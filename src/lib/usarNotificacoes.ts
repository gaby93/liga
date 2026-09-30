import { useCallback, useEffect, useState } from 'react';
import { useFavoritos } from './favoritos';
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
// Vários componentes usam as escolhas ao mesmo tempo (sino, estrela, seguir equipa): mudam juntos
const ouvintes = new Set<() => void>();
// Uma alteração de cada vez, pela ordem dos toques: inscrever o aparelho demora uns segundos
let fila: Promise<unknown> = Promise.resolve();
function gravar(p: Preferencias) {
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento local */ }
  ouvintes.forEach((f) => f());
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

  useEffect(() => {
    const f = () => setPrefs(ler());
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);

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

  // Parte sempre das escolhas guardadas (outro componente pode tê-las mudado entretanto).
  // `mudar` devolve null quando não há nada a fazer.
  const aplicar = useCallback((mudar: (atuais: Preferencias) => Preferencias | null): Promise<boolean> => {
    const vez = fila.then(() => executar(mudar));
    fila = vez.catch(() => undefined);
    return vez;
  }, []);

  const executar = async (mudar: (atuais: Preferencias) => Preferencias | null): Promise<boolean> => {
    const novas = mudar(ler());
    if (!novas) return true;
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
      return true;
    } catch (e) {
      setErro(mensagemErro(e));
      return false;
    } finally {
      setATratar(false);
    }
  };

  const alternar = (lista: 'competicoes' | 'equipas', id: string) => aplicar((p) => ({
    ...p, [lista]: p[lista].includes(id) ? p[lista].filter((x) => x !== id) : [...p[lista], id],
  }));

  /** Liga ou desliga uma competição (sem nada a fazer se já estiver assim). */
  const seguirCompeticao = (id: string, seguir: boolean) => aplicar((p) => (p.competicoes.includes(id) === seguir ? null
    : { ...p, competicoes: seguir ? [...p.competicoes, id] : p.competicoes.filter((x) => x !== id) }));

  return {
    estado, prefs, aTratar, erro,
    segueCompeticao: (id: string) => prefs.competicoes.includes(id),
    segueEquipa: (id: string) => prefs.equipas.includes(id),
    alternarCompeticao: (id: string) => alternar('competicoes', id),
    seguirCompeticao,
    alternarEquipa: (id: string) => alternar('equipas', id),
    mudarTipos: (tipos: TipoAviso[]) => aplicar((p) => ({ ...p, tipos })),
  };
}

/**
 * Favoritos que também ligam o sino: marcar uma competição ativa as notificações
 * dela (o browser pede autorização da primeira vez); tirar dos favoritos desliga-as.
 * Onde não há notificações (iPhone sem a app instalada, autorização negada), fica só o favorito.
 */
export function useFavoritosComSino() {
  const f = useFavoritos();
  const n = useNotificacoes();
  const alternar = (id: string) => {
    const favorito = !f.eFavorito(id);
    f.alternar(id);
    if (n.estado === 'disponivel') void n.seguirCompeticao(id, favorito);
  };
  return { ...f, alternar };
}
