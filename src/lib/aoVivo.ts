import type { EstadoJogo, TipoEvento } from './types';

export type Periodo = '1p' | 'intervalo' | '2p';

export interface Relogio {
  estado: EstadoJogo;
  periodo: Periodo | null;
  /** Quando começou a parte que está a decorrer (null parado). */
  relogio_inicio: string | null;
  /** Minutos já jogados antes da parte atual (a 2.ª parte continua a partir daqui). */
  relogio_base: number;
}

const MAXIMO = 130;  // limite do minuto nos eventos (base de dados)

/** Minutos completos já jogados (0 no primeiro minuto). */
export function minutosJogados(r: Relogio, agora: number): number {
  const decorrer = r.relogio_inicio ? Math.max(0, Math.floor((agora - Date.parse(r.relogio_inicio)) / 60000)) : 0;
  return Math.min(MAXIMO, r.relogio_base + decorrer);
}

/** Minuto a mostrar e a gravar num evento: o minuto em curso (1', 2'…), ou null se o relógio não está a andar. */
export function minutoAtual(r: Relogio, agora: number): number | null {
  if (r.estado !== 'em_curso' || !r.relogio_inicio) return null;
  return Math.min(MAXIMO, minutosJogados(r, agora) + 1);
}

/** Texto curto do estado ao vivo: "23'", "Intervalo", "Por começar", "Terminado". */
export function rotuloAoVivo(r: Relogio, agora: number): string {
  if (r.estado === 'terminado' || r.estado === 'wo_casa' || r.estado === 'wo_fora') return 'Terminado';
  if (r.estado !== 'em_curso') return 'Por começar';
  if (r.periodo === 'intervalo') return 'Intervalo';
  const m = minutoAtual(r, agora);
  return m == null ? 'A decorrer' : `${m}'`;
}

export type Acao = 'comecar' | 'intervalo' | 'segunda' | 'terminar';

/** Próximo passo do jogo, pela ordem: começar → intervalo → 2.ª parte → terminar. */
export function proximaAcao(r: Relogio): Acao | null {
  if (r.estado === 'agendado' || r.estado === 'adiado') return 'comecar';
  if (r.estado !== 'em_curso') return null;
  if (r.periodo === 'intervalo') return 'segunda';
  if (r.periodo === '2p') return 'terminar';
  return 'intervalo';
}

export const ROTULO_ACAO: Record<Acao, string> = {
  comecar: 'Começar o jogo',
  intervalo: 'Intervalo',
  segunda: 'Começar a 2.ª parte',
  terminar: 'Terminar o jogo',
};

/** Colunas a gravar no jogo para cada passo. */
export function aplicarAcao(r: Relogio, acao: Acao, agora: number): Relogio {
  const iso = new Date(agora).toISOString();
  switch (acao) {
    case 'comecar': return { estado: 'em_curso', periodo: '1p', relogio_inicio: iso, relogio_base: 0 };
    case 'intervalo': return { ...r, periodo: 'intervalo', relogio_inicio: null, relogio_base: minutosJogados(r, agora) };
    case 'segunda': return { ...r, periodo: '2p', relogio_inicio: iso };
    case 'terminar': return { ...r, estado: 'terminado', periodo: null, relogio_inicio: null, relogio_base: minutosJogados(r, agora) };
  }
}

export interface EventoPlacar {
  equipa_id: string;
  tipo: TipoEvento;
}

/** Resultado a partir dos golos registados (um autogolo conta para o adversário). */
export function placarDosEventos(eventos: EventoPlacar[], casaId: string, foraId: string): [number, number] {
  let casa = 0;
  let fora = 0;
  for (const e of eventos) {
    const paraCasa = (e.tipo === 'golo' && e.equipa_id === casaId) || (e.tipo === 'autogolo' && e.equipa_id === foraId);
    const paraFora = (e.tipo === 'golo' && e.equipa_id === foraId) || (e.tipo === 'autogolo' && e.equipa_id === casaId);
    if (paraCasa) casa++;
    if (paraFora) fora++;
  }
  return [casa, fora];
}

/** Jogadores expulsos neste jogo (vermelho, ou dois amarelos). */
export function expulsos(eventos: { jogador_id: string | null; tipo: TipoEvento }[]): Set<string> {
  const amarelos = new Map<string, number>();
  const fora = new Set<string>();
  for (const e of eventos) {
    if (!e.jogador_id) continue;
    if (e.tipo === 'vermelho') fora.add(e.jogador_id);
    if (e.tipo === 'amarelo') {
      const n = (amarelos.get(e.jogador_id) ?? 0) + 1;
      amarelos.set(e.jogador_id, n);
      if (n >= 2) fora.add(e.jogador_id);
    }
  }
  return fora;
}
