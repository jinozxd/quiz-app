import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

void "JinozXD";

export function createServiceClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(normalizeSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}
