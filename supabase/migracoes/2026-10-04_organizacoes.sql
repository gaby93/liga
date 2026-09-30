-- =========================================================
-- Migração 2026-10-04: organizações (cada liga só vê e gere o que é seu)
-- Executar DEPOIS de 2026-10-03_notificacoes.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
--
-- - Competições, equipas e jogadores passam a pertencer a uma organização.
-- - Os administradores que já existem (tabela admins) passam a super admin:
--   veem tudo e gerem as organizações e quem as administra.
-- - Admins de organização (por email confirmado, como os responsáveis) só
--   gerem as suas. Os dados existentes vão para uma organização inicial.
-- - O portal público continua a mostrar todas as competições publicadas.
-- =========================================================

create table if not exists public.organizacoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.admins_organizacao (
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  email          text not null check (email = lower(trim(email)) and email like '%@%'),
  primary key (organizacao_id, email)
);

-- Os dados que já existem ficam numa organização inicial (pode renomeá-la no backoffice)
insert into public.organizacoes (nome)
select 'Organização principal' where not exists (select 1 from public.organizacoes);

alter table public.competicoes add column if not exists organizacao_id uuid references public.organizacoes(id) on delete restrict;
alter table public.equipas     add column if not exists organizacao_id uuid references public.organizacoes(id) on delete restrict;
alter table public.jogadores   add column if not exists organizacao_id uuid references public.organizacoes(id) on delete restrict;
update public.competicoes set organizacao_id = (select id from public.organizacoes order by created_at limit 1) where organizacao_id is null;
update public.equipas     set organizacao_id = (select id from public.organizacoes order by created_at limit 1) where organizacao_id is null;
update public.jogadores   set organizacao_id = (select id from public.organizacoes order by created_at limit 1) where organizacao_id is null;
alter table public.competicoes alter column organizacao_id set not null;
alter table public.equipas     alter column organizacao_id set not null;
alter table public.jogadores   alter column organizacao_id set not null;
create index if not exists competicoes_organizacao_idx on public.competicoes (organizacao_id);
create index if not exists equipas_organizacao_idx on public.equipas (organizacao_id);
create index if not exists jogadores_organizacao_idx on public.jogadores (organizacao_id);

-- O nome de uma equipa passa a ser único dentro da organização (não em toda a base)
alter table public.equipas drop constraint if exists equipas_nome_key;
create unique index if not exists equipas_organizacao_nome_unico on public.equipas (organizacao_id, nome);

-- ---------- Quem gere o quê ----------

-- Organizações que o utilizador com sessão gere: todas (super admin) ou as atribuídas ao seu email confirmado
create or replace function public.minhas_organizacoes()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select o.id from public.organizacoes o where public.is_admin()
  union
  select a.organizacao_id
    from public.admins_organizacao a
    join auth.users u on lower(u.email) = a.email
   where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

create or replace function public.gere_organizacao(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_org is not null
     and (public.is_admin() or exists (select 1 from public.minhas_organizacoes() as m(id) where m.id = p_org));
$$;

-- Organização de cada coisa (para as regras de acesso)
create or replace function public.org_da_competicao(p uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select organizacao_id from public.competicoes where id = p $$;
create or replace function public.org_da_equipa(p uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select organizacao_id from public.equipas where id = p $$;
create or replace function public.org_do_jogo(p uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select c.organizacao_id from public.jogos g join public.competicoes c on c.id = g.competicao_id where g.id = p $$;
create or replace function public.org_do_jogador(p uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select organizacao_id from public.jogadores where id = p $$;

-- Um jogador com equipa pertence sempre à organização da equipa (preenchido sozinho)
create or replace function public.jogador_organizacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.equipa_id is not null then
    new.organizacao_id := public.org_da_equipa(new.equipa_id);
  end if;
  if new.organizacao_id is null then
    raise exception 'O jogador precisa de uma equipa ou de uma organização.';
  end if;
  return new;
end $$;
-- O nome começa por "a_" para correr antes dos outros gatilhos do jogador
drop trigger if exists a_jogadores_organizacao on public.jogadores;
create trigger a_jogadores_organizacao before insert or update on public.jogadores
  for each row execute function public.jogador_organizacao();

-- Suspender passa a ser dos gestores da organização do jogador (não só do super admin)
create or replace function public.proteger_suspenso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.gere_organizacao(new.organizacao_id) then
    if (tg_op = 'INSERT' and new.suspenso)
       or (tg_op = 'UPDATE' and new.suspenso is distinct from old.suspenso) then
      raise exception 'Só a organização pode suspender jogadores.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------- Regras de acesso ----------
-- Leitura pública como antes (o portal é público), exceto competições em rascunho,
-- que só a própria organização vê. Escrita só de quem gere a organização.

alter table public.organizacoes enable row level security;
drop policy if exists "leitura publica" on public.organizacoes;
create policy "leitura publica" on public.organizacoes for select using (true);
drop policy if exists "super admin" on public.organizacoes;
create policy "super admin" on public.organizacoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.admins_organizacao enable row level security;
drop policy if exists "super admin" on public.admins_organizacao;
create policy "super admin" on public.admins_organizacao for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "leitura publica" on public.competicoes;
create policy "leitura publica" on public.competicoes for select
  using (estado <> 'rascunho' or public.gere_organizacao(organizacao_id));
drop policy if exists "escrita admin" on public.competicoes;
create policy "escrita admin" on public.competicoes for all to authenticated
  using (public.gere_organizacao(organizacao_id)) with check (public.gere_organizacao(organizacao_id));

drop policy if exists "escrita admin" on public.equipas;
create policy "escrita admin" on public.equipas for all to authenticated
  using (public.gere_organizacao(organizacao_id)) with check (public.gere_organizacao(organizacao_id));

drop policy if exists "escrita admin" on public.jogadores;
create policy "escrita admin" on public.jogadores for all to authenticated
  using (public.gere_organizacao(organizacao_id)) with check (public.gere_organizacao(organizacao_id));

-- Participantes e jogos: só com equipas da mesma organização da competição
drop policy if exists "escrita admin" on public.participantes;
create policy "escrita admin" on public.participantes for all to authenticated
  using (public.gere_organizacao(public.org_da_competicao(competicao_id)))
  with check (public.gere_organizacao(public.org_da_competicao(competicao_id))
              and public.org_da_equipa(equipa_id) = public.org_da_competicao(competicao_id));

drop policy if exists "escrita admin" on public.jogos;
create policy "escrita admin" on public.jogos for all to authenticated
  using (public.gere_organizacao(public.org_da_competicao(competicao_id)))
  with check (public.gere_organizacao(public.org_da_competicao(competicao_id))
              and public.org_da_equipa(casa_id) = public.org_da_competicao(competicao_id)
              and public.org_da_equipa(fora_id) = public.org_da_competicao(competicao_id));

drop policy if exists "escrita admin" on public.eventos;
create policy "escrita admin" on public.eventos for all to authenticated
  using (public.gere_organizacao(public.org_do_jogo(jogo_id)))
  with check (public.gere_organizacao(public.org_do_jogo(jogo_id))
              and public.org_da_equipa(equipa_id) = public.org_do_jogo(jogo_id));

drop policy if exists "escrita admin" on public.sancoes;
create policy "escrita admin" on public.sancoes for all to authenticated
  using (public.gere_organizacao(public.org_da_competicao(competicao_id)))
  with check (public.gere_organizacao(public.org_da_competicao(competicao_id)));

drop policy if exists "escrita admin" on public.convocatorias;
create policy "escrita admin" on public.convocatorias for all to authenticated
  using (public.gere_organizacao(public.org_do_jogo(jogo_id)))
  with check (public.gere_organizacao(public.org_do_jogo(jogo_id)));

-- Dados pessoais e emails dos responsáveis: só a organização do jogador / da equipa
drop policy if exists "so admin" on public.jogadores_privado;
create policy "so admin" on public.jogadores_privado for all to authenticated
  using (public.gere_organizacao(public.org_do_jogador(jogador_id)))
  with check (public.gere_organizacao(public.org_do_jogador(jogador_id)));

drop policy if exists "so admin" on public.responsaveis;
create policy "so admin" on public.responsaveis for all to authenticated
  using (public.gere_organizacao(public.org_da_equipa(equipa_id)))
  with check (public.gere_organizacao(public.org_da_equipa(equipa_id)));

-- Fotos e emblemas: qualquer gestor (super admin ou de organização) envia e substitui
drop policy if exists "media insert admin" on storage.objects;
create policy "media insert admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and exists (select 1 from public.minhas_organizacoes()));
drop policy if exists "media update admin" on storage.objects;
create policy "media update admin" on storage.objects
  for update to authenticated using (bucket_id = 'media' and exists (select 1 from public.minhas_organizacoes()));
drop policy if exists "media delete admin" on storage.objects;
create policy "media delete admin" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and exists (select 1 from public.minhas_organizacoes()));

-- ---------- Calendário: gestores da organização ----------
create or replace function public.gerar_calendario(
  p_competicao uuid, p_jogos jsonb, p_quadro jsonb default null, p_so_fase_final boolean default false)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  if not public.gere_organizacao(public.org_da_competicao(p_competicao)) then
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

-- As regras de acesso dos jogos limitam as linhas que cada gestor consegue mudar
create or replace function public.definir_datas_jogos(p_jogos jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  if not exists (select 1 from public.minhas_organizacoes()) then
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

-- Só quem tem sessão pergunta que organizações gere (as regras de acesso usam-na por dentro)
revoke execute on function public.minhas_organizacoes() from public, anon;
grant execute on function public.minhas_organizacoes() to authenticated;

notify pgrst, 'reload schema';
