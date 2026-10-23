/** Regras de inscrição de jogadores e de convocatória, definidas em cada competição. */

export interface RegrasCompeticao {
  nome: string;
  estado: string;
  /** Jogadores inscritos por equipa (0 = sem limite). */
  max_jogadores: number;
  /** Idade mínima para inscrever (0 = sem limite). */
  idade_minima: number;
  idade_veterano: number;
  /** Veteranos mínimos na ficha de cada jogo (0 = desliga). */
  min_veteranos: number;
}

/** Idade completa numa data ('AAAA-MM-DD' ou ISO). */
export function idade(dataNasc: string, naData: Date | string = new Date()): number {
  const [a, m, d] = dataNasc.slice(0, 10).split('-').map(Number);
  const ref = typeof naData === 'string' ? new Date(naData) : naData;
  let anos = ref.getFullYear() - a;
  const mes = ref.getMonth() + 1;
  if (mes < m || (mes === m && ref.getDate() < d)) anos--;
  return anos;
}

/**
 * As regras que valem para uma equipa: as das competições onde participa e que
 * não terminaram. Com várias, vale a mais exigente.
 */
export function regrasDaEquipa(competicoes: RegrasCompeticao[]) {
  const ativas = competicoes.filter((c) => c.estado !== 'terminada');
  const comLimite = ativas.filter((c) => c.max_jogadores > 0);
  const comIdade = ativas.filter((c) => c.idade_minima > 0);
  const limite = comLimite.length ? comLimite.reduce((a, b) => (b.max_jogadores < a.max_jogadores ? b : a)) : null;
  const idadeMin = comIdade.length ? comIdade.reduce((a, b) => (b.idade_minima > a.idade_minima ? b : a)) : null;
  return {
    maxJogadores: limite ? { valor: limite.max_jogadores, competicao: limite.nome } : null,
    idadeMinima: idadeMin ? { valor: idadeMin.idade_minima, competicao: idadeMin.nome } : null,
  };
}

/** Motivo para não inscrever o jogador nesta equipa, ou null se pode. */
export function verificarInscricao(o: {
  regras: ReturnType<typeof regrasDaEquipa>;
  /** Jogadores que a equipa já tem, sem contar com este. */
  inscritos: number;
  /** O jogador entra agora na equipa (novo, ou vindo de outra). */
  entraNaEquipa: boolean;
  equipa: string;
  dataNasc: string;
  hoje?: Date;
}): string | null {
  const { maxJogadores, idadeMinima } = o.regras;
  if (o.entraNaEquipa && maxJogadores && o.inscritos >= maxJogadores.valor)
    return `${o.equipa} já tem ${o.inscritos} jogadores inscritos: o limite na ${maxJogadores.competicao} é ${maxJogadores.valor}.`;
  if (idadeMinima && idade(o.dataNasc, o.hoje) < idadeMinima.valor)
    return `O jogador tem ${idade(o.dataNasc, o.hoje)} anos: a idade mínima na ${idadeMinima.competicao} é ${idadeMinima.valor}.`;
  return null;
}

/** Veteranos convocados para um jogo (idade no dia do jogo) e quantos convocados não têm data de nascimento. */
export function contarVeteranos(convocados: string[], datas: Map<string, string | null>, idadeVeterano: number, diaJogo: Date | string) {
  let veteranos = 0, semData = 0;
  for (const id of convocados) {
    const d = datas.get(id);
    if (!d) semData++;
    else if (idade(d, diaJogo) >= idadeVeterano) veteranos++;
  }
  return { veteranos, semData };
}
