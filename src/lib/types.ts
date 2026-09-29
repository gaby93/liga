export type EstadoJogo = 'agendado' | 'terminado' | 'wo_casa' | 'wo_fora' | 'adiado';
export type TipoEvento = 'golo' | 'autogolo' | 'amarelo' | 'vermelho';
export type EstadoCompeticao = 'rascunho' | 'em_curso' | 'terminada';
export type Formato = 'liga' | 'grupos' | 'eliminatorias';

export const FORMATO_LABEL: Record<Formato, string> = {
  liga: 'Liga (todos contra todos)',
  grupos: 'Fase de grupos + eliminatórias',
  eliminatorias: 'Eliminatórias',
};

export type Criterio =
  | 'pontos'
  | 'confronto_pontos'
  | 'confronto_dif'
  | 'confronto_golos'
  | 'dif_golos'
  | 'golos_marcados'
  | 'fair_play'
  | 'sorteio';

export const CRITERIO_LABEL: Record<Criterio, string> = {
  pontos: 'Pontos',
  confronto_pontos: 'Pontos no confronto direto',
  confronto_dif: 'Diferença de golos no confronto direto',
  confronto_golos: 'Golos marcados no confronto direto',
  dif_golos: 'Diferença de golos',
  golos_marcados: 'Golos marcados',
  fair_play: 'Fair play (menos cartões)',
  sorteio: 'Sorteio',
};

export const ESTADO_JOGO_LABEL: Record<EstadoJogo, string> = {
  agendado: 'Agendado',
  terminado: 'Terminado',
  wo_casa: 'W.O. (faltou a equipa da casa)',
  wo_fora: 'W.O. (faltou a equipa de fora)',
  adiado: 'Adiado',
};

export const ESTADO_COMPETICAO_LABEL: Record<EstadoCompeticao, string> = {
  rascunho: 'Rascunho (não visível ao público)',
  em_curso: 'Em curso',
  terminada: 'Terminada',
};

export interface Competicao {
  id: string;
  nome: string;
  epoca: string | null;
  estado: EstadoCompeticao;
  pts_vitoria: number;
  pts_empate: number;
  pts_derrota: number;
  golos_wo: number;
  ida_volta: boolean;
  formato: Formato;
  num_grupos: number;
  apurados_por_grupo: number;
  /** Quantos dos melhores classificados logo abaixo dos apurados também passam (ex.: melhores terceiros). */
  melhores_terceiros: number;
  duas_maos: boolean;
  final_duas_maos: boolean;
  terceiro_lugar: boolean;
  amarelos_suspensao: number;
  jogos_suspensao_expulsao: number;
  criterios: Criterio[];
}

export interface Equipa {
  id: string;
  nome: string;
  emblema_url: string | null;
  responsavel: string | null;
  contacto: string | null;
}

export interface Participante {
  equipa_id: string;
  ordem_sorteio: number | null;
  grupo: string | null;
  posicao_quadro: number | null;
}

export interface Jogador {
  id: string;
  equipa_id: string | null;
  nome: string;
  numero: number | null;
  foto_url: string | null;
  suspenso: boolean;
}

export interface JogadorPrivado {
  jogador_id: string;
  data_nasc: string | null;
  documento: string | null;
  contacto: string | null;
}

export interface Jogo {
  id: string;
  competicao_id: string;
  jornada: number;
  casa_id: string;
  fora_id: string;
  data_hora: string | null;
  campo: string | null;
  golos_casa: number | null;
  golos_fora: number | null;
  estado: EstadoJogo;
  grupo: string | null;
  eliminatoria: number | null;
  chave: number | null;
  /** 1.ª ou 2.ª mão (null num jogo único). */
  mao: number | null;
  penaltis_casa: number | null;
  penaltis_fora: number | null;
}

export interface Evento {
  id: string;
  jogo_id: string;
  equipa_id: string;
  jogador_id: string | null;
  minuto: number | null;
  tipo: TipoEvento;
}

export interface Sancao {
  id: string;
  competicao_id: string;
  equipa_id: string;
  pontos: number;
  motivo: string | null;
}

export interface Convocatoria {
  jogo_id: string;
  jogador_id: string;
  equipa_id: string;
}
