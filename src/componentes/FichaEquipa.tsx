import type { ReactNode } from 'react';
import { fichaAnterior } from '../lib/fichas';
import { contarVeteranos, idade } from '../lib/inscricoes';
import type { FichaJogo } from '../lib/useFichaJogo';
import { Aviso, Botao } from './ui';

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

  // Veteranos: idade no dia do jogo (ou hoje, se ainda não tem data)
  const regra = f.competicao;
  const diaJogo = jogo.data_hora ?? new Date();
  const idadeVet = regra?.idade_veterano ?? 32;
  const minimo = regra?.min_veteranos ?? 0;
  const eVeterano = (id: string) => { const d = f.datasNasc.get(id); return Boolean(d) && idade(d!, diaJogo) >= idadeVet; };
  // Só se conta quando se conhecem as datas desta equipa (o responsável não vê as do adversário)
  const conheceDatas = lista.some((j) => f.datasNasc.has(j.id));
  const vet = contarVeteranos([...marcados], f.datasNasc, idadeVet, diaJogo);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{equipa?.nome}</h3>
        <span className="text-sm text-tinta/60">
          {marcados.size} convocados{conheceDatas && minimo > 0 ? ` · ${vet.veteranos} veteranos (mín. ${minimo})` : ''}
        </span>
      </div>
      {conheceDatas && minimo > 0 && marcados.size > 0 && vet.veteranos < minimo && (
        <div className="mb-3">
          <Aviso>
            Faltam veteranos: a ficha tem {vet.veteranos} {vet.veteranos === 1 ? 'jogador' : 'jogadores'} com {idadeVet} anos ou mais, e o mínimo é {minimo}.
            {vet.semData > 0 && ` ${vet.semData} convocado${vet.semData === 1 ? '' : 's'} sem data de nascimento não conta${vet.semData === 1 ? '' : 'm'}.`}
          </Aviso>
        </div>
      )}
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
                  {conheceDatas && eVeterano(j.id) && <span className="rounded-full bg-relva/10 px-2 py-0.5 text-xs font-medium text-relva">Veterano</span>}
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
