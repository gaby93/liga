import { describe, expect, it } from 'vitest';
import { calcularClassificacao, type JogoCalc } from './classificacao';
import { gerarCalendario } from './calendario';
import type { Criterio } from './types';

const regras = { vitoria: 3, empate: 1, derrota: 0, golosWO: 3 };
const criterios: Criterio[] = [
  'pontos', 'confronto_pontos', 'confronto_dif', 'confronto_golos',
  'dif_golos', 'golos_marcados', 'fair_play', 'sorteio',
];
const eq = (...nomes: string[]) => nomes.map((n) => ({ id: n, nome: n }));
const jogo = (casa: string, fora: string, gc: number, gf: number): JogoCalc => ({
  casaId: casa, foraId: fora, golosCasa: gc, golosFora: gf, estado: 'terminado',
});

describe('classificação', () => {
  it('ordena por pontos e calcula estatísticas', () => {
    const t = calcularClassificacao({
      equipas: eq('A', 'B'), regras, criterios,
      jogos: [jogo('A', 'B', 2, 1)],
    });
    expect(t.map((l) => l.equipaId)).toEqual(['A', 'B']);
    expect(t[0]).toMatchObject({ j: 1, v: 1, gm: 2, gs: 1, dg: 1, pts: 3, forma: ['V'] });
    expect(t[1]).toMatchObject({ d: 1, pts: 0, forma: ['D'] });
  });

  it('reaplica o confronto direto ao subgrupo quando 3 equipas empatam', () => {
    // A, B e C têm 6 pontos. No confronto direto todas têm 3 pontos;
    // A sai pela diferença (-2). Entre B e C, B venceu o jogo direto (2-0),
    // embora C tenha mais golos no mini-campeonato a três.
    const t = calcularClassificacao({
      equipas: eq('A', 'B', 'C', 'D'), regras, criterios,
      jogos: [
        jogo('A', 'B', 1, 0), jogo('B', 'C', 2, 0), jogo('C', 'A', 3, 0),
        jogo('A', 'D', 1, 0), jogo('B', 'D', 1, 0), jogo('C', 'D', 1, 0),
      ],
    });
    expect(t.map((l) => l.equipaId)).toEqual(['B', 'C', 'A', 'D']);
    expect(t[0].motivo).toBe('Pontos no confronto direto');
    expect(t[2].motivo).toBe('Diferença de golos no confronto direto');
    expect(t[3].motivo).toBeUndefined();
  });

  it('atribui a vitória por W.O. com os golos definidos nas regras', () => {
    const t = calcularClassificacao({
      equipas: eq('A', 'B'), regras, criterios,
      jogos: [{ casaId: 'A', foraId: 'B', golosCasa: null, golosFora: null, estado: 'wo_casa' }],
    });
    expect(t[0]).toMatchObject({ equipaId: 'B', pts: 3, gm: 3 });
    expect(t[1]).toMatchObject({ equipaId: 'A', pts: 0, gs: 3 });
  });

  it('ignora jogos agendados e adiados', () => {
    const t = calcularClassificacao({
      equipas: eq('A', 'B'), regras, criterios,
      jogos: [
        { casaId: 'A', foraId: 'B', golosCasa: null, golosFora: null, estado: 'agendado' },
        { casaId: 'B', foraId: 'A', golosCasa: 2, golosFora: 0, estado: 'adiado' },
      ],
    });
    expect(t.every((l) => l.j === 0)).toBe(true);
  });

  it('aplica sanções de pontos', () => {
    const t = calcularClassificacao({
      equipas: eq('A', 'B'), regras, criterios,
      jogos: [jogo('A', 'B', 1, 0)],
      sancoes: [{ equipaId: 'A', pontos: -4 }],
    });
    expect(t.map((l) => l.equipaId)).toEqual(['B', 'A']);
    expect(t[1]).toMatchObject({ pts: -1, sancao: -4 });
  });

  it('usa fair play e depois sorteio', () => {
    const base = { equipas: eq('A', 'B'), regras, criterios, jogos: [jogo('A', 'B', 1, 1)] };
    expect(calcularClassificacao({ ...base, fairPlay: { A: 4, B: 1 } })[0].equipaId).toBe('B');

    const semSorteio = calcularClassificacao(base);
    expect(semSorteio[0].motivo).toBe('Empate total, falta realizar o sorteio');

    const comSorteio = calcularClassificacao({
      ...base,
      equipas: [{ id: 'A', nome: 'A', ordemSorteio: 2 }, { id: 'B', nome: 'B', ordemSorteio: 1 }],
    });
    expect(comSorteio.map((l) => l.equipaId)).toEqual(['B', 'A']);
    expect(comSorteio[0].motivo).toBe('Sorteio');
  });
});

describe('calendário', () => {
  const verificar = (n: number, idaVolta: boolean) => {
    const ids = Array.from({ length: n }, (_, i) => `E${i}`);
    const jogos = gerarCalendario(ids, idaVolta);
    const rondas = (n % 2 ? n : n - 1) * (idaVolta ? 2 : 1);
    expect(Math.max(...jogos.map((j) => j.jornada))).toBe(rondas);
    expect(jogos.length).toBe(((n * (n - 1)) / 2) * (idaVolta ? 2 : 1));

    // Cada equipa joga no máximo uma vez por jornada
    for (let r = 1; r <= rondas; r++) {
      const naRonda = jogos.filter((j) => j.jornada === r).flatMap((j) => [j.casaId, j.foraId]);
      expect(new Set(naRonda).size).toBe(naRonda.length);
    }
    // Cada par joga o número certo de vezes
    const pares = new Map<string, number>();
    for (const j of jogos) {
      const k = [j.casaId, j.foraId].sort().join('-');
      pares.set(k, (pares.get(k) ?? 0) + 1);
    }
    expect([...pares.values()].every((v) => v === (idaVolta ? 2 : 1))).toBe(true);
    // Equilíbrio casa/fora: diferença máxima de 1 jogo por volta
    const casa = new Map<string, number>();
    for (const j of jogos) casa.set(j.casaId, (casa.get(j.casaId) ?? 0) + 1);
    const jogosPorEquipa = (n - 1) * (idaVolta ? 2 : 1);
    for (const id of ids) expect(Math.abs(2 * (casa.get(id) ?? 0) - jogosPorEquipa)).toBeLessThanOrEqual(idaVolta ? 0 : 2);
  };

  it('gera todos contra todos com número par', () => verificar(8, false));
  it('gera todos contra todos com número ímpar (folgas)', () => verificar(7, false));
  it('gera ida e volta', () => verificar(6, true));
});
