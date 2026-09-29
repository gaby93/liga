import { CRITERIO_LABEL, type Criterio, type EstadoJogo } from './types';

export interface Regras {
  vitoria: number;
  empate: number;
  derrota: number;
  golosWO: number;
}

export interface JogoCalc {
  casaId: string;
  foraId: string;
  golosCasa: number | null;
  golosFora: number | null;
  estado: EstadoJogo;
}

export interface EntradaClassificacao {
  equipas: { id: string; nome: string; ordemSorteio?: number | null }[];
  /** Jogos por ordem cronológica (usado para a forma recente). */
  jogos: JogoCalc[];
  regras: Regras;
  /** Critérios por ordem de aplicação. */
  criterios: Criterio[];
  /** Sanções em pontos (valores negativos retiram pontos). */
  sancoes?: { equipaId: string; pontos: number }[];
  /** Pontos de disciplina por equipa (menos é melhor). */
  fairPlay?: Record<string, number>;
}

export type ResultadoForma = 'V' | 'E' | 'D';

export interface Linha {
  posicao: number;
  equipaId: string;
  nome: string;
  j: number;
  v: number;
  e: number;
  d: number;
  gm: number;
  gs: number;
  dg: number;
  pts: number;
  sancao: number;
  fairPlay: number;
  forma: ResultadoForma[];
  /** Critério que decidiu a posição face às equipas empatadas em pontos. */
  motivo?: string;
}

interface Resultado {
  casaId: string;
  foraId: string;
  gc: number;
  gf: number;
}

interface Stats {
  j: number;
  v: number;
  e: number;
  d: number;
  gm: number;
  gs: number;
  pts: number;
}

const CONFRONTO: Criterio[] = ['confronto_pontos', 'confronto_dif', 'confronto_golos'];
const eConfronto = (c: Criterio) => CONFRONTO.includes(c);

/** Converte um jogo no resultado que conta para a tabela (ou null se não conta). */
export function resultadoEfetivo(j: JogoCalc, golosWO: number): Resultado | null {
  const base = { casaId: j.casaId, foraId: j.foraId };
  switch (j.estado) {
    case 'terminado':
      if (j.golosCasa == null || j.golosFora == null) return null;
      return { ...base, gc: j.golosCasa, gf: j.golosFora };
    case 'wo_casa':
      return { ...base, gc: 0, gf: golosWO };
    case 'wo_fora':
      return { ...base, gc: golosWO, gf: 0 };
    default:
      return null;
  }
}

function acumular(resultados: Resultado[], ids: Set<string>, regras: Regras): Map<string, Stats> {
  const m = new Map<string, Stats>();
  for (const id of ids) m.set(id, { j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, pts: 0 });
  for (const r of resultados) {
    if (!ids.has(r.casaId) || !ids.has(r.foraId)) continue;
    const c = m.get(r.casaId)!;
    const f = m.get(r.foraId)!;
    c.j++; f.j++;
    c.gm += r.gc; c.gs += r.gf;
    f.gm += r.gf; f.gs += r.gc;
    if (r.gc > r.gf) {
      c.v++; f.d++; c.pts += regras.vitoria; f.pts += regras.derrota;
    } else if (r.gc < r.gf) {
      f.v++; c.d++; f.pts += regras.vitoria; c.pts += regras.derrota;
    } else {
      c.e++; f.e++; c.pts += regras.empate; f.pts += regras.empate;
    }
  }
  return m;
}

/**
 * Calcula a classificação aplicando os critérios de desempate por ordem.
 *
 * Confronto direto com 3+ equipas: calcula-se uma mini-tabela só com os jogos
 * entre as equipas empatadas. Se um critério de confronto direto separar parte
 * do grupo, os critérios de confronto direto são reaplicados desde o início ao
 * subgrupo que continua empatado (regra usada pela UEFA).
 */
export function calcularClassificacao(entrada: EntradaClassificacao): Linha[] {
  const { regras, criterios } = entrada;
  const ids = entrada.equipas.map((e) => e.id);
  const nome = new Map(entrada.equipas.map((e) => [e.id, e.nome]));
  const sorteio = new Map(entrada.equipas.map((e) => [e.id, e.ordemSorteio ?? null]));
  const fp = entrada.fairPlay ?? {};

  const resultados = entrada.jogos
    .map((j) => resultadoEfetivo(j, regras.golosWO))
    .filter((r): r is Resultado => r !== null);

  const geral = acumular(resultados, new Set(ids), regras);

  const sancao = new Map<string, number>();
  for (const s of entrada.sancoes ?? []) sancao.set(s.equipaId, (sancao.get(s.equipaId) ?? 0) + s.pontos);

  const cacheConfronto = new Map<string, Map<string, Stats>>();
  const statsConfronto = (grupo: string[]) => {
    const chave = [...grupo].sort().join('|');
    let s = cacheConfronto.get(chave);
    if (!s) {
      s = acumular(resultados, new Set(grupo), regras);
      cacheConfronto.set(chave, s);
    }
    return s;
  };

  const valor = (c: Criterio, id: string, grupo: string[]): number => {
    const g = geral.get(id)!;
    switch (c) {
      case 'pontos':
        return g.pts + (sancao.get(id) ?? 0);
      case 'dif_golos':
        return g.gm - g.gs;
      case 'golos_marcados':
        return g.gm;
      case 'fair_play':
        return -(fp[id] ?? 0);
      case 'sorteio': {
        const o = sorteio.get(id);
        return o == null ? Number.NEGATIVE_INFINITY : -o;
      }
      case 'confronto_pontos':
        return statsConfronto(grupo).get(id)!.pts;
      case 'confronto_dif': {
        const s = statsConfronto(grupo).get(id)!;
        return s.gm - s.gs;
      }
      case 'confronto_golos':
        return statsConfronto(grupo).get(id)!.gm;
    }
  };

  const inicioConfronto = criterios.findIndex(eConfronto);
  const motivos = new Map<string, string>();

  const ordenar = (grupo: string[], idx: number): string[] => {
    if (grupo.length <= 1) return grupo;
    if (idx >= criterios.length) {
      // Nenhum critério separou: ordem alfabética até o sorteio ser feito
      for (const id of grupo) motivos.set(id, 'Empate total, falta realizar o sorteio');
      return [...grupo].sort((a, b) => nome.get(a)!.localeCompare(nome.get(b)!, 'pt'));
    }
    const c = criterios[idx];
    const valores = new Map(grupo.map((id) => [id, valor(c, id, grupo)]));
    const distintos = [...new Set(valores.values())].sort((a, b) => b - a);
    if (distintos.length === 1) return ordenar(grupo, idx + 1);

    if (c !== 'pontos') for (const id of grupo) motivos.set(id, CRITERIO_LABEL[c]);

    const saida: string[] = [];
    for (const v of distintos) {
      const sub = grupo.filter((id) => valores.get(id) === v);
      const proximo = eConfronto(c) ? inicioConfronto : idx + 1;
      saida.push(...ordenar(sub, proximo));
    }
    return saida;
  };

  const ordem = ordenar(ids, 0);

  const forma = new Map<string, ResultadoForma[]>(ids.map((id) => [id, []]));
  for (const r of resultados) {
    const rc: ResultadoForma = r.gc > r.gf ? 'V' : r.gc < r.gf ? 'D' : 'E';
    const rf: ResultadoForma = rc === 'V' ? 'D' : rc === 'D' ? 'V' : 'E';
    forma.get(r.casaId)?.push(rc);
    forma.get(r.foraId)?.push(rf);
  }

  return ordem.map((id, i) => {
    const g = geral.get(id)!;
    const s = sancao.get(id) ?? 0;
    return {
      posicao: i + 1,
      equipaId: id,
      nome: nome.get(id)!,
      ...g,
      dg: g.gm - g.gs,
      pts: g.pts + s,
      sancao: s,
      fairPlay: fp[id] ?? 0,
      forma: forma.get(id)!.slice(-5),
      motivo: motivos.get(id),
    };
  });
}

/** Pontos de disciplina a partir dos cartões: amarelo = 1, vermelho = 3. */
export function calcularFairPlay(eventos: { equipa_id: string; tipo: string }[]): Record<string, number> {
  const fp: Record<string, number> = {};
  for (const e of eventos) {
    const p = e.tipo === 'amarelo' ? 1 : e.tipo === 'vermelho' ? 3 : 0;
    if (p) fp[e.equipa_id] = (fp[e.equipa_id] ?? 0) + p;
  }
  return fp;
}
