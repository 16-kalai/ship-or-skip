-- Public, shareable profiles. A profile is public only while shared_at is set. Safe to re-run.
alter table public.profiles add column if not exists share_handle text unique
  check (share_handle ~ '^[a-z0-9-]{3,40}$');
alter table public.profiles add column if not exists shared_at timestamptz;
