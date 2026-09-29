import { gerarCalendario } from './calendario';
import type { EstadoJogo, Formato } from './types';

// ---------- Fase de grupos ----------

export const nomesGrupos = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

/** Sorteio: baralha as equipas e distribui-as pelos grupos à vez (A, B, C, A, B, C…). */
export function sortearGrupos(equipaIds: string[], numGrupos: number, aleatorio = Math.random): Map<string, string> {
  const baralho = [...equipaIds];
  for (let i = baralho.length - 1; i > 0; i--) {
    const k = Math.floor(aleatorio() * (i + 1));
    [baralho[i], baralho[k]] = [baralho[k], baralho[i]];
  }
  const grupos = nomesGrupos(numGrupos);
  return new Map(baralho.map((id, i) => [id, grupos[i % numGrupos]]));
}

/**
 * Sementes para a fase final: primeiro todos os 1.º classificados (por ordem
 * de grupo), depois os 2.º, etc., e no fim os melhores terceiros (pela ordem
 * do ranking). Com o quadro clássico isto dá 1.º A × 2.º B, 1.º B × 2.º A…
 */
export function sementesDosGrupos(
  tabelas: { grupo: string; equipas: string[] }[], apurados: number, melhores: string[] = [],
): string[] {
  const ordenadas = [...tabelas].sort((a, b) => a.grupo.localeCompare(b.grupo));
  const sementes: string[] = [];
  for (let pos = 0; pos < apurados; pos++) for (const t of ordenadas) sementes.push(t.equipas[pos]);
  return [...sementes, ...melhores];
}

/** Problema que impede a fase final (ou null se está tudo bem). */
export function validarFaseFinal(tamanhosGrupos: number[], apurados: number, melhores = 0): string | null {
  const total = tamanhosGrupos.length * apurados + melhores;
  if (total < 2) return 'A fase final precisa de pelo menos 2 equipas apuradas.';
  if (!ePotenciaDe2(total)) {
    const conta = `${tamanhosGrupos.length} grupos × ${apurados} apurados${melhores ? ` + ${melhores} melhores` : ''} = ${total} equipas`;
    return `${conta}. A fase final precisa de 2, 4, 8, 16 ou 32.`;
  }
  if (tamanhosGrupos.some((n) => n < apurados)) return `Há grupos com menos de ${apurados} equipas.`;
  if (melhores > tamanhosGrupos.filter((n) => n > apurados).length)
    return `Não há ${apurados + 1}.º classificados suficientes para escolher ${melhores}.`;
  return null;
}

/** Candidato a "melhor terceiro" (ou quarto…), já com os jogos descontados se os grupos forem desiguais. */
export interface LinhaMelhor {
  equipaId: string;
  nome: string;
  grupo: string;
  pts: number;
  dg: number;
  gm: number;
  v: number;
  fairPlay: number;
  sorteio: number | null;
}

/** Ranking entre grupos: pontos, diferença de golos, golos marcados, vitórias, fair play e sorteio. */
export function ordenarMelhores<T extends LinhaMelhor>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) =>
    b.pts - a.pts || b.dg - a.dg || b.gm - a.gm || b.v - a.v || a.fairPlay - b.fairPlay
    || (a.sorteio ?? Infinity) - (b.sorteio ?? Infinity) || a.nome.localeCompare(b.nome, 'pt'));
}

/**
 * Evita jogos entre equipas do mesmo grupo na primeira ronda, trocando o
 * segundo elemento de pares em conflito com o de outro par, quando a troca
 * resolve ambos. Não mexe nas melhores sementes.
 */
export function evitarMesmoGrupo(quadro: (string | null)[], grupoDe: Map<string, string>): (string | null)[] {
  const q = [...quadro];
  const conflito = (i: number) => {
    const [a, b] = [q[2 * i], q[2 * i + 1]];
    return Boolean(a && b && grupoDe.get(a) === grupoDe.get(b));
  };
  const pares = q.length / 2;
  for (let i = 0; i < pares; i++) {
    if (!conflito(i)) continue;
    for (let j = 0; j < pares; j++) {
      if (j === i || !q[2 * j + 1]) continue;
      [q[2 * i + 1], q[2 * j + 1]] = [q[2 * j + 1], q[2 * i + 1]];
      if (!conflito(i) && !conflito(j)) break;
      [q[2 * i + 1], q[2 * j + 1]] = [q[2 * j + 1], q[2 * i + 1]];  // não resolveu: desfaz
    }
  }
  return q;
}

// ---------- Eliminatórias ----------

const ePotenciaDe2 = (n: number) => n >= 1 && (n & (n - 1)) === 0;

export function potenciaDe2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordem das sementes nas posições do quadro: 1 e 2 só se podem encontrar na final. */
export function ordemSementes(tamanho: number): number[] {
  let ordem = [1];
  while (ordem.length < tamanho) {
    const n = ordem.length * 2;
    ordem = ordem.flatMap((s) => [s, n + 1 - s]);
  }
  return ordem;
}

/** Posição de cada equipa no quadro (índice → equipa, null = lugar vazio, que isenta o adversário). */
export function montarQuadro(sementes: string[]): (string | null)[] {
  return ordemSementes(potenciaDe2(sementes.length)).map((s) => sementes[s - 1] ?? null);
}

/** Na ronda final (eliminatória 2), a chave 0 é a final e a chave 1 o jogo do 3.º lugar. */
export const CHAVE_TERCEIRO = 1;

export interface RegrasEliminatoria {
  /** Rondas antes da final a duas mãos. */
  duasMaos: boolean;
  /** A final também a duas mãos (só conta com duasMaos). */
  finalDuasMaos: boolean;
  /** Jogo do 3.º lugar entre os derrotados das meias-finais. */
  terceiroLugar: boolean;
  /** Golos atribuídos num W.O. (contam para o agregado das duas mãos). */
  golosWO: number;
}

export const regrasDaCompeticao = (c: {
  duas_maos: boolean; final_duas_maos: boolean; terceiro_lugar: boolean; golos_wo: number;
}): RegrasEliminatoria => ({
  duasMaos: c.duas_maos, finalDuasMaos: c.final_duas_maos, terceiroLugar: c.terceiro_lugar, golosWO: c.golos_wo,
});

/** Esta eliminatória joga-se a duas mãos? (O 3.º lugar é sempre a um jogo.) */
export const temDuasMaos = (eliminatoria: number, chave: number, r: RegrasEliminatoria) =>
  r.duasMaos && (eliminatoria > 2 || (chave !== CHAVE_TERCEIRO && r.finalDuasMaos));

export interface JogoEliminatoria {
  /** Equipas ainda em prova nesta ronda: 2 = final, 4 = meias-finais… */
  eliminatoria: number;
  /** Posição na ronda (0, 1, 2…). O vencedor segue para a chave ⌊chave/2⌋. */
  chave: number;
  /** A melhor semente (na 2.ª mão joga em casa). */
  casaId: string;
  foraId: string;
}

/** Eliminatórias da primeira ronda. Quem não tem adversário passa sem jogar. */
export function primeiraRonda(quadro: (string | null)[]): JogoEliminatoria[] {
  const jogos: JogoEliminatoria[] = [];
  if (quadro.length < 2) return jogos;
  for (let c = 0; c < quadro.length / 2; c++) {
    const [a, b] = [quadro[2 * c], quadro[2 * c + 1]];
    if (a && b) jogos.push({ eliminatoria: quadro.length, chave: c, casaId: a, foraId: b });
  }
  return jogos;
}

export interface JogoParaVencedor {
  casa_id: string;
  fora_id: string;
  golos_casa: number | null;
  golos_fora: number | null;
  penaltis_casa: number | null;
  penaltis_fora: number | null;
  estado: EstadoJogo;
}

/** Golos que contam (W.O. incluído), ou null se o jogo ainda não tem resultado. */
function golosQueContam(j: JogoParaVencedor, golosWO: number): [number, number] | null {
  if (j.estado === 'wo_casa') return [0, golosWO];
  if (j.estado === 'wo_fora') return [golosWO, 0];
  if (j.estado !== 'terminado' || j.golos_casa == null || j.golos_fora == null) return null;
  return [j.golos_casa, j.golos_fora];
}

export interface Decisao {
  vencedor: string | null;
  perdedor: string | null;
  /** Golos de cada equipa somando as mãos (só com resultado em todas). */
  agregado: Map<string, number> | null;
  /** Empatada nos golos: é preciso o resultado dos penáltis (no único jogo ou na 2.ª mão). */
  empate: boolean;
}

/**
 * Quem passa uma eliminatória de um ou dois jogos. Nas duas mãos somam-se os
 * golos (sem regra dos golos fora); empate no total decide-se nos penáltis da
 * 2.ª mão. Num jogo único, um W.O. decide logo.
 */
export function decidirEliminatoria(maos: JogoParaVencedor[], golosWO: number): Decisao {
  const nada: Decisao = { vencedor: null, perdedor: null, agregado: null, empate: false };
  if (!maos.length) return nada;
  const [a, b] = [maos[0].casa_id, maos[0].fora_id];
  const decide = (v: string): Decisao => ({ ...nada, vencedor: v, perdedor: v === a ? b : a });

  if (maos.length === 1) {
    const j = maos[0];
    if (j.estado === 'wo_casa') return decide(j.fora_id);
    if (j.estado === 'wo_fora') return decide(j.casa_id);
  }
  const agregado = new Map([[a, 0], [b, 0]]);
  for (const j of maos) {
    const g = golosQueContam(j, golosWO);
    if (!g) return nada;
    agregado.set(j.casa_id, agregado.get(j.casa_id)! + g[0]);
    agregado.set(j.fora_id, agregado.get(j.fora_id)! + g[1]);
  }
  if (agregado.get(a) !== agregado.get(b))
    return { ...decide(agregado.get(a)! > agregado.get(b)! ? a : b), agregado };

  const ultima = maos[maos.length - 1];
  const pen = ultima.penaltis_casa != null && ultima.penaltis_fora != null && ultima.penaltis_casa !== ultima.penaltis_fora
    ? (ultima.penaltis_casa > ultima.penaltis_fora ? ultima.casa_id : ultima.fora_id) : null;
  return pen ? { ...decide(pen), agregado, empate: true } : { ...nada, agregado, empate: true };
}

/** Quem passa num jogo único (null se ainda não está decidido). */
export const vencedor = (j: JogoParaVencedor) => decidirEliminatoria([j], 0).vencedor;

export interface JogoNoQuadro extends JogoParaVencedor {
  eliminatoria: number | null;
  chave: number | null;
  mao: number | null;
}

/** Jogos de uma eliminatória (um, ou as duas mãos por ordem). */
export function jogosDaChave<T extends JogoNoQuadro>(jogos: T[], eliminatoria: number, chave: number): T[] {
  return jogos.filter((j) => j.eliminatoria === eliminatoria && j.chave === chave)
    .sort((x, y) => (x.mao ?? 0) - (y.mao ?? 0));
}

/**
 * Quem sai da posição `chave` da ronda `eliminatoria`: o vencedor ou, na
 * primeira ronda, a equipa isenta. undefined = ainda por decidir.
 */
export function apurado(
  jogos: JogoNoQuadro[], quadro: (string | null)[], eliminatoria: number, chave: number, golosWO = 0,
): string | undefined {
  const maos = jogosDaChave(jogos, eliminatoria, chave);
  if (maos.length) return decidirEliminatoria(maos, golosWO).vencedor ?? undefined;
  if (eliminatoria !== quadro.length) return undefined;
  const [a, b] = [quadro[2 * chave], quadro[2 * chave + 1]];
  // Isenção só quando o par tem uma única equipa
  return a && b ? undefined : (a ?? b ?? undefined);
}

/** Eliminatórias da ronda seguinte, ou quantas da ronda atual faltam decidir. */
export function proximaRonda(
  jogos: JogoNoQuadro[], quadro: (string | null)[], eliminatoria: number, golosWO = 0,
): { jogos: JogoEliminatoria[]; porDecidir: number } {
  const seguinte = eliminatoria / 2;
  const novos: JogoEliminatoria[] = [];
  let porDecidir = 0;
  if (seguinte < 2) return { jogos: novos, porDecidir };
  for (let c = 0; c < seguinte / 2; c++) {
    const a = apurado(jogos, quadro, eliminatoria, 2 * c, golosWO);
    const b = apurado(jogos, quadro, eliminatoria, 2 * c + 1, golosWO);
    if (a === undefined) porDecidir++;
    if (b === undefined) porDecidir++;
    if (a && b) novos.push({ eliminatoria: seguinte, chave: c, casaId: a, foraId: b });
  }
  return porDecidir ? { jogos: [], porDecidir } : { jogos: novos, porDecidir: 0 };
}

export function nomeEliminatoria(equipas: number): string {
  switch (equipas) {
    case 2: return 'Final';
    case 4: return 'Meias-finais';
    case 8: return 'Quartos de final';
    case 16: return 'Oitavos de final';
    default: return `${equipas / 2}-avos de final`;
  }
}

// ---------- Planeamento (o que o backoffice envia para a base de dados) ----------

export interface JogoPlaneado {
  jornada: number;
  casaId: string;
  foraId: string;
  grupo?: string;
  eliminatoria?: number;
  chave?: number;
  /** 1.ª ou 2.ª mão (vazio num jogo único). */
  mao?: number;
}

export interface Plano {
  jogos: JogoPlaneado[];
  /** Lugar de cada equipa no quadro (null = o formato não tem quadro nesta fase). */
  quadro: { equipa_id: string; posicao: number }[] | null;
}

export type ResultadoPlano = Plano | { erro: string };

const listaQuadro = (quadro: (string | null)[]) =>
  quadro.flatMap((equipa_id, posicao) => (equipa_id ? [{ equipa_id, posicao }] : []));

/**
 * Eliminatórias → jogos. A duas mãos, a 1.ª joga-se em casa da pior semente
 * e a 2.ª, na jornada seguinte, em casa da melhor.
 */
export function emJogos(ties: JogoEliminatoria[], jornada: number, r: RegrasEliminatoria): JogoPlaneado[] {
  return ties.flatMap((t) => temDuasMaos(t.eliminatoria, t.chave, r)
    ? [
      { ...t, casaId: t.foraId, foraId: t.casaId, jornada, mao: 1 },
      { ...t, jornada: jornada + 1, mao: 2 },
    ]
    : [{ ...t, jornada }]);
}

const SEM_REGRAS: RegrasEliminatoria = { duasMaos: false, finalDuasMaos: false, terceiroLugar: false, golosWO: 0 };

/** Primeiro calendário de uma competição, conforme o formato. */
export function planearCalendario(
  formato: Formato,
  participantes: { equipa_id: string; grupo: string | null; ordem_sorteio: number | null }[],
  idaVolta: boolean,
  regras: RegrasEliminatoria = SEM_REGRAS,
  aleatorio = Math.random,
): ResultadoPlano {
  if (participantes.length < 2) return { erro: 'São precisas pelo menos 2 equipas.' };

  if (formato === 'liga')
    return { jogos: gerarCalendario(participantes.map((p) => p.equipa_id), idaVolta), quadro: null };

  if (formato === 'grupos') {
    if (participantes.some((p) => !p.grupo))
      return { erro: 'Há equipas sem grupo. Use "Sortear grupos" ou escolha o grupo de cada equipa.' };
    const grupos = [...new Set(participantes.map((p) => p.grupo!))].sort();
    const jogos: JogoPlaneado[] = [];
    for (const g of grupos) {
      const ids = participantes.filter((p) => p.grupo === g).map((p) => p.equipa_id);
      if (ids.length < 2) return { erro: `O Grupo ${g} tem só uma equipa.` };
      jogos.push(...gerarCalendario(ids, idaVolta).map((j) => ({ ...j, grupo: g })));
    }
    return { jogos, quadro: null };
  }

  // Eliminatórias: cabeças de série pela ordem indicada, o resto sorteado
  const comSemente = participantes.filter((p) => p.ordem_sorteio != null)
    .sort((a, b) => a.ordem_sorteio! - b.ordem_sorteio!);
  const semSemente = participantes.filter((p) => p.ordem_sorteio == null);
  for (let i = semSemente.length - 1; i > 0; i--) {
    const k = Math.floor(aleatorio() * (i + 1));
    [semSemente[i], semSemente[k]] = [semSemente[k], semSemente[i]];
  }
  const quadro = montarQuadro([...comSemente, ...semSemente].map((p) => p.equipa_id));
  return { jogos: emJogos(primeiraRonda(quadro), 1, regras), quadro: listaQuadro(quadro) };
}

/**
 * Fase final a partir das tabelas dos grupos (e dos melhores terceiros, já por
 * ordem de ranking). Joga-se na jornada a seguir à última da fase de grupos.
 */
export function planearFaseFinal(
  grupos: { grupo: string; equipas: string[] }[],
  apurados: number,
  ultimaJornada: number,
  regras: RegrasEliminatoria = SEM_REGRAS,
  melhores: string[] = [],
): ResultadoPlano {
  const problema = validarFaseFinal(grupos.map((g) => g.equipas.length), apurados, melhores.length);
  if (problema) return { erro: problema };
  const grupoDe = new Map(grupos.flatMap((g) => g.equipas.map((e) => [e, g.grupo] as const)));
  const quadro = evitarMesmoGrupo(montarQuadro(sementesDosGrupos(grupos, apurados, melhores)), grupoDe);
  return { jogos: emJogos(primeiraRonda(quadro), ultimaJornada + 1, regras), quadro: listaQuadro(quadro) };
}

export interface JogoComJornada extends JogoNoQuadro {
  jornada: number;
}

/**
 * Ronda seguinte à mais avançada que já existe (com o 3.º lugar, se houver).
 * null quando não há fase final ou quando a final já está marcada.
 */
export function planearProximaRonda(
  jogos: JogoComJornada[], quadro: (string | null)[], regras: RegrasEliminatoria = SEM_REGRAS,
): { eliminatoria: number; jogos: JogoPlaneado[]; porDecidir: number } | null {
  const doQuadro = jogos.filter((j) => j.eliminatoria != null);
  if (!quadro.length) return null;
  // A ronda atual é a mais pequena já gerada; sem jogos gerados é a primeira (só isentos)
  const atual = doQuadro.length ? Math.min(...doQuadro.map((j) => j.eliminatoria!)) : quadro.length;
  if (atual <= 2) return null;
  const jornada = Math.max(0, ...doQuadro.filter((j) => j.eliminatoria === atual).map((j) => j.jornada)) + 1;
  const r = proximaRonda(doQuadro, quadro, atual, regras.golosWO);
  const ties = [...r.jogos];

  // Jogo do 3.º lugar: os derrotados das meias-finais (se ambas se jogaram)
  if (atual === 4 && regras.terceiroLugar && !r.porDecidir) {
    const [p0, p1] = [0, 1].map((c) => decidirEliminatoria(jogosDaChave(doQuadro, 4, c), regras.golosWO).perdedor);
    if (p0 && p1) ties.push({ eliminatoria: 2, chave: CHAVE_TERCEIRO, casaId: p0, foraId: p1 });
  }
  const principais = ties.filter((t) => t.chave !== CHAVE_TERCEIRO || t.eliminatoria !== 2);
  const terceiro = ties.filter((t) => t.eliminatoria === 2 && t.chave === CHAVE_TERCEIRO);
  // O 3.º lugar joga-se no dia da final (na 2.ª mão, se a final tiver duas)
  const jornadaTerceiro = jornada + (temDuasMaos(2, 0, regras) ? 1 : 0);
  return {
    eliminatoria: atual / 2,
    porDecidir: r.porDecidir,
    jogos: [...emJogos(principais, jornada, regras), ...emJogos(terceiro, jornadaTerceiro, regras)],
  };
}

/** A eliminatória deste jogo está empatada nos golos e precisa dos penáltis (só no jogo único ou na 2.ª mão). */
export function precisaPenaltis<T extends JogoNoQuadro & { id: string }>(jogo: T, todos: T[], golosWO: number): boolean {
  if (jogo.eliminatoria == null || jogo.chave == null || jogo.mao === 1) return false;
  const maos = jogo.mao === 2
    ? jogosDaChave(todos, jogo.eliminatoria, jogo.chave).map((j) => (j.id === jogo.id ? jogo : j))
    : [jogo];
  // Os penáltis já escritos não contam para saber se estava empatado
  const semPenaltis = maos.map((j) => ({ ...j, penaltis_casa: null, penaltis_fora: null }));
  return decidirEliminatoria(semPenaltis, golosWO).empate;
}

// ---------- Agrupamento para mostrar ----------

type Fase = { jornada: number; eliminatoria?: number | null; chave?: number | null; mao?: number | null };

/** Título do bloco a que o jogo pertence: jornada, ronda (com a mão) ou 3.º lugar. */
export function nomeFase(j: Fase): string {
  if (j.eliminatoria == null) return `Jornada ${j.jornada}`;
  if (j.eliminatoria === 2 && j.chave === CHAVE_TERCEIRO) return '3.º lugar';
  const ronda = nomeEliminatoria(j.eliminatoria);
  return j.mao ? `${ronda} (${j.mao}.ª mão)` : ronda;
}

/** Jogos agrupados por jornada ou ronda, pela ordem em que aparecem. */
export function blocosDeJogos<T extends Fase>(jogos: T[]) {
  const blocos = new Map<string, T[]>();
  for (const j of jogos) blocos.set(nomeFase(j), [...(blocos.get(nomeFase(j)) ?? []), j]);
  return [...blocos].map(([titulo, lista]) => ({ titulo, jogos: lista }));
}
