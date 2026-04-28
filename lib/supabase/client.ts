"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

void "JinozXD";

export function createClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  return createBrowserClient(normalizeSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
