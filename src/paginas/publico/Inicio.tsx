import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartaoAoVivo } from '../../componentes/AoVivo';
import { InstalarApp } from '../../componentes/AvisosApp';
import { Carregando } from '../../componentes/ui';
import { organizarCompeticoes, useFavoritos } from '../../lib/favoritos';
import { supabase } from '../../lib/supabase';
import { FORMATO_LABEL, type Competicao, type Equipa, type Jogo } from '../../lib/types';

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

type JogoAoVivo = Jogo & { competicao: { nome: string; estado: string } | null };

/** Jogos a decorrer em todas as competições públicas, atualizados em tempo real. */
function useJogosAoVivo() {
  const [jogos, setJogos] = useState<JogoAoVivo[]>([]);
  const [equipas, setEquipas] = useState<Map<string, Equipa>>(new Map());

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase.from('jogos').select('*, competicao:competicoes(nome, estado)')
        .eq('estado', 'em_curso').order('data_hora', { nullsFirst: false });
      const lista = ((data ?? []) as JogoAoVivo[]).filter((j) => j.competicao && j.competicao.estado !== 'rascunho');
      const ids = [...new Set(lista.flatMap((j) => [j.casa_id, j.fora_id]))];
      const e = ids.length ? await supabase.from('equipas').select('*').in('id', ids) : { data: [] };
      if (!ativo) return;
      setEquipas(new Map(((e.data ?? []) as Equipa[]).map((x) => [x.id, x])));
      setJogos(lista);
    };
    carregar();
    let atraso: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase.channel('ao-vivo-inicio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogos' }, () => {
        clearTimeout(atraso);
        atraso = setTimeout(carregar, 500);
      })
      .subscribe();
    // Plano B se o tempo real falhar
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 30000);
    return () => { ativo = false; clearTimeout(atraso); clearInterval(intervalo); supabase.removeChannel(canal); };
  }, []);

  return { jogos, equipas };
}

export default function Inicio() {
  const aoVivo = useJogosAoVivo();
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
        {aoVivo.jogos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-vermelho">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-vermelho" />
              Ao vivo agora
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {/* Os das competições favoritas primeiro */}
              {[...aoVivo.jogos].sort((a, b) => Number(eFavorito(b.competicao_id)) - Number(eFavorito(a.competicao_id))).map((j) => (
                <CartaoAoVivo key={j.id} jogo={j} casa={aoVivo.equipas.get(j.casa_id)} fora={aoVivo.equipas.get(j.fora_id)}
                  para={`/c/${j.competicao_id}/jogos/${j.id}`} contexto={j.competicao?.nome} />
              ))}
            </div>
          </section>
        )}
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
