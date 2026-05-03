alter table public.app_users
  add column if not exists is_banned boolean not null default false,
  add column if not exists delegated_at timestamptz,
  add column if not exists delegated_by uuid references public.app_users(id) on delete set null,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists last_user_agent text,
  add column if not exists login_count integer not null default 0;

create table if not exists public.app_user_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  ip text,
  user_agent text,
  device_key text,
  created_at timestamptz not null default now()
);

create index if not exists app_user_login_events_user_created_idx
  on public.app_user_login_events (user_id, created_at desc);

create index if not exists app_user_login_events_device_idx
  on public.app_user_login_events (user_id, device_key);

alter table public.app_user_login_events enable row level security;
