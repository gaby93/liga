import { describe, expect, it } from 'vitest';
import { atribuirDatas } from './calendario';
import { calcularSuspensoes, type EventoSusp, type JogoSusp } from './suspensoes';
import type { EstadoJogo, TipoEvento } from './types';

const regras = { amarelos: 3, jogosExpulsao: 1 };

// A joga contra B nas jornadas ímpares e contra C nas pares
const jogos = (estados: EstadoJogo[]): JogoSusp[] => estados.map((estado, i) => ({
  id: `J${i + 1}`, jornada: i + 1, casa_id: 'A', fora_id: i % 2 ? 'C' : 'B', data_hora: null, estado,
}));
const cartao = (jogo: number, tipo: TipoEvento, jogador = 'p1', equipa = 'A'): EventoSusp =>
  ({ jogo_id: `J${jogo}`, equipa_id: equipa, jogador_id: jogador, tipo });
const suspensosEm = (r: ReturnType<typeof calcularSuspensoes>, jogo: number) =>
  (r.porJogo.get(`J${jogo}`) ?? []).map((s) => s.jogadorId);

describe('suspensões', () => {
  it('suspende no jogo seguinte da equipa após um vermelho', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'agendado', 'agendado']), [cartao(1, 'vermelho')], regras);
    expect(suspensosEm(r, 2)).toEqual(['p1']);
    expect(suspensosEm(r, 3)).toEqual([]);
    expect(r.ativas.get('p1')).toMatchObject({ jogosEmFalta: 1, proximoJogoId: 'J2', motivo: 'Expulsão na jornada 1' });
  });

  it('deixa de estar ativa depois de cumprida', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'terminado', 'agendado']), [cartao(1, 'vermelho')], regras);
    expect(suspensosEm(r, 2)).toEqual(['p1']);
    expect(r.ativas.has('p1')).toBe(false);
  });

  it('respeita o número de jogos por expulsão', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'agendado', 'agendado', 'agendado']),
      [cartao(1, 'vermelho')], { ...regras, jogosExpulsao: 2 });
    expect([2, 3, 4].map((n) => suspensosEm(r, n).length)).toEqual([1, 1, 0]);
    expect(r.ativas.get('p1')?.jogosEmFalta).toBe(2);
  });

  it('suspende ao 3.º amarelo e de novo ao 6.º', () => {
    const r = calcularSuspensoes(
      jogos(['terminado', 'terminado', 'terminado', 'terminado', 'terminado', 'terminado', 'terminado', 'agendado']),
      [cartao(1, 'amarelo'), cartao(2, 'amarelo'), cartao(3, 'amarelo'),
        cartao(5, 'amarelo'), cartao(6, 'amarelo'), cartao(7, 'amarelo')],
      regras,
    );
    expect(suspensosEm(r, 4)).toEqual(['p1']);
    expect(suspensosEm(r, 8)).toEqual(['p1']);
    expect(r.ativas.get('p1')).toMatchObject({ jogosEmFalta: 1, motivo: '6.º amarelo na jornada 7' });
  });

  it('trata dois amarelos no mesmo jogo como expulsão, sem contar para a acumulação', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'terminado', 'terminado', 'agendado']),
      [cartao(1, 'amarelo'), cartao(1, 'amarelo'), cartao(3, 'amarelo')], regras);
    expect(suspensosEm(r, 2)).toEqual(['p1']);
    expect(suspensosEm(r, 4)).toEqual([]);
  });

  it('não conta jogos adiados como cumprimento', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'adiado', 'agendado']), [cartao(1, 'vermelho')], regras);
    expect(suspensosEm(r, 2)).toEqual([]);
    expect(suspensosEm(r, 3)).toEqual(['p1']);
  });

  it('só se cumpre nos jogos da equipa do jogador', () => {
    const lista = jogos(['terminado', 'agendado']);
    lista.push({ id: 'X', jornada: 2, casa_id: 'D', fora_id: 'E', data_hora: null, estado: 'agendado' });
    const r = calcularSuspensoes(lista, [cartao(1, 'vermelho')], regras);
    expect(r.porJogo.has('X')).toBe(false);
    expect(suspensosEm(r, 2)).toEqual(['p1']);
  });

  it('mantém a suspensão quando já não há jogos no calendário', () => {
    const r = calcularSuspensoes(jogos(['terminado']), [cartao(1, 'vermelho')], regras);
    expect(r.ativas.get('p1')).toMatchObject({ jogosEmFalta: 1, proximoJogoId: null });
  });

  it('desliga cada regra com 0', () => {
    const r = calcularSuspensoes(jogos(['terminado', 'terminado', 'terminado', 'agendado']),
      [cartao(1, 'vermelho'), cartao(2, 'amarelo'), cartao(3, 'amarelo')], { amarelos: 0, jogosExpulsao: 0 });
    expect(r.ativas.size).toBe(0);
  });
});

describe('datas do calendário', () => {
  const local = (iso: string | null) => {
    const d = new Date(iso!);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  it('espaça jornadas por dias e jogos por minutos', () => {
    const r = atribuirDatas([{ jornada: 1 }, { jornada: 1 }, { jornada: 2 }, { jornada: 3 }],
      { inicio: '2026-10-04', hora: '15:00', intervaloMin: 90, diasEntreJornadas: 7 });
    expect(r.map((j) => local(j.dataHora))).toEqual([
      '2026-10-4 15:00', '2026-10-4 16:30', '2026-10-11 15:00', '2026-10-18 15:00',
    ]);
  });

  it('começa na jornada indicada e deixa as anteriores sem data', () => {
    const r = atribuirDatas([{ jornada: 2 }, { jornada: 5 }, { jornada: 6 }],
      { inicio: '2026-12-28', hora: '09:30', intervaloMin: 60, diasEntreJornadas: 7, aPartirJornada: 5 });
    expect(r[0].dataHora).toBeNull();
    expect(local(r[1].dataHora)).toBe('2026-12-28 9:30');
    expect(local(r[2].dataHora)).toBe('2027-1-4 9:30');
  });
});
