import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Aviso, Botao, Carregando, Marca } from '../../componentes/ui';
import { ProvedorGestao, useGestao } from '../../lib/gestao';
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
    <ProvedorGestao super={papel.super} ids={papel.organizacoes}>
      <Estrutura sair={sair} />
    </ProvedorGestao>
  );
}

function Estrutura({ sair }: { sair: () => void }) {
  const g = useGestao();
  // Sem organizações, só a página Organizações (do super admin) faz sentido
  const naPaginaOrganizacoes = useLocation().pathname.startsWith('/admin/organizacoes');
  const menu = g.super ? [...links, { to: 'organizacoes', rotulo: 'Organizações' }] : links;

  return (
    <div className="min-h-screen">
      <header className="faixa lisa sticky top-0 z-30 text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link to="/admin" className="hover:opacity-80"><Marca texto="Gestão da liga" clara /></Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Administração">
            {menu.map((l) => (
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
        {/* Organização escolhida: tudo o que aparece abaixo é dela */}
        {g.atual && (
          <div className="border-t border-white/10 bg-black/10">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
              <span className="text-white/60">Organização:</span>
              {g.organizacoes.length > 1 ? (
                <select value={g.atual.id} onChange={(e) => g.mudar(e.target.value)} aria-label="Organização"
                  className="rounded-md border-0 bg-white/10 px-2 py-1 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-tinta">
                  {g.organizacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              ) : (
                <span className="font-semibold">{g.atual.nome}</span>
              )}
              {g.super && <span className="ml-auto rounded bg-white/15 px-2 py-0.5 text-xs font-semibold">Super admin</span>}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {g.atual || naPaginaOrganizacoes ? <Outlet /> : (
          <Aviso tipo="info">
            {g.super
              ? <>Ainda não há organizações. Crie a primeira em <Link to="organizacoes" className="font-semibold underline">Organizações</Link>.</>
              : 'A sua conta ainda não está associada a nenhuma organização.'}
          </Aviso>
        )}
      </main>
    </div>
  );
}
