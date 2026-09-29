import { formatarData } from './datas';
import { blocosDeJogos } from './formatos';
import type { Equipa, Jogo } from './types';

export type TipoCartaz = 'resultados' | 'proximos';

export const TIPO_CARTAZ_LABEL: Record<TipoCartaz, string> = {
  resultados: 'Resultados',
  proximos: 'Próximos jogos',
};

const REALIZADO = new Set(['terminado', 'wo_casa', 'wo_fora']);

/** Jornadas (ou rondas) que fazem sentido para cada tipo de imagem. */
export function blocosParaCartaz(jogos: Jogo[], tipo: TipoCartaz) {
  return blocosDeJogos(jogos)
    .map((b) => ({ ...b, jogos: tipo === 'proximos' ? b.jogos.filter((j) => j.estado === 'agendado') : b.jogos }))
    .filter((b) => (tipo === 'resultados' ? b.jogos.some((j) => REALIZADO.has(j.estado)) : b.jogos.length > 0));
}

/** Por defeito: a última jornada com resultados, ou a primeira com jogos por fazer. */
export function blocoPorDefeito(blocos: { titulo: string }[], tipo: TipoCartaz): string | undefined {
  return (tipo === 'resultados' ? blocos[blocos.length - 1] : blocos[0])?.titulo;
}

/** Resultado como texto: "2–1", "1–1 (4–3 g.p.)", "W.O.", "adiado" ou a data. */
export function marcador(j: Jogo): string {
  if (j.estado === 'adiado') return 'adiado';
  if (j.estado === 'wo_casa' || j.estado === 'wo_fora') return 'W.O.';
  if (j.estado === 'terminado' && j.golos_casa != null) {
    const pen = j.penaltis_casa != null && j.penaltis_fora != null ? ` (${j.penaltis_casa}–${j.penaltis_fora} g.p.)` : '';
    return `${j.golos_casa}–${j.golos_fora}${pen}`;
  }
  return 'vs';
}

/** Versão em texto, para colar numa mensagem de WhatsApp. */
export function textoPartilha(o: {
  tipo: TipoCartaz; competicao: string; titulo: string; jogos: Jogo[]; equipas: Map<string, Equipa>; endereco?: string;
}): string {
  const nome = (id: string) => o.equipas.get(id)?.nome ?? '?';
  const linhas = [`*${o.competicao}*`, `${o.titulo}: ${TIPO_CARTAZ_LABEL[o.tipo].toLowerCase()}`, ''];
  for (const j of o.jogos) {
    const grupo = j.grupo ? ` (Grupo ${j.grupo})` : '';
    if (o.tipo === 'resultados') {
      linhas.push(`${nome(j.casa_id)} ${marcador(j)} ${nome(j.fora_id)}${grupo}`);
    } else {
      const quando = [formatarData(j.data_hora) ?? 'data por marcar', j.campo].filter(Boolean).join(', ');
      linhas.push(`${nome(j.casa_id)} vs ${nome(j.fora_id)}${grupo}`, `   ${quando}`);
    }
  }
  if (o.endereco) linhas.push('', `Acompanhe em direto: ${o.endereco}`);
  return linhas.join('\n');
}

/** Endereço público do portal (não se mostra quando é localhost). */
export function enderecoPublico(competicaoId: string): string | undefined {
  const base = ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/$/, '');
  if (/localhost|127\.0\.0\.1/.test(base)) return undefined;
  return `${base}/c/${competicaoId}`;
}

// ---------- Desenho da imagem ----------

const COR = {
  relva: '#1e6b45', relvaClara: '#237a4f', giz: '#f6f8f4', tinta: '#1b2433',
  linha: '#d9dee3', cartao: '#f2c230', vermelho: '#d7263d', branco: '#ffffff',
};
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TEXTO = '"Barlow", system-ui, sans-serif';

const L = 1080;               // largura
const MARGEM = 64;
const CABECALHO = 300;
const RODAPE = 120;
const EMBLEMA = 64;
const PLACAR = 180;

export interface OpcoesCartaz {
  tipo: TipoCartaz;
  competicao: string;
  epoca: string | null;
  titulo: string;
  jogos: Jogo[];
  equipas: Map<string, Equipa>;
  endereco?: string;
}

/** Desenha a imagem e devolve-a em PNG. */
export async function gerarCartaz(o: OpcoesCartaz): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`700 80px ${DISPLAY}`),
    document.fonts.load(`600 40px ${DISPLAY}`),
    document.fonts.load(`500 28px ${TEXTO}`),
  ]).catch(() => undefined);
  const emblemas = await carregarEmblemas(o.jogos, o.equipas);

  const alturaLinha = 156;
  const espaco = 16;
  const conteudo = o.jogos.length * (alturaLinha + espaco) - espaco;
  const altura = Math.max(L, CABECALHO + 2 * MARGEM + conteudo + RODAPE);

  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;

  // Fundo e cabeçalho com faixas de relva
  ctx.fillStyle = COR.giz;
  ctx.fillRect(0, 0, L, altura);
  for (let x = 0, i = 0; x < L; x += 90, i++) {
    ctx.fillStyle = i % 2 ? COR.relvaClara : COR.relva;
    ctx.fillRect(x, 0, 90, CABECALHO);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.cartao;
  ctx.font = `600 40px ${DISPLAY}`;
  ctx.fillText(`${o.titulo} · ${TIPO_CARTAZ_LABEL[o.tipo]}`.toUpperCase(), MARGEM, 110);
  ctx.fillStyle = COR.branco;
  escreverAjustado(ctx, o.competicao, MARGEM, 200, L - 2 * MARGEM, 700, 88, 48, DISPLAY);
  if (o.epoca) {
    ctx.font = `500 30px ${TEXTO}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`Época ${o.epoca}`, MARGEM, 252);
    ctx.globalAlpha = 1;
  }

  // Jogos, centrados no espaço disponível
  const disponivel = altura - CABECALHO - RODAPE;
  let y = CABECALHO + Math.max(MARGEM, (disponivel - conteudo) / 2);
  for (const j of o.jogos) {
    desenharJogo(ctx, j, y, alturaLinha, o, emblemas);
    y += alturaLinha + espaco;
  }

  // Rodapé
  ctx.fillStyle = COR.tinta;
  ctx.fillRect(0, altura - RODAPE, L, RODAPE);
  ctx.fillStyle = COR.branco;
  ctx.textAlign = 'center';
  ctx.font = `500 30px ${TEXTO}`;
  ctx.fillText(o.endereco ? `Acompanhe em direto: ${o.endereco.replace(/^https?:\/\//, '')}` : o.competicao,
    L / 2, altura - RODAPE / 2 + 10, L - 2 * MARGEM);

  return new Promise((resolver, rejeitar) =>
    canvas.toBlob((b) => (b ? resolver(b) : rejeitar(new Error('Não foi possível criar a imagem.'))), 'image/png'));
}

function desenharJogo(
  ctx: CanvasRenderingContext2D, j: Jogo, y: number, h: number, o: OpcoesCartaz, emblemas: Map<string, ImageBitmap>,
) {
  const x = MARGEM;
  const w = L - 2 * MARGEM;
  ctx.fillStyle = COR.branco;
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 2;
  retanguloRedondo(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  const centro = L / 2;
  // Placar em cima, linha de detalhe em baixo, sem se tocarem
  const meio = y + 62;
  const casa = o.equipas.get(j.casa_id);
  const fora = o.equipas.get(j.fora_id);

  // Placar (ou hora, nos próximos jogos)
  const placar = o.tipo === 'proximos'
    ? (j.data_hora ? new Date(j.data_hora).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) : 'vs')
    : marcador(j).replace(/ \(.*\)$/, '');
  const destaque = j.estado === 'adiado' ? COR.vermelho : COR.tinta;
  ctx.fillStyle = destaque;
  retanguloRedondo(ctx, centro - PLACAR / 2, meio - 42, PLACAR, 84, 12);
  ctx.fill();
  ctx.fillStyle = COR.branco;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${placar.length > 5 ? 40 : 56}px ${DISPLAY}`;
  ctx.fillText(placar.toUpperCase(), centro, meio + 3, PLACAR - 16);

  // Equipas: emblema junto ao placar, nome para fora
  const folga = 20;
  const emblemaCasaX = centro - PLACAR / 2 - folga - EMBLEMA;
  const emblemaForaX = centro + PLACAR / 2 + folga;
  desenharEmblema(ctx, casa, emblemas, emblemaCasaX, meio - EMBLEMA / 2);
  desenharEmblema(ctx, fora, emblemas, emblemaForaX, meio - EMBLEMA / 2);
  const largNome = emblemaCasaX - folga - (x + 28);
  ctx.fillStyle = COR.tinta;
  ctx.textAlign = 'right';
  escreverAjustado(ctx, casa?.nome ?? '?', emblemaCasaX - folga, meio + 2, largNome, 600, 40, 32, DISPLAY);
  ctx.textAlign = 'left';
  escreverAjustado(ctx, fora?.nome ?? '?', emblemaForaX + EMBLEMA + folga, meio + 2, largNome, 600, 40, 32, DISPLAY);

  // Linha de detalhe: data e campo, grupo, penáltis
  const pen = j.penaltis_casa != null && j.penaltis_fora != null && j.estado === 'terminado'
    ? `Penáltis ${j.penaltis_casa}–${j.penaltis_fora}` : null;
  const detalhes = o.tipo === 'proximos'
    ? [j.data_hora ? diaPorExtenso(j.data_hora) : 'Data por marcar', j.campo, j.grupo && `Grupo ${j.grupo}`]
    : [pen, j.grupo && `Grupo ${j.grupo}`, j.estado === 'agendado' && (formatarData(j.data_hora) ?? 'Por jogar')];
  const texto = detalhes.filter(Boolean).join('  ·  ');
  if (texto) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5b6472';
    ctx.font = `500 26px ${TEXTO}`;
    ctx.fillText(texto, centro, y + h - 26, w - 40);
  }
  ctx.textBaseline = 'alphabetic';
}

function desenharEmblema(
  ctx: CanvasRenderingContext2D, equipa: Equipa | undefined, emblemas: Map<string, ImageBitmap>, x: number, y: number,
) {
  const r = EMBLEMA / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.closePath();
  const img = equipa && emblemas.get(equipa.id);
  if (img) {
    ctx.fillStyle = COR.branco;
    ctx.fill();
    ctx.clip();
    // "cover": preenche o círculo sem deformar
    const escala = Math.max(EMBLEMA / img.width, EMBLEMA / img.height);
    const [lw, lh] = [img.width * escala, img.height * escala];
    ctx.drawImage(img, x + (EMBLEMA - lw) / 2, y + (EMBLEMA - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = '#e4ede8';
    ctx.fill();
    ctx.fillStyle = COR.relva;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 26px ${DISPLAY}`;
    const iniciais = (equipa?.nome ?? '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    ctx.fillText(iniciais, x + r, y + r + 1);
  }
  ctx.restore();
}

/** Escreve numa só linha, reduzindo a letra até caber; se não chegar, corta com reticências. */
function escreverAjustado(
  ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, largura: number,
  peso: number, maior: number, menor: number, familia: string,
) {
  let tamanho = maior;
  ctx.font = `${peso} ${tamanho}px ${familia}`;
  while (ctx.measureText(texto).width > largura && tamanho > menor) {
    tamanho -= 2;
    ctx.font = `${peso} ${tamanho}px ${familia}`;
  }
  let t = texto;
  while (ctx.measureText(t).width > largura && t.length > 1) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
}

function retanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Emblemas das equipas. Os que falham (rede, CORS) ficam com as iniciais. */
async function carregarEmblemas(jogos: Jogo[], equipas: Map<string, Equipa>): Promise<Map<string, ImageBitmap>> {
  const ids = [...new Set(jogos.flatMap((j) => [j.casa_id, j.fora_id]))];
  const pares = await Promise.all(ids.map(async (id) => {
    const url = equipas.get(id)?.emblema_url;
    if (!url) return null;
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return [id, await createImageBitmap(await r.blob())] as const;
    } catch {
      return null;
    }
  }));
  return new Map(pares.filter((p): p is readonly [string, ImageBitmap] => p !== null));
}

/** "domingo, 11 de outubro" (a hora já está no placar). */
const diaPorExtenso = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
