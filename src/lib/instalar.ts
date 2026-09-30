import { useEffect, useState } from 'react';

/** Onde a pessoa abriu a app, para lhe dar os passos certos de instalação. */
export type Plataforma =
  | 'instalada'
  | 'app_interna_android' // browser dentro do Facebook, Instagram, etc.: não instala
  | 'app_interna_iphone'
  | 'iphone_safari'
  | 'iphone_outro' // Chrome, Firefox, Edge… no iPhone
  | 'android_samsung'
  | 'android'
  | 'computador';

const APP_INTERNA = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|GSA\/|; wv\)/i;

export function plataforma(ua: string, o: { instalada: boolean; toque?: boolean }): Plataforma {
  if (o.instalada) return 'instalada';
  // O iPad recente diz ser um Mac; distingue-se por ter ecrã tátil
  const iphone = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && !!o.toque);
  const android = /Android/i.test(ua);
  if (APP_INTERNA.test(ua)) return iphone ? 'app_interna_iphone' : android ? 'app_interna_android' : 'computador';
  if (iphone) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'iphone_outro' : 'iphone_safari';
  if (android) return /SamsungBrowser/i.test(ua) ? 'android_samsung' : 'android';
  return 'computador';
}

export const estaInstalada = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true);

export const plataformaAtual = () =>
  plataforma(navigator.userAgent, { instalada: estaInstalada(), toque: navigator.maxTouchPoints > 1 });

/** Endereço que abre no Chrome a partir do browser interno de outra app (só Android). */
export const abrirNoChrome = (url: string) => {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
};

/** Link de convite: página de instalação, com a competição a seguir (se houver). */
export function linkConvite(base: string, competicaoId?: string) {
  return `${base.replace(/\/$/, '')}/instalar${competicaoId ? `?c=${encodeURIComponent(competicaoId)}` : ''}`;
}

export function textoConvite(link: string, competicao?: string) {
  return competicao
    ? `Acompanhe a ${competicao} no telemóvel: resultados ao vivo, tabela e avisos de golos. Instale a app: ${link}`
    : `Acompanhe as nossas competições no telemóvel: resultados ao vivo, tabelas e avisos de golos. Instale a app: ${link}`;
}

// O browser só oferece o pedido de instalação uma vez, e às vezes antes de a página
// que o quer usar existir: guarda-se aqui, desde o arranque da app.
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let pedidoGuardado: EventoInstalar | null = null;
let instaladaAgora = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoGuardado = e as EventoInstalar; avisar(); });
  window.addEventListener('appinstalled', () => { instaladaAgora = true; pedidoGuardado = null; avisar(); });
}

/** Pedido de instalação do browser (Android, Chrome/Edge no computador), se existir. */
export function useInstalar() {
  const [, atualizar] = useState(0);
  useEffect(() => {
    const f = () => atualizar((n) => n + 1);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);
  const instalar = async () => {
    const p = pedidoGuardado;
    if (!p) return false;
    await p.prompt();
    const { outcome } = await p.userChoice;
    pedidoGuardado = null;
    if (outcome === 'accepted') instaladaAgora = true;
    avisar();
    return outcome === 'accepted';
  };
  return { podeInstalar: !!pedidoGuardado, instalada: instaladaAgora || estaInstalada(), instalar };
}
