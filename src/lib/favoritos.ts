import { useCallback, useState } from 'react';

const CHAVE = 'liga:favoritos';

// Os favoritos ficam só neste browser (o público não tem conta).
// O acesso ao localStorage pode falhar (modo privado, bloqueio de cookies).
function ler(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function gravar(ids: string[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(ids)); } catch { /* sem armazenamento: fica só nesta visita */ }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(ler);
  const alternar = useCallback((id: string) => {
    setFavoritos((atual) => {
      const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      gravar(novo);
      return novo;
    });
  }, []);
  return { favoritos, eFavorito: (id: string) => favoritos.includes(id), alternar };
}

/** Texto sem acentos e em minúsculas, para pesquisar "Liga Maputo" com "liga maputo". */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface CompeticaoLista {
  id: string;
  nome: string;
  epoca: string | null;
  estado: string;
}

/**
 * Separa as competições para a página inicial: favoritas primeiro (pela ordem
 * em que foram marcadas), depois as em curso e, à parte, as terminadas.
 * A pesquisa procura em todas as palavras do nome e da época.
 */
export function organizarCompeticoes<T extends CompeticaoLista>(lista: T[], pesquisa: string, favoritos: string[]) {
  const termos = normalizar(pesquisa).split(/\s+/).filter(Boolean);
  const encontradas = lista.filter((c) => {
    const texto = normalizar(`${c.nome} ${c.epoca ?? ''}`);
    return termos.every((t) => texto.includes(t));
  });
  const fav = new Set(favoritos);
  return {
    favoritas: favoritos.map((id) => encontradas.find((c) => c.id === id)).filter((c): c is T => Boolean(c)),
    emCurso: encontradas.filter((c) => !fav.has(c.id) && c.estado === 'em_curso'),
    terminadas: encontradas.filter((c) => !fav.has(c.id) && c.estado === 'terminada'),
  };
}

/** Junta uma competição aos favoritos (ex.: a do convite com que a pessoa chegou). */
export function adicionarFavorito(id: string) {
  const atual = ler();
  if (!atual.includes(id)) gravar([...atual, id]);
}

/** Jogadores cujo nome tem todas as palavras da pesquisa (sem acentos), ou com esse número de camisola. */
export function pesquisarJogadores<T extends { nome: string; numero: number | null }>(lista: T[], pesquisa: string): T[] {
  const termos = normalizar(pesquisa).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  if (termos.length === 1 && /^\d+$/.test(termos[0])) {
    const n = Number(termos[0]);
    return lista.filter((j) => j.numero === n || normalizar(j.nome).includes(termos[0]));
  }
  return lista.filter((j) => { const nome = normalizar(j.nome); return termos.every((t) => nome.includes(t)); });
}

/** Uma página da lista (a 1.ª é 1), já com a página corrigida se ficou fora do intervalo. */
export function paginar<T>(lista: T[], pagina: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  return { itens: lista.slice((atual - 1) * porPagina, atual * porPagina), pagina: atual, paginas };
}
