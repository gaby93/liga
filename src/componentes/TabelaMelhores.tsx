import { Link } from 'react-router-dom';
import type { LinhaMelhor } from '../lib/formatos';
import type { Equipa } from '../lib/types';
import { Emblema } from './ui';

/** Ranking entre grupos dos classificados logo abaixo dos apurados (ex.: melhores terceiros). */
export function TabelaMelhores({ linhas, posicao, equipas, linkEquipa, desigual }: {
  linhas: { linha: LinhaMelhor; apurado: boolean }[];
  /** Posição no grupo destes candidatos (3 = terceiros). */
  posicao: number;
  equipas: Map<string, Equipa>;
  linkEquipa?: (equipaId: string) => string;
  /** Os grupos têm tamanhos diferentes (há jogos descontados). */
  desigual: boolean;
}) {
  if (!linhas.length) return null;
  const num = 'px-2 py-2.5 text-center tabular-nums';
  return (
    <section>
      <h2 className="mb-2 font-display text-3xl font-semibold">Melhores {posicao}.º classificados</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-tinta text-xs text-tinta/60">
              <th className="w-8 py-2 text-left font-medium"><span className="sr-only">Posição</span></th>
              <th className="py-2 text-left font-medium">Equipa</th>
              <th className={num} title="Grupo">Gr.</th>
              <th className={num} title="Diferença de golos">DG</th>
              <th className={num} title="Golos marcados">GM</th>
              <th className={`${num} font-semibold text-tinta`}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ linha, apurado }, i) => {
              const eq = equipas.get(linha.equipaId);
              const ultimoApurado = apurado && !linhas[i + 1]?.apurado;
              return (
                <tr key={linha.equipaId}
                  className={`border-b ${ultimoApurado ? 'border-b-2 border-relva/60' : 'border-linha'} ${apurado ? '' : 'text-tinta/60'}`}>
                  <td className="py-2.5 font-display text-xl font-semibold text-relva">{i + 1}</td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <Emblema url={eq?.emblema_url} nome={linha.nome} tamanho={22} />
                      {linkEquipa
                        ? <Link to={linkEquipa(linha.equipaId)} className="truncate font-semibold hover:text-relva hover:underline">{linha.nome}</Link>
                        : <span className="truncate font-semibold">{linha.nome}</span>}
                    </span>
                  </td>
                  <td className={num}>{linha.grupo}</td>
                  <td className={num}>{linha.dg > 0 ? `+${linha.dg}` : linha.dg}</td>
                  <td className={num}>{linha.gm}</td>
                  <td className={`${num} font-display text-lg font-bold`}>{linha.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-tinta/60">
        Acima da linha verde: apurados. Desempate por pontos, diferença de golos, golos marcados, vitórias, fair play e sorteio.
        {desigual && ' Como os grupos têm tamanhos diferentes, não contam os jogos contra os últimos dos grupos maiores.'}
      </p>
    </section>
  );
}
