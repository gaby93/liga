import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Aviso, Botao, Campo, Emblema, Entrada, Seccao } from '../../componentes/ui';
import { carregarImagem } from '../../lib/imagens';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa } from '../../lib/types';

const nova: Partial<Equipa> = { nome: '', responsavel: '', contacto: '' };

export default function Equipas() {
  const [lista, setLista] = useState<Equipa[]>([]);
  const [edicao, setEdicao] = useState<Partial<Equipa> | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [responsaveis, setResponsaveis] = useState<{ equipa_id: string; email: string }[]>([]);
  const org = useGestao().atual!.id;

  // Só as equipas da organização escolhida
  const carregar = useCallback(async () => {
    const e = await supabase.from('equipas').select('*').eq('organizacao_id', org).order('nome');
    if (e.error) return setErro(mensagemErro(e.error));
    const ids = (e.data as Equipa[]).map((x) => x.id);
    const r = ids.length
      ? await supabase.from('responsaveis').select('equipa_id, email').in('equipa_id', ids).order('email')
      : { data: [], error: null };
    if (r.error) return setErro(mensagemErro(r.error));
    setLista(e.data as Equipa[]);
    setResponsaveis(r.data as { equipa_id: string; email: string }[]);
  }, [org]);
  const comAcesso = (equipaId: string) => responsaveis.filter((r) => r.equipa_id === equipaId).map((r) => r.email);
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
        : await supabase.from('equipas').insert({ ...dados, organizacao_id: org });
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
            {edicao.id && (
              <div className="sm:col-span-2">
                <AcessoResponsaveis equipaId={edicao.id} emails={comAcesso(edicao.id)} onMudou={carregar} />
              </div>
            )}
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
                  <div className="text-xs text-tinta/60">
                    {[e.responsavel, e.contacto].filter(Boolean).join(', ') || 'Sem responsável indicado'}
                    {comAcesso(e.id).length > 0 && ` · ${comAcesso(e.id).length} com acesso à área da equipa`}
                  </div>
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

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Emails com acesso à área da equipa (plantel e fichas de jogo). */
function AcessoResponsaveis({ equipaId, emails, onMudou }: { equipaId: string; emails: string[]; onMudou: () => void }) {
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await acao();
    if (error) return setErro(mensagemErro(error));
    setErro(null);
    setNovo('');
    onMudou();
  };
  const acrescentar = () => {
    const email = novo.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(email)) return setErro('Escreva um email válido.');
    executar(() => supabase.from('responsaveis').insert({ equipa_id: equipaId, email }));
  };

  return (
    <fieldset className="rounded-md border border-linha p-4">
      <legend className="px-1 text-sm font-semibold">Acesso à área da equipa</legend>
      <p className="mb-3 text-xs text-tinta/60">
        Quem entrar no site com um destes emails, depois de o confirmar, pode gerir o plantel e as fichas de jogo desta
        equipa. Não pode lançar resultados, golos, cartões nem suspensões. Peça-lhe para criar conta em /entrar com este email.
      </p>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {emails.length > 0 && (
        <ul className="mb-3 divide-y divide-linha text-sm">
          {emails.map((email) => (
            <li key={email} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 break-all">{email}</span>
              <Botao variante="perigo" onClick={() => executar(() =>
                supabase.from('responsaveis').delete().eq('equipa_id', equipaId).eq('email', email))}>
                Retirar acesso
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Entrada type="email" placeholder="email@exemplo.com" value={novo} className="min-w-0 flex-1"
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); acrescentar(); } }} />
        <Botao variante="secundario" onClick={acrescentar}>Dar acesso</Botao>
      </div>
    </fieldset>
  );
}
