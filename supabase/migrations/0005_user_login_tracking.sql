-- Migration: Add user login tracking
-- Description: Adds login tracking columns to app_users and creates app_user_login_events table

-- 1. Add tracking columns to app_users table
alter table public.app_users
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists last_user_agent text,
  add column if not exists login_count int not null default 0;

-- 2. Create the login events tracking table
create table if not exists public.app_user_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  ip text,
  user_agent text,
  device_key text,
  created_at timestamptz not null default now()
);

-- 3. Enable Row Level Security (RLS) on the new table
alter table public.app_user_login_events enable row level security;

-- (Optional) If you ever want users to read their own events via client-side Supabase:
-- create policy "users can view own login events"
-- on public.app_user_login_events for select to authenticated
-- using (user_id = auth.uid());
