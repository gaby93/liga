import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo, Carregando, Entrada, Marca } from '../../componentes/ui';
import { destinoDoPapel, obterPapel } from '../../lib/sessao';
import { supabase } from '../../lib/supabase';

/**
 * Escolher uma nova palavra-passe. Serve para quem chega pelo link de
 * recuperação (o Supabase abre a sessão a partir do link) e para quem já
 * tem sessão e a quer mudar.
 */
export default function NovaPalavraPasse() {
  const [estado, setEstado] = useState<'a_verificar' | 'pronto' | 'sem_sessao'>('a_verificar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const navegar = useNavigate();

  useEffect(() => {
    let ativo = true;
    const ver = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!ativo) return;
      if (session) { setEmail(session.user.email ?? ''); setEstado('pronto'); }
    };
    // O link de recuperação é lido pelo Supabase ao abrir a página; quando termina, avisa aqui
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!ativo || !session) return;
      if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') {
        setEmail(session.user.email ?? '');
        setEstado('pronto');
      }
    });
    ver();
    // Sem sessão ao fim de uns segundos: o link expirou ou já foi usado
    const t = setTimeout(() => { if (ativo) setEstado((e) => (e === 'a_verificar' ? 'sem_sessao' : e)); }, 4000);
    return () => { ativo = false; clearTimeout(t); data.subscription.unsubscribe(); };
  }, []);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro('A palavra-passe precisa de pelo menos 8 caracteres.');
    if (senha !== repetir) return setErro('As duas palavras-passe não são iguais.');
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) {
      setErro(/different|same/i.test(error.message)
        ? 'A nova palavra-passe tem de ser diferente da anterior.'
        : 'Não foi possível mudar a palavra-passe. Peça um link novo e tente outra vez.');
      return;
    }
    setFeito(true);
  };

  const continuar = async () => {
    const destino = destinoDoPapel(await obterPapel());
    navegar(destino ?? '/entrar', { replace: true });
  };

  return (
    <div className="faixa flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <Link to="/" className="hover:opacity-80"><Marca clara /></Link>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Nova palavra-passe</h1>
        {estado === 'a_verificar' && <Carregando />}
        {estado === 'sem_sessao' && (
          <>
            <Aviso>Este link já não é válido (expira ao fim de uma hora e só se pode usar uma vez).</Aviso>
            <Link to="/entrar" className="text-center text-sm font-semibold text-relva hover:underline">Pedir um link novo</Link>
          </>
        )}
        {estado === 'pronto' && (feito ? (
          <>
            <Aviso tipo="info">Palavra-passe mudada. Da próxima vez, entre com a nova.</Aviso>
            <Botao onClick={continuar}>Continuar</Botao>
          </>
        ) : (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            {email && <p className="text-sm text-tinta/70">Conta: <strong>{email}</strong></p>}
            {erro && <Aviso>{erro}</Aviso>}
            <Campo rotulo="Nova palavra-passe" ajuda="Pelo menos 8 caracteres.">
              <Entrada type="password" autoComplete="new-password" required minLength={8}
                value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            <Campo rotulo="Repetir a nova palavra-passe">
              <Entrada type="password" autoComplete="new-password" required minLength={8}
                value={repetir} onChange={(e) => setRepetir(e.target.value)} />
            </Campo>
            <Botao type="submit" disabled={ocupado}>{ocupado ? 'A guardar…' : 'Guardar palavra-passe'}</Botao>
          </form>
        ))}
        <Link to="/" className="text-center text-sm text-tinta/60 hover:underline">Voltar ao portal</Link>
      </div>
    </div>
  );
}
