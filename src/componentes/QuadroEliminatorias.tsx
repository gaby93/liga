import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatarData } from '../lib/datas';
import { apurado, jogoNoQuadro, nomeEliminatoria, vencedor } from '../lib/formatos';
import type { Equipa, Jogo } from '../lib/types';
import { Emblema } from './ui';

interface Props {
  quadro: (string | null)[];
  jogos: Jogo[];
  equipas: Map<string, Equipa>;
  linkJogo?: (j: Jogo) => string;
  linkEquipa?: (equipaId: string) => string;
}

/** Quadro da fase final, uma coluna por ronda, da primeira até à final. */
export function QuadroEliminatorias({ quadro, jogos, equipas, linkJogo, linkEquipa }: Props) {
  if (quadro.length < 2) return null;

  const rondas: number[] = [];
  for (let e = quadro.length; e >= 2; e /= 2) rondas.push(e);
  const final = jogoNoQuadro(jogos, 2, 0);
  const campeao = final && vencedor(final);

  const linha = (equipaId: string | undefined, golos: ReactNode, ganhou: boolean) => {
    const eq = equipaId ? equipas.get(equipaId) : undefined;
    const nome = eq ? eq.nome : 'Por definir';
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${ganhou ? 'font-semibold' : eq ? '' : 'text-tinta/50'}`}>
        {eq && <Emblema url={eq.emblema_url} nome={eq.nome} tamanho={20} />}
        <span className="min-w-0 flex-1 truncate">
          {eq && linkEquipa && !linkJogo
            ? <Link to={linkEquipa(eq.id)} className="hover:text-relva hover:underline">{nome}</Link>
            : nome}
        </span>
        <span className="tabular-nums">{golos}</span>
      </div>
    );
  };

  const cartao = (e: number, c: number) => {
    const jogo = jogoNoQuadro(jogos, e, c);
    if (jogo) {
      const v = vencedor(jogo);
      const pen = jogo.penaltis_casa != null && jogo.penaltis_fora != null && jogo.estado === 'terminado';
      const golos = (g: number | null, p: number | null) =>
        jogo.estado === 'terminado' && g != null ? <>{g}{pen && <span className="text-xs text-tinta/60"> ({p})</span>}</>
          : jogo.estado.startsWith('wo') ? 'W.O.' : '';
      const corpo = (
        <>
          {linha(jogo.casa_id, golos(jogo.golos_casa, jogo.penaltis_casa), v === jogo.casa_id)}
          <div className="border-t border-linha" />
          {linha(jogo.fora_id, golos(jogo.golos_fora, jogo.penaltis_fora), v === jogo.fora_id)}
          {!v && (
            <div className="border-t border-linha px-2.5 py-1 text-xs text-tinta/60">
              {jogo.estado === 'adiado' ? 'Adiado' : formatarData(jogo.data_hora) ?? 'Data por marcar'}
            </div>
          )}
        </>
      );
      return linkJogo
        ? <Link to={linkJogo(jogo)} className="block rounded-md border border-linha bg-white hover:border-relva">{corpo}</Link>
        : <div className="rounded-md border border-linha bg-white">{corpo}</div>;
    }

    // Sem jogo: isenção (1.ª ronda) ou ronda ainda por gerar
    if (e === quadro.length) {
      const isento = quadro[2 * c] ?? quadro[2 * c + 1];
      return (
        <div className="rounded-md border border-dashed border-linha bg-white">
          {linha(isento ?? undefined, '', true)}
          <div className="border-t border-linha px-2.5 py-1 text-xs text-tinta/60">Isento, passa sem jogar</div>
        </div>
      );
    }
    return (
      <div className="rounded-md border border-dashed border-linha bg-white">
        {linha(apurado(jogos, quadro, e * 2, 2 * c), '', false)}
        <div className="border-t border-linha" />
        {linha(apurado(jogos, quadro, e * 2, 2 * c + 1), '', false)}
      </div>
    );
  };

  return (
    <div>
      {campeao && (
        <p className="mb-4 rounded-lg bg-relva px-4 py-3 font-display text-2xl font-semibold text-white">
          Campeão: {equipas.get(campeao)?.nome}
        </p>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {rondas.map((e) => (
            <section key={e} className="flex w-56 flex-col">
              <h3 className="mb-2 font-display text-lg font-semibold">{nomeEliminatoria(e)}</h3>
              <ol className="flex flex-1 flex-col justify-around gap-3">
                {Array.from({ length: e / 2 }, (_, c) => <li key={c}>{cartao(e, c)}</li>)}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
