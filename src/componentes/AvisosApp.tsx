import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { plataformaAtual, useInstalar } from '../lib/instalar';

/** Avisos da app instalável: nova versão disponível e sem ligação. Aparecem em todas as páginas. */
export function AvisosApp() {
  const { needRefresh: [novaVersao, setNovaVersao], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registo) {
      // Procura versões novas de hora a hora (a app pode ficar aberta dias no telemóvel)
      if (registo) setInterval(() => { registo.update().catch(() => undefined); }, 60 * 60 * 1000);
    },
  });
  const online = useOnline();

  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
      {!online && (
        <div role="status" className="pointer-events-auto rounded-full bg-tinta px-4 py-2 text-sm text-white shadow-lg">
          Sem ligação: está a ver os últimos dados guardados.
        </div>
      )}
      {novaVersao && (
        <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-lg bg-tinta py-2 pl-4 pr-2 text-sm text-white shadow-lg">
          Nova versão disponível.
          <button type="button" onClick={() => updateServiceWorker(true)}
            className="rounded-md bg-cartao px-3 py-1.5 font-semibold text-tinta hover:brightness-95">
            Atualizar
          </button>
          <button type="button" onClick={() => setNovaVersao(false)} aria-label="Fechar aviso"
            className="rounded-md px-2 py-1.5 text-white/70 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const CHAVE_FECHADO = 'liga:instalar-fechado';
const lerFechado = () => { try { return localStorage.getItem(CHAVE_FECHADO) === '1'; } catch { return false; } };

/**
 * Convite para instalar a app. Onde o browser o permite (Android, Chrome/Edge no
 * computador) instala num toque; nos outros aparelhos leva aos passos certos.
 */
export function InstalarApp() {
  const { podeInstalar, instalada, instalar } = useInstalar();
  const [fechado, setFechado] = useState(lerFechado);
  const p = plataformaAtual();

  if (instalada || fechado) return null;
  if (!podeInstalar && p === 'computador') return null;

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE_FECHADO, '1'); } catch { /* sem armazenamento: volta a aparecer noutra visita */ }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-linha bg-white px-4 py-3 text-sm">
      <img src="/pwa-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Tenha a liga no telemóvel</div>
        <div className="text-tinta/70">Instale a app: abre num toque, avisa dos golos e funciona sem rede.</div>
      </div>
      {podeInstalar ? (
        <button type="button" onClick={instalar}
          className="shrink-0 rounded-md bg-relva px-3 py-2 font-semibold text-white hover:bg-relva-escura">
          Instalar
        </button>
      ) : (
        <Link to="/instalar" className="shrink-0 rounded-md bg-relva px-3 py-2 font-semibold text-white hover:bg-relva-escura">
          Como instalar
        </Link>
      )}
      <button type="button" onClick={fechar} aria-label="Não mostrar outra vez"
        className="shrink-0 rounded-md px-2 py-1 text-tinta/50 hover:text-tinta">✕</button>
    </div>
  );
}
