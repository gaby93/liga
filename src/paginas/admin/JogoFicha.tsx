import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao, Campo, Carregando, Emblema, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { deInputLocal, paraInputLocal } from '../../lib/datas';
import { nomeEliminatoria } from '../../lib/formatos';
import { mensagemErro, supabase } from '../../lib/supabase';
import { eventosForaDaFicha, fichaAnterior } from '../../lib/fichas';
import { calcularSuspensoes, type JogoSusp, type SuspensaoJogo } from '../../lib/suspensoes';
import {
  ESTADO_JOGO_LABEL, type Competicao, type Convocatoria, type Equipa, type EstadoJogo, type Evento, type Jogador, type Jogo,
  type TipoEvento,
} from '../../lib/types';

const TIPOS: Record<TipoEvento, string> = { golo: 'Golo', autogolo: 'Autogolo', amarelo: 'Cartão amarelo', vermelho: 'Cartão vermelho' };

export default function JogoFicha() {
  const { id } = useParams();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [equipas, setEquipas] = useState<Map<string, Equipa>>(new Map());
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [suspensosAuto, setSuspensosAuto] = useState<SuspensaoJogo[]>([]);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [jogosCompeticao, setJogosCompeticao] = useState<JogoSusp[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [novo, setNovo] = useState<{ tipo: TipoEvento; equipa_id: string; jogador_id: string; minuto: string }>(
    { tipo: 'golo', equipa_id: '', jogador_id: '', minuto: '' });

  const carregar = useCallback(async () => {
    const j = await supabase.from('jogos').select('*').eq('id', id!).single();
    if (j.error) return setErro(mensagemErro(j.error));
    const jg = j.data as Jogo;
    const ids = [jg.casa_id, jg.fora_id];
    const [e, p, ev, c, cj, cev, cv] = await Promise.all([
      supabase.from('equipas').select('*').in('id', ids),
      supabase.from('jogadores').select('*').in('equipa_id', ids).order('numero', { nullsFirst: false }),
      supabase.from('eventos').select('*').eq('jogo_id', id!).order('minuto', { nullsFirst: false }),
      // Para as suspensões: regras, jogos e cartões de toda a competição
      supabase.from('competicoes').select('*').eq('id', jg.competicao_id).single(),
      supabase.from('jogos').select('id, jornada, casa_id, fora_id, data_hora, estado').eq('competicao_id', jg.competicao_id),
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
      setJogosCompeticao(cj.data as JogoSusp[]);
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

  // Ficha deste jogo
  const doJogo = convocatorias.filter((c) => c.jogo_id === jogo.id);
  const convocados = (equipaId: string) => new Set(doJogo.filter((c) => c.equipa_id === equipaId).map((c) => c.jogador_id));

  // Golos e cartões: com ficha preenchida, só aparecem os convocados dessa equipa
  const naFicha = convocados(novo.equipa_id);
  const doPlantel = naFicha.size
    ? jogadores.filter((j) => naFicha.has(j.id))
    : jogadores.filter((j) => j.equipa_id === novo.equipa_id);

  // Suspensos neste jogo: automáticos (cartões) + manuais (ficha do jogador)
  const motivoSuspensao = new Map(suspensosAuto.map((s) => [s.jogadorId, s.motivo]));
  for (const j of jogadores) if (j.suspenso && !motivoSuspensao.has(j.id)) motivoSuspensao.set(j.id, 'suspensão manual');
  const suspensos = [...motivoSuspensao]
    .filter(([jogadorId]) => { const j = nomeJogador.get(jogadorId); return j && (j.equipa_id === jogo.casa_id || j.equipa_id === jogo.fora_id); })
    .map(([jogadorId, motivo]) => ({ jogadorId, motivo, nome: nomeJogador.get(jogadorId)?.nome }));
  // Suspensos que ficaram na ficha (ex.: convocados antes do cartão que deu a suspensão) ou com eventos
  const irregulares = suspensos.filter((s) =>
    doJogo.some((c) => c.jogador_id === s.jogadorId) || eventos.some((e) => e.jogador_id === s.jogadorId));
  const foraDaFicha = eventosForaDaFicha(eventos, doJogo).map((jid) => nomeJogador.get(jid)?.nome ?? 'jogador sem ficha');

  // Gravar a ficha: cada alteração vai logo para a base de dados
  const gravarFicha = async (acao: () => PromiseLike<{ error: unknown }>, local: (atual: Convocatoria[]) => Convocatoria[]) => {
    setConvocatorias(local);  // resposta imediata no ecrã
    const { error } = await acao();
    if (error) { setErro(mensagemErro(error)); carregar(); } else setErro(null);
  };
  const alternar = (jogadorId: string, equipaId: string, marcar: boolean) => gravarFicha(
    () => marcar
      ? supabase.from('convocatorias').insert({ jogo_id: jogo.id, jogador_id: jogadorId, equipa_id: equipaId })
      : supabase.from('convocatorias').delete().eq('jogo_id', jogo.id).eq('jogador_id', jogadorId),
    (atual) => marcar
      ? [...atual, { jogo_id: jogo.id, jogador_id: jogadorId, equipa_id: equipaId }]
      : atual.filter((c) => !(c.jogo_id === jogo.id && c.jogador_id === jogadorId)),
  );
  const acrescentar = (equipaId: string, jogadorIds: string[]) => {
    const ja = convocados(equipaId);
    const novos = jogadorIds.filter((jid) => !ja.has(jid)).map((jogador_id) => ({ jogo_id: jogo.id, jogador_id, equipa_id: equipaId }));
    if (novos.length) gravarFicha(() => supabase.from('convocatorias').insert(novos), (atual) => [...atual, ...novos]);
  };
  const limpar = (equipaId: string) => gravarFicha(
    () => supabase.from('convocatorias').delete().eq('jogo_id', jogo.id).eq('equipa_id', equipaId),
    (atual) => atual.filter((c) => !(c.jogo_id === jogo.id && c.equipa_id === equipaId)),
  );

  const fichaEquipa = (equipaId: string) => {
    const equipa = equipas.get(equipaId);
    const marcados = convocados(equipaId);
    // Plantel atual + convocados que já saíram da equipa
    const lista = jogadores.filter((j) => j.equipa_id === equipaId || marcados.has(j.id));
    const disponiveis = lista.filter((j) => j.equipa_id === equipaId && !motivoSuspensao.has(j.id)).map((j) => j.id);
    const anterior = fichaAnterior(jogosCompeticao, convocatorias, equipaId, jogo.id);
    const aCopiar = anterior?.jogadores.filter((jid) => disponiveis.includes(jid)) ?? [];
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xl font-semibold">{equipa?.nome}</h3>
          <span className="text-sm text-tinta/60">{marcados.size} convocados</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Botao variante="secundario" disabled={!aCopiar.length} onClick={() => acrescentar(equipaId, aCopiar)}
            title={anterior ? 'Marca quem jogou no jogo anterior (sem os suspensos)' : 'Ainda não há ficha anterior desta equipa'}>
            Copiar do jogo anterior
          </Botao>
          <Botao variante="secundario" disabled={!disponiveis.length} onClick={() => acrescentar(equipaId, disponiveis)}>
            Todos os disponíveis
          </Botao>
          {marcados.size > 0 && <Botao variante="perigo" onClick={() => limpar(equipaId)}>Limpar</Botao>}
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-tinta/70">
            Sem jogadores inscritos. Registe-os na página <Link to="/admin/jogadores" className="text-relva underline">Jogadores</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-linha rounded-md border border-linha">
            {lista.map((j) => {
              const motivo = motivoSuspensao.get(j.id);
              const marcado = marcados.has(j.id);
              // Um suspenso não se pode convocar; se já estiver marcado, pode-se desmarcar
              const bloqueado = Boolean(motivo) && !marcado;
              return (
                <li key={j.id}>
                  <label className={`flex items-center gap-3 px-3 py-2 text-sm ${bloqueado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-giz'}`}>
                    <input type="checkbox" className="h-4 w-4 accent-relva" checked={marcado} disabled={bloqueado}
                      onChange={(e) => alternar(j.id, equipaId, e.target.checked)} />
                    <span className="w-6 text-right font-display text-base font-semibold text-relva">{j.numero ?? ''}</span>
                    <span className="flex-1">{j.nome}</span>
                    {motivo && <span className="text-xs font-medium text-vermelho">Suspenso: {motivo}</span>}
                    {j.equipa_id !== equipaId && <span className="text-xs text-tinta/60">já não está na equipa</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };
  const resultadoEditavel = jogo.estado === 'terminado';
  const comPenaltis = resultadoEditavel && jogo.eliminatoria != null && jogo.golos_casa != null && jogo.golos_casa === jogo.golos_fora;

  return (
    <>
      <Link to={`/admin/competicoes/${jogo.competicao_id}?separador=${jogo.eliminatoria != null ? 'fase-final' : 'jogos'}`}
        className="text-sm font-semibold text-relva hover:underline">
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
          {irregulares.map((s) => s.nome).join(', ')} {irregulares.length === 1 ? 'está suspenso' : 'estão suspensos'} e
          {irregulares.length === 1 ? ' consta' : ' constam'} da ficha ou tem golos e cartões neste jogo. Confirme se houve
          utilização irregular.
        </Aviso>
      )}
      {foraDaFicha.length > 0 && (
        <Aviso tipo="info">
          {foraDaFicha.join(', ')} {foraDaFicha.length === 1 ? 'tem' : 'têm'} golos ou cartões mas não {foraDaFicha.length === 1 ? 'está' : 'estão'} na
          ficha de jogo. Acrescente-{foraDaFicha.length === 1 ? 'o' : 'os'} à ficha para contar o jogo.
        </Aviso>
      )}

      <Seccao titulo="Ficha de jogo">
        <p className="mb-4 text-sm text-tinta/70">
          Marque quem joga. Cada alteração fica gravada logo. Os suspensos não se podem convocar, e nos golos e cartões
          só aparecem os convocados.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {fichaEquipa(jogo.casa_id)}
          {fichaEquipa(jogo.fora_id)}
        </div>
      </Seccao>

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
