import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Aviso, Botao, Entrada, Seccao } from '../../componentes/ui';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { CampoJogo } from '../../lib/types';

/** Campos da organização: o calendário distribui os jogos da jornada por eles. */
export default function Campos() {
  const org = useGestao().atual!.id;
  const [lista, setLista] = useState<CampoJogo[]>([]);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('campos').select('*').eq('organizacao_id', org).order('ordem').order('nome');
    if (error) return setErro(mensagemErro(error));
    setLista(data as CampoJogo[]);
  }, [org]);
  useEffect(() => { carregar(); }, [carregar]);

  const executar = async (acao: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await acao();
    if (error) { setErro(mensagemErro(error)); return false; }
    setErro(null);
    await carregar();
    return true;
  };

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    const ordem = lista.length ? Math.max(...lista.map((c) => c.ordem)) + 1 : 0;
    if (await executar(() => supabase.from('campos').insert({ organizacao_id: org, nome, ordem }))) setNovo('');
  };

  // Troca dois campos vizinhos e regrava a ordem de todos (a ordem é a do calendário)
  const mover = (i: number, d: -1 | 1) => {
    if (!lista[i] || !lista[i + d]) return;
    const nova = [...lista];
    [nova[i], nova[i + d]] = [nova[i + d], nova[i]];
    return executar(async () => {
      for (const [k, c] of nova.entries()) {
        if (c.ordem === k) continue;
        const r = await supabase.from('campos').update({ ordem: k }).eq('id', c.id);
        if (r.error) return r;
      }
      return { error: null };
    });
  };

  return (
    <Seccao titulo="Campos">
      <p className="mb-4 text-sm text-tinta/70">
        Os campos onde a organização joga. Ao gerar o calendário ou marcar datas, os jogos da jornada dividem-se pelos
        campos escolhidos: com 2 campos, os 2 primeiros jogos são à mesma hora, um em cada campo, e assim por diante.
      </p>
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      <form onSubmit={criar} className="mb-6 flex flex-wrap gap-2">
        <Entrada value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome do campo (ex.: Campo 1)"
          className="min-w-0 flex-1" aria-label="Nome do novo campo" />
        <Botao type="submit" disabled={!novo.trim()}>Acrescentar campo</Botao>
      </form>
      {lista.length === 0 ? (
        <p className="text-sm text-tinta/70">Ainda não há campos. Sem campos, o calendário marca um jogo por horário.</p>
      ) : (
        <ul className="divide-y divide-linha rounded-xl border border-linha">
          {lista.map((c, i) => (
            <LinhaCampo key={c.id} campo={c} primeiro={i === 0} ultimo={i === lista.length - 1}
              executar={executar} subir={() => mover(i, -1)} descer={() => mover(i, 1)} />
          ))}
        </ul>
      )}
    </Seccao>
  );
}

function LinhaCampo({ campo, primeiro, ultimo, executar, subir, descer }: {
  campo: CampoJogo; primeiro: boolean; ultimo: boolean;
  executar: (acao: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
  subir: () => void; descer: () => void;
}) {
  const [nome, setNome] = useState(campo.nome);
  const [apagar, setApagar] = useState(false);
  useEffect(() => setNome(campo.nome), [campo.nome]);
  const mudou = nome.trim() && nome.trim() !== campo.nome;

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <div className="flex flex-col">
        <button type="button" onClick={subir} disabled={primeiro} aria-label={`Subir ${campo.nome}`}
          className="px-1 text-tinta/50 hover:text-tinta disabled:opacity-25">▲</button>
        <button type="button" onClick={descer} disabled={ultimo} aria-label={`Descer ${campo.nome}`}
          className="px-1 text-tinta/50 hover:text-tinta disabled:opacity-25">▼</button>
      </div>
      <Entrada value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do campo" className="min-w-0 flex-1" />
      {mudou && (
        <Botao variante="secundario" title="Também muda o nome nos jogos que já usam este campo"
          onClick={() => executar(() => supabase.from('campos').update({ nome: nome.trim() }).eq('id', campo.id))}>
          Guardar nome
        </Botao>
      )}
      {apagar ? (
        <>
          <Botao variante="perigo" onClick={() => executar(() => supabase.from('campos').delete().eq('id', campo.id))}>
            Confirmar
          </Botao>
          <Botao variante="secundario" onClick={() => setApagar(false)}>Cancelar</Botao>
        </>
      ) : (
        <Botao variante="perigo" onClick={() => setApagar(true)} title="Os jogos já marcados mantêm o nome do campo">Apagar</Botao>
      )}
    </li>
  );
}
