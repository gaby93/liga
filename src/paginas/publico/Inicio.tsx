import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InstalarApp } from '../../componentes/AvisosApp';
import { Carregando } from '../../componentes/ui';
import { organizarCompeticoes, useFavoritos } from '../../lib/favoritos';
import { supabase } from '../../lib/supabase';
import { FORMATO_LABEL, type Competicao } from '../../lib/types';

type Item = Competicao & { participantes: { count: number }[] };

export function EstrelaFavorito({ ativo, nome, onClick, clara = false }:
  { ativo: boolean; nome: string; onClick: () => void; clara?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      aria-label={ativo ? `Tirar ${nome} dos favoritos` : `Marcar ${nome} como favorito`}
      title={ativo ? 'Tirar dos favoritos' : 'Marcar como favorito'}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl leading-none transition-colors focus-visible:outline-2 focus-visible:outline-relva ${
        ativo ? 'text-cartao' : clara ? 'text-white/70 hover:text-white' : 'text-tinta/30 hover:text-tinta/60'}`}>
      {ativo ? '★' : '☆'}
    </button>
  );
}

export default function Inicio() {
  const [lista, setLista] = useState<Item[] | null>(null);
  const [erro, setErro] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [verTerminadas, setVerTerminadas] = useState(false);
  const { favoritos, eFavorito, alternar } = useFavoritos();

  useEffect(() => {
    supabase.from('competicoes').select('*, participantes(count)').neq('estado', 'rascunho')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErro(true);
        setLista((data ?? []) as Item[]);
      });
  }, []);

  if (!lista) return <Carregando />;
  const { favoritas, emCurso, terminadas } = organizarCompeticoes(lista, pesquisa, favoritos);
  const aPesquisar = pesquisa.trim() !== '';
  const nada = !favoritas.length && !emCurso.length && !terminadas.length;

  const bloco = (titulo: string, itens: Item[]) => itens.length > 0 && (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-semibold text-tinta/70">{titulo}</h2>
      <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
        {itens.map((c) => (
          <li key={c.id} className="flex items-center gap-2 pr-2">
            <Link to={`/c/${c.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-4 hover:bg-giz">
              <span className="truncate font-display text-2xl font-semibold">{c.nome}</span>
              <span className="text-sm text-tinta/60">
                {[c.epoca, FORMATO_LABEL[c.formato], `${c.participantes[0]?.count ?? 0} equipas`,
                  c.estado === 'terminada' && 'Terminada'].filter(Boolean).join(' · ')}
              </span>
            </Link>
            <EstrelaFavorito ativo={eFavorito(c.id)} nome={c.nome} onClick={() => alternar(c.id)} />
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relvado px-4 pb-8 pt-10 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-5xl font-bold">Competições</h1>
          <label className="mt-5 block">
            <span className="sr-only">Pesquisar competições</span>
            <input type="search" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar por nome ou época…"
              className="w-full rounded-md border-0 bg-white px-4 py-3 text-base text-tinta shadow-sm placeholder:text-tinta/50 focus:outline-none focus:ring-2 focus:ring-cartao" />
          </label>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {erro && <p className="text-sm text-vermelho">Não foi possível carregar as competições. Tente novamente daqui a pouco.</p>}
        <InstalarApp />
        {lista.length === 0 && !erro ? (
          <p className="text-tinta/70">Ainda não há competições publicadas.</p>
        ) : nada ? (
          <p className="text-tinta/70">Nenhuma competição corresponde a “{pesquisa}”.</p>
        ) : (
          <>
            {bloco('Favoritas', favoritas)}
            {bloco(favoritas.length ? 'Outras em curso' : 'Em curso', emCurso)}
            {favoritas.length === 0 && emCurso.length > 0 && !aPesquisar && (
              <p className="-mt-3 text-xs text-tinta/60">Toque na ☆ para ver uma competição sempre no topo desta lista.</p>
            )}
            {terminadas.length > 0 && (aPesquisar || verTerminadas
              ? bloco('Terminadas', terminadas)
              : (
                <button type="button" onClick={() => setVerTerminadas(true)}
                  className="self-start text-sm font-semibold text-relva hover:underline">
                  Ver competições terminadas ({terminadas.length})
                </button>
              ))}
          </>
        )}
      </main>
      <footer className="px-4 pb-6 text-center text-sm text-tinta/60">
        É responsável de uma equipa? <Link to="/entrar" className="font-semibold text-relva hover:underline">Entrar na área da equipa</Link>
      </footer>
    </div>
  );
}
