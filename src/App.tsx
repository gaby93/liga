import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { configurado } from './lib/supabase';
import AdminLayout from './paginas/admin/Layout';
import CompeticaoDetalhe from './paginas/admin/CompeticaoDetalhe';
import Competicoes from './paginas/admin/Competicoes';
import Equipas from './paginas/admin/Equipas';
import JogoFicha from './paginas/admin/JogoFicha';
import Jogadores from './paginas/admin/Jogadores';
import Login from './paginas/admin/Login';
import Inicio from './paginas/publico/Inicio';
import PublicoLayout from './paginas/publico/Layout';
import {
  PaginaEquipa, PaginaFaseFinal, PaginaJogador, PaginaJogos, PaginaMarcadores, PaginaTabela,
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
        <Route path="/c/:id" element={<PublicoLayout />}>
          <Route index element={<PaginaTabela />} />
          <Route path="jogos" element={<PaginaJogos />} />
          <Route path="marcadores" element={<PaginaMarcadores />} />
          <Route path="fase-final" element={<PaginaFaseFinal />} />
          <Route path="equipas/:equipaId" element={<PaginaEquipa />} />
          <Route path="jogadores/:jogadorId" element={<PaginaJogador />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="competicoes" replace />} />
          <Route path="competicoes" element={<Competicoes />} />
          <Route path="competicoes/:id" element={<CompeticaoDetalhe />} />
          <Route path="equipas" element={<Equipas />} />
          <Route path="jogadores" element={<Jogadores />} />
          <Route path="jogos/:id" element={<JogoFicha />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
