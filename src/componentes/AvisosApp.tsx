import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

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

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CHAVE_FECHADO = 'liga:instalar-fechado';
const lerFechado = () => { try { return localStorage.getItem(CHAVE_FECHADO) === '1'; } catch { return false; } };
const jaInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const eIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/**
 * Convite para instalar a app. No Android (e Chrome/Edge no computador) usa o
 * pedido do próprio browser; no iPhone explica como adicionar ao ecrã principal.
 */
export function InstalarApp() {
  const [pedido, setPedido] = useState<EventoInstalar | null>(null);
  const [fechado, setFechado] = useState(lerFechado);
  const [instalada, setInstalada] = useState(jaInstalada);

  useEffect(() => {
    const guardar = (e: Event) => { e.preventDefault(); setPedido(e as EventoInstalar); };
    const feito = () => { setInstalada(true); setPedido(null); };
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', feito);
    return () => { window.removeEventListener('beforeinstallprompt', guardar); window.removeEventListener('appinstalled', feito); };
  }, []);

  if (instalada || fechado) return null;
  const iphone = eIphone();
  if (!pedido && !iphone) return null;

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE_FECHADO, '1'); } catch { /* sem armazenamento: volta a aparecer noutra visita */ }
  };
  const instalar = async () => {
    if (!pedido) return;
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    setPedido(null);
    if (outcome === 'accepted') setInstalada(true);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-linha bg-white px-4 py-3 text-sm">
      <img src="/pwa-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Tenha a liga no telemóvel</div>
        <div className="text-tinta/70">
          {pedido
            ? 'Instale a app: abre num toque e funciona sem rede com os últimos dados.'
            : <>No Safari, toque em <strong>Partilhar</strong> e depois em <strong>Adicionar ao ecrã principal</strong>.</>}
        </div>
      </div>
      {pedido && (
        <button type="button" onClick={instalar}
          className="shrink-0 rounded-md bg-relva px-3 py-2 font-semibold text-white hover:bg-relva-escura">
          Instalar
        </button>
      )}
      <button type="button" onClick={fechar} aria-label="Não mostrar outra vez"
        className="shrink-0 rounded-md px-2 py-1 text-tinta/50 hover:text-tinta">✕</button>
    </div>
  );
}
