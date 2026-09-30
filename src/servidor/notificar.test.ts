import { describe, expect, it } from 'vitest';
import { tratar, type Env } from './notificar';

// Chaves verdadeiras (geradas com Web Crypto): o envio cifra a sério
const b64u = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const gerar = async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publica = await crypto.subtle.exportKey('raw', par.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: b64u(publica), privada: jwk.d! };
};
const aleatorio = (n: number) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const vapid = await gerar();
const chavesTelemovel = await Promise.all([1, 2, 3, 4].map(gerar));
let proxima = 0;
const chaves = () => chavesTelemovel[proxima++ % chavesTelemovel.length];
const env: Env = {
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servico', NOTIFICAR_SEGREDO: 'segredo-123',
  VAPID_PUBLIC_KEY: vapid.publica, VAPID_PRIVATE_KEY: vapid.privada, VAPID_SUBJECT: 'mailto:teste@exemplo.com',
};
const sub = (endpoint: string, extra: object) => {
  const k = chaves();
  return { endpoint, p256dh: k.publica, auth: aleatorio(16), competicoes: [], equipas: [], tipos: ['golos', 'inicio_fim', 'marcacoes'], ...extra };
};

const JOGO = {
  id: 'j1', competicao_id: 'c1', jornada: 4, casa_id: 'A', fora_id: 'B', data_hora: '2026-10-04T13:00:00Z', campo: 'Campo Grande',
  golos_casa: 1, golos_fora: 1, penaltis_casa: null, penaltis_fora: null, estado: 'em_curso', grupo: null, eliminatoria: null,
  chave: null, mao: null, competicao: { nome: 'Liga Tchumene', estado: 'em_curso' },
};
const SUBS = [
  sub('https://push.exemplo/competicao', { competicoes: ['c1'] }),
  sub('https://push.exemplo/equipa-so-golos', { equipas: ['B'], tipos: ['golos'] }),
  sub('https://push.exemplo/desinstalada', { competicoes: ['c1'] }),
  sub('https://push.exemplo/outra-equipa', { equipas: ['Z'] }),
];

/** Rede simulada: Supabase com dados fixos e serviços de push que registam o que recebem. */
function rede(jogos: object[] = [JOGO]) {
  const push: { endpoint: string; tamanho: number; autorizacao: string }[] = [];
  const apagados: string[] = [];
  const fetchFn = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });
    if (url.startsWith('https://push.exemplo/')) {
      const corpo = init?.body instanceof ArrayBuffer || ArrayBuffer.isView(init?.body)
        ? (init!.body as ArrayBuffer).byteLength : new Blob([init?.body as BlobPart]).size;
      push.push({ endpoint: url, tamanho: corpo, autorizacao: String((init?.headers as Record<string, string>)?.authorization ?? '') });
      return new Response(null, { status: url.endsWith('desinstalada') ? 410 : 201 });
    }
    const caminho = decodeURIComponent(url.replace(`${env.SUPABASE_URL}/rest/v1/`, ''));
    if (init?.method === 'DELETE') { apagados.push(caminho); return new Response(null, { status: 204 }); }
    if (caminho.startsWith('eventos?select=*&id=eq.')) return resposta([{ id: 'e1', jogo_id: 'j1', equipa_id: 'B', jogador_id: 'p1', minuto: 67, tipo: 'golo' }]);
    if (caminho.startsWith('eventos?select=equipa_id,tipo')) return resposta([{ equipa_id: 'A', tipo: 'golo' }, { equipa_id: 'B', tipo: 'golo' }, { equipa_id: 'B', tipo: 'golo' }]);
    if (caminho.startsWith('jogos?')) return resposta(jogos);
    if (caminho.startsWith('equipas?')) return resposta([{ id: 'A', nome: 'Gladiadores' }, { id: 'B', nome: 'Predadores' }]);
    if (caminho.startsWith('jogadores?')) return resposta([{ nome: 'Edy Banze' }]);
    if (caminho.startsWith('subscricoes_push?')) return resposta(SUBS);
    return resposta({ erro: `sem simulação para ${caminho}` }, 500);
  }) as typeof fetch;
  return { fetchFn, push, apagados };
}

const pedido = (corpo: object, segredo = 'segredo-123') =>
  new Request('https://liga.pages.dev/api/notificar', { method: 'POST', headers: { 'x-segredo': segredo }, body: JSON.stringify(corpo) });

describe('função de notificações', () => {
  it('recusa pedidos sem o segredo', async () => {
    const r = await tratar(pedido({ tipo: 'golo', evento_id: 'e1' }, 'errado'), env, rede().fetchFn);
    expect(r.status).toBe(401);
  });

  it('golo: envia cifrado a quem segue a competição ou a equipa e remove as subscrições mortas', async () => {
    const { fetchFn, push, apagados } = rede();
    const r = await tratar(pedido({ tipo: 'golo', evento_id: 'e1' }), env, fetchFn);
    expect(await r.json()).toEqual({ avisos: 1, enviadas: 2, falhadas: 0, removidas: 1 });
    expect(push.map((p) => p.endpoint).sort()).toEqual([
      'https://push.exemplo/competicao', 'https://push.exemplo/desinstalada', 'https://push.exemplo/equipa-so-golos',
    ]);
    // Corpo cifrado com tamanho constante e cabeçalho VAPID
    expect(push.every((p) => p.tamanho === 4096 && p.autorizacao.startsWith('vapid t='))).toBe(true);
    expect(apagados).toEqual(['subscricoes_push?endpoint=eq.https://push.exemplo/desinstalada']);
  });

  it('não avisa golos de jogos que já não estão a decorrer', async () => {
    const { fetchFn, push } = rede([{ ...JOGO, estado: 'terminado' }]);
    const r = await tratar(pedido({ tipo: 'golo', evento_id: 'e1' }), env, fetchFn);
    expect(await r.json()).toEqual({ enviadas: 0 });
    expect(push).toHaveLength(0);
  });

  it('marcações: uma notificação de resumo por pessoa, e só a quem quer marcações', async () => {
    const jogos = ['j1', 'j2', 'j3'].map((id) => ({ ...JOGO, id, estado: 'agendado' }));
    const { fetchFn, push } = rede(jogos);
    const r = await tratar(pedido({ tipo: 'jogos', mudancas: jogos.map((j) => ({ jogo_id: j.id, mudanca: 'marcacao' })) }), env, fetchFn);
    expect(await r.json()).toMatchObject({ avisos: 3, enviadas: 1, removidas: 1 });
    // A subscrição só de golos não recebe; a da competição recebe uma, não três
    expect(push.map((p) => p.endpoint).sort()).toEqual(['https://push.exemplo/competicao', 'https://push.exemplo/desinstalada']);
  });

  it('competições em rascunho não notificam', async () => {
    const { fetchFn, push } = rede([{ ...JOGO, competicao: { nome: 'Teste', estado: 'rascunho' } }]);
    await tratar(pedido({ tipo: 'jogos', mudancas: [{ jogo_id: 'j1', mudanca: 'inicio' }] }), env, fetchFn);
    expect(push).toHaveLength(0);
  });
});
