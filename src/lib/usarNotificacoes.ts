import { useCallback, useEffect, useState } from 'react';
import { chaveParaBytes, type TipoAviso } from './notificacoes';
import { mensagemErro, supabase } from './supabase';

const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const CHAVE = 'liga:notificacoes';

export interface Preferencias {
  competicoes: string[];
  equipas: string[];
  tipos: TipoAviso[];
}

const VAZIAS: Preferencias = { competicoes: [], equipas: [], tipos: ['golos', 'inicio_fim', 'marcacoes'] };

function ler(): Preferencias {
  try { return { ...VAZIAS, ...JSON.parse(localStorage.getItem(CHAVE) ?? '{}') }; } catch { return VAZIAS; }
}
function gravar(p: Preferencias) {
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento local */ }
}

export type Suporte = 'nao_configurado' | 'sem_suporte' | 'iphone_sem_instalar' | 'bloqueado' | 'disponivel';

/** Este aparelho pode receber notificações? */
export function suporte(): Suporte {
  if (!CHAVE_VAPID) return 'nao_configurado';
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
  // No iPhone, as notificações só existem com a app instalada no ecrã principal
  if (iphone && !instalada) return 'iphone_sem_instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem_suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'disponivel';
}

/** O service worker da app (não existe em desenvolvimento: aí desiste ao fim de uns segundos). */
async function registo(): Promise<ServiceWorkerRegistration> {
  const pronto = navigator.serviceWorker.ready;
  const limite = new Promise<never>((_, rejeitar) =>
    setTimeout(() => rejeitar(new Error('As notificações só funcionam na versão publicada da app.')), 6000));
  return Promise.race([pronto, limite]);
}

/** Subscrição deste aparelho no serviço de push (cria-a se preciso, e refaz-a se a chave mudou). */
async function subscricao(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existente = await reg.pushManager.getSubscription();
  if (existente) return existente;
  const opcoes = { userVisibleOnly: true, applicationServerKey: chaveParaBytes(CHAVE_VAPID!) as BufferSource };
  try {
    return await reg.pushManager.subscribe(opcoes);
  } catch (e) {
    const antiga = await reg.pushManager.getSubscription();
    if (!antiga) throw e;
    await antiga.unsubscribe();
    return reg.pushManager.subscribe(opcoes);
  }
}

async function enviarParaServidor(sub: PushSubscription, p: Preferencias) {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('guardar_subscricao', {
    p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth,
    p_competicoes: p.competicoes, p_equipas: p.equipas, p_tipos: p.tipos,
  });
  if (error) throw error;
}

/** Escolhas de notificações deste aparelho: que competições e equipas segue, e que avisos quer. */
export function useNotificacoes() {
  const [prefs, setPrefs] = useState<Preferencias>(ler);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const estado = suporte();

  // Uma vez por sessão, volta a enviar as escolhas: se o servidor tiver apagado a subscrição
  // (ex.: o serviço de push renovou-a), as notificações não param sem ninguém dar por isso
  useEffect(() => {
    const p = ler();
    if (estado !== 'disponivel' || Notification.permission !== 'granted') return;
    if (!p.competicoes.length && !p.equipas.length) return;
    try { if (sessionStorage.getItem('liga:notificacoes-sincronizadas')) return; } catch { /* segue */ }
    registo().then(subscricao).then((s) => enviarParaServidor(s, p))
      .then(() => { try { sessionStorage.setItem('liga:notificacoes-sincronizadas', '1'); } catch { /* segue */ } })
      .catch(() => undefined);
  }, [estado]);

  const aplicar = useCallback(async (novas: Preferencias): Promise<boolean> => {
    setATratar(true);
    setErro(null);
    try {
      const nada = !novas.competicoes.length && !novas.equipas.length;
      if (nada) {
        // Já não segue nada: apaga a subscrição (no servidor e no aparelho)
        const reg = await registo();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.rpc('remover_subscricao', { p_endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      } else {
        if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') {
          setErro('Sem autorização, o telemóvel não mostra notificações. Pode dá-la nas definições do site.');
          return false;
        }
        await enviarParaServidor(await subscricao(await registo()), novas);
      }
      gravar(novas);
      setPrefs(novas);
      return true;
    } catch (e) {
      setErro(mensagemErro(e));
      return false;
    } finally {
      setATratar(false);
    }
  }, []);

  const alternar = (lista: 'competicoes' | 'equipas', id: string) => aplicar({
    ...prefs, [lista]: prefs[lista].includes(id) ? prefs[lista].filter((x) => x !== id) : [...prefs[lista], id],
  });

  return {
    estado, prefs, aTratar, erro,
    segueCompeticao: (id: string) => prefs.competicoes.includes(id),
    segueEquipa: (id: string) => prefs.equipas.includes(id),
    alternarCompeticao: (id: string) => alternar('competicoes', id),
    alternarEquipa: (id: string) => alternar('equipas', id),
    mudarTipos: (tipos: TipoAviso[]) => aplicar({ ...prefs, tipos }),
  };
}
