-- =========================================================
-- Liga recreativa: schema, segurança (RLS), storage e realtime
-- Executar uma vez no SQL Editor do Supabase.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------

create table public.competicoes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  epoca        text,
  estado       text not null default 'rascunho'
               check (estado in ('rascunho', 'em_curso', 'terminada')),
  pts_vitoria  int  not null default 3,
  pts_empate   int  not null default 1,
  pts_derrota  int  not null default 0,
  golos_wo     int  not null default 3 check (golos_wo >= 0),
  ida_volta    boolean not null default false,
  -- liga: todos contra todos; grupos: fase de grupos + fase final; eliminatorias: só a eliminar
  formato      text not null default 'liga' check (formato in ('liga', 'grupos', 'eliminatorias')),
  num_grupos   int  not null default 2 check (num_grupos between 1 and 16),
  apurados_por_grupo int not null default 2 check (apurados_por_grupo >= 1),
  -- Suspensões automáticas (0 = regra desligada)
  amarelos_suspensao       int not null default 3 check (amarelos_suspensao >= 0),
  jogos_suspensao_expulsao int not null default 1 check (jogos_suspensao_expulsao >= 0),
  -- Ordem dos critérios de desempate (o primeiro é sempre 'pontos')
  criterios    text[] not null default array[
                 'pontos', 'confronto_pontos', 'confronto_dif', 'confronto_golos',
                 'dif_golos', 'golos_marcados', 'fair_play', 'sorteio'],
  created_at   timestamptz not null default now()
);

create table public.equipas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  emblema_url  text,
  responsavel  text,
  contacto     text,
  created_at   timestamptz not null default now()
);

-- Equipas inscritas em cada competição
create table public.participantes (
  competicao_id uuid not null references public.competicoes(id) on delete cascade,
  equipa_id     uuid not null references public.equipas(id) on delete cascade,
  ordem_sorteio int,  -- critério "sorteio" (menor = melhor); nas eliminatórias é a semente
  grupo         text, -- 'A', 'B'… no formato de grupos
  posicao_quadro int, -- lugar no quadro da fase final (definido ao gerá-la)
  primary key (competicao_id, equipa_id)
);

create table public.jogadores (
  id          uuid primary key default gen_random_uuid(),
  equipa_id   uuid references public.equipas(id) on delete set null,
  nome        text not null,
  numero      int check (numero between 0 and 99),
  foto_url    text,
  suspenso    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Dados pessoais dos jogadores: só os administradores os podem ler
create table public.jogadores_privado (
  jogador_id  uuid primary key references public.jogadores(id) on delete cascade,
  data_nasc   date,
  documento   text,
  contacto    text
);

create table public.jogos (
  id            uuid primary key default gen_random_uuid(),
  competicao_id uuid not null references public.competicoes(id) on delete cascade,
  jornada       int  not null check (jornada > 0),
  casa_id       uuid not null references public.equipas(id) on delete restrict,
  fora_id       uuid not null references public.equipas(id) on delete restrict,
  data_hora     timestamptz,
  campo         text,
  golos_casa    int check (golos_casa >= 0),
  golos_fora    int check (golos_fora >= 0),
  -- wo_casa: a equipa da casa faltou; wo_fora: a equipa de fora faltou
  estado        text not null default 'agendado'
                check (estado in ('agendado', 'terminado', 'wo_casa', 'wo_fora', 'adiado')),
  grupo         text,  -- jogo da fase de grupos
  -- Jogo a eliminar: equipas em prova na ronda (2 = final, 4 = meias…) e posição no quadro
  eliminatoria  int check (eliminatoria >= 2),
  chave         int check (chave >= 0),
  penaltis_casa int check (penaltis_casa >= 0),
  penaltis_fora int check (penaltis_fora >= 0),
  check (casa_id <> fora_id),
  check ((eliminatoria is null) = (chave is null))
);
create index on public.jogos (competicao_id, jornada);
-- Impede jogos repetidos no quadro (ex.: gerar a mesma ronda duas vezes)
create unique index on public.jogos (competicao_id, eliminatoria, chave);

create table public.eventos (
  id          uuid primary key default gen_random_uuid(),
  jogo_id     uuid not null references public.jogos(id) on delete cascade,
  equipa_id   uuid not null references public.equipas(id) on delete cascade,
  jogador_id  uuid references public.jogadores(id) on delete set null,
  minuto      int check (minuto between 0 and 130),
  -- autogolo: equipa_id é a equipa do jogador que marcou contra a própria baliza
  tipo        text not null check (tipo in ('golo', 'autogolo', 'amarelo', 'vermelho'))
);
create index on public.eventos (jogo_id);

-- Ficha de jogo: quem foi convocado por cada equipa
-- (equipa_id guarda a equipa no momento do jogo, mesmo que o jogador mude depois)
create table public.convocatorias (
  jogo_id     uuid not null references public.jogos(id) on delete cascade,
  jogador_id  uuid not null references public.jogadores(id) on delete cascade,
  equipa_id   uuid not null references public.equipas(id) on delete cascade,
  primary key (jogo_id, jogador_id)
);
create index on public.convocatorias (jogador_id);

-- Sanções de pontos (ex.: -3 por falta de comparência)
create table public.sancoes (
  id            uuid primary key default gen_random_uuid(),
  competicao_id uuid not null references public.competicoes(id) on delete cascade,
  equipa_id     uuid not null references public.equipas(id) on delete cascade,
  pontos        int  not null,
  motivo        text,
  created_at    timestamptz not null default now()
);

-- Utilizadores com permissão de administração
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Segurança ----------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.admins enable row level security;
-- Sem políticas: a tabela admins só é acessível via is_admin() ou pelo painel do Supabase.

-- Leitura pública para todos; escrita apenas para administradores
do $$
declare t text;
begin
  foreach t in array array['competicoes','equipas','participantes','jogadores','jogos','eventos','sancoes','convocatorias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format(
      'create policy "escrita admin" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.jogadores_privado enable row level security;
create policy "so admin" on public.jogadores_privado for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Calendário (operações atómicas) ----------
-- Cada função corre numa única transação: se algo falhar, nada muda.
-- security invoker: as políticas RLS de escrita (só admins) aplicam-se na mesma.

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

revoke execute on function public.gerar_calendario(uuid, jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.definir_datas_jogos(jsonb) from public, anon;
grant execute on function public.gerar_calendario(uuid, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.definir_datas_jogos(jsonb) to authenticated;

-- ---------- Storage (emblemas e fotos) ----------

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media leitura publica" on storage.objects
  for select using (bucket_id = 'media');
create policy "media insert admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media update admin" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media delete admin" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------- Tempo real ----------

alter publication supabase_realtime add table public.jogos, public.eventos, public.convocatorias;
