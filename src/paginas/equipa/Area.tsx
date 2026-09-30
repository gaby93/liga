import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { FichaEquipa } from '../../componentes/FichaEquipa';
import { FormularioJogador, abrirJogador, type EdicaoJogador } from '../../componentes/FormularioJogador';
import { Aviso, Botao, Carregando, Emblema, Seccao } from '../../componentes/ui';
import { formatarData } from '../../lib/datas';
import { nomeFase } from '../../lib/formatos';
import { usePapel } from '../../lib/sessao';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa, Jogador, Jogo } from '../../lib/types';
import { useFichaJogo } from '../../lib/useFichaJogo';

interface Contexto {
  equipas: Equipa[];
}
const useArea = () => useOutletContext<Contexto>();

/** Área dos responsáveis de equipa: só entra quem tem equipas associadas ao seu email. */
export default function AreaEquipa() {
  const papel = usePapel();
  const [equipas, setEquipas] = useState<Equipa[] | null>(null);
  const ids = papel?.tipo === 'responsavel' ? papel.equipas.join(',') : '';

  useEffect(() => {
    if (!ids) return;
    supabase.from('equipas').select('*').in('id', ids.split(',')).order('nome')
      .then(({ data }) => setEquipas((data ?? []) as Equipa[]));
  }, [ids]);

  if (!papel) return <Carregando />;
  if (papel.tipo === 'admin') return <Navigate to="/admin" replace />;
  if (papel.tipo !== 'responsavel') return <Navigate to="/entrar" replace />;
  if (!equipas) return <Carregando />;

  return (
    <div className="min-h-screen">
      <header className="bg-relva-escura text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/equipa" className="font-display text-2xl font-bold">Área da equipa</Link>
          <span className="flex-1 truncate text-sm text-white/70">{papel.email}</span>
          <Link to="/entrar/nova-palavra-passe" className="text-sm text-white/80 hover:text-white">Palavra-passe</Link>
          <Link to="/" className="text-sm text-white/80 hover:text-white">Ver portal</Link>
          <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm text-white/80 hover:text-white">Sair</button>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
        <Outlet context={{ equipas } satisfies Contexto} />
      </main>
    </div>
  );
}

export function EscolherEquipa() {
  const { equipas } = useArea();
  if (equipas.length === 1) return <Navigate to={equipas[0].id} replace />;
  return (
    <Seccao titulo="As suas equipas">
      <ul className="divide-y divide-linha">
        {equipas.map((e) => (
          <li key={e.id}>
            <Link to={e.id} className="flex items-center gap-3 py-3 hover:text-relva">
              <Emblema url={e.emblema_url} nome={e.nome} tamanho={36} />
              <span className="font-display text-xl font-semibold">{e.nome}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Seccao>
  );
}

type JogoComCompeticao = Jogo & { competicao: { nome: string } | null };

export function PainelEquipa() {
  const { equipas } = useArea();
  const { equipaId } = useParams();
  const equipa = equipas.find((e) => e.id === equipaId);
  const [plantel, setPlantel] = useState<Jogador[]>([]);
  const [jogos, setJogos] = useState<JogoComCompeticao[]>([]);
  const [adversarios, setAdversarios] = useState<Map<string, Equipa>>(new Map());
  const [convocados, setConvocados] = useState<Map<string, number>>(new Map());
  const [edicao, setEdicao] = useState<EdicaoJogador | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!equipaId) return;
    const [p, j] = await Promise.all([
      supabase.from('jogadores').select('*').eq('equipa_id', equipaId).order('numero', { nullsFirst: false }),
      supabase.from('jogos').select('*, competicao:competicoes(nome, estado)')
        .or(`casa_id.eq.${equipaId},fora_id.eq.${equipaId}`).in('estado', ['agendado', 'adiado'])
        .order('data_hora', { nullsFirst: false }).order('jornada'),
    ]);
    if (p.error || j.error) return setErro(mensagemErro(p.error ?? j.error));
    // Competições terminadas já não interessam
    const lista = ((j.data ?? []) as (JogoComCompeticao & { competicao: { estado: string } | null })[])
      .filter((x) => x.competicao?.estado !== 'terminada');
    const outros = [...new Set(lista.map((x) => (x.casa_id === equipaId ? x.fora_id : x.casa_id)))];
    const [e, c] = await Promise.all([
      outros.length ? supabase.from('equipas').select('*').in('id', outros) : Promise.resolve({ data: [] }),
      lista.length
        ? supabase.from('convocatorias').select('jogo_id').eq('equipa_id', equipaId).in('jogo_id', lista.map((x) => x.id))
        : Promise.resolve({ data: [] }),
    ]);
    const contagem = new Map<string, number>();
    for (const x of (c.data ?? []) as { jogo_id: string }[]) contagem.set(x.jogo_id, (contagem.get(x.jogo_id) ?? 0) + 1);
    setPlantel(p.data as Jogador[]);
    setJogos(lista);
    setAdversarios(new Map(((e.data ?? []) as Equipa[]).map((x) => [x.id, x])));
    setConvocados(contagem);
    setErro(null);
  }, [equipaId]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!equipa) return <Aviso>Esta equipa não está associada à sua conta.</Aviso>;

  const abrir = async (j?: Jogador) => setEdicao(j ? await abrirJogador(j) : { nome: '' });

  return (
    <>
      <div className="flex items-center gap-4">
        <Emblema url={equipa.emblema_url} nome={equipa.nome} tamanho={56} />
        <h1 className="font-display text-4xl font-bold">{equipa.nome}</h1>
      </div>
      {erro && <Aviso>{erro}</Aviso>}

      <Seccao titulo="Próximos jogos">
        {jogos.length === 0 ? (
          <p className="text-sm text-tinta/70">Não há jogos marcados.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {jogos.map((j) => {
              const adversario = adversarios.get(j.casa_id === equipaId ? j.fora_id : j.casa_id);
              const n = convocados.get(j.id) ?? 0;
              return (
                <li key={j.id}>
                  <Link to={`jogos/${j.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-giz">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {j.casa_id === equipaId ? 'Em casa' : 'Fora'} contra {adversario?.nome ?? '?'}
                      </div>
                      <div className="text-xs text-tinta/60">
                        {[j.competicao?.nome, nomeFase(j), j.estado === 'adiado' ? 'Adiado' : formatarData(j.data_hora) ?? 'Data por marcar', j.campo]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${n ? 'bg-relva/10 text-relva' : 'bg-cartao/25 text-tinta'}`}>
                      {n ? `${n} convocados` : 'Ficha por preencher'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Seccao>

      {edicao && (
        <FormularioJogador key={edicao.id ?? 'novo'} inicial={edicao} equipas={[equipa]} equipaFixa={equipa.id}
          comSuspensao={false} onGuardado={() => { setEdicao(null); carregar(); }} onCancelar={() => setEdicao(null)} />
      )}

      <Seccao titulo={`Plantel (${plantel.length})`} acao={<Botao onClick={() => abrir()}>Novo jogador</Botao>}>
        {plantel.length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda não há jogadores. Comece por acrescentar o plantel.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {plantel.map((j) => (
              <li key={j.id} className="flex items-center gap-3 py-2.5">
                <span className="w-7 text-right font-display text-lg font-semibold text-relva">{j.numero ?? ''}</span>
                <Emblema url={j.foto_url} nome={j.nome} tamanho={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {j.nome}
                  {j.suspenso && <span className="ml-2 text-xs font-medium text-vermelho">Suspenso pela organização</span>}
                </span>
                <Botao variante="secundario" onClick={() => abrir(j)}>Editar</Botao>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-tinta/60">
          Para tirar um jogador da equipa, fale com a organização da liga.
        </p>
      </Seccao>
    </>
  );
}

export function FichaJogoEquipa() {
  const { equipas } = useArea();
  const { equipaId, jogoId } = useParams();
  const f = useFichaJogo(jogoId);
  const equipa = equipas.find((e) => e.id === equipaId);

  if (!equipa) return <Aviso>Esta equipa não está associada à sua conta.</Aviso>;
  if (!f.jogo) return f.erro ? <Aviso>{f.erro}</Aviso> : <Carregando />;
  const jogo = f.jogo;
  if (jogo.casa_id !== equipa.id && jogo.fora_id !== equipa.id) return <Aviso>Este jogo não é da sua equipa.</Aviso>;

  const adversario = f.equipas.get(jogo.casa_id === equipa.id ? jogo.fora_id : jogo.casa_id);
  const aberta = jogo.estado === 'agendado' || jogo.estado === 'adiado';
  const suspensos = f.jogadores.filter((j) => j.equipa_id === equipa.id && f.motivoSuspensao.has(j.id));

  return (
    <>
      <Link to={`/equipa/${equipa.id}`} className="text-sm font-semibold text-relva hover:underline">‹ Voltar à equipa</Link>
      <div>
        <h1 className="font-display text-4xl font-bold">
          {jogo.casa_id === equipa.id ? 'Em casa' : 'Fora'} contra {adversario?.nome}
        </h1>
        <p className="text-sm text-tinta/60">
          {[nomeFase(jogo), jogo.estado === 'adiado' ? 'Adiado' : formatarData(jogo.data_hora) ?? 'Data por marcar', jogo.campo]
            .filter(Boolean).join(' · ')}
        </p>
      </div>
      {f.erro && <Aviso>{f.erro}</Aviso>}
      {suspensos.length > 0 && (
        <Aviso tipo="info">
          Suspensos neste jogo: {suspensos.map((j) => `${j.nome} (${f.motivoSuspensao.get(j.id)})`).join(', ')}.
        </Aviso>
      )}
      <Seccao titulo="Ficha de jogo">
        <FichaEquipa f={f} equipaId={equipa.id}
          fechada={aberta ? undefined : 'O jogo já terminou: a ficha só pode ser alterada pela organização.'}
          semJogadores={<>Ainda não há jogadores. <Link to={`/equipa/${equipa.id}`} className="text-relva underline">Registe o plantel</Link>.</>} />
        {aberta && <p className="mt-3 text-xs text-tinta/60">Cada alteração fica gravada logo. Pode mudar a ficha até ao jogo terminar.</p>}
      </Seccao>
    </>
  );
}
