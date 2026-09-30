import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo, Entrada, Seccao, Seletor } from '../../componentes/ui';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import { ESTADO_COMPETICAO_LABEL, FORMATO_LABEL, type Competicao, type Formato } from '../../lib/types';

export default function Competicoes() {
  const [lista, setLista] = useState<Competicao[]>([]);
  const [nome, setNome] = useState('');
  const [epoca, setEpoca] = useState(String(new Date().getFullYear()));
  const [formato, setFormato] = useState<Formato>('liga');
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const navegar = useNavigate();
  const { atual } = useGestao();
  const org = atual!.id;

  // Só as competições da organização escolhida
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('competicoes').select('*').eq('organizacao_id', org)
      .order('created_at', { ascending: false });
    if (error) setErro(mensagemErro(error));
    else setLista(data as Competicao[]);
  }, [org]);
  useEffect(() => { carregar(); }, [carregar]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('competicoes')
      .insert({ nome: nome.trim(), epoca: epoca.trim() || null, formato, organizacao_id: org }).select('id').single();
    if (error) return setErro(mensagemErro(error));
    navegar(`/admin/competicoes/${data.id}`);
  };

  return (
    <Seccao titulo="Competições" acao={!aCriar && <Botao onClick={() => setACriar(true)}>Nova competição</Botao>}>
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      {aCriar && (
        <form onSubmit={criar} className="mb-6 grid gap-4 rounded-md bg-giz p-4 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end">
          <Campo rotulo="Nome">
            <Entrada required placeholder="Liga do Bairro" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="Época">
            <Entrada value={epoca} onChange={(e) => setEpoca(e.target.value)} />
          </Campo>
          <Campo rotulo="Formato">
            <Seletor value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
              {Object.entries(FORMATO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seletor>
          </Campo>
          <div className="flex gap-2">
            <Botao type="submit">Criar competição</Botao>
            <Botao variante="secundario" onClick={() => setACriar(false)}>Cancelar</Botao>
          </div>
        </form>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-tinta/70">Crie uma competição, adicione as equipas e gere o calendário.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 hover:text-relva">
                <span className="font-display text-xl font-semibold">{c.nome} {c.epoca && <span className="text-tinta/50">{c.epoca}</span>}</span>
                <span className="text-sm text-tinta/60">{FORMATO_LABEL[c.formato]}, {ESTADO_COMPETICAO_LABEL[c.estado].toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  );
}
