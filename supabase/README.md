# Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_quiz_schema.sql` in the SQL editor or through the Supabase CLI.
3. Enable Auth providers for your school.
4. Copy project URL, anon key, and service role key into `.env.local`.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used for answer validation and audit writes.

The migration enables Row Level Security for quiz rooms, questions, answer submissions, moderation reports, audit logs, and push subscriptions.
