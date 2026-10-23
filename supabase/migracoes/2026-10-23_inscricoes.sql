-- =========================================================
-- Migração 2026-10-23: regras de inscrição e de convocatória
-- Executar DEPOIS de 2026-10-20_campos.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
--
-- Em cada competição:
-- - max_jogadores: limite de jogadores inscritos por equipa (0 = sem limite).
-- - idade_minima: idade mínima para inscrever um jogador (0 = sem limite).
-- - idade_veterano: a partir de que idade um jogador conta como veterano.
-- - min_veteranos: veteranos mínimos na ficha de cada jogo (0 = desliga).
-- =========================================================

alter table public.competicoes add column if not exists max_jogadores int not null default 25;
alter table public.competicoes add column if not exists idade_minima int not null default 0;
alter table public.competicoes add column if not exists idade_veterano int not null default 32;
alter table public.competicoes add column if not exists min_veteranos int not null default 3;

alter table public.competicoes drop constraint if exists competicoes_regras_inscricao;
alter table public.competicoes add constraint competicoes_regras_inscricao check (
  max_jogadores between 0 and 200 and idade_minima between 0 and 99
  and idade_veterano between 0 and 99 and min_veteranos between 0 and 50);

notify pgrst, 'reload schema';
