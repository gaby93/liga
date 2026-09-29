import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { Botao, Carregando } from '../../componentes/ui';
import { supabase } from '../../lib/supabase';

type Estado = 'a_verificar' | 'sem_sessao' | 'sem_permissao' | 'ok';

const links = [
  { to: 'competicoes', rotulo: 'Competições' },
  { to: 'equipas', rotulo: 'Equipas' },
  { to: 'jogadores', rotulo: 'Jogadores' },
];

export default function AdminLayout() {
  const [estado, setEstado] = useState<Estado>('a_verificar');

  useEffect(() => {
    const verificar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setEstado('sem_sessao');
      const { data, error } = await supabase.rpc('is_admin');
      setEstado(!error && data ? 'ok' : 'sem_permissao');
    };
    verificar();
    // setTimeout evita chamar o Supabase dentro do callback de autenticação
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(verificar, 0));
    return () => data.subscription.unsubscribe();
  }, []);

  const sair = () => supabase.auth.signOut();

  if (estado === 'a_verificar') return <Carregando />;
  if (estado === 'sem_sessao') return <Navigate to="/admin/login" replace />;
  if (estado === 'sem_permissao')
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4">Esta conta não tem permissão de administração. Peça a um administrador para a adicionar.</p>
        <Botao variante="secundario" onClick={sair}>Sair</Botao>
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="bg-tinta text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/admin" className="font-display text-2xl font-bold">Gestão da liga</Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Administração">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => `rounded px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-white/15' : 'text-white/80 hover:bg-white/10'}`}>
                {l.rotulo}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="text-sm text-white/80 hover:text-white">Ver portal</Link>
          <button type="button" onClick={sair} className="text-sm text-white/80 hover:text-white">Sair</button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
