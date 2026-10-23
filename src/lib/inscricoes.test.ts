import { describe, expect, it } from 'vitest';
import { contarVeteranos, idade, regrasDaEquipa, verificarInscricao } from './inscricoes';

const comp = (o: Partial<Parameters<typeof regrasDaEquipa>[0][number]> = {}) =>
  ({ nome: 'Liga', estado: 'em_curso', max_jogadores: 25, idade_minima: 0, idade_veterano: 32, min_veteranos: 3, ...o });

describe('idade', () => {
  it('conta os anos completos', () => {
    expect(idade('1994-10-23', new Date(2026, 9, 23))).toBe(32);
    expect(idade('1994-10-24', new Date(2026, 9, 23))).toBe(31);
    expect(idade('1994-11-01', '2026-10-30T15:00:00')).toBe(31);
  });
});

describe('regrasDaEquipa', () => {
  it('vale a regra mais exigente das competições que não terminaram', () => {
    const r = regrasDaEquipa([
      comp({ nome: 'Liga', max_jogadores: 25, idade_minima: 16 }),
      comp({ nome: 'Taça', max_jogadores: 20, idade_minima: 18 }),
      comp({ nome: 'Antiga', estado: 'terminada', max_jogadores: 10, idade_minima: 40 }),
    ]);
    expect(r.maxJogadores).toEqual({ valor: 20, competicao: 'Taça' });
    expect(r.idadeMinima).toEqual({ valor: 18, competicao: 'Taça' });
  });

  it('0 é sem limite; sem competições, não há regras', () => {
    expect(regrasDaEquipa([comp({ max_jogadores: 0 })])).toEqual({ maxJogadores: null, idadeMinima: null });
    expect(regrasDaEquipa([])).toEqual({ maxJogadores: null, idadeMinima: null });
  });
});

describe('verificarInscricao', () => {
  const hoje = new Date(2026, 9, 23);
  const regras = regrasDaEquipa([comp({ nome: 'Liga Jardim', max_jogadores: 25, idade_minima: 18 })]);
  const base = { regras, equipa: 'Águias', dataNasc: '1990-01-01', hoje };

  it('recusa o 26.º jogador', () => {
    expect(verificarInscricao({ ...base, inscritos: 25, entraNaEquipa: true }))
      .toBe('Águias já tem 25 jogadores inscritos: o limite na Liga Jardim é 25.');
    expect(verificarInscricao({ ...base, inscritos: 24, entraNaEquipa: true })).toBeNull();
  });

  it('editar quem já está na equipa não conta para o limite', () => {
    expect(verificarInscricao({ ...base, inscritos: 25, entraNaEquipa: false })).toBeNull();
  });

  it('recusa quem não tem a idade mínima', () => {
    expect(verificarInscricao({ ...base, inscritos: 0, entraNaEquipa: true, dataNasc: '2009-01-01' }))
      .toBe('O jogador tem 17 anos: a idade mínima na Liga Jardim é 18.');
  });
});

describe('contarVeteranos', () => {
  it('conta a idade no dia do jogo e assinala quem não tem data', () => {
    const datas = new Map<string, string | null>([['a', '1990-05-01'], ['b', '1994-11-01'], ['c', '2000-01-01'], ['d', null]]);
    // No dia 30/10/2026, "b" ainda tem 31 anos
    expect(contarVeteranos(['a', 'b', 'c', 'd'], datas, 32, new Date(2026, 9, 30))).toEqual({ veteranos: 1, semData: 1 });
    expect(contarVeteranos(['a', 'b'], datas, 32, new Date(2026, 10, 2))).toEqual({ veteranos: 2, semData: 0 });
  });
});
