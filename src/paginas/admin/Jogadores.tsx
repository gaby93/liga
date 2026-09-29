import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Aviso, Botao, Campo, Emblema, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { carregarImagem } from '../../lib/imagens';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa, Jogador, JogadorPrivado } from '../../lib/types';

type Edicao = Partial<Jogador> & Partial<Omit<JogadorPrivado, 'jogador_id'>>;

export default function Jogadores() {
  const [equipas, setEquipas] = useState<Equipa[]>([]);
  const [lista, setLista] = useState<Jogador[]>([]);
  const [filtro, setFiltro] = useState('');
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = useCallback(async () => {
    const [e, j] = await Promise.all([
      supabase.from('equipas').select('*').order('nome'),
      supabase.from('jogadores').select('*').order('nome'),
    ]);
    if (e.error || j.error) return setErro(mensagemErro(e.error ?? j.error));
    setEquipas(e.data as Equipa[]);
    setLista(j.data as Jogador[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = async (j?: Jogador) => {
    setErro(null);
    setFicheiro(null);
    if (!j) return setEdicao({ nome: '', equipa_id: filtro || null, suspenso: false });
    const { data } = await supabase.from('jogadores_privado').select('*').eq('jogador_id', j.id).maybeSingle();
    setEdicao({ ...j, ...(data ?? {}) });
  };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!edicao) return;
    setAGuardar(true);
    try {
      const foto_url = ficheiro ? await carregarImagem(ficheiro, 'jogadores') : edicao.foto_url ?? null;
      const publico = {
        nome: edicao.nome!.trim(),
        equipa_id: edicao.equipa_id || null,
        numero: edicao.numero ?? null,
        suspenso: Boolean(edicao.suspenso),
        foto_url,
      };
      let id = edicao.id;
      if (id) {
        const { error } = await supabase.from('jogadores').update(publico).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('jogadores').insert(publico).select('id').single();
        if (error) throw error;
        id = data.id as string;
      }
      const { error } = await supabase.from('jogadores_privado').upsert({
        jogador_id: id,
        data_nasc: edicao.data_nasc || null,
        documento: edicao.documento || null,
        contacto: edicao.contacto || null,
      });
      if (error) throw error;
      setEdicao(null);
      await carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setAGuardar(false);
    }
  };

  const apagar = async (j: Jogador) => {
    if (!confirm(`Apagar ${j.nome}? Os golos e cartões dele ficam sem nome.`)) return;
    const { error } = await supabase.from('jogadores').delete().eq('id', j.id);
    if (error) setErro(mensagemErro(error));
    else carregar();
  };

  const nomeEquipa = new Map(equipas.map((e) => [e.id, e.nome]));
  const visiveis = filtro ? lista.filter((j) => j.equipa_id === filtro) : lista;

  return (
    <>
      {edicao && (
        <Seccao titulo={edicao.id ? `Editar ${edicao.nome}` : 'Novo jogador'}>
          <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome">
              <Entrada required value={edicao.nome ?? ''} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Equipa">
              <Seletor value={edicao.equipa_id ?? ''} onChange={(e) => setEdicao({ ...edicao, equipa_id: e.target.value || null })}>
                <option value="">Sem equipa</option>
                {equipas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Seletor>
            </Campo>
            <Campo rotulo="Número da camisola">
              <Entrada type="number" min={0} max={99} value={edicao.numero ?? ''}
                onChange={(e) => setEdicao({ ...edicao, numero: e.target.value === '' ? null : Number(e.target.value) })} />
            </Campo>
            <Campo rotulo="Foto">
              <Entrada type="file" accept="image/*" onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} />
            </Campo>
            <Campo rotulo="Data de nascimento" ajuda="Visível só para administradores.">
              <Entrada type="date" value={edicao.data_nasc ?? ''} onChange={(e) => setEdicao({ ...edicao, data_nasc: e.target.value })} />
            </Campo>
            <Campo rotulo="Documento (BI ou passaporte)" ajuda="Visível só para administradores.">
              <Entrada value={edicao.documento ?? ''} onChange={(e) => setEdicao({ ...edicao, documento: e.target.value })} />
            </Campo>
            <Campo rotulo="Contacto" ajuda="Visível só para administradores.">
              <Entrada type="tel" value={edicao.contacto ?? ''} onChange={(e) => setEdicao({ ...edicao, contacto: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-relva" checked={Boolean(edicao.suspenso)}
                onChange={(e) => setEdicao({ ...edicao, suspenso: e.target.checked })} />
              Suspenso por decisão da organização (as suspensões por cartões são automáticas)
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Botao type="submit" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar jogador'}</Botao>
              <Botao variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Botao>
            </div>
          </form>
        </Seccao>
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
        {visiveis.length === 0 ? (
          <p className="text-sm text-tinta/70">Não há jogadores {filtro ? 'nesta equipa' : 'registados'}.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {visiveis.map((j) => (
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
      </Seccao>
    </>
  );
}
