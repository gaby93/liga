-- =========================================================
-- Migração 2026-10-01: eliminatórias a duas mãos, jogo do 3.º lugar e
-- melhores terceiros. Executar DEPOIS de 2026-09-30_responsaveis.sql.
-- Uma vez, no SQL Editor. (Instalações novas já têm isto em schema.sql.)
-- As competições existentes ficam como estavam (tudo desligado).
-- =========================================================

alter table public.competicoes
  add column if not exists melhores_terceiros int not null default 0 check (melhores_terceiros >= 0),
  add column if not exists duas_maos       boolean not null default false,
  add column if not exists final_duas_maos boolean not null default false,
  add column if not exists terceiro_lugar  boolean not null default false;

-- 1.ª ou 2.ª mão (null num jogo único). Na ronda final, a chave 1 é o 3.º lugar.
alter table public.jogos
  add column if not exists mao int check (mao in (1, 2));

-- O índice que impede jogos repetidos no quadro passa a incluir a mão.
-- (O nome antigo depende de como a base foi criada; removem-se os dois.)
drop index if exists public.jogos_competicao_eliminatoria_chave_idx;
drop index if exists public.jogos_competicao_id_eliminatoria_chave_idx;
create unique index if not exists jogos_quadro_unico
  on public.jogos (competicao_id, eliminatoria, chave, coalesce(mao, 0));

-- gerar_calendario passa a gravar a mão de cada jogo
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

  insert into public.jogos (competicao_id, jornada, casa_id, fora_id, data_hora, campo, grupo, eliminatoria, chave, mao)
  select p_competicao, j.jornada, j.casa_id, j.fora_id, j.data_hora, nullif(j.campo, ''),
         nullif(j.grupo, ''), j.eliminatoria, j.chave, j.mao
  from jsonb_to_recordset(p_jogos) as j(jornada int, casa_id uuid, fora_id uuid, data_hora timestamptz,
                                         campo text, grupo text, eliminatoria int, chave int, mao int);
  get diagnostics n = row_count;
  return n;
end $$;

notify pgrst, 'reload schema';
