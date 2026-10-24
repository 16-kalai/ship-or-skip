-- Structured onboarding, retries, points and rank, and the public-facing profile. Safe to re-run.

alter table public.profiles add column if not exists goals text[] not null default '{}';
alter table public.profiles add column if not exists background_done boolean not null default false;
alter table public.profiles add column if not exists github text check (github ~ '^[A-Za-z0-9-]{1,39}$');
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists solved integer not null default 0;
alter table public.profiles add column if not exists ai_summary jsonb;
alter table public.profiles add column if not exists ai_summary_count integer not null default 0;

-- Rank = 1 + learners with more points; this index keeps that count cheap.
create index if not exists profiles_points_idx on public.profiles (points desc);

alter table public.attempts add column if not exists tries smallint not null default 0;

alter table public.voice_sessions add column if not exists kind text not null default 'call'
  check (kind in ('call', 'speak', 'transcribe'));
create index if not exists voice_sessions_user_kind_idx on public.voice_sessions (user_id, kind, created_at desc);

-- Adds points atomically (two graded answers at once can't lose an update).
create or replace function public.add_points(p_user uuid, p_points integer, p_solved integer)
returns table (points integer, solved integer)
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
     set points = p.points + p_points, solved = p.solved + p_solved, updated_at = now()
   where p.user_id = p_user
  returning p.points, p.solved;
$$;
revoke all on function public.add_points(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.add_points(uuid, integer, integer) to service_role;
