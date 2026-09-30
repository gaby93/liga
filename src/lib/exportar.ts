import { nomeFase } from './formatos';
import { ESTADO_JOGO_LABEL, type Equipa, type Jogo } from './types';

/**
 * CSV para o Excel em português: separador ";" (a vírgula é o separador
 * decimal) e marca UTF-8 no início, para os acentos aparecerem bem.
 */
export function paraCsv(linhas: (string | number | null | undefined)[][]): string {
  const celula = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

/** Tabela de resultados: uma linha por jogo. */
export function linhasResultados(jogos: Jogo[], equipas: Map<string, Equipa>): (string | number | null)[][] {
  const nome = (id: string) => equipas.get(id)?.nome ?? '';
  const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-PT', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '');
  return [
    ['Fase', 'Grupo', 'Data', 'Campo', 'Casa', 'Golos casa', 'Golos fora', 'Fora', 'Penáltis', 'Estado'],
    ...jogos.map((j) => [
      nomeFase(j), j.grupo ?? '', data(j.data_hora), j.campo ?? '',
      nome(j.casa_id), j.golos_casa, j.golos_fora, nome(j.fora_id),
      j.penaltis_casa != null && j.penaltis_fora != null ? `${j.penaltis_casa}-${j.penaltis_fora}` : '',
      ESTADO_JOGO_LABEL[j.estado],
    ]),
  ];
}

/** Nome de ficheiro seguro: "Liga do Bairro 2026" → "liga-do-bairro-2026". */
export const nomeFicheiro = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'competicao';

/** Descarrega um ficheiro gerado no browser. */
export function descarregar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
