-- Chat onboarding: one conversation per learner, and the profile Rev builds from it.
-- Safe to re-run.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  situation text check (situation in ('student', 'working', 'switching', 'other')),
  title text,
  years_experience numeric(4, 1) check (years_experience between 0 and 60),
  stack text[] not null default '{}',
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  goal text,
  summary text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'rev')),
  content text not null check (char_length(content) <= 4000),
  meta jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);

-- Loading a conversation and counting recent messages for the rate limit both use this.
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);

-- Learners can read their own rows. All writes go through the server (secret key),
-- so nobody can edit Rev's messages or their own profile fields from the browser.
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Read own messages" on public.messages;
create policy "Read own messages" on public.messages for select to authenticated using ((select auth.uid()) = user_id);
