import { useState } from 'react';
import { TIPOS_AVISO, type TipoAviso } from '../lib/notificacoes';
import { suporte, useNotificacoes, type Suporte } from '../lib/usarNotificacoes';
import { Aviso, Botao } from './ui';

function Sino({ ativo, className = '' }: { ativo: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill={ativo ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** Explicação quando o aparelho não pode (ainda) receber notificações. */
function MotivoSemNotificacoes({ estado }: { estado: Suporte }) {
  if (estado === 'iphone_sem_instalar')
    return (
      <Aviso tipo="info">
        No iPhone, as notificações só funcionam com a app instalada: no Safari, toque em <strong>Partilhar</strong> e em{' '}
        <strong>Adicionar ao ecrã principal</strong>. Depois abra a app pelo ícone e ative aqui.
      </Aviso>
    );
  if (estado === 'bloqueado')
    return <Aviso>As notificações estão bloqueadas para este site. Pode ativá-las nas definições do browser (ícone ao lado do endereço).</Aviso>;
  if (estado === 'sem_suporte') return <Aviso>Este browser não recebe notificações. Experimente o Chrome, o Edge ou o Safari atualizados.</Aviso>;
  return null;
}

/** Sino no cabeçalho da competição: abre as escolhas de notificações. */
export function SinoCompeticao({ competicaoId, nome }: { competicaoId: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const n = useNotificacoes();
  if (n.estado === 'nao_configurado') return null;
  const ativo = n.segueCompeticao(competicaoId);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label={`Notificações de ${nome}`} title="Notificações"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-white ${
          ativo ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`}>
        <Sino ativo={ativo} className="h-5 w-5" />
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <div role="dialog" aria-label="Notificações" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-5 text-tinta shadow-xl sm:rounded-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Notificações</h2>
                <p className="text-sm text-tinta/60">{nome}</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"
                className="rounded-lg px-2 py-1 text-tinta/50 hover:bg-giz hover:text-tinta">✕</button>
            </div>
            {n.estado !== 'disponivel' ? <MotivoSemNotificacoes estado={n.estado} /> : (
              <div className="flex flex-col gap-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-linha p-3.5">
                  <span>
                    <span className="block font-semibold">Receber notificações desta competição</span>
                    <span className="block text-xs text-tinta/60">De todos os jogos. Marcar a competição como favorita (☆) também liga isto. Para uma só equipa, use "Seguir" na página dela.</span>
                  </span>
                  <Interruptor ativo={ativo} desativado={n.aTratar} onMudar={() => n.alternarCompeticao(competicaoId)} />
                </label>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-relva">Avisar de</legend>
                  {(Object.keys(TIPOS_AVISO) as TipoAviso[]).map((t) => (
                    <label key={t} className="flex items-center gap-2.5 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-relva" disabled={n.aTratar}
                        checked={n.prefs.tipos.includes(t)}
                        onChange={(e) => n.mudarTipos(e.target.checked ? [...n.prefs.tipos, t] : n.prefs.tipos.filter((x) => x !== t))} />
                      {TIPOS_AVISO[t]}
                    </label>
                  ))}
                  <p className="text-xs text-tinta/55">Vale para todas as competições e equipas que segue neste aparelho.</p>
                </fieldset>
                {n.erro && <Aviso>{n.erro}</Aviso>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Interruptor({ ativo, desativado, onMudar }: { ativo: boolean; desativado?: boolean; onMudar: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} disabled={desativado} onClick={onMudar}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${ativo ? 'bg-relva' : 'bg-tinta/20'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${ativo ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  );
}

/** "Seguir equipa" na página da equipa: notificações só dos jogos dela. */
export function SeguirEquipa({ equipaId, nome }: { equipaId: string; nome: string }) {
  const n = useNotificacoes();
  const [explicar, setExplicar] = useState(false);
  if (suporte() === 'nao_configurado') return null;
  const ativo = n.segueEquipa(equipaId);

  const tocar = () => {
    if (n.estado !== 'disponivel') { setExplicar(true); return; }
    n.alternarEquipa(equipaId);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Botao variante={ativo ? 'secundario' : 'primario'} disabled={n.aTratar} onClick={tocar}
        aria-pressed={ativo} title={ativo ? 'Deixar de receber notificações desta equipa' : 'Receber notificações dos jogos desta equipa'}>
        <Sino ativo={ativo} className="h-4 w-4" />
        {n.aTratar ? 'Um momento…' : ativo ? `A seguir ${nome}` : `Seguir ${nome}`}
      </Botao>
      {explicar && <MotivoSemNotificacoes estado={n.estado} />}
      {n.erro && <Aviso>{n.erro}</Aviso>}
    </div>
  );
}
