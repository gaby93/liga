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
 * de grupo), depois os 2.º, etc. Com o quadro clássico isto dá 1.º A × 2.º B,
 * 1.º B × 2.º A…, e equipas do mesmo grupo não se cruzam na primeira ronda.
 */
export function sementesDosGrupos(tabelas: { grupo: string; equipas: string[] }[], apurados: number): string[] {
  const ordenadas = [...tabelas].sort((a, b) => a.grupo.localeCompare(b.grupo));
  const sementes: string[] = [];
  for (let pos = 0; pos < apurados; pos++) for (const t of ordenadas) sementes.push(t.equipas[pos]);
  return sementes;
}

/** Problema que impede a fase final (ou null se está tudo bem). */
export function validarFaseFinal(tamanhosGrupos: number[], apurados: number): string | null {
  const total = tamanhosGrupos.length * apurados;
  if (total < 2) return 'A fase final precisa de pelo menos 2 equipas apuradas.';
  if (!ePotenciaDe2(total))
    return `${tamanhosGrupos.length} grupos × ${apurados} apurados = ${total} equipas. A fase final precisa de 2, 4, 8, 16 ou 32.`;
  if (tamanhosGrupos.some((n) => n < apurados)) return `Há grupos com menos de ${apurados} equipas.`;
  return null;
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

export interface JogoEliminatoria {
  /** Equipas ainda em prova nesta ronda: 2 = final, 4 = meias-finais… */
  eliminatoria: number;
  /** Posição do jogo na ronda (0, 1, 2…). O vencedor segue para a chave ⌊chave/2⌋. */
  chave: number;
  casaId: string;
  foraId: string;
}

/** Jogos da primeira ronda. Quem não tem adversário passa sem jogar. */
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

/** Quem passa a eliminatória (null se ainda não está decidido). */
export function vencedor(j: JogoParaVencedor): string | null {
  if (j.estado === 'wo_casa') return j.fora_id;
  if (j.estado === 'wo_fora') return j.casa_id;
  if (j.estado !== 'terminado' || j.golos_casa == null || j.golos_fora == null) return null;
  if (j.golos_casa !== j.golos_fora) return j.golos_casa > j.golos_fora ? j.casa_id : j.fora_id;
  if (j.penaltis_casa == null || j.penaltis_fora == null || j.penaltis_casa === j.penaltis_fora) return null;
  return j.penaltis_casa > j.penaltis_fora ? j.casa_id : j.fora_id;
}

export interface JogoNoQuadro extends JogoParaVencedor {
  eliminatoria: number | null;
  chave: number | null;
}

export function jogoNoQuadro<T extends JogoNoQuadro>(jogos: T[], eliminatoria: number, chave: number): T | undefined {
  return jogos.find((j) => j.eliminatoria === eliminatoria && j.chave === chave);
}

/**
 * Quem sai da posição `chave` da ronda `eliminatoria`: o vencedor do jogo ou,
 * na primeira ronda, a equipa isenta. undefined = ainda por decidir.
 */
export function apurado(jogos: JogoNoQuadro[], quadro: (string | null)[], eliminatoria: number, chave: number): string | undefined {
  const jogo = jogoNoQuadro(jogos, eliminatoria, chave);
  if (jogo) return vencedor(jogo) ?? undefined;
  if (eliminatoria !== quadro.length) return undefined;
  const [a, b] = [quadro[2 * chave], quadro[2 * chave + 1]];
  // Isenção só quando o par tem uma única equipa
  return a && b ? undefined : (a ?? b ?? undefined);
}

/** Jogos da ronda seguinte, ou quantos jogos da ronda atual faltam decidir. */
export function proximaRonda(
  jogos: JogoNoQuadro[], quadro: (string | null)[], eliminatoria: number,
): { jogos: JogoEliminatoria[]; porDecidir: number } {
  const seguinte = eliminatoria / 2;
  const novos: JogoEliminatoria[] = [];
  let porDecidir = 0;
  if (seguinte < 2) return { jogos: novos, porDecidir };
  for (let c = 0; c < seguinte / 2; c++) {
    const a = apurado(jogos, quadro, eliminatoria, 2 * c);
    const b = apurado(jogos, quadro, eliminatoria, 2 * c + 1);
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
}

export interface Plano {
  jogos: JogoPlaneado[];
  /** Lugar de cada equipa no quadro (null = o formato não tem quadro nesta fase). */
  quadro: { equipa_id: string; posicao: number }[] | null;
}

export type ResultadoPlano = Plano | { erro: string };

const listaQuadro = (quadro: (string | null)[]) =>
  quadro.flatMap((equipa_id, posicao) => (equipa_id ? [{ equipa_id, posicao }] : []));

/** Primeiro calendário de uma competição, conforme o formato. */
export function planearCalendario(
  formato: Formato,
  participantes: { equipa_id: string; grupo: string | null; ordem_sorteio: number | null }[],
  idaVolta: boolean,
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
  return { jogos: primeiraRonda(quadro).map((j) => ({ ...j, jornada: 1 })), quadro: listaQuadro(quadro) };
}

/** Fase final a partir das tabelas dos grupos. Joga-se na jornada a seguir à última da fase de grupos. */
export function planearFaseFinal(
  grupos: { grupo: string; equipas: string[] }[], apurados: number, ultimaJornada: number,
): ResultadoPlano {
  const problema = validarFaseFinal(grupos.map((g) => g.equipas.length), apurados);
  if (problema) return { erro: problema };
  const quadro = montarQuadro(sementesDosGrupos(grupos, apurados));
  return { jogos: primeiraRonda(quadro).map((j) => ({ ...j, jornada: ultimaJornada + 1 })), quadro: listaQuadro(quadro) };
}

export interface JogoComJornada extends JogoNoQuadro {
  jornada: number;
}

/**
 * Ronda seguinte à mais avançada que já existe. null quando não há fase final
 * ou quando a final já está marcada.
 */
export function planearProximaRonda(
  jogos: JogoComJornada[], quadro: (string | null)[],
): { eliminatoria: number; jogos: JogoPlaneado[]; porDecidir: number } | null {
  const doQuadro = jogos.filter((j) => j.eliminatoria != null);
  if (!quadro.length) return null;
  // A ronda atual é a mais pequena já gerada; sem jogos gerados é a primeira (só isentos)
  const atual = doQuadro.length ? Math.min(...doQuadro.map((j) => j.eliminatoria!)) : quadro.length;
  if (atual <= 2) return null;
  const jornada = Math.max(0, ...doQuadro.filter((j) => j.eliminatoria === atual).map((j) => j.jornada)) + 1;
  const r = proximaRonda(doQuadro, quadro, atual);
  return { eliminatoria: atual / 2, porDecidir: r.porDecidir, jogos: r.jogos.map((j) => ({ ...j, jornada })) };
}
