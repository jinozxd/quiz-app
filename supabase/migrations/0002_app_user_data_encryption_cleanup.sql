update public.app_user_data
set profile_media = '{}'::jsonb
where profile_media <> '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  false,
  1572864,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 1572864,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

comment on column public.app_user_data.saved is
  'Encrypted application JSON envelope written by the Next.js app. Legacy plaintext rows are decrypted once and re-encrypted on the next save.';

comment on column public.app_user_data.profile_progress is
  'Encrypted application JSON envelope written by the Next.js app. Legacy plaintext rows are decrypted once and re-encrypted on the next save.';

comment on column public.app_user_data.profile_media is
  'Encrypted profile media paths only. Image files live in the private profile-media Supabase Storage bucket.';
