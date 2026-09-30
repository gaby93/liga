import { describe, expect, it } from 'vitest';
import { linhasResultados, nomeFicheiro, paraCsv } from './exportar';
import type { Equipa, Jogo } from './types';

const eq = (id: string, nome: string): [string, Equipa] => [id, { id, organizacao_id: 'o1', nome, emblema_url: null, responsavel: null, contacto: null }];
const jogo = (extra: Partial<Jogo>): Jogo => ({
  id: 'j', competicao_id: 'c', jornada: 1, casa_id: 'A', fora_id: 'B', data_hora: null, campo: null,
  golos_casa: null, golos_fora: null, estado: 'agendado', grupo: null, eliminatoria: null, chave: null,
  penaltis_casa: null, penaltis_fora: null, mao: null, periodo: null, relogio_inicio: null, relogio_base: 0, ...extra,
});

describe('exportar', () => {
  it('escreve CSV para o Excel em português, com aspas quando é preciso', () => {
    const csv = paraCsv([['Equipa', 'Nota'], ['Águias; B', 'diz "olá"'], ['Leões', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1)).toBe('Equipa;Nota\r\n"Águias; B";"diz ""olá"""\r\nLeões;\r\n');
  });

  it('faz uma linha de resultados por jogo', () => {
    const equipas = new Map([eq('A', 'Águias'), eq('B', 'Leões')]);
    const linhas = linhasResultados([
      jogo({ estado: 'terminado', golos_casa: 2, golos_fora: 1, campo: 'Campo 1' }),
      jogo({ eliminatoria: 2, chave: 0, estado: 'terminado', golos_casa: 1, golos_fora: 1, penaltis_casa: 4, penaltis_fora: 3 }),
    ], equipas);
    expect(linhas[0]).toEqual(['Fase', 'Grupo', 'Data', 'Campo', 'Casa', 'Golos casa', 'Golos fora', 'Fora', 'Penáltis', 'Estado']);
    expect(linhas[1]).toEqual(['Jornada 1', '', '', 'Campo 1', 'Águias', 2, 1, 'Leões', '', 'Terminado']);
    expect(linhas[2].slice(0, 1)).toEqual(['Final']);
    expect(linhas[2][8]).toBe('4-3');
  });

  it('dá nomes de ficheiro sem acentos nem espaços', () => {
    expect(nomeFicheiro('Taça da Matola 2026/27')).toBe('taca-da-matola-2026-27');
    expect(nomeFicheiro('???')).toBe('competicao');
  });
});
