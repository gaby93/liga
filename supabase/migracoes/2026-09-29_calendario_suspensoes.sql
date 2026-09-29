-- =========================================================
-- Migração 2026-09-29: calendário em transação, datas e suspensões automáticas
-- Para bases criadas antes desta data. Executar uma vez no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
-- =========================================================

alter table public.competicoes
  add column if not exists amarelos_suspensao       int not null default 3 check (amarelos_suspensao >= 0),
  add column if not exists jogos_suspensao_expulsao int not null default 1 check (jogos_suspensao_expulsao >= 0);

-- Cada função corre numa única transação: se algo falhar, nada muda.
-- security invoker: as políticas RLS de escrita (só admins) aplicam-se na mesma.

create or replace function public.gerar_calendario(p_competicao uuid, p_jogos jsonb)
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
  delete from public.jogos where competicao_id = p_competicao;
  insert into public.jogos (competicao_id, jornada, casa_id, fora_id, data_hora, campo)
  select p_competicao, j.jornada, j.casa_id, j.fora_id, j.data_hora, nullif(j.campo, '')
  from jsonb_to_recordset(p_jogos) as j(jornada int, casa_id uuid, fora_id uuid, data_hora timestamptz, campo text);
  get diagnostics n = row_count;
  return n;
end $$;

-- Marca data (e, se indicado, campo) em vários jogos de uma vez
create or replace function public.definir_datas_jogos(p_jogos jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para marcar datas' using errcode = '42501';
  end if;
  update public.jogos g
     set data_hora = j.data_hora,
         campo = coalesce(nullif(j.campo, ''), g.campo)
    from jsonb_to_recordset(p_jogos) as j(id uuid, data_hora timestamptz, campo text)
   where g.id = j.id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.gerar_calendario(uuid, jsonb) from public, anon;
revoke execute on function public.definir_datas_jogos(jsonb) from public, anon;
grant execute on function public.gerar_calendario(uuid, jsonb) to authenticated;
grant execute on function public.definir_datas_jogos(jsonb) to authenticated;

-- Atualiza a cache do PostgREST para as novas colunas e funções ficarem disponíveis já
notify pgrst, 'reload schema';
