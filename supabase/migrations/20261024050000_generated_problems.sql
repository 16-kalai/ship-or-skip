-- Gemini-generated practice problems, tracked per learner, and a snapshot of each attempt's
-- problem (including its answer key). Safe to re-run.

create table if not exists public.generated_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'ready' check (status in ('ready', 'used', 'rejected')),
  level text not null,
  skill text not null,
  area text,
  kind text not null default 'code',
  -- The full problem, answer key included. Server only.
  problem jsonb not null,
  -- Why it was made: stage, target area, what it was based on, and the reviewer's check.
  context jsonb not null default '{}',
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists generated_problems_user_status_idx on public.generated_problems (user_id, status, created_at);
alter table public.generated_problems enable row level security;

-- Each attempt keeps the exact problem it was for, so grading and history never depend on
-- the problem still existing elsewhere.
alter table public.attempts add column if not exists problem jsonb;

-- Attempts now carry answer keys, so learners no longer read them directly; the server does.
drop policy if exists "Read own attempts" on public.attempts;
