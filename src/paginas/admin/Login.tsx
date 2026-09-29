import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo, Entrada } from '../../componentes/ui';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);
  const navegar = useNavigate();

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setAEntrar(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setAEntrar(false);
    if (error) setErro('Email ou palavra-passe incorretos.');
    else navegar('/admin');
  };

  return (
    <div className="relvado grid min-h-screen place-items-center px-4">
      <form onSubmit={entrar} className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
        <h1 className="font-display text-3xl font-bold">Entrar na gestão</h1>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Email">
          <Entrada type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Palavra-passe">
          <Entrada type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Botao type="submit" disabled={aEntrar}>{aEntrar ? 'A entrar…' : 'Entrar'}</Botao>
      </form>
    </div>
  );
}
