import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Papel =
  | { tipo: 'sem_sessao' }
  | { tipo: 'admin'; email: string }
  | { tipo: 'responsavel'; email: string; equipas: string[] }
  | { tipo: 'sem_acesso'; email: string };

/** O que a pessoa com sessão pode fazer: gerir tudo, gerir as suas equipas, ou nada. */
export async function obterPapel(): Promise<Papel> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { tipo: 'sem_sessao' };
  const email = session.user.email ?? '';
  const [admin, equipas] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('minhas_equipas')]);
  if (admin.data) return { tipo: 'admin', email };
  const ids = ((equipas.data ?? []) as unknown[]).map((x) => (typeof x === 'string' ? x : Object.values(x as object)[0] as string));
  if (ids.length) return { tipo: 'responsavel', email, equipas: ids };
  return { tipo: 'sem_acesso', email };
}

/** Papel atual, atualizado quando se entra ou sai. null enquanto verifica. */
export function usePapel(): Papel | null {
  const [papel, setPapel] = useState<Papel | null>(null);
  useEffect(() => {
    let ativo = true;
    const verificar = () => obterPapel().then((p) => ativo && setPapel(p));
    verificar();
    // setTimeout evita chamar o Supabase dentro do callback de autenticação
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(verificar, 0));
    return () => { ativo = false; data.subscription.unsubscribe(); };
  }, []);
  return papel;
}

/** Para onde vai cada papel depois de entrar. */
export const destinoDoPapel = (p: Papel) => (p.tipo === 'admin' ? '/admin' : p.tipo === 'responsavel' ? '/equipa' : null);
