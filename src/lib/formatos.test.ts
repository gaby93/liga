import { describe, expect, it } from 'vitest';
import {
  apurado, montarQuadro, nomeEliminatoria, ordemSementes, planearCalendario, planearFaseFinal,
  planearProximaRonda, primeiraRonda, proximaRonda,
  sementesDosGrupos, sortearGrupos, validarFaseFinal, vencedor, type JogoNoQuadro,
} from './formatos';
import type { EstadoJogo } from './types';

const jogo = (eliminatoria: number, chave: number, casa: string, fora: string,
  gc: number | null, gf: number | null, extra: Partial<JogoNoQuadro> = {}): JogoNoQuadro => ({
  eliminatoria, chave, casa_id: casa, fora_id: fora, golos_casa: gc, golos_fora: gf,
  penaltis_casa: null, penaltis_fora: null, estado: (gc == null ? 'agendado' : 'terminado') as EstadoJogo, ...extra,
});

describe('quadro de eliminatórias', () => {
  it('coloca as sementes para que 1 e 2 só se cruzem na final', () => {
    expect(ordemSementes(4)).toEqual([1, 4, 2, 3]);
    expect(ordemSementes(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('isenta as melhores sementes quando faltam equipas', () => {
    const quadro = montarQuadro(['S1', 'S2', 'S3', 'S4', 'S5']);
    expect(quadro).toHaveLength(8);
    const jogos = primeiraRonda(quadro);
    // 5 equipas num quadro de 8: só S4 × S5 joga, os outros passam
    expect(jogos).toEqual([{ eliminatoria: 8, chave: 1, casaId: 'S4', foraId: 'S5' }]);
    expect(apurado([], quadro, 8, 0)).toBe('S1');
    expect(apurado([], quadro, 8, 1)).toBeUndefined();
  });

  it('decide por golos, penáltis e W.O.', () => {
    expect(vencedor(jogo(2, 0, 'A', 'B', 2, 1))).toBe('A');
    expect(vencedor(jogo(2, 0, 'A', 'B', 1, 1))).toBeNull();
    expect(vencedor(jogo(2, 0, 'A', 'B', 1, 1, { penaltis_casa: 3, penaltis_fora: 4 }))).toBe('B');
    expect(vencedor(jogo(2, 0, 'A', 'B', null, null, { estado: 'wo_casa' }))).toBe('B');
    expect(vencedor(jogo(2, 0, 'A', 'B', null, null))).toBeNull();
  });

  it('gera a ronda seguinte com isentos e vencedores', () => {
    const quadro = montarQuadro(['S1', 'S2', 'S3', 'S4', 'S5']);
    const ronda1 = [jogo(8, 1, 'S4', 'S5', 0, 2)];
    const r = proximaRonda(ronda1, quadro, 8);
    expect(r.porDecidir).toBe(0);
    expect(r.jogos).toEqual([
      { eliminatoria: 4, chave: 0, casaId: 'S1', foraId: 'S5' },
      { eliminatoria: 4, chave: 1, casaId: 'S2', foraId: 'S3' },
    ]);
  });

  it('não avança enquanto houver jogos por decidir', () => {
    const quadro = montarQuadro(['A', 'B', 'C', 'D']);
    const r = proximaRonda([jogo(4, 0, 'A', 'D', 1, 0), jogo(4, 1, 'B', 'C', 2, 2)], quadro, 4);
    expect(r).toEqual({ jogos: [], porDecidir: 1 });
  });

  it('dá nome às rondas', () => {
    expect([2, 4, 8, 16, 32].map(nomeEliminatoria)).toEqual(
      ['Final', 'Meias-finais', 'Quartos de final', 'Oitavos de final', '16-avos de final']);
  });
});

describe('fase de grupos', () => {
  it('distribui as equipas de forma equilibrada', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `E${i}`);
    const grupos = sortearGrupos(ids, 3);
    const tamanhos = ['A', 'B', 'C'].map((g) => [...grupos.values()].filter((x) => x === g).length);
    expect(tamanhos.sort()).toEqual([3, 3, 4]);
  });

  it('cruza 1.º de um grupo com 2.º de outro', () => {
    const sementes = sementesDosGrupos([
      { grupo: 'B', equipas: ['B1', 'B2', 'B3'] },
      { grupo: 'A', equipas: ['A1', 'A2', 'A3'] },
    ], 2);
    expect(primeiraRonda(montarQuadro(sementes)).map((j) => [j.casaId, j.foraId]))
      .toEqual([['A1', 'B2'], ['B1', 'A2']]);
  });

  it('com 4 grupos nenhum jogo da 1.ª ronda junta equipas do mesmo grupo', () => {
    const tabelas = ['A', 'B', 'C', 'D'].map((g) => ({ grupo: g, equipas: [`${g}1`, `${g}2`] }));
    const jogos = primeiraRonda(montarQuadro(sementesDosGrupos(tabelas, 2)));
    expect(jogos).toHaveLength(4);
    for (const j of jogos) expect(j.casaId[0]).not.toBe(j.foraId[0]);
  });

  it('valida o número de apurados', () => {
    expect(validarFaseFinal([4, 4], 2)).toBeNull();
    expect(validarFaseFinal([4, 4, 4], 2)).toMatch(/2, 4, 8/);
    expect(validarFaseFinal([4, 1], 2)).toMatch(/menos de 2/);
  });
});

describe('planeamento', () => {
  const p = (equipa_id: string, grupo: string | null = null, ordem_sorteio: number | null = null) =>
    ({ equipa_id, grupo, ordem_sorteio });

  it('gera os jogos de cada grupo com o grupo marcado', () => {
    const r = planearCalendario('grupos', [p('A1', 'A'), p('A2', 'A'), p('A3', 'A'), p('B1', 'B'), p('B2', 'B')], false);
    if ('erro' in r) throw new Error(r.erro);
    expect(r.jogos.filter((j) => j.grupo === 'A')).toHaveLength(3);
    expect(r.jogos.filter((j) => j.grupo === 'B')).toHaveLength(1);
    expect(r.quadro).toBeNull();
  });

  it('recusa grupos incompletos', () => {
    expect(planearCalendario('grupos', [p('A1', 'A'), p('A2', null)], false)).toHaveProperty('erro');
    expect(planearCalendario('grupos', [p('A1', 'A'), p('A2', 'A'), p('B1', 'B')], false))
      .toEqual({ erro: 'O Grupo B tem só uma equipa.' });
  });

  it('nas eliminatórias respeita as cabeças de série', () => {
    const r = planearCalendario('eliminatorias', [p('X'), p('S2', null, 2), p('Y'), p('S1', null, 1), p('Z')], false);
    if ('erro' in r) throw new Error(r.erro);
    // 5 equipas: S1 e S2 ficam isentas
    const jogam = r.jogos.flatMap((j) => [j.casaId, j.foraId]);
    expect(jogam).not.toContain('S1');
    expect(jogam).not.toContain('S2');
    expect(r.quadro).toHaveLength(5);
    expect(r.quadro!.find((q) => q.equipa_id === 'S1')!.posicao).toBe(0);
  });

  it('marca a fase final para a jornada seguinte aos grupos', () => {
    const r = planearFaseFinal([{ grupo: 'A', equipas: ['A1', 'A2'] }, { grupo: 'B', equipas: ['B1', 'B2'] }], 2, 3);
    if ('erro' in r) throw new Error(r.erro);
    expect(r.jogos.map((j) => j.jornada)).toEqual([4, 4]);
    expect(r.jogos.every((j) => j.eliminatoria === 4)).toBe(true);
  });

  it('planeia a ronda seguinte e para na final', () => {
    const quadro = montarQuadro(['A', 'B', 'C', 'D']);
    const meias = [
      { ...jogo(4, 0, 'A', 'D', 1, 0), jornada: 5 },
      { ...jogo(4, 1, 'B', 'C', 0, 3), jornada: 5 },
    ];
    const r = planearProximaRonda(meias, quadro);
    expect(r).toEqual({ eliminatoria: 2, porDecidir: 0, jogos: [{ eliminatoria: 2, chave: 0, casaId: 'A', foraId: 'C', jornada: 6 }] });
    expect(planearProximaRonda([...meias, { ...jogo(2, 0, 'A', 'C', null, null), jornada: 6 }], quadro)).toBeNull();
  });
});
