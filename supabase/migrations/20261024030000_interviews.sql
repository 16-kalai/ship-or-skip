-- Practice interviews from a job description. The plan holds rubrics, so these tables have no
-- browser read policies: the server reads them after checking the owner. Safe to re-run.

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_title text not null,
  company text,
  level text not null check (level in ('fresher', 'mid', 'senior')),
  jd text not null check (char_length(jd) between 80 and 12000),
  plan jsonb not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_index smallint not null default 0,
  follow_ups smallint not null default 0,
  scores jsonb not null default '[]',
  report jsonb,
  overall numeric(3, 1),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists interviews_user_created_idx on public.interviews (user_id, created_at desc);
-- One interview in progress per learner.
create unique index if not exists interviews_one_active_idx on public.interviews (user_id) where status = 'active';

create table if not exists public.interview_turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('interviewer', 'candidate')),
  kind text not null check (kind in ('question', 'follow_up', 'answer', 'close')),
  question_index smallint not null,
  content text not null check (char_length(content) <= 6000),
  card jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists interview_turns_interview_created_idx on public.interview_turns (interview_id, created_at);

alter table public.interviews enable row level security;
alter table public.interview_turns enable row level security;
