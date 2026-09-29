import { describe, expect, it } from 'vitest';
import { eventosForaDaFicha, fichaAnterior, jogosDisputados } from './fichas';
import type { JogoSusp } from './suspensoes';

const jogo = (id: string, jornada: number, casa: string, fora: string, estado: JogoSusp['estado'] = 'terminado'): JogoSusp =>
  ({ id, jornada, casa_id: casa, fora_id: fora, data_hora: null, estado });
const conv = (jogo_id: string, jogador_id: string, equipa_id = 'A') => ({ jogo_id, jogador_id, equipa_id });

describe('fichas de jogo', () => {
  const jogos = [jogo('J1', 1, 'A', 'B'), jogo('J2', 2, 'C', 'A'), jogo('J3', 3, 'B', 'C'), jogo('J4', 4, 'A', 'C', 'agendado')];

  it('copia a última ficha preenchida da equipa', () => {
    const convocatorias = [conv('J1', 'p1'), conv('J1', 'p2'), conv('J2', 'p1'), conv('J2', 'p3'), conv('J1', 'q1', 'B')];
    expect(fichaAnterior(jogos, convocatorias, 'A', 'J4')).toEqual({ jogoId: 'J2', jogadores: ['p1', 'p3'] });
  });

  it('salta jogos da equipa sem ficha e ignora jogos de outras equipas', () => {
    const convocatorias = [conv('J1', 'p1'), conv('J3', 'x', 'C')];
    expect(fichaAnterior(jogos, convocatorias, 'A', 'J4')).toEqual({ jogoId: 'J1', jogadores: ['p1'] });
    expect(fichaAnterior(jogos, convocatorias, 'A', 'J1')).toBeNull();
  });

  it('conta jogos disputados só nos jogos terminados', () => {
    const lista = [...jogos, jogo('J5', 5, 'A', 'B', 'wo_fora')];
    const n = jogosDisputados(lista, [conv('J1', 'p1'), conv('J2', 'p1'), conv('J4', 'p1'), conv('J5', 'p1')]);
    expect(n.get('p1')).toBe(2);
  });

  it('aponta golos e cartões de quem não está na ficha', () => {
    const convocatorias = [conv('J1', 'p1')];
    const eventos = [
      { equipa_id: 'A', jogador_id: 'p1' },
      { equipa_id: 'A', jogador_id: 'p9' },   // da equipa com ficha, mas não convocado
      { equipa_id: 'B', jogador_id: 'q1' },   // equipa B sem ficha: não se verifica
      { equipa_id: 'A', jogador_id: null },
    ];
    expect(eventosForaDaFicha(eventos, convocatorias)).toEqual(['p9']);
  });
});
