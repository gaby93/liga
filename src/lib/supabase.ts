import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && chave);

export const supabase = createClient(url || 'http://localhost', chave || 'sem-chave');

export function mensagemErro(e: unknown): string {
  const erro = e as { code?: string; message?: string };
  if (erro?.code === '23503') return 'Este registo está a ser usado noutro sítio (por exemplo, em jogos) e não pode ser apagado.';
  if (erro?.code === '23505') return 'Já existe um registo com esse nome.';
  if (erro?.message) return erro.message;
  return String(e);
}
