-- Strong and weak areas (asked during onboarding), and the Coach agent's plan. Safe to re-run.
-- null means "not asked yet"; an empty array means "not sure".
alter table public.profiles add column if not exists strengths text[];
alter table public.profiles add column if not exists weaknesses text[];
alter table public.profiles add column if not exists coach_plan jsonb;
alter table public.profiles add column if not exists coach_at timestamptz;
