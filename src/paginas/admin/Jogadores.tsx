import { useCallback, useEffect, useState } from 'react';
import { FormularioJogador, abrirJogador, type EdicaoJogador } from '../../componentes/FormularioJogador';
import { Aviso, Botao, Emblema, Entrada, Paginacao, Seccao, Seletor } from '../../componentes/ui';
import { paginar, pesquisarJogadores } from '../../lib/favoritos';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa, Jogador } from '../../lib/types';

const POR_PAGINA = 25;

export default function Jogadores() {
  const [equipas, setEquipas] = useState<Equipa[]>([]);
  const [lista, setLista] = useState<Jogador[]>([]);
  const [filtro, setFiltro] = useState('');
  const [edicao, setEdicao] = useState<EdicaoJogador | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const org = useGestao().atual!.id;
  const [pesquisa, setPesquisa] = useState('');
  const [pagina, setPagina] = useState(1);

  // Só as equipas e os jogadores da organização escolhida
  const carregar = useCallback(async () => {
    const [e, j] = await Promise.all([
      supabase.from('equipas').select('*').eq('organizacao_id', org).order('nome'),
      supabase.from('jogadores').select('*').eq('organizacao_id', org).order('nome'),
    ]);
    if (e.error || j.error) return setErro(mensagemErro(e.error ?? j.error));
    setEquipas(e.data as Equipa[]);
    setLista(j.data as Jogador[]);
  }, [org]);
  useEffect(() => { carregar(); }, [carregar]);
  // Ao mudar de organização, o filtro de equipa deixa de fazer sentido
  useEffect(() => { setFiltro(''); setPesquisa(''); setEdicao(null); }, [org]);
  // Uma pesquisa ou um filtro novo começa na 1.ª página
  useEffect(() => { setPagina(1); }, [filtro, pesquisa, org]);

  const abrir = async (j?: Jogador) => {
    setErro(null);
    setEdicao(j ? await abrirJogador(j) : { nome: '', equipa_id: filtro || null, suspenso: false });
  };

  const apagar = async (j: Jogador) => {
    if (!confirm(`Apagar ${j.nome}? Os golos e cartões dele ficam sem nome.`)) return;
    const { error } = await supabase.from('jogadores').delete().eq('id', j.id);
    if (error) setErro(mensagemErro(error));
    else carregar();
  };

  const nomeEquipa = new Map(equipas.map((e) => [e.id, e.nome]));
  const daEquipa = filtro ? lista.filter((j) => j.equipa_id === filtro) : lista;
  const encontrados = pesquisarJogadores(daEquipa, pesquisa);
  const pag = paginar(encontrados, pagina, POR_PAGINA);

  return (
    <>
      {edicao && (
        <FormularioJogador key={edicao.id ?? 'novo'} inicial={edicao} equipas={equipas} organizacaoId={org} comSuspensao
          onGuardado={() => { setEdicao(null); carregar(); }} onCancelar={() => setEdicao(null)} />
      )}

      <Seccao titulo="Jogadores" acao={
        <div className="flex flex-wrap gap-2">
          <Seletor value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por equipa">
            <option value="">Todas as equipas</option>
            {equipas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Seletor>
          <Botao onClick={() => abrir()}>Novo jogador</Botao>
        </div>
      }>
        {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
        {daEquipa.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Entrada type="search" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar por nome ou número" aria-label="Pesquisar jogadores" className="min-w-0 flex-1" />
            <span className="text-sm text-tinta/60">
              {pesquisa.trim() ? `${encontrados.length} de ${daEquipa.length}` : daEquipa.length} {daEquipa.length === 1 ? 'jogador' : 'jogadores'}
            </span>
          </div>
        )}
        {encontrados.length === 0 ? (
          <p className="text-sm text-tinta/70">
            {pesquisa.trim() && daEquipa.length ? `Nenhum jogador corresponde a “${pesquisa.trim()}”.` : `Não há jogadores ${filtro ? 'nesta equipa' : 'registados'}.`}
          </p>
        ) : (
          <ul className="divide-y divide-linha">
            {pag.itens.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                <Emblema url={j.foto_url} nome={j.nome} tamanho={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {j.numero != null && <span className="mr-2 font-display text-relva">{j.numero}</span>}
                    {j.nome}
                    {j.suspenso && <span className="ml-2 text-xs font-medium text-vermelho">Suspenso</span>}
                  </div>
                  <div className="text-xs text-tinta/60">{j.equipa_id ? nomeEquipa.get(j.equipa_id) : 'Sem equipa'}</div>
                </div>
                <Botao variante="secundario" onClick={() => abrir(j)}>Editar</Botao>
                <Botao variante="perigo" onClick={() => apagar(j)}>Apagar</Botao>
              </li>
            ))}
          </ul>
        )}
        <Paginacao pagina={pag.pagina} paginas={pag.paginas} onMudar={(p) => { setPagina(p); window.scrollTo({ top: 0 }); }} />
      </Seccao>
    </>
  );
}
