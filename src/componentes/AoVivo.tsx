import { Link } from 'react-router-dom';
import { minutoEParte } from '../lib/aoVivo';
import type { Equipa, Jogo } from '../lib/types';
import { useAgora } from '../lib/useAgora';
import { Emblema } from './ui';

/** Etiqueta vermelha "Ao vivo · 23'" (ou "Intervalo"), atualizada sozinha. */
export function EtiquetaAoVivo({ jogo, grande = false }: { jogo: Jogo; grande?: boolean }) {
  const agora = useAgora(10000);
  const intervalo = jogo.periodo === 'intervalo';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ${
      grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'} ${intervalo ? 'bg-tinta/10 text-tinta' : 'bg-vermelho text-white'}`}>
      {!intervalo && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      {intervalo ? 'Intervalo' : `${grande ? 'Ao vivo · ' : ''}${minutoEParte(jogo, agora)}`}
    </span>
  );
}

/** Cartão de um jogo a decorrer: equipas, resultado e minuto. Abre a página do jogo. */
export function CartaoAoVivo({ jogo, casa, fora, para, contexto }: {
  jogo: Jogo; casa?: Equipa; fora?: Equipa; para: string; contexto?: string;
}) {
  return (
    <Link to={para} className="block rounded-lg border border-vermelho/30 bg-white px-3 py-2.5 shadow-sm hover:border-vermelho/60">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <EtiquetaAoVivo jogo={jogo} />
        {contexto && <span className="truncate text-xs text-tinta/60">{contexto}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate font-semibold">{casa?.nome}</span>
          <Emblema url={casa?.emblema_url} nome={casa?.nome ?? '?'} tamanho={24} />
        </span>
        <span className="px-1 font-display text-2xl font-bold tabular-nums">{jogo.golos_casa ?? 0}–{jogo.golos_fora ?? 0}</span>
        <span className="flex min-w-0 items-center gap-2">
          <Emblema url={fora?.emblema_url} nome={fora?.nome ?? '?'} tamanho={24} />
          <span className="truncate font-semibold">{fora?.nome}</span>
        </span>
      </div>
    </Link>
  );
}
