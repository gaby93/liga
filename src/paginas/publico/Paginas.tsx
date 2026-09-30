import type { ReactNode } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { EtiquetaAoVivo } from '../../componentes/AoVivo';
import { SeguirEquipa } from '../../componentes/Notificacoes';
import { ListaJogos, Placar } from '../../componentes/ListaJogos';
import { QuadroEliminatorias } from '../../componentes/QuadroEliminatorias';
import { TabelaClassificacao } from '../../componentes/TabelaClassificacao';
import { TabelaMelhores } from '../../componentes/TabelaMelhores';
import { Carregando, Emblema, Etiqueta } from '../../componentes/ui';
import { resultadoEfetivo } from '../../lib/classificacao';
import { formatarData } from '../../lib/datas';
import { decidirEliminatoria, jogosDaChave, nomeFase } from '../../lib/formatos';
import type { Jogo, TipoEvento } from '../../lib/types';
import type { DadosCompeticao } from '../../lib/useDadosCompeticao';

const useDados = () => useOutletContext<DadosCompeticao>();

/** Links do portal dentro da competição. */
function useLinks() {
  const { id } = useParams();
  return {
    equipa: (equipaId: string) => `/c/${id}/equipas/${equipaId}`,
    jogador: (jogadorId: string) => `/c/${id}/jogadores/${jogadorId}`,
    jogo: (j: { id: string }) => `/c/${id}/jogos/${j.id}`,
    jogos: `/c/${id}/jogos`,
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
      <div className="flex flex-col gap-6">
        {d.grupos.map((g) => (
          <section key={g.grupo}>
            <Etiqueta className="mb-2.5">Grupo {g.grupo}</Etiqueta>
            <Cartao>
              <TabelaClassificacao linhas={g.linhas} equipas={d.equipas} linkEquipa={links.equipa}
                apurados={d.competicao!.apurados_por_grupo} jogos={d.jogos} linkJogo={links.jogo} />
            </Cartao>
          </section>
        ))}
        <p className="text-xs text-tinta/55">
          A linha verde marca as posições que dão acesso à fase final.
        </p>
        {d.melhores.length > 0 && (
          <Cartao>
            <div className="py-4">
              <TabelaMelhores linhas={d.melhores} posicao={d.competicao!.apurados_por_grupo + 1} equipas={d.equipas}
                linkEquipa={links.equipa} desigual={new Set(d.grupos.map((g) => g.linhas.length)).size > 1} />
            </div>
          </Cartao>
        )}
      </div>
    );
  }
  return (
    <Cartao>
      <TabelaClassificacao linhas={d.tabela} equipas={d.equipas} linkEquipa={links.equipa} jogos={d.jogos} linkJogo={links.jogo} />
    </Cartao>
  );
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
  return <ListaJogos jogos={d.jogos} equipas={d.equipas} linkPara={links.jogo} />;
}

export function PaginaMarcadores() {
  const d = useDados();
  const links = useLinks();
  if (d.carregando) return <Carregando />;
  const nomeEquipa = (id: string | null) => (id ? d.equipas.get(id)?.nome : '');

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Melhores marcadores</h2>
        {d.marcadores.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda não há golos registados.</p>
        ) : (
          <ol className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao">
            {d.marcadores.map((m, i) => (
              <li key={m.jogador.id}>
                <Link to={links.jogador(m.jogador.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-giz">
                  <span className={`w-5 text-sm font-semibold ${i < 3 ? 'text-relva' : 'text-tinta/45'}`}>{i + 1}</span>
                  <Emblema url={m.jogador.foto_url} nome={m.jogador.nome} tamanho={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{m.jogador.nome}</div>
                    <div className="text-xs text-tinta/60">{nomeEquipa(m.jogador.equipa_id)}</div>
                  </div>
                  <span className="text-xl font-semibold tabular-nums">{m.golos}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Disciplina</h2>
        {d.disciplina.length === 0 ? (
          <p className="text-sm text-tinta/70">Sem cartões até agora.</p>
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao">
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
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">{equipa.nome}</h2>
          {linha && (
            <p className="mt-1 text-sm text-tinta/70">
              {linha.posicao}.º lugar{grupo ? ` no Grupo ${grupo.grupo}` : ''}, {linha.pts} pontos
            </p>
          )}
          <div className="mt-3"><SeguirEquipa equipaId={equipa.id} nome={equipa.nome} /></div>
        </div>
      </header>

      <Numeros itens={[
        ['Jogos', s.j], ['Vitórias', s.v], ['Empates', s.e], ['Derrotas', s.d],
        ['Golos marcados', s.gm], ['Golos sofridos', s.gs],
      ]} />

      {proximo && (
        <section>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">{proximo.estado === 'em_curso' ? 'A jogar agora' : 'Próximo jogo'}</h3>
          <ListaJogos jogos={[proximo]} equipas={d.equipas} linkPara={links.jogo} />
        </section>
      )}

      <section>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Plantel</h3>
        {plantel.length === 0 ? (
          <p className="text-sm text-tinta/70">Plantel ainda não registado.</p>
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao">
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
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Jogos</h3>
        <ListaJogos jogos={jogos} equipas={d.equipas} linkPara={links.jogo} vazio="Ainda sem jogos marcados." />
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
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
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
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Jogos</h3>
        {jogos.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda sem jogos nesta competição.</p>
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao">
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
        <Link to={links.jogo(jogo)} className="text-xs text-tinta/60 hover:text-relva hover:underline">
          {[fase, formatarData(jogo.data_hora)].filter(Boolean).join(', ')} · ver jogo
        </Link>
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

// ---------- Jogo ----------

/** Página de um jogo: marcador (ao vivo durante o jogo), golos e cartões, e convocados. */
export function PaginaJogo() {
  const d = useDados();
  const links = useLinks();
  const { jogoId } = useParams();
  if (d.carregando) return <Carregando />;
  const jogo = d.jogos.find((j) => j.id === jogoId);
  if (!jogo) return <NaoEncontrado o="Este jogo não existe nesta competição." />;

  const casa = d.equipas.get(jogo.casa_id);
  const fora = d.equipas.get(jogo.fora_id);
  const aoVivo = jogo.estado === 'em_curso';
  const temResultado = aoVivo || jogo.estado === 'terminado';
  const wo = jogo.estado === 'wo_casa' || jogo.estado === 'wo_fora';
  const eventos = d.eventos.filter((e) => e.jogo_id === jogo.id)
    .sort((a, b) => (a.minuto ?? 999) - (b.minuto ?? 999));
  const convocados = d.convocatorias.filter((c) => c.jogo_id === jogo.id);
  const agregado = jogo.mao === 2 && jogo.eliminatoria != null && jogo.chave != null
    ? decidirEliminatoria(jogosDaChave(d.jogos, jogo.eliminatoria, jogo.chave), d.competicao?.golos_wo ?? 3).agregado
    : null;

  const nomeJogador = (id: string | null) => {
    const j = id ? d.jogadores.get(id) : undefined;
    if (!j) return <span className="text-tinta/60">{id ? 'Jogador' : 'Jogador não identificado'}</span>;
    return <Link to={links.jogador(j.id)} className="hover:text-relva hover:underline">{j.nome}</Link>;
  };

  const equipaCabecalho = (id: string) => {
    const e = d.equipas.get(id);
    return (
      <Link to={links.equipa(id)} className="flex min-w-0 flex-col items-center gap-2 text-center hover:underline">
        <Emblema url={e?.emblema_url} nome={e?.nome ?? '?'} tamanho={56} />
        <span className="w-full truncate font-display text-lg font-semibold sm:text-xl">{e?.nome}</span>
      </Link>
    );
  };

  const plantelNaFicha = (equipaId: string) => convocados
    .filter((c) => c.equipa_id === equipaId)
    .map((c) => d.jogadores.get(c.jogador_id))
    .filter((j): j is NonNullable<typeof j> => Boolean(j))
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, 'pt'));

  return (
    <div className="flex flex-col gap-6">
      <Link to={links.jogos} className="-mb-2 text-sm font-semibold text-relva hover:underline">
        ‹ Todos os jogos
      </Link>

      {/* Marcador */}
      <section className={`rounded-xl px-3 py-5 ${aoVivo ? 'bg-tinta text-white shadow-cartao' : 'border border-linha bg-white shadow-cartao'}`}>
        <p className={`mb-3 text-center text-xs ${aoVivo ? 'text-white/70' : 'text-tinta/60'}`}>
          {[nomeFase(jogo), jogo.grupo && `Grupo ${jogo.grupo}`].filter(Boolean).join(' · ')}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {equipaCabecalho(jogo.casa_id)}
          <div className="flex flex-col items-center gap-2">
            {temResultado ? (
              <span className="font-display text-6xl font-bold tabular-nums leading-none">
                {jogo.golos_casa ?? 0}<span className="px-1 opacity-40">–</span>{jogo.golos_fora ?? 0}
              </span>
            ) : (
              <span className="font-display text-3xl font-semibold opacity-60">{wo ? 'W.O.' : 'vs'}</span>
            )}
            {aoVivo && <EtiquetaAoVivo jogo={jogo} grande />}
            {jogo.estado === 'terminado' && <span className="text-xs font-semibold uppercase tracking-wide text-tinta/60">Terminado</span>}
            {jogo.estado === 'adiado' && <span className="text-sm font-semibold text-vermelho">Adiado</span>}
          </div>
          {equipaCabecalho(jogo.fora_id)}
        </div>
        {(jogo.penaltis_casa != null && jogo.penaltis_fora != null && jogo.estado === 'terminado') && (
          <p className="mt-3 text-center text-sm">Penáltis: {jogo.penaltis_casa}–{jogo.penaltis_fora}</p>
        )}
        {agregado && (
          <p className={`mt-2 text-center text-sm ${aoVivo ? 'text-white/80' : 'text-tinta/70'}`}>
            Total das duas mãos: {agregado.get(jogo.casa_id)}–{agregado.get(jogo.fora_id)}
          </p>
        )}
        {wo && (
          <p className="mt-3 text-center text-sm text-tinta/70">
            {(jogo.estado === 'wo_casa' ? casa : fora)?.nome} não compareceu.
          </p>
        )}
        {(jogo.estado === 'agendado' || jogo.estado === 'adiado') && (
          <p className="mt-3 text-center text-sm text-tinta/70">
            {[formatarData(jogo.data_hora) ?? 'Data por marcar', jogo.campo].filter(Boolean).join(' · ')}
          </p>
        )}
      </section>

      {/* Golos e cartões */}
      {(eventos.length > 0 || aoVivo) && (
        <section>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Golos e cartões</h2>
          {eventos.length === 0 ? (
            <p className="text-sm text-tinta/70">Ainda sem golos nem cartões. Esta página atualiza-se sozinha.</p>
          ) : (
            <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao">
              {eventos.map((e) => {
                const daCasa = e.equipa_id === jogo.casa_id;
                const conteudo = (
                  <span className={`flex items-center gap-2 ${daCasa ? 'justify-end text-right' : ''}`}>
                    {!daCasa && SIMBOLO[e.tipo].marca}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{nomeJogador(e.jogador_id)}</span>
                      {e.tipo === 'autogolo' && <span className="block text-xs text-tinta/60">Autogolo</span>}
                    </span>
                    {daCasa && SIMBOLO[e.tipo].marca}
                  </span>
                );
                return (
                  <li key={e.id} className="grid grid-cols-[1fr_3rem_1fr] items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="min-w-0">{daCasa && conteudo}</span>
                    <span className="text-center tabular-nums text-tinta/60">
                      {e.minuto != null ? `${e.minuto}'` : ''}
                      <span className="sr-only"> {SIMBOLO[e.tipo].rotulo}</span>
                    </span>
                    <span className="min-w-0">{!daCasa && conteudo}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Convocados */}
      {convocados.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-relva">Convocados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[jogo.casa_id, jogo.fora_id].map((id) => (
              <div key={id}>
                <h3 className="mb-1 font-semibold">{d.equipas.get(id)?.nome}</h3>
                {plantelNaFicha(id).length === 0 ? (
                  <p className="text-sm text-tinta/60">Ficha por preencher.</p>
                ) : (
                  <ul className="divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white shadow-cartao text-sm">
                    {plantelNaFicha(id).map((j) => (
                      <li key={j.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-6 text-right font-display text-base font-semibold text-relva">{j.numero ?? ''}</span>
                        <Link to={links.jogador(j.id)} className="flex-1 truncate hover:text-relva hover:underline">{j.nome}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Peças comuns ----------

function Numeros({ itens }: { itens: [string, number | string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="rounded-xl border border-linha bg-white px-3 py-2.5 shadow-cartao">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta/45">{rotulo}</dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{valor}</dd>
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

/** Cartão branco para tabelas e listas do portal. */
function Cartao({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-linha bg-white px-3 shadow-cartao sm:px-5">{children}</div>;
}
