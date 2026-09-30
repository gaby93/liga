import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Guarda o pedido de instalação do browser desde o arranque
import './lib/instalar';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
