create extension if not exists "pgcrypto";

create type public.room_visibility as enum ('public', 'school', 'private');
create type public.room_status as enum ('draft', 'waiting', 'live', 'ended', 'locked');
create type public.user_role as enum ('student', 'teacher', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  school_id text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  subject text not null check (char_length(subject) between 2 and 80),
  visibility public.room_visibility not null default 'school',
  status public.room_status not null default 'waiting',
  anti_cheat jsonb not null default '{"shuffle_options":true,"lock_on_tab_blur":false,"max_attempts":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 2000),
  position int not null check (position >= 0),
  time_limit_seconds int not null default 30 check (time_limit_seconds between 5 and 600),
  created_at timestamptz not null default now(),
  unique (room_id, position)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_correct boolean not null default false,
  position int not null check (position >= 0),
  unique (question_id, position)
);

create table public.room_participants (
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  score int not null default 0,
  primary key (room_id, user_id)
);

create table public.answer_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id uuid not null references public.question_options(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_correct boolean not null,
  client_sent_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  unique (room_id, question_id, user_id)
);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.quiz_rooms enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.room_participants enable row level security;
alter table public.answer_submissions enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Học sinh'),
    new.raw_user_meta_data ->> 'school_id'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create policy "profiles are readable to authenticated users"
on public.profiles for select to authenticated using (true);

create policy "users can update own profile"
on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "rooms are readable"
on public.quiz_rooms for select to authenticated
using (visibility in ('public', 'school') or host_id = auth.uid() or public.is_admin());

create policy "authenticated users can create rooms"
on public.quiz_rooms for insert to authenticated
with check (host_id = auth.uid());

create policy "hosts can update rooms"
on public.quiz_rooms for update to authenticated
using (host_id = auth.uid() or public.is_admin())
with check (host_id = auth.uid() or public.is_admin());

create policy "questions are readable through readable rooms"
on public.questions for select to authenticated
using (exists (
  select 1 from public.quiz_rooms r
  where r.id = room_id
    and (r.visibility in ('public', 'school') or r.host_id = auth.uid() or public.is_admin())
));

create policy "hosts manage questions"
on public.questions for all to authenticated
using (exists (select 1 from public.quiz_rooms r where r.id = room_id and (r.host_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.quiz_rooms r where r.id = room_id and (r.host_id = auth.uid() or public.is_admin())));

create policy "hosts read full options"
on public.question_options for select to authenticated
using (exists (
  select 1 from public.questions q
  join public.quiz_rooms r on r.id = q.room_id
  where q.id = question_id and (r.host_id = auth.uid() or public.is_admin())
));

create policy "hosts manage options"
on public.question_options for all to authenticated
using (exists (
  select 1 from public.questions q
  join public.quiz_rooms r on r.id = q.room_id
  where q.id = question_id and (r.host_id = auth.uid() or public.is_admin())
))
with check (exists (
  select 1 from public.questions q
  join public.quiz_rooms r on r.id = q.room_id
  where q.id = question_id and (r.host_id = auth.uid() or public.is_admin())
));

create view public.question_options_public as
select
  o.id,
  o.question_id,
  o.body,
  o.position
from public.question_options o
join public.questions q on q.id = o.question_id
join public.quiz_rooms r on r.id = q.room_id
where r.visibility in ('public', 'school')
  or r.host_id = auth.uid()
  or public.is_admin();

grant select on public.question_options_public to authenticated;

create policy "participants read room participants"
on public.room_participants for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.quiz_rooms r where r.id = room_id and r.host_id = auth.uid()) or public.is_admin());

create policy "users join as themselves"
on public.room_participants for insert to authenticated
with check (user_id = auth.uid());

create policy "users read own submissions"
on public.answer_submissions for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "users report content"
on public.moderation_reports for insert to authenticated
with check (reporter_id = auth.uid());

create policy "admins read reports"
on public.moderation_reports for select to authenticated
using (public.is_admin());

create policy "admins read audit logs"
on public.audit_logs for select to authenticated
using (public.is_admin());

create policy "users manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter publication supabase_realtime add table public.quiz_rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.answer_submissions;
alter publication supabase_realtime add table public.moderation_reports;
