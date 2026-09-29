-- =========================================================
-- Migração 2026-09-30 (2.ª): acesso dos responsáveis de equipa
-- Executar DEPOIS de 2026-09-30_fichas_jogo.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
--
-- O administrador regista o email do responsável de cada equipa. Quem entrar
-- com esse email, JÁ CONFIRMADO, pode gerir o plantel e as fichas de jogo da
-- sua equipa. Resultados, golos, cartões e suspensões continuam só do admin.
-- =========================================================

create table if not exists public.responsaveis (
  equipa_id  uuid not null references public.equipas(id) on delete cascade,
  email      text not null check (email = lower(trim(email)) and email like '%@%'),
  primary key (equipa_id, email)
);

-- Os emails não são públicos: só o administrador lê e escreve esta tabela
alter table public.responsaveis enable row level security;
drop policy if exists "so admin" on public.responsaveis;
create policy "so admin" on public.responsaveis for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Equipas do utilizador com sessão. Exige email confirmado: sem isso, alguém
-- podia criar conta com o email de um responsável e ficar com a equipa dele.
create or replace function public.minhas_equipas()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select r.equipa_id
    from public.responsaveis r
    join auth.users u on lower(u.email) = r.email
   where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

create or replace function public.e_responsavel(p_equipa uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_equipa is not null and exists (select 1 from public.minhas_equipas() as e(id) where e.id = p_equipa);
$$;

revoke execute on function public.minhas_equipas() from public, anon;
revoke execute on function public.e_responsavel(uuid) from public, anon;
grant execute on function public.minhas_equipas() to authenticated;
grant execute on function public.e_responsavel(uuid) to authenticated;

-- ---------- Plantel ----------
-- Acrescentar e editar jogadores da própria equipa. Sem apagar nem mudar de equipa.
drop policy if exists "responsavel insere" on public.jogadores;
create policy "responsavel insere" on public.jogadores for insert to authenticated
  with check (public.e_responsavel(equipa_id));
drop policy if exists "responsavel edita" on public.jogadores;
create policy "responsavel edita" on public.jogadores for update to authenticated
  using (public.e_responsavel(equipa_id)) with check (public.e_responsavel(equipa_id));

-- Suspender é decisão da organização: só o administrador mexe em "suspenso".
-- (Sem sessão, ex.: SQL Editor, não se bloqueia.)
create or replace function public.proteger_suspenso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if (tg_op = 'INSERT' and new.suspenso)
       or (tg_op = 'UPDATE' and new.suspenso is distinct from old.suspenso) then
      raise exception 'Só a organização pode suspender jogadores.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists jogadores_proteger_suspenso on public.jogadores;
create trigger jogadores_proteger_suspenso before insert or update on public.jogadores
  for each row execute function public.proteger_suspenso();

-- Dados pessoais dos jogadores da própria equipa
drop policy if exists "responsavel dados" on public.jogadores_privado;
create policy "responsavel dados" on public.jogadores_privado for all to authenticated
  using (exists (select 1 from public.jogadores j where j.id = jogador_id and public.e_responsavel(j.equipa_id)))
  with check (exists (select 1 from public.jogadores j where j.id = jogador_id and public.e_responsavel(j.equipa_id)));

-- ---------- Fichas de jogo ----------
-- Só a ficha da própria equipa, só com jogadores dela e só antes do jogo.
drop policy if exists "responsavel ficha" on public.convocatorias;
create policy "responsavel ficha" on public.convocatorias for all to authenticated
  using (
    public.e_responsavel(equipa_id)
    and exists (select 1 from public.jogos g where g.id = jogo_id and g.estado in ('agendado', 'adiado'))
  )
  with check (
    public.e_responsavel(equipa_id)
    and exists (select 1 from public.jogos g
                 where g.id = jogo_id and g.estado in ('agendado', 'adiado')
                   and equipa_id in (g.casa_id, g.fora_id))
    and exists (select 1 from public.jogadores j where j.id = jogador_id and j.equipa_id = convocatorias.equipa_id)
  );

-- ---------- Fotos ----------
-- Enviar fotos de jogadores (pasta jogadores/). Substituir e apagar continua só do admin.
drop policy if exists "media insert responsavel" on storage.objects;
create policy "media insert responsavel" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (storage.foldername(name))[1] = 'jogadores'
    and exists (select 1 from public.minhas_equipas())
  );

notify pgrst, 'reload schema';
