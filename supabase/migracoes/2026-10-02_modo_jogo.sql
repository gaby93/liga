-- =========================================================
-- Migração 2026-10-02: modo jogo (lançar no campo)
-- Executar DEPOIS de 2026-10-01_eliminatorias.sql. Uma vez, no SQL Editor.
-- (Instalações novas já têm isto em schema.sql.)
-- =========================================================

-- Novo estado: a decorrer. Continua fora da tabela até terminar.
alter table public.jogos drop constraint if exists jogos_estado_check;
alter table public.jogos add constraint jogos_estado_check
  check (estado in ('agendado', 'em_curso', 'terminado', 'wo_casa', 'wo_fora', 'adiado'));

-- Parte em curso e relógio. O minuto é relogio_base + o tempo desde relogio_inicio.
alter table public.jogos
  add column if not exists periodo text check (periodo in ('1p', 'intervalo', '2p')),
  add column if not exists relogio_inicio timestamptz,
  add column if not exists relogio_base int not null default 0 check (relogio_base >= 0);

notify pgrst, 'reload schema';
