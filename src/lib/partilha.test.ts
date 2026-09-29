import { describe, expect, it } from 'vitest';
import { blocoPorDefeito, blocosParaCartaz, marcador, textoPartilha } from './partilha';
import type { Equipa, EstadoJogo, Jogo } from './types';

const jogo = (id: string, jornada: number, estado: EstadoJogo, extra: Partial<Jogo> = {}): Jogo => ({
  id, competicao_id: 'c', jornada, casa_id: 'A', fora_id: 'B', data_hora: null, campo: null,
  golos_casa: null, golos_fora: null, estado, grupo: null, eliminatoria: null, chave: null,
  penaltis_casa: null, penaltis_fora: null, mao: null, ...extra,
});
const equipas = new Map<string, Equipa>([
  ['A', { id: 'A', nome: 'Águias', emblema_url: null, responsavel: null, contacto: null }],
  ['B', { id: 'B', nome: 'Leões', emblema_url: null, responsavel: null, contacto: null }],
]);

describe('imagens para partilhar', () => {
  const jogos = [
    jogo('1', 1, 'terminado', { golos_casa: 2, golos_fora: 1 }),
    jogo('2', 2, 'terminado', { golos_casa: 0, golos_fora: 0 }),
    jogo('3', 2, 'agendado'),
    jogo('4', 3, 'agendado'),
    jogo('5', 4, 'adiado'),
  ];

  it('propõe a última jornada com resultados e a próxima com jogos por fazer', () => {
    const resultados = blocosParaCartaz(jogos, 'resultados');
    expect(resultados.map((b) => b.titulo)).toEqual(['Jornada 1', 'Jornada 2']);
    expect(blocoPorDefeito(resultados, 'resultados')).toBe('Jornada 2');

    const proximos = blocosParaCartaz(jogos, 'proximos');
    // A jornada 2 ainda tem um jogo por fazer; a 4 só tem um adiado e fica de fora
    expect(proximos.map((b) => b.titulo)).toEqual(['Jornada 2', 'Jornada 3']);
    expect(proximos[0].jogos.map((j) => j.id)).toEqual(['3']);
    expect(blocoPorDefeito(proximos, 'proximos')).toBe('Jornada 2');
  });

  it('usa o nome da ronda nas eliminatórias', () => {
    const final = jogo('f', 5, 'terminado', { eliminatoria: 2, chave: 0, golos_casa: 1, golos_fora: 1, penaltis_casa: 4, penaltis_fora: 3 });
    expect(blocosParaCartaz([final], 'resultados')[0].titulo).toBe('Final');
    expect(marcador(final)).toBe('1–1 (4–3 g.p.)');
  });

  it('escreve o marcador de cada estado', () => {
    expect(marcador(jogo('x', 1, 'wo_fora'))).toBe('W.O.');
    expect(marcador(jogo('x', 1, 'adiado'))).toBe('adiado');
    expect(marcador(jogo('x', 1, 'agendado'))).toBe('vs');
  });

  it('gera o texto para a mensagem', () => {
    const texto = textoPartilha({
      tipo: 'resultados', competicao: 'Liga do Bairro', titulo: 'Jornada 1',
      jogos: [jogos[0]], equipas, endereco: 'https://liga.pages.dev/c/c',
    });
    expect(texto).toBe([
      '*Liga do Bairro*', 'Jornada 1: resultados', '', 'Águias 2–1 Leões', '',
      'Acompanhe em direto: https://liga.pages.dev/c/c',
    ].join('\n'));

    const proximos = textoPartilha({
      tipo: 'proximos', competicao: 'Liga', titulo: 'Jornada 3', equipas,
      jogos: [jogo('4', 3, 'agendado', { grupo: 'A', campo: 'Campo 1' })],
    });
    expect(proximos).toContain('Águias vs Leões (Grupo A)');
    expect(proximos).toContain('data por marcar, Campo 1');
  });
});
