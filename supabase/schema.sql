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
  -- em_curso: a decorrer (modo jogo); wo_casa: a equipa da casa faltou; wo_fora: a equipa de fora faltou
  estado        text not null default 'agendado'
                constraint jogos_estado_check
                check (estado in ('agendado', 'em_curso', 'terminado', 'wo_casa', 'wo_fora', 'adiado')),
  -- Modo jogo: parte em curso e relógio. O minuto é relogio_base + o tempo desde relogio_inicio.
  periodo        text check (periodo in ('1p', 'intervalo', '2p')),
  relogio_inicio timestamptz,
  relogio_base   int not null default 0 check (relogio_base >= 0),
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

-- ---------- Notificações push ----------
-- Depois de instalar, configurar o endereço e o segredo: ver "Notificações" no README.

-- Pedidos HTTP a partir da base de dados (extensão do próprio Supabase)
create extension if not exists pg_net with schema extensions;

-- Quem quer receber notificações, e de quê. Uma linha por aparelho (endpoint do serviço de push).
create table if not exists public.subscricoes_push (
  endpoint      text primary key check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh        text not null check (length(p256dh) between 60 and 120),
  auth          text not null check (length(auth) between 16 and 40),
  competicoes   uuid[] not null default '{}',
  equipas       uuid[] not null default '{}',
  tipos         text[] not null default '{golos,inicio_fim,marcacoes}'
                check (tipos <@ array['golos', 'inicio_fim', 'marcacoes']),
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
-- Sem políticas: ninguém lê nem escreve diretamente. Só as funções abaixo
-- (para cada aparelho gerir a sua) e o servidor (chave de serviço).
alter table public.subscricoes_push enable row level security;

-- Guardar as escolhas deste aparelho. Sem competições nem equipas (ou sem tipos), apaga.
create or replace function public.guardar_subscricao(
  p_endpoint text, p_p256dh text, p_auth text, p_competicoes uuid[], p_equipas uuid[], p_tipos text[])
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(cardinality(p_competicoes), 0) + coalesce(cardinality(p_equipas), 0) = 0
     or coalesce(cardinality(p_tipos), 0) = 0 then
    delete from public.subscricoes_push where endpoint = p_endpoint;
    return;
  end if;
  if cardinality(p_competicoes) > 50 or cardinality(p_equipas) > 100 then
    raise exception 'Demasiadas competições ou equipas seguidas.';
  end if;
  insert into public.subscricoes_push (endpoint, p256dh, auth, competicoes, equipas, tipos)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_competicoes, '{}'), coalesce(p_equipas, '{}'), p_tipos)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, competicoes = excluded.competicoes,
        equipas = excluded.equipas, tipos = excluded.tipos, atualizada_em = now();
end $$;

create or replace function public.remover_subscricao(p_endpoint text)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.subscricoes_push where endpoint = p_endpoint;
$$;

grant execute on function public.guardar_subscricao(text, text, text, uuid[], uuid[], text[]) to anon, authenticated;
grant execute on function public.remover_subscricao(text) to anon, authenticated;

-- Endereço da função que envia as notificações e o segredo partilhado. Privado.
create table if not exists public.config_notificacoes (
  id      int primary key default 1 check (id = 1),
  url     text,
  segredo text
);
alter table public.config_notificacoes enable row level security;
insert into public.config_notificacoes (id) values (1) on conflict (id) do nothing;

-- Pede o envio ao servidor. Uma falha aqui nunca pode impedir de gravar o jogo.
create or replace function public.pedir_notificacao(p_corpo jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c record;
begin
  select url, segredo into c from public.config_notificacoes where id = 1;
  if c.url is null or c.segredo is null then
    return;  -- notificações ainda não configuradas
  end if;
  perform net.http_post(
    url := c.url,
    body := p_corpo,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Segredo', c.segredo),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'Notificação não pedida: %', sqlerrm;
end $$;
revoke execute on function public.pedir_notificacao(jsonb) from public, anon, authenticated;

-- Golo num jogo a decorrer (golos lançados depois, num jogo antigo, não avisam)
create or replace function public.notificar_golo()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.tipo in ('golo', 'autogolo') and exists (
    select 1 from public.jogos g join public.competicoes c on c.id = g.competicao_id
     where g.id = new.jogo_id and g.estado = 'em_curso' and c.estado = 'em_curso') then
    perform public.pedir_notificacao(jsonb_build_object('tipo', 'golo', 'evento_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists eventos_notificar on public.eventos;
create trigger eventos_notificar after insert on public.eventos
  for each row execute function public.notificar_golo();

-- Início, fim e datas marcadas. Corre uma vez por operação (não por jogo): marcar a
-- época inteira de uma vez gera um só pedido, e o servidor junta tudo num resumo.
create or replace function public.notificar_jogos()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  mudancas jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('jogo_id', n.id, 'mudanca', m.mudanca)), '[]'::jsonb)
    into mudancas
    from novos n
    join antigos a on a.id = n.id
    join public.competicoes c on c.id = n.competicao_id and c.estado = 'em_curso'
    cross join lateral (select case
      when a.estado in ('agendado', 'adiado') and n.estado = 'em_curso' then 'inicio'
      when a.estado in ('agendado', 'adiado', 'em_curso') and n.estado in ('terminado', 'wo_casa', 'wo_fora') then 'fim'
      when n.estado = 'agendado' and n.data_hora is not null and n.data_hora is distinct from a.data_hora
           and n.data_hora > now() then 'marcacao'
    end as mudanca) m
   where m.mudanca is not null;
  if jsonb_array_length(mudancas) > 0 then
    perform public.pedir_notificacao(jsonb_build_object('tipo', 'jogos', 'mudancas', mudancas));
  end if;
  return null;
end $$;
drop trigger if exists jogos_notificar on public.jogos;
create trigger jogos_notificar after update on public.jogos
  referencing old table as antigos new table as novos
  for each statement execute function public.notificar_jogos();

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

-- ---------- Organizações ----------
-- Cada organização (liga) tem as suas competições, equipas e jogadores. Os admins da
-- tabela admins são super admin; os admins de organização só gerem as suas. Fica no fim
-- porque substitui regras de acesso criadas acima. Numa instalação nova, crie o super admin
-- (tabela admins) e renomeie a "Organização principal" no backoffice.

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
