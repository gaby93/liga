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
