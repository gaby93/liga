import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao, Campo, Carregando, Emblema, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { deInputLocal, paraInputLocal } from '../../lib/datas';
import { nomeEliminatoria } from '../../lib/formatos';
import { mensagemErro, supabase } from '../../lib/supabase';
import { calcularSuspensoes, type SuspensaoJogo } from '../../lib/suspensoes';
import {
  ESTADO_JOGO_LABEL, type Competicao, type Equipa, type EstadoJogo, type Evento, type Jogador, type Jogo, type TipoEvento,
} from '../../lib/types';

const TIPOS: Record<TipoEvento, string> = { golo: 'Golo', autogolo: 'Autogolo', amarelo: 'Cartão amarelo', vermelho: 'Cartão vermelho' };

export default function JogoFicha() {
  const { id } = useParams();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [equipas, setEquipas] = useState<Map<string, Equipa>>(new Map());
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [suspensosAuto, setSuspensosAuto] = useState<SuspensaoJogo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [novo, setNovo] = useState<{ tipo: TipoEvento; equipa_id: string; jogador_id: string; minuto: string }>(
    { tipo: 'golo', equipa_id: '', jogador_id: '', minuto: '' });

  const carregar = useCallback(async () => {
    const j = await supabase.from('jogos').select('*').eq('id', id!).single();
    if (j.error) return setErro(mensagemErro(j.error));
    const jg = j.data as Jogo;
    const ids = [jg.casa_id, jg.fora_id];
    const [e, p, ev, c, cj, cev] = await Promise.all([
      supabase.from('equipas').select('*').in('id', ids),
      supabase.from('jogadores').select('*').in('equipa_id', ids).order('numero', { nullsFirst: false }),
      supabase.from('eventos').select('*').eq('jogo_id', id!).order('minuto', { nullsFirst: false }),
      // Para as suspensões: regras, jogos e cartões de toda a competição
      supabase.from('competicoes').select('*').eq('id', jg.competicao_id).single(),
      supabase.from('jogos').select('id, jornada, casa_id, fora_id, data_hora, estado').eq('competicao_id', jg.competicao_id),
      supabase.from('eventos').select('jogo_id, equipa_id, jogador_id, tipo, jogos!inner(competicao_id)')
        .eq('jogos.competicao_id', jg.competicao_id).in('tipo', ['amarelo', 'vermelho']),
    ]);
    const falha = [c, cj, cev].find((r) => r.error);
    if (falha) setErro(mensagemErro(falha.error));
    else {
      const comp = c.data as Competicao;
      const r = calcularSuspensoes(cj.data as Jogo[], (cev.data ?? []) as unknown as Evento[], {
        amarelos: comp.amarelos_suspensao, jogosExpulsao: comp.jogos_suspensao_expulsao,
      });
      setSuspensosAuto(r.porJogo.get(jg.id) ?? []);
    }
    setJogo(jg);
    setEquipas(new Map(((e.data ?? []) as Equipa[]).map((x) => [x.id, x])));
    setJogadores((p.data ?? []) as Jogador[]);
    setEventos((ev.data ?? []) as Evento[]);
    setNovo((n) => ({ ...n, equipa_id: n.equipa_id || jg.casa_id }));
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!jogo) return erro ? <Aviso>{erro}</Aviso> : <Carregando />;

  const casa = equipas.get(jogo.casa_id);
  const fora = equipas.get(jogo.fora_id);
  const nomeJogador = new Map(jogadores.map((j) => [j.id, j]));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('jogos').update({
      data_hora: jogo.data_hora, campo: jogo.campo || null, estado: jogo.estado,
      golos_casa: jogo.golos_casa, golos_fora: jogo.golos_fora,
      // Penáltis só contam num empate de eliminatória
      penaltis_casa: comPenaltis ? jogo.penaltis_casa : null, penaltis_fora: comPenaltis ? jogo.penaltis_fora : null,
    }).eq('id', jogo.id);
    if (error) return setErro(mensagemErro(error));
    setErro(null);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  const adicionarEvento = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('eventos').insert({
      jogo_id: jogo.id, equipa_id: novo.equipa_id, jogador_id: novo.jogador_id || null,
      minuto: novo.minuto === '' ? null : Number(novo.minuto), tipo: novo.tipo,
    });
    if (error) return setErro(mensagemErro(error));
    setNovo({ ...novo, jogador_id: '', minuto: '' });
    carregar();
  };

  const apagarEvento = async (ev: Evento) => {
    const { error } = await supabase.from('eventos').delete().eq('id', ev.id);
    if (error) setErro(mensagemErro(error));
    else carregar();
  };

  // Verificação: os golos registados batem certo com o resultado?
  const golosDe = (equipa: string, adversario: string) =>
    eventos.filter((e) => (e.tipo === 'golo' && e.equipa_id === equipa) || (e.tipo === 'autogolo' && e.equipa_id === adversario)).length;
  const gCasa = golosDe(jogo.casa_id, jogo.fora_id);
  const gFora = golosDe(jogo.fora_id, jogo.casa_id);
  const temGolos = eventos.some((e) => e.tipo === 'golo' || e.tipo === 'autogolo');
  const discrepancia = jogo.estado === 'terminado' && temGolos && (gCasa !== jogo.golos_casa || gFora !== jogo.golos_fora);

  const doPlantel = jogadores.filter((j) => j.equipa_id === novo.equipa_id);
  // Suspensos neste jogo: automáticos (cartões) + manuais (ficha do jogador)
  const motivoSuspensao = new Map(suspensosAuto.map((s) => [s.jogadorId, s.motivo]));
  for (const j of jogadores) if (j.suspenso && !motivoSuspensao.has(j.id)) motivoSuspensao.set(j.id, 'suspensão manual');
  const suspensos = [...motivoSuspensao].map(([jogadorId, motivo]) => ({ jogadorId, motivo, nome: nomeJogador.get(jogadorId)?.nome }));
  const irregulares = suspensos.filter((s) => eventos.some((e) => e.jogador_id === s.jogadorId));
  const resultadoEditavel = jogo.estado === 'terminado';
  const comPenaltis = resultadoEditavel && jogo.eliminatoria != null && jogo.golos_casa != null && jogo.golos_casa === jogo.golos_fora;

  return (
    <>
      <Link to={`/admin/competicoes/${jogo.competicao_id}`} className="text-sm font-semibold text-relva hover:underline">
        Voltar à competição
      </Link>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg bg-tinta px-4 py-6 text-white">
        <div className="flex flex-col items-center gap-2 text-center">
          <Emblema url={casa?.emblema_url} nome={casa?.nome ?? '?'} tamanho={48} />
          <span className="font-display text-xl font-semibold">{casa?.nome}</span>
        </div>
        <div className="text-center">
          <div className="font-display text-5xl font-bold tabular-nums">
            {jogo.golos_casa ?? '–'}<span className="px-2 text-white/40">:</span>{jogo.golos_fora ?? '–'}
          </div>
          <div className="text-xs text-white/70">
            {jogo.eliminatoria != null ? nomeEliminatoria(jogo.eliminatoria) : `Jornada ${jogo.jornada}`}
            {jogo.grupo && `, Grupo ${jogo.grupo}`}
            {comPenaltis && jogo.penaltis_casa != null && ` (${jogo.penaltis_casa}–${jogo.penaltis_fora} g.p.)`}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <Emblema url={fora?.emblema_url} nome={fora?.nome ?? '?'} tamanho={48} />
          <span className="font-display text-xl font-semibold">{fora?.nome}</span>
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {suspensos.length > 0 && (
        <Aviso tipo="info">
          Suspensos nesta partida: {suspensos.map((s) => `${s.nome ?? 'jogador sem ficha'} (${s.motivo})`).join(', ')}.
        </Aviso>
      )}
      {irregulares.length > 0 && (
        <Aviso>
          {irregulares.map((s) => s.nome).join(', ')} {irregulares.length === 1 ? 'estava suspenso e tem' : 'estavam suspensos e têm'} golos
          ou cartões registados neste jogo. Confirme se houve utilização irregular.
        </Aviso>
      )}

      <Seccao titulo="Resultado">
        <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Estado">
            <Seletor value={jogo.estado} onChange={(e) => setJogo({ ...jogo, estado: e.target.value as EstadoJogo })}>
              {Object.entries(ESTADO_JOGO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Data e hora">
            <Entrada type="datetime-local" value={paraInputLocal(jogo.data_hora)}
              onChange={(e) => setJogo({ ...jogo, data_hora: deInputLocal(e.target.value) })} />
          </Campo>
          <Campo rotulo="Campo">
            <Entrada value={jogo.campo ?? ''} onChange={(e) => setJogo({ ...jogo, campo: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo={`Golos ${casa?.nome ?? 'casa'}`}>
              <Entrada type="number" min={0} disabled={!resultadoEditavel} value={jogo.golos_casa ?? ''}
                onChange={(e) => setJogo({ ...jogo, golos_casa: e.target.value === '' ? null : Number(e.target.value) })} />
            </Campo>
            <Campo rotulo={`Golos ${fora?.nome ?? 'fora'}`}>
              <Entrada type="number" min={0} disabled={!resultadoEditavel} value={jogo.golos_fora ?? ''}
                onChange={(e) => setJogo({ ...jogo, golos_fora: e.target.value === '' ? null : Number(e.target.value) })} />
            </Campo>
          </div>
          {comPenaltis && (
            <div className="grid grid-cols-2 gap-3 rounded-md border border-cartao/60 bg-cartao/10 p-3 sm:col-span-2">
              <p className="col-span-2 text-sm">Empate numa eliminatória: indique o resultado dos penáltis para decidir quem passa.</p>
              <Campo rotulo={`Penáltis ${casa?.nome ?? 'casa'}`}>
                <Entrada type="number" min={0} value={jogo.penaltis_casa ?? ''}
                  onChange={(e) => setJogo({ ...jogo, penaltis_casa: e.target.value === '' ? null : Number(e.target.value) })} />
              </Campo>
              <Campo rotulo={`Penáltis ${fora?.nome ?? 'fora'}`}>
                <Entrada type="number" min={0} value={jogo.penaltis_fora ?? ''}
                  onChange={(e) => setJogo({ ...jogo, penaltis_fora: e.target.value === '' ? null : Number(e.target.value) })} />
              </Campo>
            </div>
          )}
          {discrepancia && (
            <div className="sm:col-span-2">
              <Aviso tipo="info">Os golos registados abaixo dão {gCasa}–{gFora}, mas o resultado indicado é {jogo.golos_casa}–{jogo.golos_fora}.</Aviso>
            </div>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Botao type="submit">Guardar resultado</Botao>
            {guardado && <span role="status" className="text-sm text-relva">Resultado guardado. O portal já foi atualizado.</span>}
          </div>
        </form>
      </Seccao>

      <Seccao titulo="Golos e cartões">
        <form onSubmit={adicionarEvento} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_5rem_auto] sm:items-end">
          <Campo rotulo="Tipo">
            <Seletor value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoEvento })}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seletor>
          </Campo>
          <Campo rotulo="Equipa do jogador">
            <Seletor value={novo.equipa_id} onChange={(e) => setNovo({ ...novo, equipa_id: e.target.value, jogador_id: '' })}>
              <option value={jogo.casa_id}>{casa?.nome}</option>
              <option value={jogo.fora_id}>{fora?.nome}</option>
            </Seletor>
          </Campo>
          <Campo rotulo="Jogador">
            <Seletor value={novo.jogador_id} onChange={(e) => setNovo({ ...novo, jogador_id: e.target.value })}>
              <option value="">Não identificado</option>
              {doPlantel.map((j) => (
                <option key={j.id} value={j.id}>{j.numero != null ? `${j.numero}. ` : ''}{j.nome}{motivoSuspensao.has(j.id) ? ' (suspenso)' : ''}</option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Minuto">
            <Entrada type="number" min={0} max={130} value={novo.minuto} onChange={(e) => setNovo({ ...novo, minuto: e.target.value })} />
          </Campo>
          <Botao type="submit">Registar</Botao>
        </form>

        {eventos.length === 0 ? (
          <p className="text-sm text-tinta/70">Sem golos nem cartões registados.</p>
        ) : (
          <ul className="divide-y divide-linha text-sm">
            {eventos.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 py-2">
                <span className="w-10 tabular-nums text-tinta/60">{ev.minuto != null ? `${ev.minuto}'` : ''}</span>
                {ev.tipo === 'amarelo' || ev.tipo === 'vermelho' ? (
                  <span aria-hidden className={`h-4 w-3 rounded-sm ${ev.tipo === 'amarelo' ? 'bg-cartao' : 'bg-vermelho'}`} />
                ) : (
                  <span aria-hidden className="h-3 w-3 rounded-full border-2 border-tinta" />
                )}
                <span className="flex-1">
                  <span className="font-semibold">{TIPOS[ev.tipo]}</span>{' '}
                  {ev.jogador_id ? nomeJogador.get(ev.jogador_id)?.nome : 'jogador não identificado'}
                  <span className="text-tinta/60"> ({equipas.get(ev.equipa_id)?.nome})</span>
                </span>
                <Botao variante="perigo" onClick={() => apagarEvento(ev)}>Apagar</Botao>
              </li>
            ))}
          </ul>
        )}
      </Seccao>
    </>
  );
}
