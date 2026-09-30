import { Link } from 'react-router-dom';
import { formatarData } from '../lib/datas';
import { CHAVE_TERCEIRO, apurado, decidirEliminatoria, jogosDaChave, nomeEliminatoria } from '../lib/formatos';
import type { Equipa, Jogo } from '../lib/types';
import { Emblema } from './ui';

interface Props {
  quadro: (string | null)[];
  jogos: Jogo[];
  equipas: Map<string, Equipa>;
  /** Golos de um W.O. (contam no agregado das duas mãos). */
  golosWO: number;
  linkJogo?: (j: Jogo) => string;
  linkEquipa?: (equipaId: string) => string;
}

/** Quadro da fase final, uma coluna por ronda, da primeira até à final (e o 3.º lugar). */
export function QuadroEliminatorias({ quadro, jogos, equipas, golosWO, linkJogo, linkEquipa }: Props) {
  if (quadro.length < 2) return null;

  const rondas: number[] = [];
  for (let e = quadro.length; e >= 2; e /= 2) rondas.push(e);
  const campeao = decidirEliminatoria(jogosDaChave(jogos, 2, 0), golosWO).vencedor;
  const terceiro = jogosDaChave(jogos, 2, CHAVE_TERCEIRO);

  const nome = (equipaId: string | undefined) => {
    const eq = equipaId ? equipas.get(equipaId) : undefined;
    if (!eq) return <span className="text-tinta/50">Por definir</span>;
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Emblema url={eq.emblema_url} nome={eq.nome} tamanho={20} />
        {linkEquipa && !linkJogo
          ? <Link to={linkEquipa(eq.id)} className="truncate hover:text-relva hover:underline">{eq.nome}</Link>
          : <span className="truncate">{eq.nome}</span>}
      </span>
    );
  };

  /** Golos de uma equipa num jogo, como aparecem no quadro. */
  const golos = (j: Jogo, equipaId: string) => {
    if (j.estado === 'wo_casa' || j.estado === 'wo_fora') return 'W.O.';
    if ((j.estado !== 'terminado' && j.estado !== 'em_curso') || j.golos_casa == null) return '';
    return String(j.casa_id === equipaId ? j.golos_casa : j.golos_fora);
  };

  const cartao = (e: number, c: number) => {
    const maos = jogosDaChave(jogos, e, c);
    if (maos.length) {
      const d = decidirEliminatoria(maos, golosWO);
      const ultima = maos[maos.length - 1];
      // A melhor semente primeiro: em casa no jogo único e na 2.ª mão
      const equipasDaChave = [ultima.casa_id, ultima.fora_id];
      const pen = ultima.penaltis_casa != null && ultima.penaltis_fora != null && d.empate;
      const porJogar = maos.find((j) => j.estado === 'agendado' || j.estado === 'adiado');

      const corpo = (
        <>
          {equipasDaChave.map((id, i) => (
            <div key={id}>
              {i > 0 && <div className="border-t border-linha" />}
              <div className={`flex items-center gap-2 px-2.5 py-1.5 ${d.vencedor === id ? 'font-semibold' : ''}`}>
                <span className="min-w-0 flex-1">{nome(id)}</span>
                {maos.map((j) => <span key={j.id} className="w-7 text-right tabular-nums">{golos(j, id)}</span>)}
                {pen && (
                  <span className="text-xs text-tinta/60">
                    ({ultima.casa_id === id ? ultima.penaltis_casa : ultima.penaltis_fora})
                  </span>
                )}
              </div>
            </div>
          ))}
          {(!d.vencedor || maos.length > 1) && (
            <div className="flex flex-wrap gap-x-3 border-t border-linha px-2.5 py-1 text-xs text-tinta/60">
              {maos.length > 1 && linkJogo
                ? maos.map((j) => (
                  <Link key={j.id} to={linkJogo(j)} className="font-semibold text-relva hover:underline">{j.mao}.ª mão</Link>
                ))
                : maos.length > 1 && <span>Duas mãos{d.agregado ? `, agregado ${d.agregado.get(equipasDaChave[0])}–${d.agregado.get(equipasDaChave[1])}` : ''}</span>}
              {porJogar && !d.vencedor && (
                <span>{porJogar.estado === 'adiado' ? 'Adiado' : formatarData(porJogar.data_hora) ?? 'Data por marcar'}</span>
              )}
            </div>
          )}
        </>
      );
      return linkJogo && maos.length === 1
        ? <Link to={linkJogo(maos[0])} className="block rounded-md border border-linha bg-white hover:border-relva">{corpo}</Link>
        : <div className="rounded-md border border-linha bg-white">{corpo}</div>;
    }

    // Sem jogo: isenção (1.ª ronda) ou ronda ainda por gerar
    const vazio = (a: string | undefined, b: string | undefined, nota?: string) => (
      <div className="rounded-md border border-dashed border-linha bg-white">
        <div className="px-2.5 py-1.5">{nome(a)}</div>
        {!nota && <><div className="border-t border-linha" /><div className="px-2.5 py-1.5">{nome(b)}</div></>}
        {nota && <div className="border-t border-linha px-2.5 py-1 text-xs text-tinta/60">{nota}</div>}
      </div>
    );
    if (e === quadro.length) return vazio(quadro[2 * c] ?? quadro[2 * c + 1] ?? undefined, undefined, 'Isento, passa sem jogar');
    return vazio(apurado(jogos, quadro, e * 2, 2 * c, golosWO), apurado(jogos, quadro, e * 2, 2 * c + 1, golosWO));
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
            <section key={e} className="flex w-60 flex-col">
              <h3 className="mb-2 font-display text-lg font-semibold">{nomeEliminatoria(e)}</h3>
              <ol className="flex flex-1 flex-col justify-around gap-3">
                {Array.from({ length: e / 2 }, (_, c) => <li key={c}>{cartao(e, c)}</li>)}
              </ol>
              {e === 2 && terceiro.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 font-display text-lg font-semibold">3.º lugar</h3>
                  {cartao(2, CHAVE_TERCEIRO)}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
