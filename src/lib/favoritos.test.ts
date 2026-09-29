import { describe, expect, it } from 'vitest';
import { normalizar, organizarCompeticoes } from './favoritos';

const c = (id: string, nome: string, estado = 'em_curso', epoca: string | null = '2026') => ({ id, nome, estado, epoca });
const lista = [
  c('1', 'Liga do Bairro'), c('2', 'Taça da Matola'), c('3', 'Liga Feminina'),
  c('4', 'Liga do Bairro', 'terminada', '2025'),
];

describe('página inicial', () => {
  it('mostra as favoritas primeiro, pela ordem em que foram marcadas', () => {
    const r = organizarCompeticoes(lista, '', ['3', '4']);
    expect(r.favoritas.map((x) => x.id)).toEqual(['3', '4']);
    expect(r.emCurso.map((x) => x.id)).toEqual(['1', '2']);
    expect(r.terminadas).toEqual([]);
  });

  it('separa as terminadas', () => {
    expect(organizarCompeticoes(lista, '', []).terminadas.map((x) => x.id)).toEqual(['4']);
  });

  it('pesquisa sem acentos, por palavras e pela época', () => {
    expect(organizarCompeticoes(lista, 'taca', []).emCurso.map((x) => x.id)).toEqual(['2']);
    expect(organizarCompeticoes(lista, 'bairro 2025', []).terminadas.map((x) => x.id)).toEqual(['4']);
    expect(organizarCompeticoes(lista, 'bairro 2025', []).emCurso).toEqual([]);
    expect(organizarCompeticoes(lista, 'feminina', ['3']).favoritas.map((x) => x.id)).toEqual(['3']);
  });

  it('ignora favoritos de competições que já não existem', () => {
    expect(organizarCompeticoes(lista, '', ['apagada', '2']).favoritas.map((x) => x.id)).toEqual(['2']);
  });

  it('normaliza texto', () => {
    expect(normalizar('  Taça ÁGUIAS ')).toBe('taca aguias');
  });
});
