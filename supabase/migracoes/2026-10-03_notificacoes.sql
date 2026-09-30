-- =========================================================
-- Migração 2026-10-03: notificações push (golos, início e fim, jogos marcados)
-- Executar DEPOIS de 2026-10-02_modo_jogo.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
-- Depois, configurar o endereço e o segredo: ver "Notificações" no README.
-- =========================================================

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

notify pgrst, 'reload schema';
