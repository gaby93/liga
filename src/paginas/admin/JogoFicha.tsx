import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FichaEquipa } from '../../componentes/FichaEquipa';
import { Aviso, Botao, Campo, Carregando, Emblema, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { deInputLocal, paraInputLocal } from '../../lib/datas';
import { eventosForaDaFicha } from '../../lib/fichas';
import { decidirEliminatoria, jogosDaChave, nomeFase, precisaPenaltis } from '../../lib/formatos';
import { mensagemErro, supabase } from '../../lib/supabase';
import { ESTADO_JOGO_LABEL, type EstadoJogo, type Evento, type TipoEvento } from '../../lib/types';
import { useFichaJogo } from '../../lib/useFichaJogo';

const TIPOS: Record<TipoEvento, string> = { golo: 'Golo', autogolo: 'Autogolo', amarelo: 'Cartão amarelo', vermelho: 'Cartão vermelho' };

export default function JogoFicha() {
  const { id } = useParams();
  const f = useFichaJogo(id);
  const { jogo, setJogo, equipas, jogadores, eventos, motivoSuspensao, doJogo, erro, setErro, carregar } = f;
  const [guardado, setGuardado] = useState(false);
  const [novo, setNovo] = useState<{ tipo: TipoEvento; equipa_id: string; jogador_id: string; minuto: string }>(
    { tipo: 'golo', equipa_id: '', jogador_id: '', minuto: '' });

  if (!jogo) return erro ? <Aviso>{erro}</Aviso> : <Carregando />;

  const casa = equipas.get(jogo.casa_id);
  const fora = equipas.get(jogo.fora_id);
  const nomeJogador = new Map(jogadores.map((j) => [j.id, j]));
  // Equipa escolhida para o próximo golo ou cartão (por defeito, a da casa)
  const equipaEvento = novo.equipa_id || jogo.casa_id;

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
      jogo_id: jogo.id, equipa_id: equipaEvento, jogador_id: novo.jogador_id || null,
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

  // Golos e cartões: com ficha preenchida, só aparecem os convocados dessa equipa
  const naFicha = f.convocados(equipaEvento);
  const doPlantel = naFicha.size
    ? jogadores.filter((j) => naFicha.has(j.id))
    : jogadores.filter((j) => j.equipa_id === equipaEvento);

  const suspensos = [...motivoSuspensao]
    .filter(([jogadorId]) => { const j = nomeJogador.get(jogadorId); return j && (j.equipa_id === jogo.casa_id || j.equipa_id === jogo.fora_id); })
    .map(([jogadorId, motivo]) => ({ jogadorId, motivo, nome: nomeJogador.get(jogadorId)?.nome }));
  // Suspensos que ficaram na ficha (ex.: convocados antes do cartão que deu a suspensão) ou com eventos
  const irregulares = suspensos.filter((s) =>
    doJogo.some((c) => c.jogador_id === s.jogadorId) || eventos.some((e) => e.jogador_id === s.jogadorId));
  const foraDaFicha = eventosForaDaFicha(eventos, doJogo).map((jid) => nomeJogador.get(jid)?.nome ?? 'jogador sem ficha');

  const fichaEquipa = (equipaId: string) => (
    <FichaEquipa f={f} equipaId={equipaId}
      semJogadores={<>Sem jogadores inscritos. Registe-os na página <Link to="/admin/jogadores" className="text-relva underline">Jogadores</Link>.</>} />
  );
  const resultadoEditavel = jogo.estado === 'terminado';
  const golosWO = f.competicao?.golos_wo ?? 3;
  // Penáltis: num jogo único empatado, ou na 2.ª mão com o total empatado (conta o resultado que está no ecrã)
  const comPenaltis = resultadoEditavel && precisaPenaltis(jogo, f.jogosCompeticao, golosWO);
  // Nas duas mãos, o total das duas (com o resultado que está no ecrã)
  const agregado = jogo.mao === 2 && jogo.eliminatoria != null && jogo.chave != null
    ? decidirEliminatoria(jogosDaChave(f.jogosCompeticao, jogo.eliminatoria, jogo.chave)
      .map((j) => (j.id === jogo.id ? jogo : j)), golosWO).agregado
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/admin/competicoes/${jogo.competicao_id}?separador=${jogo.eliminatoria != null ? 'fase-final' : 'jogos'}`}
          className="text-sm font-semibold text-relva hover:underline">
          Voltar à competição
        </Link>
        {jogo.estado !== 'terminado' && jogo.estado !== 'wo_casa' && jogo.estado !== 'wo_fora' && (
          <Link to={`/admin/jogos/${jogo.id}/campo`}
            className="rounded-md bg-relva px-4 py-2 text-sm font-semibold text-white hover:bg-relva-escura">
            {jogo.estado === 'em_curso' ? 'Continuar no modo jogo' : 'Modo jogo (lançar no campo)'}
          </Link>
        )}
      </div>

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
            {nomeFase(jogo)}
            {jogo.grupo && `, Grupo ${jogo.grupo}`}
            {comPenaltis && jogo.penaltis_casa != null && ` (${jogo.penaltis_casa}–${jogo.penaltis_fora} g.p.)`}
          </div>
          {agregado && (
            <div className="mt-1 text-sm font-semibold text-cartao">
              Total das duas mãos: {agregado.get(jogo.casa_id)}–{agregado.get(jogo.fora_id)}
            </div>
          )}
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
              <p className="col-span-2 text-sm">{jogo.mao === 2 ? 'Empate no total das duas mãos' : 'Empate numa eliminatória'}: indique o resultado dos penáltis para decidir quem passa.</p>
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
            <Seletor value={equipaEvento} onChange={(e) => setNovo({ ...novo, equipa_id: e.target.value, jogador_id: '' })}>
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
