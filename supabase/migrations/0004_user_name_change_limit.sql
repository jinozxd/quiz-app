alter table public.app_users
  add column if not exists name_changed_at timestamptz;
