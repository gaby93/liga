import { useState, type FormEvent } from 'react';
import { regrasDaEquipa, verificarInscricao, type RegrasCompeticao } from '../lib/inscricoes';
import { mensagemErro, supabase } from '../lib/supabase';
import type { Equipa, Jogador, JogadorPrivado } from '../lib/types';
import { Aviso, Botao, Campo, Entrada, Seccao, Seletor } from './ui';

/**
 * Pode este jogador ficar nesta equipa? Verifica o limite de inscritos e a idade
 * mínima das competições (não terminadas) em que a equipa participa.
 */
async function motivoParaRecusar(equipaId: string, nomeEquipa: string, jogadorId: string | undefined, entraNaEquipa: boolean, dataNasc: string) {
  const [p, n] = await Promise.all([
    supabase.from('participantes')
      .select('competicao:competicoes(nome, estado, max_jogadores, idade_minima, idade_veterano, min_veteranos)')
      .eq('equipa_id', equipaId),
    (() => {
      let q = supabase.from('jogadores').select('id', { count: 'exact', head: true }).eq('equipa_id', equipaId);
      if (jogadorId) q = q.neq('id', jogadorId);
      return q;
    })(),
  ]);
  if (p.error) throw p.error;
  if (n.error) throw n.error;
  const competicoes = ((p.data ?? []) as unknown as { competicao: RegrasCompeticao | null }[])
    .map((x) => x.competicao).filter((c): c is RegrasCompeticao => Boolean(c));
  return verificarInscricao({ regras: regrasDaEquipa(competicoes), inscritos: n.count ?? 0, entraNaEquipa, equipa: nomeEquipa, dataNasc });
}

export type EdicaoJogador = Partial<Jogador> & Partial<Omit<JogadorPrivado, 'jogador_id'>>;

/** Dados de um jogador para editar: os públicos mais os pessoais (só admin e responsável os leem). */
export async function abrirJogador(j: Jogador): Promise<EdicaoJogador> {
  const { data } = await supabase.from('jogadores_privado').select('*').eq('jogador_id', j.id).maybeSingle();
  return { ...j, ...(data ?? {}) };
}

/**
 * Formulário de jogador. No backoffice escolhe-se a equipa e a suspensão manual;
 * na área da equipa, a equipa é fixa e a suspensão não aparece (é decisão da organização).
 */
export function FormularioJogador({ inicial, equipas, equipaFixa, organizacaoId, comSuspensao, onGuardado, onCancelar }: {
  inicial: EdicaoJogador;
  /** Equipas à escolha (backoffice). */
  equipas: Equipa[];
  /** Área da equipa: o jogador fica sempre nesta equipa e o campo não aparece. */
  equipaFixa?: string;
  /** Organização do jogador sem equipa (com equipa, a base de dados usa a da equipa). */
  organizacaoId?: string;
  comSuspensao: boolean;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [edicao, setEdicao] = useState<EdicaoJogador>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!equipaFixa && !edicao.equipa_id) { setErro('Escolha a equipa do jogador.'); return; }
    if (!edicao.data_nasc) { setErro('Indique a data de nascimento.'); return; }
    setAGuardar(true);
    try {
      const equipaId = (equipaFixa ?? edicao.equipa_id)!;
      const nomeEquipa = equipas.find((e) => e.id === equipaId)?.nome ?? 'A equipa';
      const recusa = await motivoParaRecusar(equipaId, nomeEquipa, edicao.id, !edicao.id || inicial.equipa_id !== equipaId, edicao.data_nasc);
      if (recusa) { setErro(recusa); return; }
      const publico = {
        nome: edicao.nome!.trim(),
        equipa_id: equipaFixa ?? (edicao.equipa_id || null),
        ...(organizacaoId ? { organizacao_id: organizacaoId } : {}),
        numero: edicao.numero ?? null,
        // Só se envia "suspenso" quando o formulário o mostra (admin)
        ...(comSuspensao ? { suspenso: Boolean(edicao.suspenso) } : {}),
      };
      let id = edicao.id;
      if (id) {
        const { error } = await supabase.from('jogadores').update(publico).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('jogadores').insert(publico).select('id').single();
        if (error) throw error;
        id = data.id as string;
      }
      const { error } = await supabase.from('jogadores_privado').upsert({
        jogador_id: id,
        data_nasc: edicao.data_nasc || null,
        documento: edicao.documento || null,
        contacto: edicao.contacto || null,
      });
      if (error) throw error;
      onGuardado();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setAGuardar(false);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Seccao titulo={edicao.id ? `Editar ${inicial.nome}` : 'Novo jogador'}>
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome">
          <Entrada required value={edicao.nome ?? ''} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
        </Campo>
        {!equipaFixa && (
          <Campo rotulo="Equipa" ajuda={equipas.length ? undefined : 'Crie primeiro as equipas, em Equipas.'}>
            <Seletor required value={edicao.equipa_id ?? ''} onChange={(e) => setEdicao({ ...edicao, equipa_id: e.target.value || null })}>
              <option value="" disabled>Escolha a equipa</option>
              {equipas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Seletor>
          </Campo>
        )}
        <Campo rotulo="Número da camisola">
          <Entrada type="number" min={0} max={99} value={edicao.numero ?? ''}
            onChange={(e) => setEdicao({ ...edicao, numero: e.target.value === '' ? null : Number(e.target.value) })} />
        </Campo>
        <Campo rotulo="Data de nascimento" ajuda="Obrigatória. Não aparece no portal público.">
          <Entrada type="date" required min="1940-01-01" max={hoje} value={edicao.data_nasc ?? ''}
            onChange={(e) => setEdicao({ ...edicao, data_nasc: e.target.value })} />
        </Campo>
        <Campo rotulo="Documento (BI ou passaporte)" ajuda="Não aparece no portal público.">
          <Entrada value={edicao.documento ?? ''} onChange={(e) => setEdicao({ ...edicao, documento: e.target.value })} />
        </Campo>
        <Campo rotulo="Contacto" ajuda="Não aparece no portal público.">
          <Entrada type="tel" value={edicao.contacto ?? ''} onChange={(e) => setEdicao({ ...edicao, contacto: e.target.value })} />
        </Campo>
        {comSuspensao && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-relva" checked={Boolean(edicao.suspenso)}
              onChange={(e) => setEdicao({ ...edicao, suspenso: e.target.checked })} />
            Suspenso por decisão da organização (as suspensões por cartões são automáticas)
          </label>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Botao type="submit" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar jogador'}</Botao>
          <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao>
        </div>
      </form>
    </Seccao>
  );
}
