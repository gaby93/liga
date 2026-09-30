import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo, Entrada } from '../../componentes/ui';
import { destinoDoPapel, obterPapel } from '../../lib/sessao';
import { supabase } from '../../lib/supabase';

type Modo = 'entrar' | 'criar' | 'recuperar';

const TITULO: Record<Modo, string> = { entrar: 'Entrar', criar: 'Criar conta', recuperar: 'Recuperar a palavra-passe' };

/** Entrada comum: administradores vão para a gestão, responsáveis para a área da equipa. */
export default function Login() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const navegar = useNavigate();

  const seguir = async () => {
    const papel = await obterPapel();
    const destino = destinoDoPapel(papel);
    if (destino) navegar(destino, { replace: true });
    else if (papel.tipo === 'sem_acesso') setSemAcesso(papel.email);
  };

  // Quem já tem sessão (ex.: volta do link de confirmação) segue logo
  useEffect(() => { seguir(); }, []);

  const mudar = (m: Modo) => { setModo(m); setErro(null); setInfo(null); };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setOcupado(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) {
          setErro(/confirm/i.test(error.message)
            ? 'Ainda não confirmou o email. Abra a mensagem que lhe enviámos e carregue no link.'
            : 'Email ou palavra-passe incorretos.');
          return;
        }
        await seguir();
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: senha, options: { emailRedirectTo: `${window.location.origin}/entrar` },
        });
        if (error) { setErro(error.message); return; }
        if (data.session) await seguir();
        else setInfo('Conta criada. Enviámos um email de confirmação: abra-o e carregue no link para ativar a conta.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/entrar/nova-palavra-passe`,
        });
        // O Supabase responde igual para emails com e sem conta, por isso um erro aqui é uma falha
        // verdadeira (limite de pedidos, sem rede) e mostrá-lo não revela que emails estão registados
        if (error) {
          setErro(/seconds|rate|limit/i.test(error.message)
            ? 'Já pediu um link há pouco. Espere um minuto e tente de novo.'
            : 'Não foi possível enviar o link agora. Verifique a ligação e tente de novo.');
          return;
        }
        // A mesma resposta com ou sem conta: a página não revela que emails estão registados
        setInfo('Se houver uma conta com este email, enviámos um link para escolher uma nova palavra-passe. '
          + 'Veja também a pasta de spam. O link é válido durante uma hora.');
      }
    } finally {
      setOcupado(false);
    }
  };

  const sair = async () => { await supabase.auth.signOut(); setSemAcesso(null); };

  return (
    <div className="relvado grid min-h-screen place-items-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
        {semAcesso ? (
          <>
            <h1 className="font-display text-3xl font-bold">Conta sem equipa</h1>
            <p className="text-sm">
              Entrou como <strong>{semAcesso}</strong>, mas este email ainda não está associado a nenhuma equipa.
              Peça à organização da liga para o registar como responsável da sua equipa e volte a entrar.
            </p>
            <Botao variante="secundario" onClick={sair}>Sair</Botao>
          </>
        ) : (
          <form onSubmit={submeter} className="flex flex-col gap-4">
            <h1 className="font-display text-3xl font-bold">{TITULO[modo]}</h1>
            {modo === 'criar' && (
              <p className="text-sm text-tinta/70">
                Para responsáveis de equipa. Use o email que deu à organização da liga.
              </p>
            )}
            {modo === 'recuperar' && (
              <p className="text-sm text-tinta/70">
                Escreva o email da sua conta. Enviamos um link para escolher uma nova palavra-passe.
              </p>
            )}
            {erro && <Aviso>{erro}</Aviso>}
            {info && <Aviso tipo="info">{info}</Aviso>}
            <Campo rotulo="Email">
              <Entrada type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            {modo !== 'recuperar' && (
              <Campo rotulo="Palavra-passe" ajuda={modo === 'criar' ? 'Pelo menos 8 caracteres.' : undefined}>
                <Entrada type="password" required minLength={modo === 'criar' ? 8 : undefined}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  value={senha} onChange={(e) => setSenha(e.target.value)} />
              </Campo>
            )}
            <Botao type="submit" disabled={ocupado}>
              {ocupado ? 'Um momento…' : modo === 'recuperar' ? 'Enviar o link' : TITULO[modo]}
            </Botao>
            {modo === 'entrar' && (
              <button type="button" className="text-sm text-tinta/70 hover:underline" onClick={() => mudar('recuperar')}>
                Esqueci-me da palavra-passe
              </button>
            )}
            <button type="button" className="text-sm font-semibold text-relva hover:underline"
              onClick={() => mudar(modo === 'entrar' ? 'criar' : 'entrar')}>
              {modo === 'entrar' ? 'É responsável de equipa e ainda não tem conta? Criar conta' : 'Voltar a entrar'}
            </button>
          </form>
        )}
        <Link to="/" className="text-center text-sm text-tinta/60 hover:underline">Voltar ao portal</Link>
      </div>
    </div>
  );
}
