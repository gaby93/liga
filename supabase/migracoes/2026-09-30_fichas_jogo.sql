-- =========================================================
-- Migração 2026-09-30: fichas de jogo (convocatórias)
-- Executar DEPOIS das migrações de 2026-09-29. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
-- =========================================================

-- Ficha de jogo: quem foi convocado por cada equipa
-- (equipa_id guarda a equipa no momento do jogo, mesmo que o jogador mude depois)
create table if not exists public.convocatorias (
  jogo_id     uuid not null references public.jogos(id) on delete cascade,
  jogador_id  uuid not null references public.jogadores(id) on delete cascade,
  equipa_id   uuid not null references public.equipas(id) on delete cascade,
  primary key (jogo_id, jogador_id)
);
create index if not exists convocatorias_jogador_id_idx on public.convocatorias (jogador_id);

-- Leitura pública; escrita só para administradores (como nas outras tabelas)
alter table public.convocatorias enable row level security;
drop policy if exists "leitura publica" on public.convocatorias;
create policy "leitura publica" on public.convocatorias for select using (true);
drop policy if exists "escrita admin" on public.convocatorias;
create policy "escrita admin" on public.convocatorias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Tempo real: o portal atualiza os jogos disputados sozinho
alter publication supabase_realtime add table public.convocatorias;

notify pgrst, 'reload schema';
