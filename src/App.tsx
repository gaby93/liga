import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AvisosApp } from './componentes/AvisosApp';
import { configurado } from './lib/supabase';
import AdminLayout from './paginas/admin/Layout';
import CompeticaoDetalhe from './paginas/admin/CompeticaoDetalhe';
import Competicoes from './paginas/admin/Competicoes';
import Equipas from './paginas/admin/Equipas';
import JogoFicha from './paginas/admin/JogoFicha';
import ModoJogo from './paginas/admin/ModoJogo';
import NoCampo from './paginas/admin/NoCampo';
import Organizacoes from './paginas/admin/Organizacoes';
import Jogadores from './paginas/admin/Jogadores';
import Login from './paginas/admin/Login';
import NovaPalavraPasse from './paginas/admin/NovaPalavraPasse';
import Inicio from './paginas/publico/Inicio';
import Instalar from './paginas/publico/Instalar';
import PublicoLayout from './paginas/publico/Layout';
import AreaEquipa, { EscolherEquipa, FichaJogoEquipa, PainelEquipa } from './paginas/equipa/Area';
import {
  PaginaEquipa, PaginaFaseFinal, PaginaJogador, PaginaJogo, PaginaJogos, PaginaMarcadores, PaginaTabela,
} from './paginas/publico/Paginas';

export default function App() {
  if (!configurado)
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-3 font-display text-3xl font-bold">Falta ligar ao Supabase</h1>
        <p>Copie o ficheiro <code>.env.example</code> para <code>.env</code>, preencha o URL e a chave do projeto e reinicie com <code>npm run dev</code>.</p>
      </div>
    );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/instalar" element={<Instalar />} />
        <Route path="/c/:id" element={<PublicoLayout />}>
          <Route index element={<PaginaTabela />} />
          <Route path="jogos" element={<PaginaJogos />} />
          <Route path="jogos/:jogoId" element={<PaginaJogo />} />
          <Route path="marcadores" element={<PaginaMarcadores />} />
          <Route path="fase-final" element={<PaginaFaseFinal />} />
          <Route path="equipas/:equipaId" element={<PaginaEquipa />} />
          <Route path="jogadores/:jogadorId" element={<PaginaJogador />} />
        </Route>
        <Route path="/entrar" element={<Login />} />
        <Route path="/entrar/nova-palavra-passe" element={<NovaPalavraPasse />} />
        <Route path="/admin/login" element={<Navigate to="/entrar" replace />} />
        <Route path="/equipa" element={<AreaEquipa />}>
          <Route index element={<EscolherEquipa />} />
          <Route path=":equipaId" element={<PainelEquipa />} />
          <Route path=":equipaId/jogos/:jogoId" element={<FichaJogoEquipa />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="competicoes" replace />} />
          <Route path="competicoes" element={<Competicoes />} />
          <Route path="competicoes/:id" element={<CompeticaoDetalhe />} />
          <Route path="equipas" element={<Equipas />} />
          <Route path="jogadores" element={<Jogadores />} />
          <Route path="jogos/:id" element={<JogoFicha />} />
          <Route path="jogos/:id/campo" element={<ModoJogo />} />
          <Route path="campo" element={<NoCampo />} />
          <Route path="organizacoes" element={<Organizacoes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AvisosApp />
    </BrowserRouter>
  );
}
