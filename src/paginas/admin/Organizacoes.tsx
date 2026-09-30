import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Aviso, Botao, Entrada, Seccao } from '../../componentes/ui';
import { useGestao } from '../../lib/gestao';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Organizacao } from '../../lib/types';

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Só o super admin: criar organizações (ligas) e atribuir quem as administra. */
export default function Organizacoes() {
  const g = useGestao();
  const [lista, setLista] = useState<Organizacao[]>([]);
  const [admins, setAdmins] = useState<{ organizacao_id: string; email: string }[]>([]);
  const [contagens, setContagens] = useState<Map<string, number>>(new Map());
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [o, a, c] = await Promise.all([
      supabase.from('organizacoes').select('id, nome').order('nome'),
      supabase.from('admins_organizacao').select('organizacao_id, email').order('email'),
      supabase.from('competicoes').select('organizacao_id'),
    ]);
    const falha = [o, a, c].find((r) => r.error);
    if (falha) return setErro(mensagemErro(falha.error));
    setLista(o.data as Organizacao[]);
    setAdmins(a.data as { organizacao_id: string; email: string }[]);
    const n = new Map<string, number>();
    for (const x of (c.data ?? []) as { organizacao_id: string }[]) n.set(x.organizacao_id, (n.get(x.organizacao_id) ?? 0) + 1);
    setContagens(n);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!g.super) return <Navigate to="/admin" replace />;

  const executar = async (acao: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await acao();
    if (error) { setErro(mensagemErro(error)); return false; }
    setErro(null);
    await Promise.all([carregar(), g.recarregar()]);
    return true;
  };

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nova.trim()) return;
    if (await executar(() => supabase.from('organizacoes').insert({ nome: nova.trim() }))) setNova('');
  };

  return (
    <Seccao titulo="Organizações">
      <p className="mb-4 text-sm text-tinta/70">
        Cada organização (liga) tem as suas competições, equipas e jogadores. Os administradores de uma organização só
        veem e gerem o que é dela. O portal público continua a mostrar todas as competições publicadas.
      </p>
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      <form onSubmit={criar} className="mb-6 flex flex-wrap gap-2">
        <Entrada value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nome da nova organização (ex.: Liga da Matola)"
          className="min-w-0 flex-1" aria-label="Nome da nova organização" />
        <Botao type="submit" disabled={!nova.trim()}>Criar organização</Botao>
      </form>
      <ul className="flex flex-col gap-4">
        {lista.map((o) => (
          <li key={o.id}>
            <CartaoOrganizacao org={o} competicoes={contagens.get(o.id) ?? 0}
              emails={admins.filter((a) => a.organizacao_id === o.id).map((a) => a.email)} executar={executar} />
          </li>
        ))}
      </ul>
    </Seccao>
  );
}

function CartaoOrganizacao({ org, competicoes, emails, executar }: {
  org: Organizacao; competicoes: number; emails: string[];
  executar: (acao: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(org.nome);
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const darAcesso = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(e)) return setAviso('Escreva um email válido.');
    setAviso(null);
    if (await executar(() => supabase.from('admins_organizacao').insert({ organizacao_id: org.id, email: e }))) setEmail('');
  };

  return (
    <div className="rounded-xl border border-linha p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da organização" className="min-w-0 flex-1 font-semibold" />
        {nome.trim() && nome.trim() !== org.nome && (
          <Botao variante="secundario" onClick={() => executar(() => supabase.from('organizacoes').update({ nome: nome.trim() }).eq('id', org.id))}>
            Guardar nome
          </Botao>
        )}
        <span className="text-sm text-tinta/60">{competicoes} {competicoes === 1 ? 'competição' : 'competições'}</span>
        {competicoes === 0 && (
          <Botao variante="perigo" onClick={() => executar(() => supabase.from('organizacoes').delete().eq('id', org.id))}>Apagar</Botao>
        )}
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-relva">Administradores</p>
      <p className="mb-2 text-xs text-tinta/60">
        Quem entrar com um destes emails, depois de o confirmar, gere esta organização. Se ainda não tiver conta, pode criá-la em /entrar.
      </p>
      {aviso && <div className="mb-2"><Aviso>{aviso}</Aviso></div>}
      {emails.length > 0 && (
        <ul className="mb-3 divide-y divide-linha text-sm">
          {emails.map((e) => (
            <li key={e} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 break-all">{e}</span>
              <Botao variante="perigo" onClick={() => executar(() =>
                supabase.from('admins_organizacao').delete().eq('organizacao_id', org.id).eq('email', e))}>
                Retirar acesso
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Entrada type="email" placeholder="email@exemplo.com" value={email} className="min-w-0 flex-1"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); darAcesso(); } }} />
        <Botao variante="secundario" onClick={darAcesso}>Dar acesso</Botao>
      </div>
    </div>
  );
}
