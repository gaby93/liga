import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { CartaoAoVivo } from '../../componentes/AoVivo';
import { Aviso } from '../../componentes/ui';
import { nomeFase } from '../../lib/formatos';
import type { Formato } from '../../lib/types';
import { useDadosCompeticao } from '../../lib/useDadosCompeticao';
import { useFavoritos } from '../../lib/favoritos';
import { EstrelaFavorito } from './Inicio';

const SEPARADORES: Record<Formato, { to: string; rotulo: string; end: boolean }[]> = {
  liga: [{ to: '', rotulo: 'Tabela', end: true }],
  grupos: [{ to: '', rotulo: 'Grupos', end: true }, { to: 'fase-final', rotulo: 'Fase final', end: false }],
  eliminatorias: [{ to: '', rotulo: 'Quadro', end: true }],
};

export default function PublicoLayout() {
  const { id, jogoId } = useParams();
  const dados = useDadosCompeticao(id);
  const c = dados.competicao;
  // Jogos a decorrer (menos o que já está aberto na página do jogo)
  const aoVivo = dados.jogos.filter((j) => j.estado === 'em_curso' && j.id !== jogoId);
  const { eFavorito, alternar } = useFavoritos();
  const separadores = [
    ...SEPARADORES[c?.formato ?? 'liga'],
    { to: 'jogos', rotulo: 'Jogos', end: false },
    { to: 'marcadores', rotulo: 'Marcadores', end: false },
  ];

  return (
    <div className="min-h-screen">
      <header className="relvado text-white">
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-4 sm:pt-6">
          <Link to="/" className="mb-4 inline-block text-sm font-semibold text-white/85 hover:text-white hover:underline">
            ‹ Todas as competições
          </Link>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-5xl font-bold leading-[0.95] sm:text-7xl">
              <Link to={`/c/${id}`} className="hover:underline">{c?.nome ?? '\u00a0'}</Link>
            </h1>
            {c && <EstrelaFavorito ativo={eFavorito(c.id)} nome={c.nome} onClick={() => alternar(c.id)} clara />}
          </div>
          {c && (
            <p className="mt-3 text-white/85">
              {[c.epoca && `Época ${c.epoca}`, c.estado === 'terminada' && 'Competição terminada'].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4" aria-label="Secções">
          {separadores.map((s) => (
            <NavLink key={s.rotulo} to={s.to} end={s.end}
              className={({ isActive }) =>
                `shrink-0 rounded-t-md px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white ${
                  isActive ? 'bg-giz text-tinta' : 'text-white/90 hover:bg-white/10'}`}>
              {s.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {aoVivo.length > 0 && (
          <section aria-label="Jogos ao vivo" className="mb-6 grid gap-2 sm:grid-cols-2">
            {aoVivo.map((j) => (
              <CartaoAoVivo key={j.id} jogo={j} casa={dados.equipas.get(j.casa_id)} fora={dados.equipas.get(j.fora_id)}
                para={`/c/${id}/jogos/${j.id}`} contexto={nomeFase(j)} />
            ))}
          </section>
        )}
        {dados.erro ? <Aviso>Não foi possível carregar a competição: {dados.erro}</Aviso> : <Outlet context={dados} />}
      </main>
    </div>
  );
}
