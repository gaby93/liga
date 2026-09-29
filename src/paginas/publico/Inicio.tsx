import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Carregando } from '../../componentes/ui';
import { supabase } from '../../lib/supabase';
import type { Competicao } from '../../lib/types';

export default function Inicio() {
  const [lista, setLista] = useState<Competicao[] | null>(null);

  useEffect(() => {
    supabase.from('competicoes').select('*').neq('estado', 'rascunho')
      .order('created_at', { ascending: false })
      .then(({ data }) => setLista((data ?? []) as Competicao[]));
  }, []);

  if (!lista) return <Carregando />;
  const emCurso = lista.filter((c) => c.estado === 'em_curso');
  if (emCurso.length === 1) return <Navigate to={`/c/${emCurso[0].id}`} replace />;

  return (
    <div className="min-h-screen">
      <header className="relvado px-4 py-10 text-white">
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-bold">Competições</h1>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {lista.length === 0 ? (
          <p className="text-tinta/70">Ainda não há competições publicadas.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {lista.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.id}`} className="flex items-baseline justify-between gap-4 px-4 py-4 hover:bg-giz">
                  <span className="font-display text-2xl font-semibold">{c.nome}</span>
                  <span className="text-sm text-tinta/60">{c.estado === 'terminada' ? 'Terminada' : 'Em curso'}{c.epoca ? `, ${c.epoca}` : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
