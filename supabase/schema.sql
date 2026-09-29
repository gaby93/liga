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
  -- Melhores classificados logo abaixo dos apurados que também passam (ex.: melhores terceiros)
  melhores_terceiros int not null default 0 check (melhores_terceiros >= 0),
  -- Eliminatórias: a duas mãos (a final à parte) e jogo do 3.º lugar
  duas_maos       boolean not null default false,
  final_duas_maos boolean not null default false,
  terceiro_lugar  boolean not null default false,
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
  -- 1.ª ou 2.ª mão de uma eliminatória a duas mãos (null num jogo único).
  -- Na ronda final (eliminatoria = 2), a chave 1 é o jogo do 3.º lugar.
  mao           int check (mao in (1, 2)),
  check (casa_id <> fora_id),
  check ((eliminatoria is null) = (chave is null))
);
create index on public.jogos (competicao_id, jornada);
-- Impede jogos repetidos no quadro (ex.: gerar a mesma ronda duas vezes)
create unique index jogos_quadro_unico on public.jogos (competicao_id, eliminatoria, chave, coalesce(mao, 0));

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

  insert into public.jogos (competicao_id, jornada, casa_id, fora_id, data_hora, campo, grupo, eliminatoria, chave, mao)
  select p_competicao, j.jornada, j.casa_id, j.fora_id, j.data_hora, nullif(j.campo, ''),
         nullif(j.grupo, ''), j.eliminatoria, j.chave, j.mao
  from jsonb_to_recordset(p_jogos) as j(jornada int, casa_id uuid, fora_id uuid, data_hora timestamptz,
                                         campo text, grupo text, eliminatoria int, chave int, mao int);
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

-- ---------- Responsáveis de equipa ----------
-- O administrador regista o email do responsável de cada equipa. Quem entrar com
-- esse email, já confirmado, gere o plantel e as fichas de jogo da sua equipa.

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
