import { Link } from 'react-router-dom';
import { formatarData } from '../lib/datas';
import { rotuloAoVivo } from '../lib/aoVivo';
import { blocosDeJogos } from '../lib/formatos';
import type { Equipa, Jogo } from '../lib/types';
import { useAgora } from '../lib/useAgora';
import { Emblema } from './ui';

/** Jogo a decorrer: resultado e minuto, atualizados sozinhos. */
function PlacarAoVivo({ jogo }: { jogo: Jogo }) {
  const agora = useAgora(20000);
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="font-display text-2xl font-bold tabular-nums">{jogo.golos_casa ?? 0}–{jogo.golos_fora ?? 0}</span>
      <span className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-vermelho">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-vermelho" />
        Ao vivo · {rotuloAoVivo(jogo, agora)}
      </span>
    </span>
  );
}

export function Placar({ jogo }: { jogo: Jogo }) {
  if (jogo.estado === 'em_curso') return <PlacarAoVivo jogo={jogo} />;
  if (jogo.estado === 'adiado') return <span className="text-sm font-semibold text-vermelho">Adiado</span>;
  if (jogo.estado === 'wo_casa' || jogo.estado === 'wo_fora')
    return <span className="text-sm font-semibold">W.O.</span>;
  if (jogo.estado === 'terminado' && jogo.golos_casa != null)
    return (
      <span className="flex flex-col items-center leading-none">
        <span className="font-display text-2xl font-bold tabular-nums">{jogo.golos_casa}–{jogo.golos_fora}</span>
        {jogo.penaltis_casa != null && jogo.penaltis_fora != null && (
          <span className="mt-0.5 text-xs text-tinta/60" title="Desempate por penáltis">
            ({jogo.penaltis_casa}–{jogo.penaltis_fora} g.p.)
          </span>
        )}
      </span>
    );
  return <span className="text-sm text-tinta/50">vs</span>;
}


export function ListaJogos({ jogos, equipas, linkPara, linkEquipa, vazio = 'O calendário ainda não foi publicado.' }: {
  jogos: Jogo[];
  equipas: Map<string, Equipa>;
  /** Torna cada jogo num link (backoffice). */
  linkPara?: (j: Jogo) => string;
  /** Torna o nome de cada equipa num link (só quando o jogo não é link). */
  linkEquipa?: (equipaId: string) => string;
  vazio?: string;
}) {
  if (!jogos.length) return <p className="text-sm text-tinta/70">{vazio}</p>;


  const nomeEquipa = (id: string, alinhar: string) => {
    const nome = <span className={`truncate font-semibold ${alinhar}`}>{equipas.get(id)?.nome}</span>;
    return linkEquipa && !linkPara ? <Link to={linkEquipa(id)} className="min-w-0 truncate hover:text-relva hover:underline">{nome}</Link> : nome;
  };

  return (
    <div className="flex flex-col gap-6">
      {blocosDeJogos(jogos).map(({ titulo, jogos: lista }) => (
        <div key={titulo}>
          <h3 className="mb-2 font-display text-xl font-semibold">{titulo}</h3>
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
            {lista.map((j) => {
              const casa = equipas.get(j.casa_id);
              const fora = equipas.get(j.fora_id);
              const detalhes = [j.grupo && `Grupo ${j.grupo}`, formatarData(j.data_hora) ?? 'Data por marcar', j.campo]
                .filter(Boolean).join(', ');
              const conteudo = (
                <>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                      {nomeEquipa(j.casa_id, 'text-right')}
                      <Emblema url={casa?.emblema_url} nome={casa?.nome ?? '?'} tamanho={24} />
                    </div>
                    <div className="min-w-14 text-center"><Placar jogo={j} /></div>
                    <div className="flex min-w-0 items-center gap-2">
                      <Emblema url={fora?.emblema_url} nome={fora?.nome ?? '?'} tamanho={24} />
                      {nomeEquipa(j.fora_id, '')}
                    </div>
                  </div>
                  <p className="mt-1 text-center text-xs text-tinta/60">{detalhes}</p>
                </>
              );
              return (
                <li key={j.id}>
                  {linkPara ? (
                    <Link to={linkPara(j)} className="block px-3 py-3 hover:bg-giz focus-visible:outline-2 focus-visible:outline-relva">{conteudo}</Link>
                  ) : (
                    <div className="px-3 py-3">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
