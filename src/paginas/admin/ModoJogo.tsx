import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao, Carregando, Emblema, Entrada } from '../../componentes/ui';
import {
  ROTULO_ACAO, aplicarAcao, expulsos, minutoAtual, minutoEParte, placarDosEventos, proximaAcao, type Acao,
} from '../../lib/aoVivo';
import { nomeFase, precisaPenaltis } from '../../lib/formatos';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Evento, Jogador, TipoEvento } from '../../lib/types';
import { useAgora } from '../../lib/useAgora';
import { useFichaJogo } from '../../lib/useFichaJogo';

const ROTULO: Record<TipoEvento, string> = { golo: 'Golo', autogolo: 'Autogolo', amarelo: 'Amarelo', vermelho: 'Vermelho' };
const MARCA: Record<TipoEvento, string> = {
  golo: 'h-3.5 w-3.5 rounded-full border-2 border-tinta',
  autogolo: 'h-3.5 w-3.5 rounded-full border-2 border-vermelho',
  amarelo: 'h-4 w-3 rounded-sm bg-cartao',
  vermelho: 'h-4 w-3 rounded-sm bg-vermelho',
};

// A fila de envio fica também no aparelho, para sobreviver ao fecho da app sem rede
const chaveFila = (jogoId: string) => `liga:fila:${jogoId}`;
function lerFila(jogoId: string): Evento[] {
  try { return JSON.parse(localStorage.getItem(chaveFila(jogoId)) ?? '[]'); } catch { return []; }
}
function gravarFila(jogoId: string, fila: Evento[]) {
  try {
    if (fila.length) localStorage.setItem(chaveFila(jogoId), JSON.stringify(fila));
    else localStorage.removeItem(chaveFila(jogoId));
  } catch { /* sem armazenamento: a fila fica só em memória */ }
}

/** Lançar o jogo no campo: relógio, golos e cartões com um toque, pensado para o telemóvel. */
export default function ModoJogo() {
  const { id } = useParams();
  const f = useFichaJogo(id);
  const { jogo, setJogo, eventos, setEventos } = f;
  const agora = useAgora(5000);
  const [fila, setFila] = useState<Evento[]>(() => (id ? lerFila(id) : []));
  const [falhados, setFalhados] = useState<Set<string>>(new Set());
  const [escolha, setEscolha] = useState<{ tipo: TipoEvento; equipaId: string } | null>(null);
  const [minuto, setMinuto] = useState('');
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [aAnular, setAAnular] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [penaltis, setPenaltis] = useState({ casa: '', fora: '' });
  const [tentativa, setTentativa] = useState(0);
  const filaRef = useRef(fila);
  filaRef.current = fila;

  useEffect(() => { if (id) gravarFila(id, fila); }, [id, fila]);

  // Envia um evento. O id é criado no telemóvel: repetir o envio nunca duplica.
  const enviar = useCallback(async (ev: Evento) => {
    const { error } = await supabase.from('eventos').insert(ev);
    if (!error || (error as { code?: string }).code === '23505') {
      setFila((q) => q.filter((x) => x.id !== ev.id));
      setFalhados((s) => { const n = new Set(s); n.delete(ev.id); return n; });
      setEventos((e) => (e.some((x) => x.id === ev.id) ? e : [...e, ev]));
    } else {
      setFalhados((s) => new Set(s).add(ev.id));
    }
  }, [setEventos]);

  // Ao abrir (fila guardada de uma sessão anterior) e quando a rede volta: reenvia o que falta
  useEffect(() => {
    const reenviar = () => { filaRef.current.forEach(enviar); setTentativa((t) => t + 1); };
    if (filaRef.current.length) reenviar();
    window.addEventListener('online', reenviar);
    return () => window.removeEventListener('online', reenviar);
  }, [enviar]);

  // O marcador do jogo segue os golos gravados (o público vê-o em direto)
  useEffect(() => {
    if (!jogo || jogo.estado !== 'em_curso') return;
    const [c, fo] = placarDosEventos(eventos, jogo.casa_id, jogo.fora_id);
    if (c === jogo.golos_casa && fo === jogo.golos_fora) return;
    supabase.from('jogos').update({ golos_casa: c, golos_fora: fo }).eq('id', jogo.id)
      .then(({ error }) => { if (!error) setJogo((j) => (j ? { ...j, golos_casa: c, golos_fora: fo } : j)); });
  }, [eventos, jogo, setJogo, tentativa]);

  // Mantém o ecrã aceso durante o jogo (onde o aparelho o permite)
  const aDecorrer = jogo?.estado === 'em_curso';
  useEffect(() => {
    if (!aDecorrer || !('wakeLock' in navigator)) return;
    let trinco: { release: () => Promise<void> } | null = null;
    const pedir = () => {
      if (document.visibilityState !== 'visible') return;
      (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request('screen').then((t) => { trinco = t; }).catch(() => undefined);
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => { document.removeEventListener('visibilitychange', pedir); trinco?.release().catch(() => undefined); };
  }, [aDecorrer]);

  // Aviso ao sair com eventos por enviar
  useEffect(() => {
    if (!fila.length) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [fila.length]);

  if (!jogo) return f.erro ? <Aviso>{f.erro}</Aviso> : <Carregando />;

  const casa = f.equipas.get(jogo.casa_id);
  const fora = f.equipas.get(jogo.fora_id);
  const todos = [...eventos, ...fila.filter((p) => !eventos.some((e) => e.id === p.id))];
  const [gCasa, gFora] = placarDosEventos(todos, jogo.casa_id, jogo.fora_id);
  const acao = proximaAcao(jogo);
  const expulsosAgora = expulsos(todos);
  const nomeJogador = new Map(f.jogadores.map((j) => [j.id, j]));
  const golosWO = f.competicao?.golos_wo ?? 3;
  const faltaPenaltis = jogo.estado === 'terminado' && precisaPenaltis(jogo, f.jogosCompeticao, golosWO)
    && (jogo.penaltis_casa == null || jogo.penaltis_fora == null);

  const avancar = async (a: Acao) => {
    setAviso(null);
    if (a === 'terminar') {
      if (fila.length) return setAviso('Ainda há golos ou cartões por enviar. Espere pela rede antes de terminar.');
      if (!confirmarFim) { setConfirmarFim(true); return; }
      setConfirmarFim(false);
    }
    const r = aplicarAcao(jogo, a, Date.now());
    const patch = {
      estado: r.estado, periodo: r.periodo, relogio_inicio: r.relogio_inicio, relogio_base: r.relogio_base,
      // Ao começar e ao terminar, o resultado é o dos golos registados
      ...(a === 'comecar' || a === 'terminar' ? { golos_casa: gCasa, golos_fora: gFora } : {}),
    };
    const { error } = await supabase.from('jogos').update(patch).eq('id', jogo.id);
    if (error) setAviso(`Não gravou: ${mensagemErro(error)}`);
    else setJogo({ ...jogo, ...patch });
  };

  const abrirEscolha = (tipo: TipoEvento, equipaId: string) => {
    setEscolha({ tipo, equipaId });
    setMinuto(String(minutoAtual(jogo, Date.now()) ?? ''));
  };

  const registar = (jogadorId: string | null) => {
    if (!escolha) return;
    const ev: Evento = {
      id: crypto.randomUUID(), jogo_id: jogo.id, equipa_id: escolha.equipaId, jogador_id: jogadorId,
      minuto: minuto === '' ? null : Math.max(0, Math.min(130, Number(minuto))), tipo: escolha.tipo,
    };
    setEscolha(null);
    setFila((q) => [...q, ev]);
    enviar(ev);
  };

  const anular = async (ev: Evento) => {
    if (aAnular !== ev.id) { setAAnular(ev.id); return; }
    setAAnular(null);
    // Ainda na fila (nunca chegou à base de dados): basta tirá-lo da fila
    if (!eventos.some((e) => e.id === ev.id)) {
      setFila((q) => q.filter((x) => x.id !== ev.id));
      setFalhados((s) => { const n = new Set(s); n.delete(ev.id); return n; });
      return;
    }
    const { error } = await supabase.from('eventos').delete().eq('id', ev.id);
    if (error) setAviso(`Não anulou: ${mensagemErro(error)}`);
    else setEventos((e) => e.filter((x) => x.id !== ev.id));
  };

  const gravarPenaltis = async () => {
    const pc = Number(penaltis.casa);
    const pf = Number(penaltis.fora);
    if (penaltis.casa === '' || penaltis.fora === '' || pc === pf) return setAviso('Indique os penáltis de cada equipa (não podem empatar).');
    const { error } = await supabase.from('jogos').update({ penaltis_casa: pc, penaltis_fora: pf }).eq('id', jogo.id);
    if (error) setAviso(mensagemErro(error));
    else { setJogo({ ...jogo, penaltis_casa: pc, penaltis_fora: pf }); setAviso(null); }
  };

  // Lista de jogadores para escolher: a ficha de jogo, ou o plantel se a ficha estiver vazia
  const listaDe = (equipaId: string): { lista: Jogador[]; daFicha: boolean } => {
    const naFicha = f.convocados(equipaId);
    const lista = (naFicha.size ? f.jogadores.filter((j) => naFicha.has(j.id)) : f.jogadores.filter((j) => j.equipa_id === equipaId))
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt'));
    return { lista, daFicha: naFicha.size > 0 };
  };

  const painelEquipa = (equipaId: string) => {
    const equipa = f.equipas.get(equipaId);
    const botao = (tipo: TipoEvento, cls: string) => (
      <button type="button" disabled={!aDecorrer} onClick={() => abrirEscolha(tipo, equipaId)}
        className={`flex min-h-14 items-center justify-center gap-2 rounded-lg px-2 text-base font-semibold disabled:opacity-40 ${cls}`}>
        <span aria-hidden className={MARCA[tipo]} />{ROTULO[tipo]}
      </button>
    );
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="truncate text-center font-display text-lg font-semibold">{equipa?.nome}</div>
        {botao('golo', 'bg-relva text-white [&>span]:border-white')}
        {botao('amarelo', 'border border-linha bg-white')}
        {botao('vermelho', 'border border-linha bg-white')}
        <button type="button" disabled={!aDecorrer} onClick={() => abrirEscolha('autogolo', equipaId)}
          className="rounded-md py-1.5 text-xs font-medium text-tinta/70 hover:bg-giz disabled:opacity-40">
          Autogolo de um jogador desta equipa
        </button>
      </div>
    );
  };

  const escolhida = escolha && listaDe(escolha.equipaId);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <Link to={`/admin/jogos/${jogo.id}`} className="font-semibold text-relva hover:underline">‹ Ficha do jogo</Link>
        <span className="text-tinta/60">{nomeFase(jogo)}</span>
      </div>

      {/* Marcador */}
      <div className="rounded-xl bg-tinta px-3 py-4 text-white">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Emblema url={casa?.emblema_url} nome={casa?.nome ?? '?'} tamanho={40} />
            <span className="w-full truncate text-sm font-semibold">{casa?.nome}</span>
          </div>
          <div className="font-display text-6xl font-bold tabular-nums leading-none">
            {gCasa}<span className="px-1 text-white/40">–</span>{gFora}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Emblema url={fora?.emblema_url} nome={fora?.nome ?? '?'} tamanho={40} />
            <span className="w-full truncate text-sm font-semibold">{fora?.nome}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${aDecorrer && jogo.periodo !== 'intervalo' ? 'bg-vermelho' : 'bg-white/15'}`}>
            {aDecorrer && jogo.periodo !== 'intervalo' && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />}
            {minutoEParte(jogo, agora)}
            {jogo.penaltis_casa != null && jogo.estado === 'terminado' && ` · penáltis ${jogo.penaltis_casa}–${jogo.penaltis_fora}`}
          </span>
        </div>
      </div>

      {aviso && <Aviso>{aviso}</Aviso>}
      {fila.length > 0 && (
        <Aviso tipo="info">
          {fila.length === 1 ? '1 evento por enviar' : `${fila.length} eventos por enviar`}. {falhados.size > 0
            ? 'Sem rede: será enviado sozinho quando a ligação voltar.'
            : 'A enviar…'}
        </Aviso>
      )}

      {acao && (
        <Botao variante={acao === 'terminar' ? (confirmarFim ? 'primario' : 'secundario') : 'primario'}
          className="min-h-14 text-base" onClick={() => avancar(acao)}>
          {acao === 'terminar' && confirmarFim ? `Confirmar: terminar ${gCasa}–${gFora}` : ROTULO_ACAO[acao]}
        </Botao>
      )}
      {confirmarFim && <Botao variante="secundario" onClick={() => setConfirmarFim(false)}>Continuar o jogo</Botao>}
      {!aDecorrer && jogo.estado !== 'terminado' && (
        <p className="-mt-2 text-center text-xs text-tinta/60">Os botões de golo e cartão ficam ativos quando o jogo começar.</p>
      )}

      {faltaPenaltis && (
        <div className="flex flex-col gap-3 rounded-lg border border-cartao/60 bg-cartao/10 p-3">
          <p className="text-sm font-semibold">Empate na eliminatória: resultado dos penáltis</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">{casa?.nome}
              <Entrada type="number" inputMode="numeric" min={0} value={penaltis.casa} className="mt-1 w-full"
                onChange={(e) => setPenaltis({ ...penaltis, casa: e.target.value })} />
            </label>
            <label className="text-sm">{fora?.nome}
              <Entrada type="number" inputMode="numeric" min={0} value={penaltis.fora} className="mt-1 w-full"
                onChange={(e) => setPenaltis({ ...penaltis, fora: e.target.value })} />
            </label>
          </div>
          <Botao onClick={gravarPenaltis}>Gravar penáltis</Botao>
        </div>
      )}

      {jogo.estado !== 'terminado' && (
        <div className="grid grid-cols-2 gap-3">
          {painelEquipa(jogo.casa_id)}
          {painelEquipa(jogo.fora_id)}
        </div>
      )}

      {/* Linha do tempo */}
      <section>
        <h2 className="mb-2 font-display text-xl font-semibold">Golos e cartões</h2>
        {todos.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda nada registado.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {[...todos].reverse().map((ev) => {
              const j = ev.jogador_id ? nomeJogador.get(ev.jogador_id) : undefined;
              const porEnviar = fila.some((p) => p.id === ev.id);
              return (
                <li key={ev.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-9 tabular-nums text-tinta/60">{ev.minuto != null ? `${ev.minuto}'` : ''}</span>
                  <span aria-hidden className={`shrink-0 ${MARCA[ev.tipo]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{ROTULO[ev.tipo]}</span>{' '}
                    {j ? `${j.numero != null ? `${j.numero}. ` : ''}${j.nome}` : 'jogador não identificado'}
                    <span className="block truncate text-xs text-tinta/60">
                      {f.equipas.get(ev.equipa_id)?.nome}
                      {porEnviar && (falhados.has(ev.id) ? ' · por enviar (sem rede)' : ' · a enviar…')}
                    </span>
                  </span>
                  {jogo.estado !== 'terminado' && (
                    <button type="button" onClick={() => anular(ev)}
                      className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ${aAnular === ev.id ? 'bg-vermelho text-white' : 'text-vermelho hover:bg-vermelho/10'}`}>
                      {aAnular === ev.id ? 'Anular?' : 'Anular'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {jogo.estado === 'terminado' && (
          <p className="mt-2 text-xs text-tinta/60">Jogo terminado. Para corrigir alguma coisa, use a ficha do jogo.</p>
        )}
      </section>

      {/* Escolher o jogador */}
      {escolha && escolhida && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-tinta/40" onClick={() => setEscolha(null)}>
          <div role="dialog" aria-label={`${ROTULO[escolha.tipo]}: escolher jogador`}
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <span aria-hidden className={MARCA[escolha.tipo]} />
              <h2 className="flex-1 font-display text-2xl font-semibold">
                {ROTULO[escolha.tipo]} · {f.equipas.get(escolha.equipaId)?.nome}
              </h2>
              <label className="flex items-center gap-1 text-sm">
                Min.
                <Entrada type="number" inputMode="numeric" min={0} max={130} value={minuto} className="w-16"
                  onChange={(e) => setMinuto(e.target.value)} />
              </label>
            </div>
            {!escolhida.daFicha && (
              <p className="mb-2 text-xs text-tinta/60">A ficha de jogo desta equipa está vazia: a mostrar o plantel todo.</p>
            )}
            <ul className="divide-y divide-linha rounded-lg border border-linha">
              {escolhida.lista.map((j) => {
                const motivo = f.motivoSuspensao.get(j.id);
                const expulso = expulsosAgora.has(j.id);
                return (
                  <li key={j.id}>
                    <button type="button" onClick={() => registar(j.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-giz">
                      <span className="w-7 text-right font-display text-xl font-semibold text-relva">{j.numero ?? ''}</span>
                      <span className="flex-1 font-semibold">{j.nome}</span>
                      {expulso && <span className="text-xs font-medium text-vermelho">expulso</span>}
                      {motivo && !expulso && <span className="text-xs font-medium text-vermelho">suspenso</span>}
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => registar(null)}
                  className="flex min-h-12 w-full items-center px-3 py-2 text-left text-tinta/70 hover:bg-giz">
                  Jogador não identificado
                </button>
              </li>
            </ul>
            <Botao variante="secundario" className="mt-3 w-full" onClick={() => setEscolha(null)}>Cancelar</Botao>
          </div>
        </div>
      )}
    </div>
  );
}
