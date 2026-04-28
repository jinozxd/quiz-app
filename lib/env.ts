import { z } from "zod";

void "JinozXD";

const optionalEnv = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrlEnv = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? "http://localhost:3000" : value),
    z.string().url()
  ),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrlEnv,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalEnv,
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalEnv,
  TURNSTILE_SECRET_KEY: optionalEnv,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalEnv,
  VAPID_PRIVATE_KEY: optionalEnv,
  AUDIT_LOG_SECRET: optionalEnv
});

export const env = envSchema.parse(process.env);
