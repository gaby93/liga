import { porJornada, type JogoSusp } from './suspensoes';

export interface ConvocatoriaBase {
  jogo_id: string;
  jogador_id: string;
  equipa_id: string;
}

/**
 * Jogadores da última ficha preenchida da equipa antes deste jogo.
 * Serve para "Copiar do jogo anterior": quem jogou da última vez costuma voltar.
 */
export function fichaAnterior(
  jogos: JogoSusp[], convocatorias: ConvocatoriaBase[], equipaId: string, jogoId: string,
): { jogoId: string; jogadores: string[] } | null {
  const ordem = [...jogos].sort(porJornada);
  const atual = ordem.findIndex((j) => j.id === jogoId);
  if (atual < 0) return null;
  for (let i = atual - 1; i >= 0; i--) {
    const g = ordem[i];
    if (g.casa_id !== equipaId && g.fora_id !== equipaId) continue;
    const jogadores = convocatorias.filter((c) => c.jogo_id === g.id && c.equipa_id === equipaId).map((c) => c.jogador_id);
    if (jogadores.length) return { jogoId: g.id, jogadores };
  }
  return null;
}

/** Jogos disputados por jogador: convocado num jogo terminado (num W.O. ninguém jogou). */
export function jogosDisputados(
  jogos: { id: string; estado: string }[], convocatorias: ConvocatoriaBase[],
): Map<string, number> {
  const terminados = new Set(jogos.filter((j) => j.estado === 'terminado').map((j) => j.id));
  const n = new Map<string, number>();
  for (const c of convocatorias) if (terminados.has(c.jogo_id)) n.set(c.jogador_id, (n.get(c.jogador_id) ?? 0) + 1);
  return n;
}

/**
 * Quem tem golos ou cartões neste jogo sem estar na ficha da equipa.
 * Só se verifica para equipas com ficha preenchida.
 */
export function eventosForaDaFicha(
  eventos: { equipa_id: string; jogador_id: string | null }[], convocatorias: ConvocatoriaBase[],
): string[] {
  const comFicha = new Set(convocatorias.map((c) => c.equipa_id));
  const convocados = new Set(convocatorias.map((c) => c.jogador_id));
  return [...new Set(eventos
    .filter((e) => e.jogador_id && comFicha.has(e.equipa_id) && !convocados.has(e.jogador_id))
    .map((e) => e.jogador_id!))];
}
