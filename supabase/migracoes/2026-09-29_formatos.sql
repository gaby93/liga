-- =========================================================
-- Migração 2026-09-29 (2.ª): formatos de competição (grupos e eliminatórias)
-- Executar DEPOIS de 2026-09-29_calendario_suspensoes.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
-- =========================================================

alter table public.competicoes
  add column if not exists formato text not null default 'liga'
    check (formato in ('liga', 'grupos', 'eliminatorias')),
  add column if not exists num_grupos int not null default 2 check (num_grupos between 1 and 16),
  add column if not exists apurados_por_grupo int not null default 2 check (apurados_por_grupo >= 1);

alter table public.participantes
  add column if not exists grupo text,
  add column if not exists posicao_quadro int;

alter table public.jogos
  add column if not exists grupo text,
  add column if not exists eliminatoria int check (eliminatoria >= 2),
  add column if not exists chave int check (chave >= 0),
  add column if not exists penaltis_casa int check (penaltis_casa >= 0),
  add column if not exists penaltis_fora int check (penaltis_fora >= 0);

alter table public.jogos drop constraint if exists jogos_eliminatoria_chave_check;
alter table public.jogos add constraint jogos_eliminatoria_chave_check
  check ((eliminatoria is null) = (chave is null));
create unique index if not exists jogos_competicao_eliminatoria_chave_idx
  on public.jogos (competicao_id, eliminatoria, chave);

-- A função ganha parâmetros: remove-se a versão antiga para não ficarem duas
drop function if exists public.gerar_calendario(uuid, jsonb);

-- p_quadro: [{equipa_id, posicao}] com o quadro da fase final (null = sem quadro).
-- p_so_fase_final: substitui só os jogos a eliminar, mantendo os da fase de grupos.
create or replace function public.gerar_calendario(
  p_competicao uuid, p_jogos jsonb, p_quadro jsonb default null, p_so_fase_final boolean default false)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para gerar o calendário' using errcode = '42501';
  end if;
  delete from public.jogos
   where competicao_id = p_competicao and (not p_so_fase_final or eliminatoria is not null);

  update public.participantes set posicao_quadro = null where competicao_id = p_competicao;
  if p_quadro is not null then
    update public.participantes p set posicao_quadro = q.posicao
      from jsonb_to_recordset(p_quadro) as q(equipa_id uuid, posicao int)
     where p.competicao_id = p_competicao and p.equipa_id = q.equipa_id;
  end if;

  insert into public.jogos (competicao_id, jornada, casa_id, fora_id, data_hora, campo, grupo, eliminatoria, chave)
  select p_competicao, j.jornada, j.casa_id, j.fora_id, j.data_hora, nullif(j.campo, ''),
         nullif(j.grupo, ''), j.eliminatoria, j.chave
  from jsonb_to_recordset(p_jogos) as j(jornada int, casa_id uuid, fora_id uuid, data_hora timestamptz,
                                         campo text, grupo text, eliminatoria int, chave int);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.gerar_calendario(uuid, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.gerar_calendario(uuid, jsonb, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
