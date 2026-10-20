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
  /** Minutos entre um horário e o seguinte, na mesma jornada. */
  intervaloMin: number;
  /** Dias entre uma jornada e a seguinte. */
  diasEntreJornadas: number;
  /** Jornada que joga na data de início (as anteriores não recebem data). */
  aPartirJornada?: number;
  /** Campos a usar, por ordem: jogos seguidos da jornada jogam à mesma hora, um em cada campo. */
  campos?: string[];
}

/**
 * Atribui data, hora (na hora local) e campo a cada jogo: a jornada N joga
 * (N − aPartirJornada) × diasEntreJornadas dias depois do início. Com C campos,
 * os jogos da jornada, pela ordem da lista, ocupam os C campos à mesma hora;
 * os seguintes passam para o horário seguinte, intervaloMin depois.
 * Sem campos, é um jogo por horário e o campo fica null.
 */
export function atribuirDatas<T extends { jornada: number }>(jogos: T[], o: OpcoesDatas):
  (T & { dataHora: string | null; campo: string | null })[] {
  const campos = o.campos?.filter((c) => c.trim()) ?? [];
  const porHorario = Math.max(1, campos.length);
  const [ano, mes, dia] = o.inicio.split('-').map(Number);
  const [h, min] = o.hora.split(':').map(Number);
  const primeira = o.aPartirJornada ?? 1;
  const posicao = new Map<number, number>();

  return jogos.map((j) => {
    if (j.jornada < primeira) return { ...j, dataHora: null, campo: null };
    const i = posicao.get(j.jornada) ?? 0;
    posicao.set(j.jornada, i + 1);
    const horario = Math.floor(i / porHorario);
    const data = new Date(ano, mes - 1, dia + (j.jornada - primeira) * o.diasEntreJornadas, h, min + horario * o.intervaloMin);
    return { ...j, dataHora: data.toISOString(), campo: campos.length ? campos[i % porHorario] : null };
  });
}
