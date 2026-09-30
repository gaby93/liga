/**
 * Notificações: o texto de cada aviso e quem o recebe. Lógica pura, usada
 * pela função do servidor (functions/api/notificar.ts) e pelos testes.
 */

export type TipoAviso = 'golos' | 'inicio_fim' | 'marcacoes';

export const TIPOS_AVISO: Record<TipoAviso, string> = {
  golos: 'Golos',
  inicio_fim: 'Início e fim dos jogos',
  marcacoes: 'Jogos marcados e remarcados',
};

export interface Subscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
  competicoes: string[];
  equipas: string[];
  tipos: string[];
}

export interface Mensagem {
  titulo: string;
  corpo: string;
  /** Página a abrir ao tocar. */
  url: string;
  /** Avisos com a mesma etiqueta substituem-se no telemóvel (ex.: o mesmo jogo). */
  etiqueta: string;
}

/** Um aviso sobre um jogo, antes de se saber a quem vai. */
export interface Aviso {
  tipo: TipoAviso;
  competicaoId: string;
  competicao: string;
  jogoId: string;
  casaId: string;
  foraId: string;
  mensagem: Mensagem;
}

export interface JogoAviso {
  id: string;
  competicaoId: string;
  competicao: string;
  casaId: string;
  foraId: string;
  casa: string;
  fora: string;
  golosCasa: number | null;
  golosFora: number | null;
  penaltisCasa?: number | null;
  penaltisFora?: number | null;
  estado: string;
  dataHora: string | null;
  campo: string | null;
  fase: string;
}

const urlJogo = (j: JogoAviso) => `/c/${j.competicaoId}/jogos/${j.id}`;
const resultado = (j: JogoAviso) => `${j.casa} ${j.golosCasa ?? 0}–${j.golosFora ?? 0} ${j.fora}`;
const base = (j: JogoAviso, tipo: TipoAviso) =>
  ({ tipo, competicaoId: j.competicaoId, competicao: j.competicao, jogoId: j.id, casaId: j.casaId, foraId: j.foraId });

/** "sábado, 4 de outubro, 15:00" no fuso da liga. */
export function dataPorExtenso(iso: string, fusoHorario: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: fusoHorario,
  }).format(new Date(iso));
}

/** Golo: o resultado já conta com ele. Num autogolo, o golo é da outra equipa. */
export function avisoGolo(j: JogoAviso, g: { equipaId: string; tipo: 'golo' | 'autogolo'; minuto: number | null; jogador: string | null }): Aviso {
  const daCasa = g.tipo === 'golo' ? g.equipaId === j.casaId : g.equipaId !== j.casaId;
  const quem = g.jogador ?? 'jogador não identificado';
  const detalhe = g.tipo === 'autogolo' ? `autogolo de ${quem}` : quem;
  return {
    ...base(j, 'golos'),
    mensagem: {
      titulo: `⚽ Golo: ${daCasa ? j.casa : j.fora}!`,
      corpo: `${resultado(j)} · ${g.minuto != null ? `${g.minuto}' ` : ''}${detalhe}`,
      url: urlJogo(j),
      etiqueta: `jogo-${j.id}`,
    },
  };
}

export function avisoInicio(j: JogoAviso): Aviso {
  return {
    ...base(j, 'inicio_fim'),
    mensagem: { titulo: `▶️ Começou: ${j.casa} – ${j.fora}`, corpo: `${j.competicao} · ${j.fase}`, url: urlJogo(j), etiqueta: `jogo-${j.id}` },
  };
}

export function avisoFim(j: JogoAviso): Aviso {
  const wo = j.estado === 'wo_casa' || j.estado === 'wo_fora';
  const pen = j.penaltisCasa != null && j.penaltisFora != null ? ` (penáltis ${j.penaltisCasa}–${j.penaltisFora})` : '';
  const titulo = wo
    ? `🏁 Terminou por W.O.: ${j.casa} – ${j.fora}`
    : `🏁 Terminou: ${resultado(j)}${pen}`;
  const corpo = wo ? `${j.estado === 'wo_casa' ? j.casa : j.fora} não compareceu · ${j.competicao}` : `${j.competicao} · ${j.fase}`;
  return { ...base(j, 'inicio_fim'), mensagem: { titulo, corpo, url: urlJogo(j), etiqueta: `jogo-${j.id}` } };
}

export function avisoMarcacao(j: JogoAviso, fusoHorario: string): Aviso {
  const quando = j.dataHora ? dataPorExtenso(j.dataHora, fusoHorario) : 'data por confirmar';
  return {
    ...base(j, 'marcacoes'),
    mensagem: {
      titulo: `📅 Jogo marcado: ${j.casa} – ${j.fora}`,
      corpo: [quando, j.campo, j.competicao].filter(Boolean).join(' · '),
      url: urlJogo(j),
      etiqueta: `marcacao-${j.id}`,
    },
  };
}

/** A subscrição quer este aviso? (tipo escolhido e competição ou equipa seguida) */
export function interessa(s: Subscricao, a: Aviso): boolean {
  if (!s.tipos.includes(a.tipo)) return false;
  return s.competicoes.includes(a.competicaoId) || s.equipas.includes(a.casaId) || s.equipas.includes(a.foraId);
}

/**
 * O que cada subscrição recebe. Várias marcações para a mesma pessoa juntam-se
 * numa só notificação de resumo (marcar a época inteira não gera 20 avisos).
 */
export function distribuir(subscricoes: Subscricao[], avisos: Aviso[]): { subscricao: Subscricao; mensagem: Mensagem }[] {
  const envios: { subscricao: Subscricao; mensagem: Mensagem }[] = [];
  for (const s of subscricoes) {
    const meus = avisos.filter((a) => interessa(s, a));
    const marcacoes = meus.filter((a) => a.tipo === 'marcacoes');
    for (const a of meus) if (a.tipo !== 'marcacoes') envios.push({ subscricao: s, mensagem: a.mensagem });
    if (marcacoes.length === 1) envios.push({ subscricao: s, mensagem: marcacoes[0].mensagem });
    if (marcacoes.length > 1) {
      const competicoes = [...new Set(marcacoes.map((a) => a.competicao))];
      const primeira = marcacoes[0];
      envios.push({
        subscricao: s,
        mensagem: {
          titulo: `📅 ${marcacoes.length} jogos marcados`,
          corpo: `${competicoes.join(', ')}. Veja as datas e os horários.`,
          url: competicoes.length === 1 ? `/c/${primeira.competicaoId}/jogos` : '/',
          etiqueta: 'marcacoes',
        },
      });
    }
  }
  return envios;
}

/** Chave VAPID pública (base64url) → formato pedido pelo PushManager. */
export function chaveParaBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
