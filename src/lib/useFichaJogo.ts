import { useCallback, useEffect, useMemo, useState } from 'react';
import { mensagemErro, supabase } from './supabase';
import { calcularSuspensoes, type SuspensaoJogo } from './suspensoes';
import type { Competicao, Convocatoria, Equipa, Evento, Jogador, Jogo } from './types';

/**
 * Tudo o que a ficha de um jogo precisa: o jogo, as duas equipas e os planteis,
 * os eventos, as suspensões para este jogo e as fichas da competição (para
 * "Copiar do jogo anterior"). Usado pelo backoffice e pela área da equipa.
 */
export function useFichaJogo(jogoId: string | undefined) {
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [equipas, setEquipas] = useState<Map<string, Equipa>>(new Map());
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [suspensosAuto, setSuspensosAuto] = useState<SuspensaoJogo[]>([]);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [jogosCompeticao, setJogosCompeticao] = useState<Jogo[]>([]);
  const [competicao, setCompeticao] = useState<Competicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!jogoId) return;
    const j = await supabase.from('jogos').select('*').eq('id', jogoId).single();
    if (j.error) return setErro(mensagemErro(j.error));
    const jg = j.data as Jogo;
    const ids = [jg.casa_id, jg.fora_id];
    const [e, p, ev, c, cj, cev, cv] = await Promise.all([
      supabase.from('equipas').select('*').in('id', ids),
      supabase.from('jogadores').select('*').in('equipa_id', ids).order('numero', { nullsFirst: false }),
      supabase.from('eventos').select('*').eq('jogo_id', jogoId).order('minuto', { nullsFirst: false }),
      // Para as suspensões: regras, jogos e cartões de toda a competição
      supabase.from('competicoes').select('*').eq('id', jg.competicao_id).single(),
      supabase.from('jogos').select('*').eq('competicao_id', jg.competicao_id),
      supabase.from('eventos').select('jogo_id, equipa_id, jogador_id, tipo, jogos!inner(competicao_id)')
        .eq('jogos.competicao_id', jg.competicao_id).in('tipo', ['amarelo', 'vermelho']),
      // Fichas de toda a competição, para copiar a do jogo anterior
      supabase.from('convocatorias').select('jogo_id, jogador_id, equipa_id, jogos!inner(competicao_id)')
        .eq('jogos.competicao_id', jg.competicao_id),
    ]);
    const falha = [c, cj, cev, cv].find((r) => r.error);
    if (falha) setErro(mensagemErro(falha.error));
    else {
      const comp = c.data as Competicao;
      const r = calcularSuspensoes(cj.data as Jogo[], (cev.data ?? []) as unknown as Evento[], {
        amarelos: comp.amarelos_suspensao, jogosExpulsao: comp.jogos_suspensao_expulsao,
      });
      setSuspensosAuto(r.porJogo.get(jg.id) ?? []);
      setJogosCompeticao(cj.data as Jogo[]);
      setCompeticao(comp);
      setConvocatorias((cv.data ?? []).map(({ jogos: _j, ...x }) => x as Convocatoria));
    }
    setJogo(jg);
    setEquipas(new Map(((e.data ?? []) as Equipa[]).map((x) => [x.id, x])));
    // Convocados que entretanto mudaram de equipa continuam a precisar do nome
    const plantel = (p.data ?? []) as Jogador[];
    const emFalta = [...new Set((cv.data ?? []).filter((x) => x.jogo_id === jg.id).map((x) => x.jogador_id))]
      .filter((jid) => !plantel.some((x) => x.id === jid));
    const extra = emFalta.length ? ((await supabase.from('jogadores').select('*').in('id', emFalta)).data ?? []) as Jogador[] : [];
    setJogadores([...plantel, ...extra]);
    setEventos((ev.data ?? []) as Evento[]);
  }, [jogoId]);
  useEffect(() => { carregar(); }, [carregar]);

  // Suspensos neste jogo: automáticos (cartões) + manuais (ficha do jogador)
  const motivoSuspensao = useMemo(() => {
    const m = new Map(suspensosAuto.map((s) => [s.jogadorId, s.motivo]));
    for (const j of jogadores) if (j.suspenso && !m.has(j.id)) m.set(j.id, 'suspensão manual');
    return m;
  }, [suspensosAuto, jogadores]);

  const doJogo = useMemo(() => convocatorias.filter((c) => c.jogo_id === jogo?.id), [convocatorias, jogo?.id]);
  const convocados = useCallback(
    (equipaId: string) => new Set(doJogo.filter((c) => c.equipa_id === equipaId).map((c) => c.jogador_id)), [doJogo]);

  // Cada alteração da ficha vai logo para a base de dados; o ecrã responde já
  const gravarFicha = async (acao: () => PromiseLike<{ error: unknown }>, local: (atual: Convocatoria[]) => Convocatoria[]) => {
    setConvocatorias(local);
    const { error } = await acao();
    if (error) { setErro(mensagemErro(error)); carregar(); } else setErro(null);
  };
  const alternar = (jogadorId: string, equipaId: string, marcar: boolean) => {
    if (!jogo) return;
    return gravarFicha(
      () => marcar
        ? supabase.from('convocatorias').insert({ jogo_id: jogo.id, jogador_id: jogadorId, equipa_id: equipaId })
        : supabase.from('convocatorias').delete().eq('jogo_id', jogo.id).eq('jogador_id', jogadorId),
      (atual) => marcar
        ? [...atual, { jogo_id: jogo.id, jogador_id: jogadorId, equipa_id: equipaId }]
        : atual.filter((c) => !(c.jogo_id === jogo.id && c.jogador_id === jogadorId)),
    );
  };
  const acrescentar = (equipaId: string, jogadorIds: string[]) => {
    if (!jogo) return;
    const ja = convocados(equipaId);
    const novos = jogadorIds.filter((jid) => !ja.has(jid)).map((jogador_id) => ({ jogo_id: jogo.id, jogador_id, equipa_id: equipaId }));
    if (novos.length) return gravarFicha(() => supabase.from('convocatorias').insert(novos), (atual) => [...atual, ...novos]);
  };
  const limpar = (equipaId: string) => {
    if (!jogo) return;
    return gravarFicha(
      () => supabase.from('convocatorias').delete().eq('jogo_id', jogo.id).eq('equipa_id', equipaId),
      (atual) => atual.filter((c) => !(c.jogo_id === jogo.id && c.equipa_id === equipaId)),
    );
  };

  return {
    jogo, setJogo, competicao, equipas, jogadores, eventos, setEventos, convocatorias, jogosCompeticao, motivoSuspensao,
    doJogo, convocados, alternar, acrescentar, limpar, erro, setErro, carregar,
  };
}

export type FichaJogo = ReturnType<typeof useFichaJogo>;
