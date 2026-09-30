import { describe, expect, it } from 'vitest';
import {
  aplicarAcao, expulsos, jogosAoVivoPorEquipa, minutoAtual, minutoEParte, nomeParte, placarDosEventos, proximaAcao,
  resultadoPara, rotuloAoVivo, type Relogio,
} from './aoVivo';

const T0 = Date.parse('2026-10-04T15:00:00Z');
const min = (m: number, s = 0) => T0 + m * 60000 + s * 1000;
const agendado: Relogio = { estado: 'agendado', periodo: null, relogio_inicio: null, relogio_base: 0 };

describe('modo jogo: relógio', () => {
  it('conta o minuto em curso desde o início', () => {
    const r = aplicarAcao(agendado, 'comecar', T0);
    expect(r).toMatchObject({ estado: 'em_curso', periodo: '1p', relogio_base: 0 });
    expect(minutoAtual(r, min(0, 10))).toBe(1);
    expect(minutoAtual(r, min(22, 59))).toBe(23);
    expect(rotuloAoVivo(r, min(22, 59))).toBe("23'");
  });

  it('para no intervalo e a 2.ª parte continua a partir daí', () => {
    const primeira = aplicarAcao(agendado, 'comecar', T0);
    const intervalo = aplicarAcao(primeira, 'intervalo', min(25, 30));
    expect(intervalo).toMatchObject({ periodo: 'intervalo', relogio_inicio: null, relogio_base: 25 });
    expect(minutoAtual(intervalo, min(40))).toBeNull();
    expect(rotuloAoVivo(intervalo, min(40))).toBe('Intervalo');

    // 10 minutos de intervalo não contam
    const segunda = aplicarAcao(intervalo, 'segunda', min(35));
    expect(minutoAtual(segunda, min(35, 5))).toBe(26);
    expect(minutoAtual(segunda, min(50))).toBe(41);

    const fim = aplicarAcao(segunda, 'terminar', min(60));
    expect(fim).toMatchObject({ estado: 'terminado', periodo: null, relogio_inicio: null, relogio_base: 50 });
    expect(rotuloAoVivo(fim, min(61))).toBe('Terminado');
  });

  it('segue a ordem dos passos', () => {
    let r = agendado;
    const passos = [];
    for (let i = 0; i < 5; i++) {
      const a = proximaAcao(r);
      passos.push(a);
      if (!a) break;
      r = aplicarAcao(r, a, min(i * 10));
    }
    expect(passos).toEqual(['comecar', 'intervalo', 'segunda', 'terminar', null]);
  });

  it('diz em que parte vai o jogo', () => {
    const primeira = aplicarAcao(agendado, 'comecar', T0);
    expect(nomeParte(primeira)).toBe('1.ª parte');
    expect(minutoEParte(primeira, min(22, 30))).toBe("23' · 1.ª parte");
    const intervalo = aplicarAcao(primeira, 'intervalo', min(25));
    expect(nomeParte(intervalo)).toBe('Intervalo');
    expect(minutoEParte(intervalo, min(30))).toBe('Intervalo');
    const segunda = aplicarAcao(intervalo, 'segunda', min(35));
    expect(minutoEParte(segunda, min(47, 10))).toBe("38' · 2.ª parte");
    expect(nomeParte(aplicarAcao(segunda, 'terminar', min(60)))).toBeNull();
    expect(nomeParte(agendado)).toBeNull();
  });

  it('nunca passa do limite de minutos', () => {
    const r = aplicarAcao(agendado, 'comecar', T0);
    expect(minutoAtual(r, min(500))).toBe(130);
  });

  it('um jogo por começar não tem minuto', () => {
    expect(minutoAtual(agendado, T0)).toBeNull();
    expect(rotuloAoVivo(agendado, T0)).toBe('Por começar');
  });
});

describe('tabela: quem está a jogar', () => {
  it('associa cada equipa ao seu jogo a decorrer e mostra o resultado do ponto de vista dela', () => {
    const jogos = [
      { id: '1', estado: 'em_curso' as const, casa_id: 'A', fora_id: 'B', golos_casa: 2, golos_fora: 1 },
      { id: '2', estado: 'agendado' as const, casa_id: 'C', fora_id: 'D', golos_casa: null, golos_fora: null },
      { id: '3', estado: 'terminado' as const, casa_id: 'A', fora_id: 'C', golos_casa: 0, golos_fora: 0 },
    ];
    const m = jogosAoVivoPorEquipa(jogos);
    expect([...m.keys()].sort()).toEqual(['A', 'B']);
    expect(resultadoPara(m.get('A')!, 'A')).toEqual([2, 1]);
    expect(resultadoPara(m.get('B')!, 'B')).toEqual([1, 2]);
  });
});

describe('modo jogo: marcador e expulsões', () => {
  it('soma golos e autogolos para o lado certo', () => {
    const ev = [
      { equipa_id: 'A', tipo: 'golo' as const },
      { equipa_id: 'A', tipo: 'golo' as const },
      { equipa_id: 'A', tipo: 'autogolo' as const },  // jogador de A marcou na própria baliza: golo de B
      { equipa_id: 'B', tipo: 'amarelo' as const },
    ];
    expect(placarDosEventos(ev, 'A', 'B')).toEqual([2, 1]);
  });

  it('marca expulsos por vermelho ou dois amarelos', () => {
    const e = expulsos([
      { jogador_id: 'p1', tipo: 'vermelho' },
      { jogador_id: 'p2', tipo: 'amarelo' }, { jogador_id: 'p2', tipo: 'amarelo' },
      { jogador_id: 'p3', tipo: 'amarelo' },
      { jogador_id: null, tipo: 'vermelho' },
    ]);
    expect([...e].sort()).toEqual(['p1', 'p2']);
  });
});
