-- =========================================================
-- Migração 2026-10-20: campos de cada organização
-- Executar DEPOIS de 2026-10-04_organizacoes.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
--
-- - Cada organização regista os seus campos (ex.: "Campo 1", "Campo 2").
-- - O calendário distribui os jogos da jornada pelos campos escolhidos: com
--   2 campos, os 2 primeiros jogos são à mesma hora, um em cada campo.
-- - Os jogos continuam a guardar o nome do campo (texto). Mudar o nome de um
--   campo muda-o também nos jogos da organização.
-- =========================================================

create table if not exists public.campos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nome           text not null check (length(trim(nome)) > 0),
  ordem          int not null default 0,
  criado_em      timestamptz not null default now(),
  unique (organizacao_id, nome)
);

alter table public.campos enable row level security;

drop policy if exists "leitura publica" on public.campos;
create policy "leitura publica" on public.campos for select using (true);
drop policy if exists "escrita admin" on public.campos;
create policy "escrita admin" on public.campos for all to authenticated
  using (public.gere_organizacao(organizacao_id)) with check (public.gere_organizacao(organizacao_id));

-- Mudar o nome de um campo atualiza os jogos da organização que o usam
create or replace function public.campo_renomeado()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.nome is distinct from old.nome then
    update public.jogos g set campo = new.nome
      from public.competicoes c
     where c.id = g.competicao_id and c.organizacao_id = new.organizacao_id and g.campo = old.nome;
  end if;
  return new;
end $$;

drop trigger if exists campo_renomeado on public.campos;
create trigger campo_renomeado after update of nome on public.campos
  for each row execute function public.campo_renomeado();
