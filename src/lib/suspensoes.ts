import type { EstadoJogo, TipoEvento } from './types';

export interface RegrasSuspensao {
  /** Amarelos acumulados que dão 1 jogo de suspensão (0 = não se aplica). */
  amarelos: number;
  /** Jogos de suspensão por expulsão (0 = não se aplica). */
  jogosExpulsao: number;
}

export interface JogoSusp {
  id: string;
  jornada: number;
  casa_id: string;
  fora_id: string;
  data_hora: string | null;
  estado: EstadoJogo;
}

export interface EventoSusp {
  jogo_id: string;
  equipa_id: string;
  jogador_id: string | null;
  tipo: TipoEvento;
}

export interface SuspensaoJogo {
  jogadorId: string;
  equipaId: string;
  motivo: string;
}

export interface SuspensaoAtiva extends SuspensaoJogo {
  /** Jogos que ainda faltam cumprir (inclui os que ainda não estão no calendário). */
  jogosEmFalta: number;
  /** Primeiro jogo por realizar em que o jogador fica de fora. */
  proximoJogoId: string | null;
}

export interface ResultadoSuspensoes {
  /** Para cada jogo, quem estava (ou está) suspenso nele. */
  porJogo: Map<string, SuspensaoJogo[]>;
  /** Suspensões ainda por cumprir, por jogador. */
  ativas: Map<string, SuspensaoAtiva>;
}

const REALIZADO: ReadonlySet<EstadoJogo> = new Set(['terminado', 'wo_casa', 'wo_fora']);

/** Ordem pela jornada (e pela data dentro da jornada), que é a ordem em que a liga avança. */
const porJornada = (a: JogoSusp, b: JogoSusp) =>
  a.jornada - b.jornada || (a.data_hora ?? '').localeCompare(b.data_hora ?? '') || a.id.localeCompare(b.id);

/**
 * Calcula as suspensões a partir dos cartões.
 *
 * - Expulsão (vermelho, ou dois amarelos no mesmo jogo): `jogosExpulsao` jogos.
 *   Os amarelos de um jogo com expulsão não contam para a acumulação.
 * - Cada `amarelos` amarelos acumulados: 1 jogo.
 *
 * A suspensão cumpre-se nos jogos seguintes da equipa. Jogos adiados não contam.
 * Jogos agendados contam como os próximos a cumprir.
 */
export function calcularSuspensoes(
  jogos: JogoSusp[], eventos: EventoSusp[], regras: RegrasSuspensao,
): ResultadoSuspensoes {
  const ordem = [...jogos].sort(porJornada);

  // jogador -> jogo -> cartões nesse jogo
  const cartoes = new Map<string, Map<string, { amarelos: number; vermelhos: number; equipaId: string }>>();
  for (const e of eventos) {
    if (!e.jogador_id || (e.tipo !== 'amarelo' && e.tipo !== 'vermelho')) continue;
    const doJogador = cartoes.get(e.jogador_id) ?? new Map();
    const c = doJogador.get(e.jogo_id) ?? { amarelos: 0, vermelhos: 0, equipaId: e.equipa_id };
    if (e.tipo === 'amarelo') c.amarelos++;
    else c.vermelhos++;
    doJogador.set(e.jogo_id, c);
    cartoes.set(e.jogador_id, doJogador);
  }

  const porJogo = new Map<string, SuspensaoJogo[]>();
  const ativas = new Map<string, SuspensaoAtiva>();

  for (const [jogadorId, doJogador] of cartoes) {
    let amarelos = 0;
    let equipaId = '';
    const divida: { motivo: string; jogos: number }[] = [];
    let emFalta = 0;
    let proximo: { id: string; motivo: string } | null = null;

    for (const g of ordem) {
      const daEquipa = g.casa_id === equipaId || g.fora_id === equipaId;
      if (divida.length && daEquipa && g.estado !== 'adiado') {
        const d = divida[0];
        const lista = porJogo.get(g.id) ?? [];
        lista.push({ jogadorId, equipaId, motivo: d.motivo });
        porJogo.set(g.id, lista);
        if (!REALIZADO.has(g.estado)) {
          emFalta++;
          proximo ??= { id: g.id, motivo: d.motivo };
        }
        if (--d.jogos === 0) divida.shift();
      }

      const c = doJogador.get(g.id);
      if (!c) continue;
      equipaId = c.equipaId;
      if (c.vermelhos > 0 || c.amarelos >= 2) {
        if (regras.jogosExpulsao > 0)
          divida.push({ motivo: `Expulsão na jornada ${g.jornada}`, jogos: regras.jogosExpulsao });
      } else if (regras.amarelos > 0) {
        for (let i = 0; i < c.amarelos; i++) {
          amarelos++;
          if (amarelos % regras.amarelos === 0)
            divida.push({ motivo: `${amarelos}.º amarelo na jornada ${g.jornada}`, jogos: 1 });
        }
      }
    }

    // O que sobra é para jogos que ainda não estão no calendário
    const sobra = divida.reduce((s, d) => s + d.jogos, 0);
    if (emFalta + sobra > 0) {
      ativas.set(jogadorId, {
        jogadorId, equipaId,
        motivo: proximo?.motivo ?? divida[0].motivo,
        jogosEmFalta: emFalta + sobra,
        proximoJogoId: proximo?.id ?? null,
      });
    }
  }

  return { porJogo, ativas };
}
