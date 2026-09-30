import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { Botao, Carregando, Marca } from '../../componentes/ui';
import { usePapel } from '../../lib/sessao';
import { supabase } from '../../lib/supabase';

const links = [
  { to: 'competicoes', rotulo: 'Competições' },
  { to: 'equipas', rotulo: 'Equipas' },
  { to: 'jogadores', rotulo: 'Jogadores' },
  { to: 'campo', rotulo: 'No campo' },
];

export default function AdminLayout() {
  const papel = usePapel();
  const sair = () => supabase.auth.signOut();

  if (!papel) return <Carregando />;
  if (papel.tipo === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (papel.tipo === 'responsavel') return <Navigate to="/equipa" replace />;
  if (papel.tipo === 'sem_acesso')
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4">Esta conta não tem permissão de administração. Peça a um administrador para a adicionar.</p>
        <Botao variante="secundario" onClick={sair}>Sair</Botao>
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="faixa lisa sticky top-0 z-30 text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link to="/admin" className="hover:opacity-80"><Marca texto="Gestão da liga" clara /></Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Administração">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                {l.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <Link to="/entrar/nova-palavra-passe" className="hover:text-white">Palavra-passe</Link>
            <Link to="/" className="hover:text-white">Ver portal</Link>
            <button type="button" onClick={sair} className="hover:text-white">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
