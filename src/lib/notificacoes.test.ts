import { describe, expect, it } from 'vitest';
import {
  avisoFim, avisoGolo, avisoInicio, avisoMarcacao, chaveParaBytes, distribuir, interessa, type JogoAviso, type Subscricao,
} from './notificacoes';

const jogo = (extra: Partial<JogoAviso> = {}): JogoAviso => ({
  id: 'j1', competicaoId: 'c1', competicao: 'Liga Tchumene', casaId: 'A', foraId: 'B', casa: 'Gladiadores', fora: 'Predadores',
  golosCasa: 2, golosFora: 1, estado: 'em_curso', dataHora: '2026-10-04T13:00:00Z', campo: 'Campo Grande', fase: 'Jornada 4', ...extra,
});
const sub = (extra: Partial<Subscricao>): Subscricao => ({
  endpoint: 'https://push/1', p256dh: 'x', auth: 'y', competicoes: [], equipas: [], tipos: ['golos', 'inicio_fim', 'marcacoes'], ...extra,
});

describe('mensagens das notificações', () => {
  it('golo com o resultado, o minuto e o marcador', () => {
    const a = avisoGolo(jogo(), { equipaId: 'A', tipo: 'golo', minuto: 23, jogador: 'Cleyton' });
    expect(a.mensagem).toEqual({
      titulo: '⚽ Golo: Gladiadores!', corpo: "Gladiadores 2–1 Predadores · 23' Cleyton",
      url: '/c/c1/jogos/j1', etiqueta: 'jogo-j1',
    });
  });

  it('autogolo conta para a outra equipa', () => {
    const a = avisoGolo(jogo(), { equipaId: 'A', tipo: 'autogolo', minuto: null, jogador: 'Edson' });
    expect(a.mensagem.titulo).toBe('⚽ Golo: Predadores!');
    expect(a.mensagem.corpo).toBe('Gladiadores 2–1 Predadores · autogolo de Edson');
  });

  it('início, fim (com penáltis) e W.O.', () => {
    expect(avisoInicio(jogo()).mensagem.titulo).toBe('▶️ Começou: Gladiadores – Predadores');
    expect(avisoFim(jogo({ estado: 'terminado', golosCasa: 1, golosFora: 1, penaltisCasa: 4, penaltisFora: 3 })).mensagem.titulo)
      .toBe('🏁 Terminou: Gladiadores 1–1 Predadores (penáltis 4–3)');
    const wo = avisoFim(jogo({ estado: 'wo_fora' })).mensagem;
    expect(wo.titulo).toBe('🏁 Terminou por W.O.: Gladiadores – Predadores');
    expect(wo.corpo).toBe('Predadores não compareceu · Liga Tchumene');
  });

  it('marcação com o dia e a hora no fuso da liga', () => {
    const m = avisoMarcacao(jogo({ estado: 'agendado' }), 'Africa/Maputo').mensagem;
    expect(m.titulo).toBe('📅 Jogo marcado: Gladiadores – Predadores');
    expect(m.corpo).toMatch(/^domingo, 4 de outubro.* 15:00 · Campo Grande · Liga Tchumene$/);
  });
});

describe('quem recebe', () => {
  const golo = avisoGolo(jogo(), { equipaId: 'A', tipo: 'golo', minuto: 23, jogador: 'Cleyton' });

  it('quem segue a competição ou uma das equipas, e quer esse tipo', () => {
    expect(interessa(sub({ competicoes: ['c1'] }), golo)).toBe(true);
    expect(interessa(sub({ equipas: ['B'] }), golo)).toBe(true);
    expect(interessa(sub({ equipas: ['Z'] }), golo)).toBe(false);
    expect(interessa(sub({ competicoes: ['c1'], tipos: ['inicio_fim'] }), golo)).toBe(false);
  });

  it('junta várias marcações numa só notificação por pessoa', () => {
    const marcacoes = ['j1', 'j2', 'j3'].map((id) => avisoMarcacao(jogo({ id, estado: 'agendado' }), 'Africa/Maputo'));
    const envios = distribuir([sub({ competicoes: ['c1'] }), sub({ endpoint: 'https://push/2', equipas: ['A'] })], [...marcacoes, golo]);
    expect(envios.filter((e) => e.subscricao.endpoint === 'https://push/1').map((e) => e.mensagem.titulo))
      .toEqual(['⚽ Golo: Gladiadores!', '📅 3 jogos marcados']);
    const resumo = envios.find((e) => e.mensagem.etiqueta === 'marcacoes')!.mensagem;
    expect(resumo.url).toBe('/c/c1/jogos');
    expect(envios).toHaveLength(4);
  });

  it('uma só marcação vai com os pormenores', () => {
    const envios = distribuir([sub({ competicoes: ['c1'] })], [avisoMarcacao(jogo({ estado: 'agendado' }), 'Africa/Maputo')]);
    expect(envios.map((e) => e.mensagem.titulo)).toEqual(['📅 Jogo marcado: Gladiadores – Predadores']);
  });
});

describe('chave VAPID', () => {
  it('converte base64url em bytes', () => {
    expect([...chaveParaBytes('AQID_w')]).toEqual([1, 2, 3, 255]);
  });
});
