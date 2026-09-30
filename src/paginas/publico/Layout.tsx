import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { CartaoAoVivo } from '../../componentes/AoVivo';
import { SinoCompeticao } from '../../componentes/Notificacoes';
import { Aviso, Marca } from '../../componentes/ui';
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
      <header className="faixa text-white">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex h-14 items-center justify-between">
            <Link to="/" className="hover:opacity-80"><Marca clara /></Link>
            <Link to="/" className="text-sm text-white/70 hover:text-white">Todas as competições</Link>
          </div>
          <div className="flex items-start justify-between gap-3 pb-5 pt-4">
            <div className="min-w-0">
              {c && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/65">
                  {[c.epoca && `Época ${c.epoca}`, c.estado === 'terminada' && 'Terminada'].filter(Boolean).join(' · ') || 'Competição'}
                </p>
              )}
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                <Link to={`/c/${id}`} className="hover:text-white/85">{c?.nome ?? '\u00a0'}</Link>
              </h1>
            </div>
            {c && (
              <div className="flex items-center">
                <SinoCompeticao competicaoId={c.id} nome={c.nome} />
                <EstrelaFavorito ativo={eFavorito(c.id)} nome={c.nome} onClick={() => alternar(c.id)} clara />
              </div>
            )}
          </div>
          <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Secções">
            {separadores.map((s) => (
              <NavLink key={s.rotulo} to={s.to} end={s.end}
                className={({ isActive }) =>
                  `shrink-0 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/65 hover:text-white'}`}>
                {s.rotulo}
              </NavLink>
            ))}
          </nav>
        </div>
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
