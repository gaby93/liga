import { describe, expect, it } from 'vitest';
import { atribuirDatas } from './calendario';

const hora = (iso: string | null) => (iso ? new Date(iso).toTimeString().slice(0, 5) : null);
const dia = (iso: string | null) => (iso ? new Date(iso).getDate() : null);
const jornada = (n: number, quantos: number) => Array.from({ length: quantos }, (_, k) => ({ jornada: n, k }));

describe('atribuirDatas com campos', () => {
  const base = { inicio: '2026-11-01', hora: '09:00', intervaloMin: 60, diasEntreJornadas: 7 };

  it('com 2 campos, os jogos seguidos jogam à mesma hora em campos diferentes', () => {
    const r = atribuirDatas(jornada(1, 5), { ...base, campos: ['Campo 1', 'Campo 2'] });
    expect(r.map((j) => [hora(j.dataHora), j.campo])).toEqual([
      ['09:00', 'Campo 1'], ['09:00', 'Campo 2'],
      ['10:00', 'Campo 1'], ['10:00', 'Campo 2'],
      ['11:00', 'Campo 1'],
    ]);
  });

  it('cada jornada recomeça no primeiro horário e no primeiro campo', () => {
    const r = atribuirDatas([...jornada(1, 3), ...jornada(2, 2)], { ...base, campos: ['A', 'B'] });
    expect(r.slice(3).map((j) => [dia(j.dataHora), hora(j.dataHora), j.campo])).toEqual([[8, '09:00', 'A'], [8, '09:00', 'B']]);
  });

  it('sem campos, é um jogo por horário e não há campo', () => {
    const r = atribuirDatas(jornada(1, 3), base);
    expect(r.map((j) => [hora(j.dataHora), j.campo])).toEqual([['09:00', null], ['10:00', null], ['11:00', null]]);
  });

  it('um campo só: jogos seguidos, todos no mesmo campo', () => {
    const r = atribuirDatas(jornada(1, 2), { ...base, campos: ['Principal'] });
    expect(r.map((j) => [hora(j.dataHora), j.campo])).toEqual([['09:00', 'Principal'], ['10:00', 'Principal']]);
  });

  it('jornadas antes da inicial ficam sem data nem campo', () => {
    const r = atribuirDatas([...jornada(1, 1), ...jornada(2, 1)], { ...base, aPartirJornada: 2, campos: ['A'] });
    expect(r[0]).toMatchObject({ dataHora: null, campo: null });
    expect(r[1].campo).toBe('A');
  });
});
