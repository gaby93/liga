import type { ReactNode } from 'react';
import { fichaAnterior } from '../lib/fichas';
import type { FichaJogo } from '../lib/useFichaJogo';
import { Botao } from './ui';

/** Ficha de jogo de uma equipa: quem joga, com os suspensos bloqueados. */
export function FichaEquipa({ f, equipaId, semJogadores, fechada }: {
  f: FichaJogo;
  equipaId: string;
  /** O que mostrar quando a equipa não tem jogadores (ex.: link para os registar). */
  semJogadores: ReactNode;
  /** Motivo pelo qual a ficha só se pode ver (ex.: jogo terminado). */
  fechada?: string;
}) {
  const jogo = f.jogo!;
  const equipa = f.equipas.get(equipaId);
  const marcados = f.convocados(equipaId);
  // Plantel atual + convocados que já saíram da equipa
  const lista = f.jogadores.filter((j) => j.equipa_id === equipaId || marcados.has(j.id));
  const disponiveis = lista.filter((j) => j.equipa_id === equipaId && !f.motivoSuspensao.has(j.id)).map((j) => j.id);
  const anterior = fichaAnterior(f.jogosCompeticao, f.convocatorias, equipaId, jogo.id);
  const aCopiar = anterior?.jogadores.filter((jid) => disponiveis.includes(jid)) ?? [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{equipa?.nome}</h3>
        <span className="text-sm text-tinta/60">{marcados.size} convocados</span>
      </div>
      {fechada ? (
        <p className="mb-3 text-sm text-tinta/70">{fechada}</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          <Botao variante="secundario" disabled={!aCopiar.length} onClick={() => f.acrescentar(equipaId, aCopiar)}
            title={anterior ? 'Marca quem jogou no jogo anterior (sem os suspensos)' : 'Ainda não há ficha anterior desta equipa'}>
            Copiar do jogo anterior
          </Botao>
          <Botao variante="secundario" disabled={!disponiveis.length} onClick={() => f.acrescentar(equipaId, disponiveis)}>
            Todos os disponíveis
          </Botao>
          {marcados.size > 0 && <Botao variante="perigo" onClick={() => f.limpar(equipaId)}>Limpar</Botao>}
        </div>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-tinta/70">{semJogadores}</p>
      ) : (
        <ul className="divide-y divide-linha rounded-md border border-linha">
          {lista.map((j) => {
            const motivo = f.motivoSuspensao.get(j.id);
            const marcado = marcados.has(j.id);
            // Um suspenso não se pode convocar; se já estiver marcado, pode-se desmarcar
            const bloqueado = Boolean(fechada) || (Boolean(motivo) && !marcado);
            return (
              <li key={j.id}>
                <label className={`flex items-center gap-3 px-3 py-2 text-sm ${bloqueado ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-giz'} ${motivo && !marcado ? 'opacity-60' : ''}`}>
                  <input type="checkbox" className="h-4 w-4 accent-relva" checked={marcado} disabled={bloqueado}
                    onChange={(e) => f.alternar(j.id, equipaId, e.target.checked)} />
                  <span className="w-6 text-right font-display text-base font-semibold text-relva">{j.numero ?? ''}</span>
                  <span className="flex-1">{j.nome}</span>
                  {motivo && <span className="text-xs font-medium text-vermelho">Suspenso: {motivo}</span>}
                  {j.equipa_id !== equipaId && <span className="text-xs text-tinta/60">já não está na equipa</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
