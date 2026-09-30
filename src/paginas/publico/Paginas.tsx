import type { ReactNode } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ListaJogos, Placar } from '../../componentes/ListaJogos';
import { QuadroEliminatorias } from '../../componentes/QuadroEliminatorias';
import { TabelaClassificacao } from '../../componentes/TabelaClassificacao';
import { TabelaMelhores } from '../../componentes/TabelaMelhores';
import { Carregando, Emblema } from '../../componentes/ui';
import { resultadoEfetivo } from '../../lib/classificacao';
import { formatarData } from '../../lib/datas';
import { nomeFase } from '../../lib/formatos';
import type { Jogo, TipoEvento } from '../../lib/types';
import type { DadosCompeticao } from '../../lib/useDadosCompeticao';

const useDados = () => useOutletContext<DadosCompeticao>();

/** Links do portal dentro da competição. */
function useLinks() {
  const { id } = useParams();
  return {
    equipa: (equipaId: string) => `/c/${id}/equipas/${equipaId}`,
    jogador: (jogadorId: string) => `/c/${id}/jogadores/${jogadorId}`,
  };
}

export function PaginaTabela() {
  const d = useDados();
  const links = useLinks();
  if (d.carregando) return <Carregando />;
  if (d.competicao?.formato === 'eliminatorias') return <PaginaFaseFinal />;
  if (d.competicao?.formato === 'grupos') {
    if (!d.grupos.length) return <p className="text-sm text-tinta/70">Os grupos ainda não foram sorteados.</p>;
    return (
      <div className="flex flex-col gap-8">
        {d.grupos.map((g) => (
          <section key={g.grupo}>
            <h2 className="mb-2 font-display text-3xl font-semibold">Grupo {g.grupo}</h2>
            <TabelaClassificacao linhas={g.linhas} equipas={d.equipas} linkEquipa={links.equipa}
              apurados={d.competicao!.apurados_por_grupo} />
          </section>
        ))}
        <p className="text-xs text-tinta/60">
          A linha verde marca as posições que dão acesso à fase final.
        </p>
        <TabelaMelhores linhas={d.melhores} posicao={d.competicao!.apurados_por_grupo + 1} equipas={d.equipas}
          linkEquipa={links.equipa} desigual={new Set(d.grupos.map((g) => g.linhas.length)).size > 1} />
      </div>
    );
  }
  return <TabelaClassificacao linhas={d.tabela} equipas={d.equipas} linkEquipa={links.equipa} />;
}

export function PaginaFaseFinal() {
  const d = useDados();
  const links = useLinks();
  if (d.carregando) return <Carregando />;
  if (!d.quadro.length)
    return (
      <p className="text-sm text-tinta/70">
        {d.competicao?.formato === 'grupos'
          ? 'A fase final é definida quando terminar a fase de grupos.'
          : 'O quadro ainda não foi sorteado.'}
      </p>
    );
  return <QuadroEliminatorias quadro={d.quadro} jogos={d.jogos} equipas={d.equipas} golosWO={d.competicao?.golos_wo ?? 3} linkEquipa={links.equipa} />;
}

export function PaginaJogos() {
  const d = useDados();
  const links = useLinks();
  if (d.carregando) return <Carregando />;
  return <ListaJogos jogos={d.jogos} equipas={d.equipas} linkEquipa={links.equipa} />;
}

export function PaginaMarcadores() {
  const d = useDados();
  const links = useLinks();
  if (d.carregando) return <Carregando />;
  const nomeEquipa = (id: string | null) => (id ? d.equipas.get(id)?.nome : '');

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section>
        <h2 className="mb-3 font-display text-3xl font-semibold">Melhores marcadores</h2>
        {d.marcadores.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda não há golos registados.</p>
        ) : (
          <ol className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {d.marcadores.map((m, i) => (
              <li key={m.jogador.id}>
                <Link to={links.jogador(m.jogador.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-giz">
                  <span className="w-6 font-display text-xl font-semibold text-relva">{i + 1}</span>
                  <Emblema url={m.jogador.foto_url} nome={m.jogador.nome} tamanho={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{m.jogador.nome}</div>
                    <div className="text-xs text-tinta/60">{nomeEquipa(m.jogador.equipa_id)}</div>
                  </div>
                  <span className="font-display text-2xl font-bold tabular-nums">{m.golos}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-display text-3xl font-semibold">Disciplina</h2>
        {d.disciplina.length === 0 ? (
          <p className="text-sm text-tinta/70">Sem cartões até agora.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {d.disciplina.map((r) => (
              <li key={r.jogador.id}>
                <Link to={links.jogador(r.jogador.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-giz">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {r.jogador.nome}
                      {(r.jogador.suspenso || d.suspensoes.has(r.jogador.id)) && <span className="ml-2 text-xs font-medium text-vermelho">Suspenso</span>}
                    </div>
                    <div className="text-xs text-tinta/60">{nomeEquipa(r.jogador.equipa_id)}</div>
                  </div>
                  <Cartoes amarelos={r.amarelos} vermelhos={r.vermelhos} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Equipa ----------

export function PaginaEquipa() {
  const d = useDados();
  const links = useLinks();
  const { equipaId } = useParams();
  if (d.carregando) return <Carregando />;
  const equipa = equipaId ? d.equipas.get(equipaId) : undefined;
  if (!equipa) return <NaoEncontrado o="Esta equipa não participa nesta competição." />;

  const jogos = d.jogos.filter((j) => j.casa_id === equipa.id || j.fora_id === equipa.id);
  const golosWO = d.competicao?.golos_wo ?? 3;
  const s = { j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0 };
  for (const j of jogos) {
    const r = resultadoEfetivo({ casaId: j.casa_id, foraId: j.fora_id, golosCasa: j.golos_casa, golosFora: j.golos_fora, estado: j.estado }, golosWO);
    if (!r) continue;
    const [meus, deles] = j.casa_id === equipa.id ? [r.gc, r.gf] : [r.gf, r.gc];
    s.j++; s.gm += meus; s.gs += deles;
    if (meus > deles) s.v++;
    else if (meus < deles) s.d++;
    else s.e++;
  }

  // Posição na tabela da liga ou do grupo
  const grupo = d.grupos.find((g) => g.linhas.some((l) => l.equipaId === equipa.id));
  const linha = (grupo?.linhas ?? d.tabela).find((l) => l.equipaId === equipa.id);
  const proximo = jogos.find((j) => j.estado === 'em_curso') ?? jogos.find((j) => j.estado === 'agendado');

  const plantel = [...d.jogadores.values()]
    .filter((j) => j.equipa_id === equipa.id)
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt'));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <Emblema url={equipa.emblema_url} nome={equipa.nome} tamanho={72} />
        <div>
          <h2 className="font-display text-4xl font-bold leading-none">{equipa.nome}</h2>
          {linha && (
            <p className="mt-1 text-sm text-tinta/70">
              {linha.posicao}.º lugar{grupo ? ` no Grupo ${grupo.grupo}` : ''}, {linha.pts} pontos
            </p>
          )}
        </div>
      </header>

      <Numeros itens={[
        ['Jogos', s.j], ['Vitórias', s.v], ['Empates', s.e], ['Derrotas', s.d],
        ['Golos marcados', s.gm], ['Golos sofridos', s.gs],
      ]} />

      {proximo && (
        <section>
          <h3 className="mb-2 font-display text-2xl font-semibold">{proximo.estado === 'em_curso' ? 'A jogar agora' : 'Próximo jogo'}</h3>
          <ListaJogos jogos={[proximo]} equipas={d.equipas} linkEquipa={links.equipa} />
        </section>
      )}

      <section>
        <h3 className="mb-2 font-display text-2xl font-semibold">Plantel</h3>
        {plantel.length === 0 ? (
          <p className="text-sm text-tinta/70">Plantel ainda não registado.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {plantel.map((j) => {
              const est = d.estatisticas.get(j.id);
              return (
                <li key={j.id}>
                  <Link to={links.jogador(j.id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-giz">
                    <span className="w-7 text-right font-display text-lg font-semibold text-relva">{j.numero ?? ''}</span>
                    <Emblema url={j.foto_url} nome={j.nome} tamanho={32} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {j.nome}
                      {(j.suspenso || d.suspensoes.has(j.id)) && <span className="ml-2 text-xs font-medium text-vermelho">Suspenso</span>}
                    </span>
                    {est && est.jogos > 0 && (
                      <span className="text-sm tabular-nums text-tinta/60" title="Jogos disputados">{est.jogos} {est.jogos === 1 ? 'jogo' : 'jogos'}</span>
                    )}
                    {est && est.golos > 0 && (
                      <span className="text-sm tabular-nums" title="Golos">{est.golos} {est.golos === 1 ? 'golo' : 'golos'}</span>
                    )}
                    {est && <Cartoes amarelos={est.amarelos} vermelhos={est.vermelhos} esconderZeros />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-display text-2xl font-semibold">Jogos</h3>
        <ListaJogos jogos={jogos} equipas={d.equipas} linkEquipa={links.equipa} vazio="Ainda sem jogos marcados." />
      </section>
    </div>
  );
}

// ---------- Jogador ----------

const SIMBOLO: Record<TipoEvento, { rotulo: string; marca: ReactNode }> = {
  golo: { rotulo: 'Golo', marca: <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-tinta" /> },
  autogolo: { rotulo: 'Autogolo', marca: <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-vermelho" /> },
  amarelo: { rotulo: 'Amarelo', marca: <span aria-hidden className="inline-block h-4 w-3 rounded-sm bg-cartao" /> },
  vermelho: { rotulo: 'Vermelho', marca: <span aria-hidden className="inline-block h-4 w-3 rounded-sm bg-vermelho" /> },
};

export function PaginaJogador() {
  const d = useDados();
  const links = useLinks();
  const { jogadorId } = useParams();
  if (d.carregando) return <Carregando />;
  const jogador = jogadorId ? d.jogadores.get(jogadorId) : undefined;
  if (!jogador) return <NaoEncontrado o="Este jogador não está inscrito em nenhuma equipa desta competição." />;

  const equipa = jogador.equipa_id ? d.equipas.get(jogador.equipa_id) : undefined;
  const est = d.estatisticas.get(jogador.id) ?? { golos: 0, autogolos: 0, amarelos: 0, vermelhos: 0, jogos: 0 };
  const lugarMarcadores = d.marcadores.findIndex((m) => m.jogador.id === jogador.id) + 1;
  const suspensao = d.suspensoes.get(jogador.id);

  // Jogos em que foi convocado ou tem golos e cartões, por ordem do calendário
  const eventos = d.eventos.filter((e) => e.jogador_id === jogador.id);
  const convocado = new Set(d.convocatorias.filter((c) => c.jogador_id === jogador.id).map((c) => c.jogo_id));
  const jogos = d.jogos.filter((j) => convocado.has(j.id) || eventos.some((e) => e.jogo_id === j.id));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <Emblema url={jogador.foto_url} nome={jogador.nome} tamanho={88} />
        <div>
          <h2 className="font-display text-4xl font-bold leading-none">
            {jogador.numero != null && <span className="mr-2 text-relva">{jogador.numero}</span>}
            {jogador.nome}
          </h2>
          {equipa && (
            <Link to={links.equipa(equipa.id)} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold hover:text-relva hover:underline">
              <Emblema url={equipa.emblema_url} nome={equipa.nome} tamanho={20} />{equipa.nome}
            </Link>
          )}
        </div>
      </header>

      {(suspensao || jogador.suspenso) && (
        <p className="rounded-md border border-vermelho/30 bg-vermelho/5 px-3 py-2 text-sm text-vermelho">
          {suspensao
            ? `Suspenso: ${suspensao.motivo}. ${suspensao.jogosEmFalta === 1 ? 'Falta cumprir 1 jogo' : `Faltam cumprir ${suspensao.jogosEmFalta} jogos`}.`
            : 'Suspenso por decisão da organização.'}
        </p>
      )}

      <Numeros itens={[
        ['Jogos', est.jogos],
        ['Golos', est.golos],
        ...(lugarMarcadores ? [['Lugar nos marcadores', `${lugarMarcadores}.º`] as [string, string]] : []),
        ['Amarelos', est.amarelos],
        ['Vermelhos', est.vermelhos],
        ...(est.autogolos ? [['Autogolos', est.autogolos] as [string, number]] : []),
      ]} />

      <section>
        <h3 className="mb-2 font-display text-2xl font-semibold">Jogos</h3>
        {jogos.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda sem jogos nesta competição.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {jogos.map((j) => <LinhaJogoJogador key={j.id} jogo={j} d={d} eventos={eventos.filter((e) => e.jogo_id === j.id)} links={links} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinhaJogoJogador({ jogo, d, eventos, links }: {
  jogo: Jogo; d: DadosCompeticao; eventos: DadosCompeticao['eventos']; links: ReturnType<typeof useLinks>;
}) {
  const casa = d.equipas.get(jogo.casa_id);
  const fora = d.equipas.get(jogo.fora_id);
  const fase = nomeFase(jogo);
  const ordenados = [...eventos].sort((a, b) => (a.minuto ?? 999) - (b.minuto ?? 999));
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 font-semibold">
          <Link to={links.equipa(jogo.casa_id)} className="hover:text-relva hover:underline">{casa?.nome}</Link>
          <Placar jogo={jogo} />
          <Link to={links.equipa(jogo.fora_id)} className="hover:text-relva hover:underline">{fora?.nome}</Link>
        </div>
        <div className="text-xs text-tinta/60">{[fase, formatarData(jogo.data_hora)].filter(Boolean).join(', ')}</div>
      </div>
      <ul className="flex flex-wrap gap-3 text-sm">
        {ordenados.map((e) => (
          <li key={e.id} className="flex items-center gap-1.5" title={SIMBOLO[e.tipo].rotulo}>
            {SIMBOLO[e.tipo].marca}
            <span className="sr-only">{SIMBOLO[e.tipo].rotulo}</span>
            <span className="tabular-nums text-tinta/70">{e.minuto != null ? `${e.minuto}'` : ''}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

// ---------- Peças comuns ----------

function Numeros({ itens }: { itens: [string, number | string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="rounded-lg border border-linha bg-white px-3 py-2">
          <dt className="text-xs text-tinta/60">{rotulo}</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cartoes({ amarelos, vermelhos, esconderZeros = false }: { amarelos: number; vermelhos: number; esconderZeros?: boolean }) {
  return (
    <>
      {(!esconderZeros || amarelos > 0) && (
        <span className="flex items-center gap-1 text-sm tabular-nums" title="Amarelos">
          <span aria-hidden className="h-4 w-3 rounded-sm bg-cartao" />{amarelos}
        </span>
      )}
      {(!esconderZeros || vermelhos > 0) && (
        <span className="flex items-center gap-1 text-sm tabular-nums" title="Vermelhos">
          <span aria-hidden className="h-4 w-3 rounded-sm bg-vermelho" />{vermelhos}
        </span>
      )}
    </>
  );
}

function NaoEncontrado({ o }: { o: string }) {
  const { id } = useParams();
  return (
    <p className="text-sm text-tinta/70">
      {o} <Link to={`/c/${id}`} className="font-semibold text-relva hover:underline">Voltar à competição</Link>
    </p>
  );
}
