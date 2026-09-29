export interface JogoGerado {
  jornada: number;
  casaId: string;
  foraId: string;
}

const FOLGA = '__folga__';

/**
 * Gera um calendário de todos contra todos pelo método do círculo.
 * Com número ímpar de equipas, uma equipa folga em cada jornada.
 */
export function gerarCalendario(equipaIds: string[], idaVolta: boolean): JogoGerado[] {
  if (equipaIds.length < 2) return [];
  const lista = [...equipaIds];
  if (lista.length % 2 === 1) lista.push(FOLGA);

  const n = lista.length;
  const rondas = n - 1;
  const jogos: JogoGerado[] = [];
  let roda = lista;

  for (let r = 0; r < rondas; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = roda[i];
      const b = roda[n - 1 - i];
      if (a === FOLGA || b === FOLGA) continue;
      // Alterna casa/fora para equilibrar os jogos em casa de cada equipa
      const trocar = i === 0 ? r % 2 === 1 : i % 2 === 1;
      jogos.push({ jornada: r + 1, casaId: trocar ? b : a, foraId: trocar ? a : b });
    }
    roda = [roda[0], roda[n - 1], ...roda.slice(1, n - 1)];
  }

  if (idaVolta) {
    const volta = jogos.map((j) => ({ jornada: j.jornada + rondas, casaId: j.foraId, foraId: j.casaId }));
    jogos.push(...volta);
  }
  return jogos;
}

export interface OpcoesDatas {
  /** Data da primeira jornada a marcar, 'AAAA-MM-DD'. */
  inicio: string;
  /** Hora do primeiro jogo de cada jornada, 'HH:MM'. */
  hora: string;
  /** Minutos entre jogos da mesma jornada. */
  intervaloMin: number;
  /** Dias entre uma jornada e a seguinte. */
  diasEntreJornadas: number;
  /** Jornada que joga na data de início (as anteriores não recebem data). */
  aPartirJornada?: number;
}

/**
 * Atribui data e hora (na hora local) a cada jogo: a jornada N joga
 * (N − aPartirJornada) × diasEntreJornadas dias depois do início, e os jogos
 * da mesma jornada seguem-se, pela ordem da lista, de intervaloMin em intervaloMin.
 */
export function atribuirDatas<T extends { jornada: number }>(jogos: T[], o: OpcoesDatas): (T & { dataHora: string | null })[] {
  const [ano, mes, dia] = o.inicio.split('-').map(Number);
  const [h, min] = o.hora.split(':').map(Number);
  const primeira = o.aPartirJornada ?? 1;
  const posicao = new Map<number, number>();

  return jogos.map((j) => {
    if (j.jornada < primeira) return { ...j, dataHora: null };
    const i = posicao.get(j.jornada) ?? 0;
    posicao.set(j.jornada, i + 1);
    const data = new Date(ano, mes - 1, dia + (j.jornada - primeira) * o.diasEntreJornadas, h, min + i * o.intervaloMin);
    return { ...j, dataHora: data.toISOString() };
  });
}
