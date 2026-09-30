/**
 * Envia as notificações push. Chamada pela base de dados (pg_net), nunca pelo browser:
 *   POST /api/notificar   cabeçalho X-Segredo: <NOTIFICAR_SEGREDO>
 *   { "tipo": "golo", "evento_id": "…" }
 *   { "tipo": "jogos", "mudancas": [{ "jogo_id": "…", "mudanca": "inicio" | "fim" | "marcacao" }] }
 *
 * Variáveis no Cloudflare Pages (Settings > Variables and Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 *   VAPID_SUBJECT (ex.: mailto:email@exemplo.com), NOTIFICAR_SEGREDO, FUSO_HORARIO (opcional)
 */
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { placarDosEventos } from '../lib/aoVivo';
import { nomeFase } from '../lib/formatos';
import {
  avisoFim, avisoGolo, avisoInicio, avisoMarcacao, distribuir, type Aviso, type JogoAviso, type Mensagem, type Subscricao,
} from '../lib/notificacoes';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  NOTIFICAR_SEGREDO: string;
  FUSO_HORARIO?: string;
}

type Pedido =
  | { tipo: 'golo'; evento_id: string }
  | { tipo: 'jogos'; mudancas: { jogo_id: string; mudanca: 'inicio' | 'fim' | 'marcacao' }[] };

interface JogoBD {
  id: string; competicao_id: string; jornada: number; casa_id: string; fora_id: string; data_hora: string | null;
  campo: string | null; golos_casa: number | null; golos_fora: number | null; penaltis_casa: number | null;
  penaltis_fora: number | null; estado: string; grupo: string | null; eliminatoria: number | null; chave: number | null;
  mao: number | null; competicao: { nome: string; estado: string } | null;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

/** Comparação que não revela, pelo tempo, quantos caracteres acertou. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function tratar(pedido: Request, env: Env, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (!env.NOTIFICAR_SEGREDO || !iguais(pedido.headers.get('x-segredo') ?? '', env.NOTIFICAR_SEGREDO))
    return json({ erro: 'não autorizado' }, 401);
  let dados: Pedido;
  try { dados = await pedido.json(); } catch { return json({ erro: 'pedido inválido' }, 400); }

  // Chave de serviço: a nova ("sb_secret_…") vai só em apikey; a antiga (JWT service_role) também como Bearer
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  const autenticacao: Record<string, string> = chave.startsWith('sb_')
    ? { apikey: chave }
    : { apikey: chave, authorization: `Bearer ${chave}` };
  const sb = async <T>(caminho: string, init: RequestInit = {}): Promise<T> => {
    const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
      ...init,
      headers: { ...autenticacao, ...init.headers },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status} em ${caminho.split('?')[0]}`);
    return (r.status === 204 ? null : r.json()) as T;
  };
  const fuso = env.FUSO_HORARIO || 'Africa/Maputo';

  try {
    // Os jogos envolvidos, com os nomes das equipas
    const idsJogos = dados.tipo === 'golo' ? [] : [...new Set(dados.mudancas.map((m) => m.jogo_id))];
    let evento: { id: string; jogo_id: string; equipa_id: string; jogador_id: string | null; minuto: number | null; tipo: string } | undefined;
    if (dados.tipo === 'golo') {
      [evento] = await sb<NonNullable<typeof evento>[]>(`eventos?select=*&id=eq.${encodeURIComponent(dados.evento_id)}`);
      if (!evento) return json({ enviadas: 0, motivo: 'evento já não existe' });
      idsJogos.push(evento.jogo_id);
    }
    if (!idsJogos.length) return json({ enviadas: 0 });
    const jogos = await sb<JogoBD[]>(`jogos?select=*,competicao:competicoes(nome,estado)&id=in.(${idsJogos.join(',')})`);
    const idsEquipas = [...new Set(jogos.flatMap((j) => [j.casa_id, j.fora_id]))];
    const equipas = new Map((await sb<{ id: string; nome: string }[]>(`equipas?select=id,nome&id=in.(${idsEquipas.join(',')})`))
      .map((e) => [e.id, e.nome]));

    const paraAviso = (j: JogoBD): JogoAviso => ({
      id: j.id, competicaoId: j.competicao_id, competicao: j.competicao?.nome ?? '', casaId: j.casa_id, foraId: j.fora_id,
      casa: equipas.get(j.casa_id) ?? '?', fora: equipas.get(j.fora_id) ?? '?', golosCasa: j.golos_casa, golosFora: j.golos_fora,
      penaltisCasa: j.penaltis_casa, penaltisFora: j.penaltis_fora, estado: j.estado, dataHora: j.data_hora, campo: j.campo,
      fase: [nomeFase(j), j.grupo && `Grupo ${j.grupo}`].filter(Boolean).join(' · '),
    });

    const avisos: Aviso[] = [];
    if (dados.tipo === 'golo' && evento) {
      const j = jogos[0];
      // Só jogos a decorrer: lançar golos de um jogo antigo não gera avisos
      if (j && j.estado === 'em_curso' && j.competicao?.estado === 'em_curso') {
        // O resultado conta os golos registados (inclui este), mesmo que o marcador do jogo ainda não esteja atualizado
        const doJogo = await sb<{ equipa_id: string; tipo: 'golo' | 'autogolo' | 'amarelo' | 'vermelho' }[]>(
          `eventos?select=equipa_id,tipo&jogo_id=eq.${j.id}&tipo=in.(golo,autogolo)`);
        const [c, f] = placarDosEventos(doJogo, j.casa_id, j.fora_id);
        const jogador = evento.jogador_id
          ? (await sb<{ nome: string }[]>(`jogadores?select=nome&id=eq.${evento.jogador_id}`))[0]?.nome ?? null
          : null;
        avisos.push(avisoGolo({ ...paraAviso(j), golosCasa: c, golosFora: f },
          { equipaId: evento.equipa_id, tipo: evento.tipo as 'golo' | 'autogolo', minuto: evento.minuto, jogador }));
      }
    } else if (dados.tipo === 'jogos') {
      for (const m of dados.mudancas) {
        const j = jogos.find((x) => x.id === m.jogo_id);
        if (!j || j.competicao?.estado !== 'em_curso') continue;
        const a = paraAviso(j);
        if (m.mudanca === 'inicio') avisos.push(avisoInicio(a));
        else if (m.mudanca === 'fim') avisos.push(avisoFim(a));
        else avisos.push(avisoMarcacao(a, fuso));
      }
    }
    if (!avisos.length) return json({ enviadas: 0 });

    // Só as subscrições que seguem estas competições ou equipas
    const comps = [...new Set(avisos.map((a) => a.competicaoId))];
    const eqs = [...new Set(avisos.flatMap((a) => [a.casaId, a.foraId]))];
    const subscricoes = await sb<Subscricao[]>(
      `subscricoes_push?select=endpoint,p256dh,auth,competicoes,equipas,tipos&or=(competicoes.ov.{${comps.join(',')}},equipas.ov.{${eqs.join(',')}})`);
    const envios = distribuir(subscricoes, avisos);

    const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    let enviadas = 0;
    let falhadas = 0;
    const remover = new Set<string>();
    const enviar = async ({ subscricao: s, mensagem }: { subscricao: Subscricao; mensagem: Mensagem }) => {
      try {
        const marcacao = mensagem.etiqueta.startsWith('marcacao');
        const payload = await buildPushPayload(
          { data: JSON.stringify(mensagem), options: { ttl: marcacao ? 86400 : 3600, urgency: marcacao ? 'normal' : 'high' } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        );
        const r = await fetchFn(s.endpoint, payload);
        if (r.ok) enviadas++;
        // 404/410: a subscrição já não existe (app desinstalada ou autorização retirada)
        else if (r.status === 404 || r.status === 410) remover.add(s.endpoint);
        else falhadas++;
      } catch {
        falhadas++;
      }
    };
    // Em grupos de 20, para não abrir centenas de ligações de uma vez
    for (let i = 0; i < envios.length; i += 20) await Promise.all(envios.slice(i, i + 20).map(enviar));

    for (const endpoint of remover)
      await sb(`subscricoes_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' }).catch(() => undefined);

    return json({ avisos: avisos.length, enviadas, falhadas, removidas: remover.size });
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
}

