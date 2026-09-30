import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ListaJogos } from '../../componentes/ListaJogos';
import { PainelConvite } from '../../componentes/Convidar';
import { PartilharImagens } from '../../componentes/PartilharImagens';
import { QuadroEliminatorias } from '../../componentes/QuadroEliminatorias';
import { TabelaClassificacao } from '../../componentes/TabelaClassificacao';
import { TabelaMelhores } from '../../componentes/TabelaMelhores';
import { Aviso, Botao, Campo, Carregando, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { atribuirDatas } from '../../lib/calendario';
import { descarregar, linhasResultados, nomeFicheiro, paraCsv } from '../../lib/exportar';
import {
  nomeEliminatoria, nomesGrupos, planearCalendario, planearFaseFinal, planearProximaRonda, regrasDaCompeticao, sortearGrupos,
  type JogoPlaneado,
} from '../../lib/formatos';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import {
  CRITERIO_LABEL, ESTADO_COMPETICAO_LABEL, FORMATO_LABEL,
  type Competicao, type Criterio, type Equipa, type EstadoCompeticao, type Formato,
} from '../../lib/types';
import { useDadosCompeticao } from '../../lib/useDadosCompeticao';

const TODOS_CRITERIOS = (Object.keys(CRITERIO_LABEL) as Criterio[]).filter((c) => c !== 'pontos');

export default function CompeticaoDetalhe() {
  const { id } = useParams();
  const d = useDadosCompeticao(id);
  const [todasEquipas, setTodasEquipas] = useState<Equipa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [parametros, setParametros] = useSearchParams();
  const gestao = useGestao();
  const org = d.competicao?.organizacao_id;

  // Só as equipas da organização da competição podem ser inscritas
  useEffect(() => {
    if (!org) return;
    supabase.from('equipas').select('*').eq('organizacao_id', org).order('nome')
      .then(({ data }) => setTodasEquipas((data ?? []) as Equipa[]));
  }, [org]);

  if (d.carregando) return <Carregando />;
  if (!d.competicao) return <Aviso>{d.erro ?? 'Competição não encontrada.'}</Aviso>;
  if (!gestao.gere(org)) return <Aviso>Esta competição pertence a outra organização.</Aviso>;

  const executar = async (acao: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await acao();
    if (error) { setErro(mensagemErro(error)); return false; }
    setErro(null);
    await d.recarregar();
    return true;
  };

  const c = d.competicao;
  const suspensos = d.suspensoes.size + [...d.jogadores.values()].filter((j) => j.suspenso && !d.suspensoes.has(j.id)).length;
  const separadores: { id: Separador; rotulo: string; contador?: number }[] = [
    { id: 'jogos', rotulo: 'Jogos' },
    ...(c.formato === 'liga' ? [{ id: 'classificacao' as const, rotulo: 'Classificação' }] : []),
    ...(c.formato === 'grupos' ? [{ id: 'classificacao' as const, rotulo: 'Grupos' }] : []),
    ...(c.formato !== 'liga' ? [{ id: 'fase-final' as const, rotulo: c.formato === 'grupos' ? 'Fase final' : 'Quadro' }] : []),
    { id: 'partilhar', rotulo: 'Partilhar' },
    { id: 'disciplina', rotulo: 'Disciplina', contador: suspensos },
    { id: 'configuracao', rotulo: 'Configuração' },
  ];
  // Sem equipas ou sem jogos, o trabalho começa na configuração
  const pedido = parametros.get('separador') as Separador | null;
  const atual = separadores.some((s) => s.id === pedido)
    ? pedido!
    : d.participantes.length < 2 ? 'configuracao' : 'jogos';
  const abrir = (s: Separador) => setParametros({ separador: s }, { replace: true });

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{c.nome}</h1>
          <p className="text-sm text-tinta/60">
            {[c.epoca, FORMATO_LABEL[c.formato], ESTADO_COMPETICAO_LABEL[c.estado]].filter(Boolean).join(' · ')}
          </p>
        </div>
        {c.estado !== 'rascunho' && (
          <Link to={`/c/${c.id}`} className="text-sm font-semibold text-relva hover:underline">Abrir página pública</Link>
        )}
      </div>

      <nav className="-mb-2 flex gap-1 overflow-x-auto border-b border-linha" role="tablist" aria-label="Secções da competição">
        {separadores.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={atual === s.id} onClick={() => abrir(s.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${
              atual === s.id ? 'border-relva text-relva' : 'border-transparent text-tinta/70 hover:text-tinta'}`}>
            {s.rotulo}
            {Boolean(s.contador) && (
              <span className="rounded-full bg-vermelho px-1.5 text-xs leading-5 text-white" aria-label={`${s.contador} suspensos`}>
                {s.contador}
              </span>
            )}
          </button>
        ))}
      </nav>

      {erro && <Aviso>{erro}</Aviso>}

      {atual === 'jogos' && <Calendario d={d} executar={executar} />}

      {atual === 'classificacao' && c.formato === 'liga' && (
        <Seccao titulo="Classificação">
          <TabelaClassificacao linhas={d.tabela} equipas={d.equipas} jogos={d.jogos} linkJogo={(j) => `/admin/jogos/${j.id}/campo`} />
        </Seccao>
      )}
      {atual === 'classificacao' && c.formato === 'grupos' && (
        <Seccao titulo="Grupos">
          {d.grupos.length === 0 ? (
            <p className="text-sm text-tinta/70">Ainda não há grupos. Distribua as equipas no separador Configuração.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {d.grupos.map((g) => (
                <div key={g.grupo}>
                  <h3 className="mb-1 font-display text-xl font-semibold">Grupo {g.grupo}</h3>
                  <TabelaClassificacao linhas={g.linhas} equipas={d.equipas} apurados={c.apurados_por_grupo}
                    jogos={d.jogos} linkJogo={(j) => `/admin/jogos/${j.id}/campo`} />
                </div>
              ))}
            </div>
          )}
          {d.melhores.length > 0 && (
            <div className="mt-8">
              <TabelaMelhores linhas={d.melhores} posicao={c.apurados_por_grupo + 1} equipas={d.equipas}
                desigual={new Set(d.grupos.map((g) => g.linhas.length)).size > 1} />
            </div>
          )}
        </Seccao>
      )}

      {atual === 'fase-final' && <FaseFinal d={d} executar={executar} />}

      {atual === 'partilhar' && (
        <>
          <PartilharImagens d={d} />
          <Seccao titulo="Convidar adeptos para a app">
            <p className="mb-4 text-sm text-tinta/70">
              Envie o convite aos grupos das equipas ou mostre o QR code no campo. Quem o abrir vê como instalar a app no seu
              telemóvel e fica logo a seguir esta competição.
            </p>
            <div className="mx-auto max-w-sm"><PainelConvite competicaoId={c.id} nome={c.nome} /></div>
          </Seccao>
        </>
      )}

      {atual === 'disciplina' && (
        <>
          <Suspensoes d={d} />
          <Sancoes d={d} executar={executar} />
        </>
      )}

      {atual === 'configuracao' && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Regras competicao={c} temJogos={d.jogos.length > 0} executar={executar} />
            <Criterios competicao={c} executar={executar} />
          </div>
          <Participantes d={d} todasEquipas={todasEquipas} executar={executar} />
          <Exportar d={d} />
        </>
      )}
    </>
  );
}

type Separador = 'jogos' | 'classificacao' | 'fase-final' | 'partilhar' | 'disciplina' | 'configuracao';

/** Descarregar os dados da competição: tudo (JSON) ou os resultados para o Excel (CSV). */
function Exportar({ d }: { d: Dados }) {
  const c = d.competicao!;
  const [pessoais, setPessoais] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'info'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const base = `${nomeFicheiro(`${c.nome} ${c.epoca ?? ''}`)}-${new Date().toISOString().slice(0, 10)}`;

  const tudo = async () => {
    setAviso(null);
    setOcupado(true);
    try {
      const jogadores = [...d.jogadores.values()];
      let privado: unknown[] = [];
      let responsaveis: unknown[] = [];
      if (pessoais) {
        const ids = jogadores.map((j) => j.id);
        const [p, r] = await Promise.all([
          ids.length ? supabase.from('jogadores_privado').select('*').in('jogador_id', ids) : Promise.resolve({ data: [], error: null }),
          supabase.from('responsaveis').select('*').in('equipa_id', [...d.equipas.keys()]),
        ]);
        if (p.error || r.error) throw p.error ?? r.error;
        privado = p.data ?? [];
        responsaveis = r.data ?? [];
      }
      const dados = {
        formato: 'liga-recreativa', versao: 1, exportado_em: new Date().toISOString(),
        competicao: c, participantes: d.participantes, equipas: [...d.equipas.values()], jogadores,
        jogos: d.jogos, eventos: d.eventos, convocatorias: d.convocatorias, sancoes: d.sancoes,
        ...(pessoais ? { jogadores_privado: privado, responsaveis } : {}),
      };
      descarregar(`${base}.json`, JSON.stringify(dados, null, 2), 'application/json');
      setAviso({ tipo: 'info', texto: `Descarregado: ${d.jogos.length} jogos, ${jogadores.length} jogadores${pessoais ? ', com dados pessoais' : ''}.` });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) });
    } finally {
      setOcupado(false);
    }
  };

  const resultados = () => {
    descarregar(`${base}-resultados.csv`, paraCsv(linhasResultados(d.jogos, d.equipas)), 'text/csv;charset=utf-8');
    setAviso({ tipo: 'info', texto: `Descarregado: ${d.jogos.length} jogos.` });
  };

  return (
    <Seccao titulo="Exportar dados">
      <p className="mb-3 text-sm text-tinta/70">
        Uma cópia desta competição no seu computador. A cópia de segurança completa (todas as competições) é feita
        todas as semanas no GitHub; veja o README.
      </p>
      {aviso && <div className="mb-3"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
      <label className="mb-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-relva" checked={pessoais} onChange={(e) => setPessoais(e.target.checked)} />
        <span>
          Incluir dados pessoais (BI, contactos, datas de nascimento e emails dos responsáveis).
          <span className="block text-xs text-tinta/60">Guarde o ficheiro num sítio seguro e não o partilhe.</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Botao disabled={ocupado} onClick={tudo}>{ocupado ? 'A preparar…' : 'Descarregar tudo (JSON)'}</Botao>
        <Botao variante="secundario" onClick={resultados} disabled={!d.jogos.length}>Resultados para o Excel (CSV)</Botao>
      </div>
    </Seccao>
  );
}

function Participantes({ d, todasEquipas, executar }: { d: Dados; todasEquipas: Equipa[]; executar: Executar }) {
  const c = d.competicao!;
  const grupos = nomesGrupos(c.num_grupos);
  const atualizar = (equipaId: string, valores: Record<string, unknown>) => executar(() =>
    supabase.from('participantes').update(valores).eq('competicao_id', c.id).eq('equipa_id', equipaId));

  const sortear = () => {
    const semGrupoValido = d.participantes.filter((p) => !p.grupo || !grupos.includes(p.grupo));
    if (semGrupoValido.length < d.participantes.length &&
      !confirm('Isto sorteia de novo os grupos de todas as equipas. Continuar?')) return;
    const sorteio = sortearGrupos(d.participantes.map((p) => p.equipa_id), c.num_grupos);
    executar(() => supabase.from('participantes').upsert(
      [...sorteio].map(([equipa_id, grupo]) => ({ competicao_id: c.id, equipa_id, grupo }))));
  };

  const semente = c.formato === 'eliminatorias';
  return (
    <Seccao titulo="Equipas participantes" acao={c.formato === 'grupos' && (
      <Botao variante="secundario" disabled={d.participantes.length < 2} onClick={sortear}>Sortear grupos</Botao>
    )}>
      {d.jogos.length > 0 && (
        <div className="mb-4">
          <Aviso tipo="info">Já existe calendário. Se mudar as equipas{c.formato === 'grupos' ? ' ou os grupos' : ''}, gere o calendário de novo.</Aviso>
        </div>
      )}
      {semente && (
        <p className="mb-3 text-sm text-tinta/70">
          Semente: 1 é a melhor equipa. As sementes 1 e 2 só se podem encontrar na final e, se faltarem equipas para
          completar o quadro, as melhores passam a 1.ª ronda sem jogar. Sem semente, o lugar é sorteado.
        </p>
      )}
      {todasEquipas.length === 0 ? (
        <p className="text-sm text-tinta/70">Crie equipas primeiro na página <Link className="text-relva underline" to="/admin/equipas">Equipas</Link>.</p>
      ) : (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {todasEquipas.map((e) => {
            const p = d.participantes.find((x) => x.equipa_id === e.id);
            return (
              <li key={e.id} className="flex items-center gap-3 border-b border-linha py-2">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-relva" checked={Boolean(p)}
                    onChange={(ev) => executar(() => ev.target.checked
                      ? supabase.from('participantes').insert({ competicao_id: c.id, equipa_id: e.id })
                      : supabase.from('participantes').delete().eq('competicao_id', c.id).eq('equipa_id', e.id))} />
                  {e.nome}
                </label>
                {p && c.formato === 'grupos' && (
                  <Seletor className="w-20" aria-label={`Grupo de ${e.nome}`} value={p.grupo ?? ''}
                    onChange={(ev) => atualizar(e.id, { grupo: ev.target.value || null })}>
                    <option value="">–</option>
                    {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                  </Seletor>
                )}
                {p && (
                  <Entrada type="number" min={1} className="w-24" placeholder={semente ? 'Semente' : 'Sorteio'}
                    aria-label={`${semente ? 'Semente' : 'Ordem de sorteio'} de ${e.nome}`}
                    title={semente ? 'Cabeça de série (1 = melhor)' : 'Posição no sorteio (usada só em empate total)'}
                    defaultValue={p.ordem_sorteio ?? ''}
                    onBlur={(ev) => atualizar(e.id, { ordem_sorteio: ev.target.value === '' ? null : Number(ev.target.value) })} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Seccao>
  );
}

function FaseFinal({ d, executar }: { d: Dados; executar: Executar }) {
  const c = d.competicao!;
  const [aviso, setAviso] = useState<string | null>(null);
  const eliminatorias = d.jogos.filter((j) => j.eliminatoria != null);
  const deGrupos = d.jogos.filter((j) => j.eliminatoria == null);
  const porJogar = deGrupos.filter((j) => j.estado === 'agendado' || j.estado === 'adiado' || j.estado === 'em_curso').length;
  const regras = regrasDaCompeticao(c);
  const proxima = planearProximaRonda(d.jogos, d.quadro, regras);


  const gerarFaseFinal = async () => {
    setAviso(null);
    if (porJogar && !confirm(`Ainda faltam ${porJogar} jogos da fase de grupos. Gerar a fase final com as tabelas atuais?`)) return;
    if (eliminatorias.length && !confirm(`Isto apaga os ${eliminatorias.length} jogos da fase final, com resultados e eventos. Continuar?`)) return;
    const plano = planearFaseFinal(
      d.grupos.map((g) => ({ grupo: g.grupo, equipas: g.linhas.map((l) => l.equipaId) })),
      c.apurados_por_grupo,
      Math.max(0, ...deGrupos.map((j) => j.jornada)),
      regras,
      d.melhores.filter((m) => m.apurado).map((m) => m.linha.equipaId),
    );
    if ('erro' in plano) return setAviso(plano.erro);
    if (await executar(() => supabase.rpc('gerar_calendario', {
      p_competicao: c.id, p_jogos: plano.jogos.map((j) => paraBase(j)), p_quadro: plano.quadro, p_so_fase_final: true,
    }))) setAviso('Fase final gerada. Marque as datas no painel do calendário.');
  };

  const gerarRonda = async () => {
    if (!proxima) return;
    setAviso(null);
    if (proxima.porDecidir) {
      setAviso(`Ainda ${proxima.porDecidir === 1 ? 'falta decidir 1 jogo' : `faltam decidir ${proxima.porDecidir} jogos`}. Um empate precisa do resultado dos penáltis (nas duas mãos, na ficha da 2.ª mão).`);
      return;
    }
    if (await executar(() => supabase.from('jogos').insert(proxima.jogos.map((j) => ({ competicao_id: c.id, ...paraBase(j) })))))
      setAviso(`${nomeEliminatoria(proxima.eliminatoria)} gerada. Marque as datas no painel do calendário.`);
  };

  return (
    <Seccao titulo="Fase final" acao={
      <div className="flex flex-wrap gap-2">
        {c.formato === 'grupos' && (
          <Botao variante={eliminatorias.length ? 'secundario' : 'primario'} disabled={!d.grupos.length} onClick={gerarFaseFinal}>
            {eliminatorias.length ? 'Gerar fase final de novo' : 'Gerar fase final'}
          </Botao>
        )}
        {proxima && (
          <Botao onClick={gerarRonda}>Gerar {nomeEliminatoria(proxima.eliminatoria).toLowerCase()}</Botao>
        )}
      </div>
    }>
      {c.formato === 'grupos' && !eliminatorias.length && (
        <p className="mb-3 text-sm text-tinta/70">
          {porJogar
            ? `Faltam ${porJogar} jogos da fase de grupos. No fim, gere a fase final: os apurados entram no quadro pela classificação.`
            : 'A fase de grupos terminou. Pode gerar a fase final.'}
        </p>
      )}
      {aviso && <div className="mb-4"><Aviso tipo="info">{aviso}</Aviso></div>}
      {d.quadro.length > 0 ? (
        <QuadroEliminatorias quadro={d.quadro} jogos={d.jogos} equipas={d.equipas} golosWO={c.golos_wo}
          linkJogo={(j) => `/admin/jogos/${j.id}`} />
      ) : c.formato === 'eliminatorias' && (
        <p className="text-sm text-tinta/70">Gere o calendário para sortear o quadro.</p>
      )}
    </Seccao>
  );
}

type Executar = (acao: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
type Dados = ReturnType<typeof useDadosCompeticao>;

/** Jogo planeado → colunas da tabela jogos. */
const paraBase = (j: JogoPlaneado & { dataHora?: string | null }, campo?: string) => ({
  jornada: j.jornada, casa_id: j.casaId, fora_id: j.foraId, grupo: j.grupo ?? null,
  eliminatoria: j.eliminatoria ?? null, chave: j.chave ?? null, mao: j.mao ?? null,
  data_hora: j.dataHora ?? null, campo: campo || null,
});

function Regras({ competicao, temJogos, executar }: { competicao: Competicao; temJogos: boolean; executar: Executar }) {
  const [f, setF] = useState(competicao);
  useEffect(() => setF(competicao), [competicao]);
  const num = (k: 'pts_vitoria' | 'pts_empate' | 'pts_derrota' | 'golos_wo' | 'amarelos_suspensao' | 'jogos_suspensao_expulsao'
    | 'num_grupos' | 'apurados_por_grupo' | 'melhores_terceiros') => ({
    type: 'number', value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: Number(e.target.value) }),
  });

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    executar(() => supabase.from('competicoes').update({
      nome: f.nome, epoca: f.epoca, estado: f.estado, pts_vitoria: f.pts_vitoria, pts_empate: f.pts_empate,
      pts_derrota: f.pts_derrota, golos_wo: f.golos_wo, ida_volta: f.ida_volta,
      amarelos_suspensao: f.amarelos_suspensao, jogos_suspensao_expulsao: f.jogos_suspensao_expulsao,
      formato: f.formato, num_grupos: f.num_grupos, apurados_por_grupo: f.apurados_por_grupo,
      melhores_terceiros: f.formato === 'grupos' ? f.melhores_terceiros : 0,
      duas_maos: f.duas_maos, final_duas_maos: f.duas_maos && f.final_duas_maos, terceiro_lugar: f.terceiro_lugar,
    }).eq('id', competicao.id));
  };
  const apuradosTotal = f.num_grupos * f.apurados_por_grupo + f.melhores_terceiros;

  return (
    <Seccao titulo="Regras">
      <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
        <Campo rotulo="Nome" className="col-span-2">
          <Entrada required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </Campo>
        <Campo rotulo="Estado" className="col-span-2">
          <Seletor value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as EstadoCompeticao })}>
            {Object.entries(ESTADO_COMPETICAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seletor>
        </Campo>
        <Campo rotulo="Formato" className="col-span-2"
          ajuda={temJogos && f.formato !== competicao.formato ? 'Depois de mudar o formato, gere o calendário de novo.' : undefined}>
          <Seletor value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value as Formato })}>
            {Object.entries(FORMATO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seletor>
        </Campo>
        {f.formato === 'grupos' && (
          <>
            <Campo rotulo="Número de grupos"><Entrada min={1} max={16} {...num('num_grupos')} /></Campo>
            <Campo rotulo="Apurados por grupo">
              <Entrada min={1} {...num('apurados_por_grupo')} />
            </Campo>
            <Campo rotulo={`Melhores ${f.apurados_por_grupo + 1}.º classificados também passam`}
              ajuda={[2, 4, 8, 16, 32].includes(apuradosTotal)
                ? `${apuradosTotal} equipas na fase final.`
                : `${apuradosTotal} apurados: a fase final precisa de 2, 4, 8, 16 ou 32.`}>
              <Entrada min={0} max={f.num_grupos} {...num('melhores_terceiros')} />
            </Campo>
          </>
        )}
        <Campo rotulo="Pontos por vitória"><Entrada {...num('pts_vitoria')} /></Campo>
        <Campo rotulo="Pontos por empate"><Entrada {...num('pts_empate')} /></Campo>
        <Campo rotulo="Pontos por derrota"><Entrada {...num('pts_derrota')} /></Campo>
        <Campo rotulo="Golos atribuídos no W.O."><Entrada min={0} {...num('golos_wo')} /></Campo>
        <Campo rotulo="Amarelos para 1 jogo de suspensão" ajuda="0 desliga. Conta a cada múltiplo (3, 6, 9…).">
          <Entrada min={0} {...num('amarelos_suspensao')} />
        </Campo>
        <Campo rotulo="Jogos de suspensão por expulsão" ajuda="Vermelho ou 2 amarelos no mesmo jogo. 0 desliga.">
          <Entrada min={0} {...num('jogos_suspensao_expulsao')} />
        </Campo>
        {f.formato !== 'eliminatorias' && (
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-relva" checked={f.ida_volta}
              onChange={(e) => setF({ ...f, ida_volta: e.target.checked })} />
            Jogos a duas voltas (ida e volta){f.formato === 'grupos' && ' na fase de grupos'}
          </label>
        )}
        {f.formato !== 'liga' && (
          <fieldset className="col-span-2 flex flex-col gap-2 rounded-md border border-linha p-3">
            <legend className="px-1 text-sm font-semibold">Eliminatórias</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-relva" checked={f.duas_maos}
                onChange={(e) => setF({ ...f, duas_maos: e.target.checked, final_duas_maos: e.target.checked && f.final_duas_maos })} />
              A duas mãos (ida e volta, golos somados)
            </label>
            {f.duas_maos && (
              <label className="ml-6 flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-relva" checked={f.final_duas_maos}
                  onChange={(e) => setF({ ...f, final_duas_maos: e.target.checked })} />
                A final também a duas mãos
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-relva" checked={f.terceiro_lugar}
                onChange={(e) => setF({ ...f, terceiro_lugar: e.target.checked })} />
              Jogo do 3.º lugar (entre os derrotados das meias-finais)
            </label>
            <p className="text-xs text-tinta/60">
              Empate {f.duas_maos ? 'no total das duas mãos' : 'no jogo'}: registe os penáltis na ficha
              {f.duas_maos ? ' da 2.ª mão' : ' do jogo'}. {f.duas_maos && 'Não há regra dos golos fora.'}
              {temJogos && ' Estas regras aplicam-se às rondas que ainda vão ser geradas.'}
            </p>
          </fieldset>
        )}
        <div className="col-span-2"><Botao type="submit">Guardar regras</Botao></div>
      </form>
    </Seccao>
  );
}

function Criterios({ competicao, executar }: { competicao: Competicao; executar: Executar }) {
  const [ativos, setAtivos] = useState<Criterio[]>(competicao.criterios.filter((c) => c !== 'pontos'));
  useEffect(() => setAtivos(competicao.criterios.filter((c) => c !== 'pontos')), [competicao]);
  const disponiveis = TODOS_CRITERIOS.filter((c) => !ativos.includes(c));

  const mover = (i: number, delta: number) => {
    const n = [...ativos];
    [n[i], n[i + delta]] = [n[i + delta], n[i]];
    setAtivos(n);
  };

  return (
    <Seccao titulo="Critérios de desempate">
      <p className="mb-3 text-sm text-tinta/70">Aplicados por esta ordem quando duas ou mais equipas têm os mesmos pontos.</p>
      <ol className="mb-4 flex flex-col gap-1">
        {ativos.map((c, i) => (
          <li key={c} className="flex items-center gap-2 rounded-md border border-linha px-3 py-2 text-sm">
            <span className="w-5 font-display text-lg font-semibold text-relva">{i + 1}</span>
            <span className="flex-1">{CRITERIO_LABEL[c]}</span>
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}
              className="rounded px-2 py-1 hover:bg-giz disabled:opacity-30">↑</button>
            <button type="button" aria-label="Descer" disabled={i === ativos.length - 1} onClick={() => mover(i, 1)}
              className="rounded px-2 py-1 hover:bg-giz disabled:opacity-30">↓</button>
            <button type="button" aria-label={`Remover ${CRITERIO_LABEL[c]}`} onClick={() => setAtivos(ativos.filter((x) => x !== c))}
              className="rounded px-2 py-1 text-vermelho hover:bg-vermelho/10">✕</button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {disponiveis.length > 0 && (
          <Seletor value="" aria-label="Adicionar critério"
            onChange={(e) => e.target.value && setAtivos([...ativos, e.target.value as Criterio])}>
            <option value="">Adicionar critério…</option>
            {disponiveis.map((c) => <option key={c} value={c}>{CRITERIO_LABEL[c]}</option>)}
          </Seletor>
        )}
        <Botao onClick={() => executar(() => supabase.from('competicoes')
          .update({ criterios: ['pontos', ...ativos] }).eq('id', competicao.id))}>
          Guardar critérios
        </Botao>
      </div>
    </Seccao>
  );
}

function Calendario({ d, executar }: { d: Dados; executar: Executar }) {
  const competicao = d.competicao!;
  const [o, setO] = useState({ inicio: '', hora: '15:00', intervaloMin: 60, diasEntreJornadas: 7, campo: '', substituir: false });
  const [aPartir, setAPartir] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'porJogar' | 'jogados' | 'todos'>();
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Por defeito, a primeira jornada que ainda tem jogos por jogar
  const porJogar = d.jogos.filter((j) => j.estado === 'agendado').map((j) => j.jornada);
  const jornadaInicial = aPartir ?? (porJogar.length ? Math.min(...porJogar) : 1);
  const opcoes = { inicio: o.inicio, hora: o.hora || '00:00', intervaloMin: o.intervaloMin, diasEntreJornadas: o.diasEntreJornadas };

  const correr = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setAviso(null);
    try { await acao(); } finally { setOcupado(false); }
  };

  const gerar = () => correr(async () => {
    if (d.jogos.length && !confirm(`Isto apaga os ${d.jogos.length} jogos existentes, com resultados e eventos. Continuar?`)) return;
    const plano = planearCalendario(competicao.formato, d.participantes, competicao.ida_volta, regrasDaCompeticao(competicao));
    if ('erro' in plano) { setAviso(plano.erro); return; }
    const datados = o.inicio ? atribuirDatas(plano.jogos, { ...opcoes, aPartirJornada: 1 }) : plano.jogos;
    const p_jogos = datados.map((j) => paraBase(j, o.campo));
    // Apaga e cria numa só transação: se falhar, o calendário anterior fica intacto
    if (await executar(() => supabase.rpc('gerar_calendario', { p_competicao: competicao.id, p_jogos, p_quadro: plano.quadro })))
      setAviso(`Calendário gerado: ${p_jogos.length} jogos${o.inicio ? ', já com data' : ''}.`);
  });

  const marcarDatas = () => correr(async () => {
    const candidatos = d.jogos.filter((j) => j.jornada >= jornadaInicial);
    const alterar = atribuirDatas(candidatos, { ...opcoes, aPartirJornada: jornadaInicial })
      .filter((j) => j.estado === 'agendado' && (o.substituir || !j.data_hora))
      .map((j) => ({ id: j.id, data_hora: j.dataHora, campo: o.campo || null }));
    if (!alterar.length) {
      setAviso('Não há jogos para marcar. Para mudar datas já marcadas, ative "Substituir datas já marcadas".');
      return;
    }
    if (await executar(() => supabase.rpc('definir_datas_jogos', { p_jogos: alterar })))
      setAviso(`${alterar.length} ${alterar.length === 1 ? 'jogo ficou' : 'jogos ficaram'} com data marcada.`);
  });

  const porTerminar = (j: { estado: string }) => j.estado === 'agendado' || j.estado === 'adiado' || j.estado === 'em_curso';
  const porFazer = d.jogos.filter(porTerminar);
  const jogados = d.jogos.filter((j) => !porTerminar(j));
  const visiveis = { porJogar: porFazer, jogados: [...jogados].reverse(), todos: d.jogos }[filtro ?? (porFazer.length ? 'porJogar' : 'todos')];

  return (
    <Seccao titulo="Jogos" acao={d.jogos.length > 0 && (
      <div className="flex rounded-md border border-linha p-0.5 text-sm" role="radiogroup" aria-label="Mostrar jogos">
        {([['porJogar', `Por jogar (${porFazer.length})`], ['jogados', `Jogados (${jogados.length})`], ['todos', 'Todos']] as const)
          .map(([k, rotulo]) => {
            const ativo = (filtro ?? (porFazer.length ? 'porJogar' : 'todos')) === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={ativo} onClick={() => setFiltro(k)}
                className={`rounded px-3 py-1.5 font-semibold ${ativo ? 'bg-relva text-white' : 'hover:bg-giz'}`}>
                {rotulo}
              </button>
            );
          })}
      </div>
    )}>
      <details open={!d.jogos.length} className="group mb-6 rounded-md border border-linha">
        <summary className="cursor-pointer list-none px-4 py-3 font-display text-lg font-semibold hover:bg-giz">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>›</span>
          {d.jogos.length ? 'Gerar calendário de novo e marcar datas' : 'Gerar calendário'}
        </summary>
        <div className="border-t border-linha p-4">
        <p className="mb-3 text-sm text-tinta/70">
          Com a data preenchida, o calendário é gerado já com dia, hora e campo. Num calendário existente,
          "Marcar datas" só mexe nos jogos agendados; resultados e jogos adiados ficam como estão.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo rotulo="Data da jornada inicial">
            <Entrada type="date" value={o.inicio} onChange={(e) => setO({ ...o, inicio: e.target.value })} />
          </Campo>
          <Campo rotulo="Hora do 1.º jogo">
            <Entrada type="time" value={o.hora} onChange={(e) => setO({ ...o, hora: e.target.value })} />
          </Campo>
          <Campo rotulo="Minutos entre jogos">
            <Entrada type="number" min={0} value={o.intervaloMin} onChange={(e) => setO({ ...o, intervaloMin: Number(e.target.value) })} />
          </Campo>
          <Campo rotulo="Dias entre jornadas">
            <Entrada type="number" min={1} value={o.diasEntreJornadas} onChange={(e) => setO({ ...o, diasEntreJornadas: Number(e.target.value) })} />
          </Campo>
          <Campo rotulo="Campo">
            <Entrada value={o.campo} placeholder="Opcional" onChange={(e) => setO({ ...o, campo: e.target.value })} />
          </Campo>
          <Campo rotulo="A partir da jornada" ajuda="Só para marcar datas.">
            <Entrada type="number" min={1} value={jornadaInicial} disabled={!d.jogos.length}
              onChange={(e) => setAPartir(e.target.value === '' ? null : Number(e.target.value))} />
          </Campo>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {d.jogos.length > 0 && (
            <>
              <Botao disabled={!o.inicio || ocupado} onClick={marcarDatas}>Marcar datas nos jogos por jogar</Botao>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-relva" checked={o.substituir}
                  onChange={(e) => setO({ ...o, substituir: e.target.checked })} />
                Substituir datas já marcadas
              </label>
            </>
          )}
          <Botao variante={d.jogos.length ? 'perigo' : 'primario'} className="sm:ml-auto"
            disabled={d.participantes.length < 2 || ocupado} onClick={gerar}>
            {d.jogos.length ? 'Gerar calendário de novo (apaga os jogos)' : 'Gerar calendário'}
          </Botao>
        </div>
        {d.participantes.length < 2 && (
          <p className="mt-2 text-xs text-tinta/60">Escolha pelo menos 2 equipas no separador Configuração.</p>
        )}
        </div>
      </details>
      {aviso && <div className="mb-4"><Aviso tipo="info">{aviso}</Aviso></div>}
      <ListaJogos jogos={visiveis} equipas={d.equipas} linkPara={(j) => `/admin/jogos/${j.id}`}
        vazio={d.jogos.length ? 'Nenhum jogo neste filtro.' : 'Ainda não há calendário.'} />
    </Seccao>
  );
}

function Suspensoes({ d }: { d: Dados }) {
  const jogos = new Map(d.jogos.map((j) => [j.id, j]));
  const automaticas = [...d.suspensoes.values()];
  const manuais = [...d.jogadores.values()].filter((j) => j.suspenso && !d.suspensoes.has(j.id));

  return (
    <Seccao titulo="Suspensões">
      <p className="mb-3 text-sm text-tinta/70">
        Calculadas a partir dos cartões, segundo as regras acima. As suspensões manuais marcam-se na ficha do jogador.
      </p>
      {automaticas.length === 0 && manuais.length === 0 ? (
        <p className="text-sm text-tinta/70">Ninguém está suspenso.</p>
      ) : (
        <ul className="divide-y divide-linha text-sm">
          {automaticas.map((s) => {
            const prox = s.proximoJogoId ? jogos.get(s.proximoJogoId) : undefined;
            const adversario = prox && d.equipas.get(prox.casa_id === s.equipaId ? prox.fora_id : prox.casa_id)?.nome;
            return (
              <li key={s.jogadorId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="font-semibold">{d.jogadores.get(s.jogadorId)?.nome ?? 'Jogador sem ficha'}</span>
                <span className="text-tinta/60">{d.equipas.get(s.equipaId)?.nome}</span>
                <span className="flex-1 text-tinta/70">{s.motivo}</span>
                <span className="font-semibold text-vermelho">
                  Falta{s.jogosEmFalta === 1 ? '' : 'm'} {s.jogosEmFalta} {s.jogosEmFalta === 1 ? 'jogo' : 'jogos'}
                </span>
                {prox && (
                  <Link to={`/admin/jogos/${prox.id}`} className="text-relva hover:underline">
                    Próximo: J{prox.jornada} contra {adversario}
                  </Link>
                )}
              </li>
            );
          })}
          {manuais.map((j) => (
            <li key={j.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <span className="font-semibold">{j.nome}</span>
              <span className="text-tinta/60">{j.equipa_id ? d.equipas.get(j.equipa_id)?.nome : ''}</span>
              <span className="flex-1 text-tinta/70">Suspensão manual</span>
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  );
}

function Sancoes({ d, executar }: { d: Dados; executar: Executar }) {
  const [equipa, setEquipa] = useState('');
  const [pontos, setPontos] = useState(-3);
  const [motivo, setMotivo] = useState('');

  const adicionar = (e: FormEvent) => {
    e.preventDefault();
    executar(() => supabase.from('sancoes').insert({
      competicao_id: d.competicao!.id, equipa_id: equipa, pontos, motivo: motivo || null,
    })).then(() => { setMotivo(''); });
  };

  return (
    <Seccao titulo="Sanções de pontos">
      <form onSubmit={adicionar} className="mb-4 grid gap-3 sm:grid-cols-[1fr_7rem_2fr_auto] sm:items-end">
        <Campo rotulo="Equipa">
          <Seletor required value={equipa} onChange={(e) => setEquipa(e.target.value)}>
            <option value="">Escolher…</option>
            {[...d.equipas.values()].map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Seletor>
        </Campo>
        <Campo rotulo="Pontos"><Entrada type="number" value={pontos} onChange={(e) => setPontos(Number(e.target.value))} /></Campo>
        <Campo rotulo="Motivo"><Entrada value={motivo} placeholder="Ex.: jogador inscrito irregularmente" onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <Botao type="submit">Aplicar sanção</Botao>
      </form>
      {d.sancoes.length > 0 && (
        <ul className="divide-y divide-linha text-sm">
          {d.sancoes.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span className="w-12 font-semibold text-vermelho">{s.pontos}</span>
              <span className="flex-1">{d.equipas.get(s.equipa_id)?.nome}{s.motivo && <span className="text-tinta/60">: {s.motivo}</span>}</span>
              <Botao variante="perigo" onClick={() => executar(() => supabase.from('sancoes').delete().eq('id', s.id))}>Retirar</Botao>
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  );
}
