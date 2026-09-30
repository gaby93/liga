import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Aviso, Carregando, Emblema, Seccao } from '../../componentes/ui';
import { rotuloAoVivo } from '../../lib/aoVivo';
import { nomeFase } from '../../lib/formatos';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Equipa, Jogo } from '../../lib/types';
import { useAgora } from '../../lib/useAgora';

type JogoLista = Jogo & { competicao: { nome: string } | null };

/** Atalho para o dia de jogo: os jogos a decorrer e os de hoje, de todas as competições. */
export default function NoCampo() {
  const agora = useAgora(15000);
  const [jogos, setJogos] = useState<JogoLista[] | null>(null);
  const [equipas, setEquipas] = useState<Map<string, Equipa>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio); fim.setDate(fim.getDate() + 1);
    const campos = '*, competicao:competicoes(nome)';
    Promise.all([
      supabase.from('jogos').select(campos).eq('estado', 'em_curso'),
      supabase.from('jogos').select(campos).in('estado', ['agendado', 'terminado'])
        .gte('data_hora', inicio.toISOString()).lt('data_hora', fim.toISOString()),
    ]).then(async ([a, b]) => {
      if (a.error || b.error) return setErro(mensagemErro(a.error ?? b.error));
      const lista = [...(a.data ?? []), ...(b.data ?? [])] as JogoLista[];
      lista.sort((x, y) => (x.estado === 'em_curso' ? -1 : 0) - (y.estado === 'em_curso' ? -1 : 0)
        || (x.data_hora ?? '').localeCompare(y.data_hora ?? ''));
      const ids = [...new Set(lista.flatMap((j) => [j.casa_id, j.fora_id]))];
      const e = ids.length ? await supabase.from('equipas').select('*').in('id', ids) : { data: [] };
      setEquipas(new Map(((e.data ?? []) as Equipa[]).map((x) => [x.id, x])));
      setJogos(lista);
    });
  }, []);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!jogos) return <Carregando />;

  return (
    <Seccao titulo="No campo">
      <p className="mb-4 text-sm text-tinta/70">
        Jogos a decorrer e jogos de hoje. Toque num jogo para lançar golos e cartões à medida que acontecem.
      </p>
      {jogos.length === 0 ? (
        <p className="text-sm text-tinta/70">
          Não há jogos hoje. Para outro jogo, abra-o na competição e escolha <strong>Modo jogo</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-linha">
          {jogos.map((j) => {
            const casa = equipas.get(j.casa_id);
            const fora = equipas.get(j.fora_id);
            const aoVivo = j.estado === 'em_curso';
            return (
              <li key={j.id}>
                <Link to={`/admin/jogos/${j.id}/campo`} className="flex items-center gap-3 py-3 hover:bg-giz">
                  <div className="flex w-14 shrink-0 flex-col items-center text-xs">
                    {aoVivo
                      ? <span className="rounded-full bg-vermelho px-2 py-0.5 font-semibold text-white">{rotuloAoVivo(j, agora)}</span>
                      : <span className="font-semibold">{j.data_hora ? new Date(j.data_hora).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Emblema url={casa?.emblema_url} nome={casa?.nome ?? '?'} tamanho={20} />
                      <span className="truncate">{casa?.nome}</span>
                      {(aoVivo || j.estado === 'terminado') && <span className="tabular-nums">{j.golos_casa ?? 0}–{j.golos_fora ?? 0}</span>}
                      <span className="truncate">{fora?.nome}</span>
                      <Emblema url={fora?.emblema_url} nome={fora?.nome ?? '?'} tamanho={20} />
                    </div>
                    <div className="truncate text-xs text-tinta/60">
                      {[j.competicao?.nome, nomeFase(j), j.campo, j.estado === 'terminado' && 'Terminado'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span aria-hidden className="text-xl text-tinta/40">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Seccao>
  );
}
