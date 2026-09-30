import { useEffect, useState } from 'react';

/** Hora atual, atualizada de `intervalo` em `intervalo` ms (para relógios no ecrã). */
export function useAgora(intervalo = 15000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo);
    // Ao voltar à app (ecrã desbloqueado), acerta logo
    const visivel = () => { if (document.visibilityState === 'visible') setAgora(Date.now()); };
    document.addEventListener('visibilitychange', visivel);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', visivel); };
  }, [intervalo]);
  return agora;
}
