import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Organizacao } from './types';

interface Gestao {
  /** Super admin: gere todas as organizações e quem as administra. */
  super: boolean;
  /** Organizações que esta pessoa gere. */
  organizacoes: Organizacao[];
  /** A organização escolhida: as listas do backoffice mostram só a dela. */
  atual: Organizacao | null;
  mudar: (id: string) => void;
  /** Esta pessoa gere a organização indicada? */
  gere: (organizacaoId: string | null | undefined) => boolean;
  recarregar: () => Promise<void>;
}

const Contexto = createContext<Gestao | null>(null);
const CHAVE = 'liga:organizacao';

export function ProvedorGestao({ super: eSuper, ids, children }: { super: boolean; ids: string[]; children: ReactNode }) {
  const [organizacoes, setOrganizacoes] = useState<Organizacao[] | null>(null);
  const [atualId, setAtualId] = useState<string | null>(() => { try { return localStorage.getItem(CHAVE); } catch { return null; } });
  const chaveIds = ids.join(',');

  const recarregar = useCallback(async () => {
    // O super admin vê todas (incluindo as que acabou de criar); os outros, as atribuídas
    const q = supabase.from('organizacoes').select('id, nome').order('nome');
    const { data } = eSuper ? await q : await q.in('id', chaveIds ? chaveIds.split(',') : []);
    setOrganizacoes((data ?? []) as Organizacao[]);
  }, [eSuper, chaveIds]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const mudar = useCallback((id: string) => {
    setAtualId(id);
    try { localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento local */ }
  }, []);

  if (!organizacoes) return null;
  const atual = organizacoes.find((o) => o.id === atualId) ?? organizacoes[0] ?? null;
  const gere = (id: string | null | undefined) => Boolean(id) && (eSuper || organizacoes.some((o) => o.id === id));

  return (
    <Contexto.Provider value={{ super: eSuper, organizacoes, atual, mudar, gere, recarregar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useGestao(): Gestao {
  const g = useContext(Contexto);
  if (!g) throw new Error('useGestao fora do backoffice');
  return g;
}
