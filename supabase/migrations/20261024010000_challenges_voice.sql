-- Problems a learner attempts, and voice sessions (for the per-user voice limit). Safe to re-run.

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id text not null,
  status text not null default 'open' check (status in ('open', 'graded')),
  asked_why boolean not null default false,
  hints_used smallint not null default 0,
  answer text,
  verdict text check (verdict in ('ship', 'skip')),
  correct boolean,
  score smallint check (score between 0 and 10),
  breakdown jsonb,
  created_at timestamptz not null default now(),
  graded_at timestamptz
);

-- At most one open problem per learner, enforced by the database (two tabs can't open two).
create unique index if not exists attempts_one_open_idx on public.attempts (user_id) where status = 'open';
create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at desc);

create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists voice_sessions_user_created_idx on public.voice_sessions (user_id, created_at desc);

-- Learners read their own attempts; only the server writes. Voice sessions are server-only.
alter table public.attempts enable row level security;
alter table public.voice_sessions enable row level security;
drop policy if exists "Read own attempts" on public.attempts;
create policy "Read own attempts" on public.attempts for select to authenticated using ((select auth.uid()) = user_id);
