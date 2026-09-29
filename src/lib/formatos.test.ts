import { describe, expect, it } from 'vitest';
import {
  apurado, montarQuadro, nomeEliminatoria, ordemSementes, planearCalendario, planearFaseFinal,
  planearProximaRonda, primeiraRonda, proximaRonda, CHAVE_TERCEIRO, decidirEliminatoria, emJogos, nomeFase,
  ordenarMelhores, precisaPenaltis,
  sementesDosGrupos, sortearGrupos, validarFaseFinal, vencedor, type JogoNoQuadro,
} from './formatos';
import type { EstadoJogo } from './types';

const jogo = (eliminatoria: number, chave: number, casa: string, fora: string,
  gc: number | null, gf: number | null, extra: Partial<JogoNoQuadro> = {}): JogoNoQuadro => ({
  eliminatoria, chave, casa_id: casa, fora_id: fora, golos_casa: gc, golos_fora: gf,
  penaltis_casa: null, penaltis_fora: null, mao: null, estado: (gc == null ? 'agendado' : 'terminado') as EstadoJogo, ...extra,
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

describe('duas mãos, 3.º lugar e melhores terceiros', () => {
  const regras = { duasMaos: true, finalDuasMaos: false, terceiroLugar: true, golosWO: 3 };
  // Eliminatória a duas mãos: a 1.ª em casa de B, a 2.ª em casa de A
  const maos = (e: number, c: number, a: string, b: string, g1: [number, number] | null, g2: [number, number] | null,
    extra2: Partial<JogoNoQuadro> = {}) => [
    { ...jogo(e, c, b, a, g1?.[0] ?? null, g1?.[1] ?? null), mao: 1, id: `${e}-${c}-1`, jornada: 1 },
    { ...jogo(e, c, a, b, g2?.[0] ?? null, g2?.[1] ?? null, extra2), mao: 2, id: `${e}-${c}-2`, jornada: 2 },
  ];

  it('soma os golos das duas mãos', () => {
    // B 2-1 A na 1.ª mão; A 2-0 B na 2.ª: total A 3-2 B
    const d = decidirEliminatoria(maos(4, 0, 'A', 'B', [2, 1], [2, 0]), 3);
    expect(d.vencedor).toBe('A');
    expect(d.perdedor).toBe('B');
    expect([d.agregado!.get('A'), d.agregado!.get('B')]).toEqual([3, 2]);
  });

  it('empate no total: decide nos penáltis da 2.ª mão, sem golos fora', () => {
    // B 1-0 A; A 2-1 B: total 2-2 (A marcou 0 fora, B marcou 1 fora, mas não conta)
    const semPen = decidirEliminatoria(maos(4, 0, 'A', 'B', [1, 0], [2, 1]), 3);
    expect(semPen).toMatchObject({ vencedor: null, empate: true });
    const comPen = decidirEliminatoria(maos(4, 0, 'A', 'B', [1, 0], [2, 1], { penaltis_casa: 3, penaltis_fora: 5 }), 3);
    expect(comPen).toMatchObject({ vencedor: 'B', empate: true });
  });

  it('um W.O. numa mão conta com os golos das regras', () => {
    const [ida, volta] = maos(4, 0, 'A', 'B', [0, 0], null);
    const d = decidirEliminatoria([ida, { ...volta, estado: 'wo_fora' as EstadoJogo }], 3);
    expect(d.vencedor).toBe('A');
    expect(decidirEliminatoria(maos(4, 0, 'A', 'B', [1, 0], null), 3).vencedor).toBeNull();
  });

  it('só pede penáltis no jogo único ou na 2.ª mão empatada no total', () => {
    const [ida, volta] = maos(4, 0, 'A', 'B', [1, 0], [1, 0]);
    const todos = [ida, volta];
    expect(precisaPenaltis(ida, todos, 3)).toBe(false);
    expect(precisaPenaltis(volta, todos, 3)).toBe(true);
    expect(precisaPenaltis({ ...volta, golos_casa: 2 }, todos, 3)).toBe(false);
    const unico = { ...jogo(2, 0, 'A', 'B', 1, 1), id: 'f' };
    expect(precisaPenaltis(unico, [unico], 3)).toBe(true);
  });

  it('gera as duas mãos com a melhor semente em casa na 2.ª', () => {
    const jogos = emJogos([{ eliminatoria: 4, chave: 0, casaId: 'S1', foraId: 'S4' }], 5, regras);
    expect(jogos).toEqual([
      { eliminatoria: 4, chave: 0, casaId: 'S4', foraId: 'S1', jornada: 5, mao: 1 },
      { eliminatoria: 4, chave: 0, casaId: 'S1', foraId: 'S4', jornada: 6, mao: 2 },
    ]);
  });

  it('depois das meias gera a final (jogo único) e o 3.º lugar', () => {
    const quadro = montarQuadro(['A', 'B', 'C', 'D']);
    const meias = [...maos(4, 0, 'A', 'D', [1, 0], [1, 0]), ...maos(4, 1, 'B', 'C', [2, 0], [0, 0])];
    // Meia 0: total 1-1 → penáltis em falta; ainda não gera nada
    expect(planearProximaRonda(meias, quadro, regras)?.porDecidir).toBe(1);

    const decididas = [...maos(4, 0, 'A', 'D', [0, 1], [2, 0]), ...maos(4, 1, 'B', 'C', [2, 0], [0, 0])];
    const r = planearProximaRonda(decididas, quadro, regras)!;
    expect(r.jogos).toEqual([
      { eliminatoria: 2, chave: 0, casaId: 'A', foraId: 'C', jornada: 3 },
      { eliminatoria: 2, chave: CHAVE_TERCEIRO, casaId: 'D', foraId: 'B', jornada: 3 },
    ]);
    expect(r.jogos.map(nomeFase)).toEqual(['Final', '3.º lugar']);
  });

  it('com final a duas mãos, o 3.º lugar joga-se no dia da 2.ª mão', () => {
    const quadro = montarQuadro(['A', 'B', 'C', 'D']);
    const decididas = [...maos(4, 0, 'A', 'D', [0, 1], [2, 0]), ...maos(4, 1, 'B', 'C', [2, 0], [0, 0])];
    const r = planearProximaRonda(decididas, quadro, { ...regras, finalDuasMaos: true })!;
    expect(r.jogos.map((j) => [nomeFase(j), j.jornada])).toEqual([
      ['Final (1.ª mão)', 3], ['Final (2.ª mão)', 4], ['3.º lugar', 4],
    ]);
  });

  it('ordena os melhores terceiros entre grupos', () => {
    const l = (equipaId: string, grupo: string, pts: number, dg: number, gm = 0, sorteio: number | null = null) =>
      ({ equipaId, nome: equipaId, grupo, pts, dg, gm, v: 0, fairPlay: 0, sorteio });
    const r = ordenarMelhores([l('X', 'A', 4, 0), l('Y', 'B', 4, 2), l('Z', 'C', 6, -3), l('W', 'D', 4, 2, 0, 1)]);
    expect(r.map((x) => x.equipaId)).toEqual(['Z', 'W', 'Y', 'X']);
  });

  it('valida o número de apurados com os melhores terceiros', () => {
    expect(validarFaseFinal([4, 4, 4], 2, 2)).toBeNull();
    expect(validarFaseFinal([4, 4, 4], 2, 1)).toMatch(/7 equipas/);
    expect(validarFaseFinal([4, 2, 2], 2, 2)).toMatch(/3\.º classificados suficientes/);
  });

  it('nunca junta equipas do mesmo grupo na 1.ª ronda (6 grupos, 4 melhores terceiros)', () => {
    const letras = ['A', 'B', 'C', 'D', 'E', 'F'];
    const grupos = letras.map((g) => ({ grupo: g, equipas: [`${g}1`, `${g}2`, `${g}3`, `${g}4`] }));
    // Todas as 15 combinações de 4 grupos de onde vêm os terceiros
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) for (let x = c + 1; x < 6; x++) {
      const terceiros = [a, b, c, x].map((i) => `${letras[i]}3`);
      const plano = planearFaseFinal(grupos, 2, 3, undefined, terceiros);
      if ('erro' in plano) throw new Error(plano.erro);
      expect(plano.jogos).toHaveLength(8);
      for (const j of plano.jogos) expect(`${terceiros.join()}: ${j.casaId}-${j.foraId}`).not.toMatch(/: (\w)\d-\1\d$/);
    }
  });

  it('com 3 grupos e 2 melhores terceiros também evita repetir grupo', () => {
    const grupos = ['A', 'B', 'C'].map((g) => ({ grupo: g, equipas: [`${g}1`, `${g}2`, `${g}3`] }));
    for (const terceiros of [['A3', 'B3'], ['A3', 'C3'], ['B3', 'C3'], ['C3', 'A3']]) {
      const plano = planearFaseFinal(grupos, 2, 3, undefined, terceiros);
      if ('erro' in plano) throw new Error(plano.erro);
      for (const j of plano.jogos) expect(j.casaId[0]).not.toBe(j.foraId[0]);
    }
  });
});
