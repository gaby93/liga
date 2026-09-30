import { Link } from 'react-router-dom';
import { jogosAoVivoPorEquipa, minutoEParte, resultadoPara } from '../lib/aoVivo';
import type { Linha } from '../lib/classificacao';
import type { Equipa, Jogo } from '../lib/types';
import { useAgora } from '../lib/useAgora';
import { Emblema } from './ui';

const forma = {
  V: { cls: 'bg-relva', titulo: 'Vitória' },
  E: { cls: 'bg-tinta/30', titulo: 'Empate' },
  D: { cls: 'bg-vermelho', titulo: 'Derrota' },
};

/** "● A jogar: 2–1 contra UDM · 52' · 2.ª parte" por baixo do nome da equipa. */
function AJogar({ jogo, equipaId, equipas, link }: { jogo: Jogo; equipaId: string; equipas: Map<string, Equipa>; link?: string }) {
  const agora = useAgora(15000);
  const [meus, deles] = resultadoPara(jogo, equipaId);
  const adversario = equipas.get(jogo.casa_id === equipaId ? jogo.fora_id : jogo.casa_id)?.nome ?? 'adversário';
  const texto = (
    <>
      <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-vermelho ${jogo.periodo === 'intervalo' ? '' : 'animate-pulse'}`} />
      {/* Pode ocupar duas linhas: numa tabela, cortar com "…" alargaria a coluna e esconderia os pontos */}
      <span>
        A jogar: <span className="tabular-nums">{meus}–{deles}</span> contra {adversario}{' '}
        <span className="whitespace-nowrap">· {minutoEParte(jogo, agora)}</span>
      </span>
    </>
  );
  const cls = 'mt-0.5 flex items-start gap-1.5 text-xs font-semibold leading-snug text-vermelho';
  return link ? <Link to={link} className={`${cls} hover:underline`}>{texto}</Link> : <div className={cls}>{texto}</div>;
}

export function TabelaClassificacao({ linhas, equipas, linkEquipa, apurados = 0, jogos = [], linkJogo }: {
  linhas: Linha[];
  equipas: Map<string, Equipa>;
  linkEquipa?: (equipaId: string) => string;
  /** Quantas equipas passam à fase seguinte (ficam marcadas na tabela). */
  apurados?: number;
  /** Jogos da competição: as equipas com um jogo a decorrer ficam assinaladas. */
  jogos?: Jogo[];
  linkJogo?: (j: Jogo) => string;
}) {
  if (!linhas.length) return <p className="text-sm text-tinta/70">Ainda não há equipas inscritas nesta competição.</p>;
  const aJogar = jogosAoVivoPorEquipa(jogos);

  const num = 'px-1.5 py-3 text-center';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b-2 border-tinta text-xs text-tinta/60">
            <th className="w-10 py-2 pr-2 text-left font-medium"><span className="sr-only">Posição</span></th>
            <th className="py-2 text-left font-medium">Equipa</th>
            <th className={num} title="Jogos">J</th>
            <th className={`${num} hidden sm:table-cell`} title="Vitórias">V</th>
            <th className={`${num} hidden sm:table-cell`} title="Empates">E</th>
            <th className={`${num} hidden sm:table-cell`} title="Derrotas">D</th>
            <th className={`${num} hidden md:table-cell`} title="Golos marcados">GM</th>
            <th className={`${num} hidden md:table-cell`} title="Golos sofridos">GS</th>
            <th className={num} title="Diferença de golos">DG</th>
            <th className={`${num} font-semibold text-tinta`}>Pts</th>
            <th className="hidden py-2 pl-3 text-left font-medium lg:table-cell">Últimos jogos</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.equipaId} className={`border-b align-middle ${l.posicao === apurados ? 'border-b-2 border-relva/60' : 'border-linha'} ${aJogar.has(l.equipaId) ? 'bg-vermelho/5' : ''}`}
              title={l.posicao <= apurados ? 'Posição de apuramento' : undefined}>
              <td className="py-3 pr-2 font-display text-3xl font-semibold leading-none text-relva">{l.posicao}</td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <Emblema url={equipas.get(l.equipaId)?.emblema_url} nome={l.nome} />
                  <div className="min-w-0">
                    {linkEquipa
                      ? <Link to={linkEquipa(l.equipaId)} className="block truncate font-semibold hover:text-relva hover:underline">{l.nome}</Link>
                      : <div className="truncate font-semibold">{l.nome}</div>}
                    {aJogar.has(l.equipaId) && (
                      <AJogar jogo={aJogar.get(l.equipaId)!} equipaId={l.equipaId} equipas={equipas}
                        link={linkJogo?.(aJogar.get(l.equipaId)!)} />
                    )}
                    {l.motivo && <div className="text-xs text-tinta/60">Desempate: {l.motivo}</div>}
                    {l.sancao !== 0 && <div className="text-xs text-vermelho">{l.sancao} pts de sanção</div>}
                  </div>
                </div>
              </td>
              <td className={num}>{l.j}</td>
              <td className={`${num} hidden sm:table-cell`}>{l.v}</td>
              <td className={`${num} hidden sm:table-cell`}>{l.e}</td>
              <td className={`${num} hidden sm:table-cell`}>{l.d}</td>
              <td className={`${num} hidden md:table-cell`}>{l.gm}</td>
              <td className={`${num} hidden md:table-cell`}>{l.gs}</td>
              <td className={num}>{l.dg > 0 ? `+${l.dg}` : l.dg}</td>
              <td className={`${num} font-display text-xl font-bold`}>{l.pts}</td>
              <td className="hidden py-3 pl-3 lg:table-cell">
                <div className="flex gap-1">
                  {l.forma.map((r, i) => (
                    <span key={i} title={forma[r].titulo} className={`h-2.5 w-2.5 rounded-full ${forma[r].cls}`} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
