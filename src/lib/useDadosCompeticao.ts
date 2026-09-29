import { useCallback, useEffect, useMemo, useState } from 'react';
import { calcularClassificacao, calcularFairPlay, type Linha } from './classificacao';
import { potenciaDe2 } from './formatos';
import { mensagemErro, supabase } from './supabase';
import { calcularSuspensoes, type SuspensaoAtiva } from './suspensoes';
import { jogosDisputados } from './fichas';
import type { Competicao, Convocatoria, Equipa, Evento, Jogador, Jogo, Participante, Sancao } from './types';

export interface Marcador {
  jogador: Jogador;
  golos: number;
}

export interface RegistoDisciplina {
  jogador: Jogador;
  amarelos: number;
  vermelhos: number;
}

export interface EstatisticasJogador {
  golos: number;
  autogolos: number;
  amarelos: number;
  vermelhos: number;
  /** Jogos disputados: convocado na ficha de um jogo terminado. */
  jogos: number;
}

export interface DadosCompeticao {
  competicao: Competicao | null;
  participantes: Participante[];
  equipas: Map<string, Equipa>;
  jogadores: Map<string, Jogador>;
  jogos: Jogo[];
  eventos: Evento[];
  sancoes: Sancao[];
  convocatorias: Convocatoria[];
  /** Tabela do formato liga (vazia nos outros formatos). */
  tabela: Linha[];
  /** Tabelas da fase de grupos, por ordem de grupo. */
  grupos: { grupo: string; linhas: Linha[] }[];
  /** Quadro da fase final: posição → equipa (null = lugar vazio). Vazio se ainda não foi gerado. */
  quadro: (string | null)[];
  estatisticas: Map<string, EstatisticasJogador>;
  marcadores: Marcador[];
  disciplina: RegistoDisciplina[];
  /** Suspensões automáticas por cumprir, por jogador. */
  suspensoes: Map<string, SuspensaoAtiva>;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

interface Base {
  competicao: Competicao | null;
  participantes: Participante[];
  equipas: Map<string, Equipa>;
  jogadores: Map<string, Jogador>;
  jogos: Jogo[];
  eventos: Evento[];
  sancoes: Sancao[];
  convocatorias: Convocatoria[];
}

const vazio: Base = {
  competicao: null, participantes: [], equipas: new Map(), jogadores: new Map(),
  jogos: [], eventos: [], sancoes: [], convocatorias: [],
};

/** Carrega tudo o que uma competição precisa e mantém-se atualizado em tempo real. */
export function useDadosCompeticao(id: string | undefined): DadosCompeticao {
  const [base, setBase] = useState<Base>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!id) return;
    try {
      const [c, p, j, s, ev, cv] = await Promise.all([
        supabase.from('competicoes').select('*').eq('id', id).single(),
        supabase.from('participantes').select('ordem_sorteio, grupo, posicao_quadro, equipa:equipas(*)').eq('competicao_id', id),
        supabase.from('jogos').select('*').eq('competicao_id', id)
          .order('jornada').order('data_hora', { nullsFirst: false }),
        supabase.from('sancoes').select('*').eq('competicao_id', id),
        supabase.from('eventos').select('*, jogos!inner(competicao_id)').eq('jogos.competicao_id', id),
        supabase.from('convocatorias').select('jogo_id, jogador_id, equipa_id, jogos!inner(competicao_id)').eq('jogos.competicao_id', id),
      ]);
      const falha = [c, p, j, s, ev, cv].find((r) => r.error);
      if (falha) throw falha.error;

      const linhas = (p.data ?? []) as unknown as (Omit<Participante, 'equipa_id'> & { equipa: Equipa })[];
      const equipas = new Map(linhas.map((l) => [l.equipa.id, l.equipa]));
      const participantes = linhas.map(({ equipa, ...l }) => ({ ...l, equipa_id: equipa.id }));

      let jogadores: Jogador[] = [];
      if (equipas.size) {
        const r = await supabase.from('jogadores').select('*').in('equipa_id', [...equipas.keys()]);
        if (r.error) throw r.error;
        jogadores = r.data as Jogador[];
      }

      setBase({
        competicao: c.data as Competicao,
        participantes,
        equipas,
        jogadores: new Map(jogadores.map((x) => [x.id, x])),
        jogos: j.data as Jogo[],
        eventos: (ev.data ?? []).map(({ jogos: _j, ...e }) => e as Evento),
        sancoes: s.data as Sancao[],
        convocatorias: (cv.data ?? []).map(({ jogos: _j, ...x }) => x as Convocatoria),
      });
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    setBase(vazio);
    recarregar();

    let atraso: ReturnType<typeof setTimeout> | undefined;
    const agendar = () => {
      clearTimeout(atraso);
      atraso = setTimeout(recarregar, 400);
    };
    const canal = supabase
      .channel(`competicao-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogos', filter: `competicao_id=eq.${id}` }, agendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, agendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'convocatorias' }, agendar)
      .subscribe();

    // Plano B: se o tempo real falhar (ex.: limite de ligações), atualiza a cada 30 s
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') recarregar();
    }, 30000);

    return () => {
      clearTimeout(atraso);
      clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, [id, recarregar]);

  const { tabela, grupos } = useMemo(() => {
    const c = base.competicao;
    if (!c || c.formato === 'eliminatorias') return { tabela: [], grupos: [] };
    const fairPlay = calcularFairPlay(base.eventos);
    // Só os jogos de campeonato contam para a tabela; os de eliminatória não
    const doCampeonato = base.jogos.filter((j) => j.eliminatoria == null);
    const classificar = (participantes: Participante[], jogos: Jogo[]) => calcularClassificacao({
      equipas: participantes.map((p) => ({
        id: p.equipa_id, nome: base.equipas.get(p.equipa_id)!.nome, ordemSorteio: p.ordem_sorteio,
      })),
      jogos: jogos.map((j) => ({
        casaId: j.casa_id, foraId: j.fora_id, golosCasa: j.golos_casa, golosFora: j.golos_fora, estado: j.estado,
      })),
      regras: { vitoria: c.pts_vitoria, empate: c.pts_empate, derrota: c.pts_derrota, golosWO: c.golos_wo },
      criterios: c.criterios,
      sancoes: base.sancoes.map((s) => ({ equipaId: s.equipa_id, pontos: s.pontos })),
      fairPlay,
    });

    if (c.formato === 'liga') return { tabela: classificar(base.participantes, doCampeonato), grupos: [] };
    const nomes = [...new Set(base.participantes.map((p) => p.grupo).filter((g): g is string => Boolean(g)))].sort();
    return {
      tabela: [],
      grupos: nomes.map((g) => ({
        grupo: g,
        linhas: classificar(base.participantes.filter((p) => p.grupo === g), doCampeonato.filter((j) => j.grupo === g)),
      })),
    };
  }, [base]);

  // Posição de cada equipa no quadro da fase final (null = lugar vazio)
  const quadro = useMemo(() => {
    const noQuadro = base.participantes.filter((p) => p.posicao_quadro != null);
    const q: (string | null)[] = Array(noQuadro.length ? potenciaDe2(noQuadro.length) : 0).fill(null);
    for (const p of noQuadro) q[p.posicao_quadro!] = p.equipa_id;
    return q;
  }, [base]);

  const { marcadores, disciplina, estatisticas } = useMemo(() => {
    const estatisticas = new Map<string, EstatisticasJogador>();
    const de = (id: string) => {
      const s = estatisticas.get(id) ?? { golos: 0, autogolos: 0, amarelos: 0, vermelhos: 0, jogos: 0 };
      estatisticas.set(id, s);
      return s;
    };
    for (const e of base.eventos) {
      if (!e.jogador_id || !base.jogadores.has(e.jogador_id)) continue;
      const s = de(e.jogador_id);
      if (e.tipo === 'golo') s.golos++;
      else if (e.tipo === 'autogolo') s.autogolos++;
      else if (e.tipo === 'amarelo') s.amarelos++;
      else s.vermelhos++;
    }
    for (const [id, n] of jogosDisputados(base.jogos, base.convocatorias))
      if (base.jogadores.has(id)) de(id).jogos = n;

    const lista = [...estatisticas].map(([id, s]) => ({ jogador: base.jogadores.get(id)!, ...s }));
    return {
      estatisticas,
      marcadores: lista.filter((r) => r.golos > 0)
        .sort((a, b) => b.golos - a.golos || a.jogador.nome.localeCompare(b.jogador.nome, 'pt')),
      disciplina: lista.filter((r) => r.amarelos + r.vermelhos > 0)
        .sort((a, b) => b.vermelhos * 3 + b.amarelos - (a.vermelhos * 3 + a.amarelos)),
    };
  }, [base]);

  const suspensoes = useMemo(() => {
    const c = base.competicao;
    if (!c) return new Map<string, SuspensaoAtiva>();
    return calcularSuspensoes(base.jogos, base.eventos, {
      amarelos: c.amarelos_suspensao, jogosExpulsao: c.jogos_suspensao_expulsao,
    }).ativas;
  }, [base]);

  return { ...base, tabela, grupos, quadro, marcadores, disciplina, estatisticas, suspensoes, carregando, erro, recarregar };
}
