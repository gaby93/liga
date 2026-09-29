import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Aviso, Botao, Campo, Emblema, Entrada, Seccao } from '../../componentes/ui';
import { carregarImagem } from '../../lib/imagens';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa } from '../../lib/types';

const nova: Partial<Equipa> = { nome: '', responsavel: '', contacto: '' };

export default function Equipas() {
  const [lista, setLista] = useState<Equipa[]>([]);
  const [edicao, setEdicao] = useState<Partial<Equipa> | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('equipas').select('*').order('nome');
    if (error) setErro(mensagemErro(error));
    else setLista(data as Equipa[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (e: Partial<Equipa>) => { setEdicao(e); setFicheiro(null); setErro(null); };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!edicao) return;
    setAGuardar(true);
    try {
      const emblema_url = ficheiro ? await carregarImagem(ficheiro, 'emblemas') : edicao.emblema_url ?? null;
      const dados = {
        nome: edicao.nome!.trim(), responsavel: edicao.responsavel || null, contacto: edicao.contacto || null, emblema_url,
      };
      const { error } = edicao.id
        ? await supabase.from('equipas').update(dados).eq('id', edicao.id)
        : await supabase.from('equipas').insert(dados);
      if (error) throw error;
      setEdicao(null);
      await carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setAGuardar(false);
    }
  };

  const apagar = async (e: Equipa) => {
    if (!confirm(`Apagar a equipa ${e.nome}? Os jogadores ficam sem equipa.`)) return;
    const { error } = await supabase.from('equipas').delete().eq('id', e.id);
    if (error) setErro(mensagemErro(error));
    else carregar();
  };

  return (
    <>
      {edicao && (
        <Seccao titulo={edicao.id ? `Editar ${edicao.nome}` : 'Nova equipa'}>
          <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome">
              <Entrada required value={edicao.nome ?? ''} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Emblema" ajuda="A imagem é reduzida automaticamente antes do envio.">
              <Entrada type="file" accept="image/*" onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} />
            </Campo>
            <Campo rotulo="Responsável">
              <Entrada value={edicao.responsavel ?? ''} onChange={(e) => setEdicao({ ...edicao, responsavel: e.target.value })} />
            </Campo>
            <Campo rotulo="Contacto">
              <Entrada type="tel" value={edicao.contacto ?? ''} onChange={(e) => setEdicao({ ...edicao, contacto: e.target.value })} />
            </Campo>
            <div className="flex gap-2 sm:col-span-2">
              <Botao type="submit" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar equipa'}</Botao>
              <Botao variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Botao>
            </div>
          </form>
        </Seccao>
      )}

      <Seccao titulo="Equipas" acao={<Botao onClick={() => abrir(nova)}>Nova equipa</Botao>}>
        {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
        {lista.length === 0 ? (
          <p className="text-sm text-tinta/70">Crie a primeira equipa para começar.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {lista.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <Emblema url={e.emblema_url} nome={e.nome} tamanho={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{e.nome}</div>
                  <div className="text-xs text-tinta/60">{[e.responsavel, e.contacto].filter(Boolean).join(', ') || 'Sem responsável indicado'}</div>
                </div>
                <Botao variante="secundario" onClick={() => abrir(e)}>Editar</Botao>
                <Botao variante="perigo" onClick={() => apagar(e)}>Apagar</Botao>
              </li>
            ))}
          </ul>
        )}
      </Seccao>
    </>
  );
}
