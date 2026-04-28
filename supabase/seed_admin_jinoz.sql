-- Run this once in Supabase SQL Editor to create/reset the owner admin account.
-- Login name: jinoz
-- The password is stored as a scrypt hash, not as plain text.

with upserted_admin as (
  insert into public.app_users (
    email,
    name,
    password_hash,
    password_salt,
    role,
    password_changed_at,
    updated_at
  )
  values (
    'jinoz@users.noreply.github.com',
    'jinoz',
    'CskMYYJ9tlF-oJbJJVqw1H1RdvOA234wDblwd5yo2b6jf2qyJrbsiE7TaBkzkkvvGT_4Z_byaSkU3dMJANQ7iQ',
    'VueyBcpYJmNBZl76leU9kQ',
    'admin',
    null,
    now()
  )
  on conflict (name) do update
    set email = excluded.email,
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        role = 'admin',
        password_changed_at = null,
        updated_at = now()
  returning id
)
insert into public.app_user_data (user_id)
select id from upserted_admin
on conflict (user_id) do nothing;
