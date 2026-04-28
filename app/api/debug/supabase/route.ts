import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

export const runtime = "nodejs";

function keyKind(key?: string) {
  if (!key) return "missing";
  if (key.startsWith("eyJ")) return "legacy-service-role-jwt";
  if (key.startsWith("sb_secret_")) return "secret-key";
  if (key.startsWith("sb_publishable_")) return "publishable-key";
  return "unknown";
}

export async function GET() {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const normalizedUrl = rawUrl ? normalizeSupabaseUrl(rawUrl) : undefined;
  const service = createServiceClient();

  if (!rawUrl || !env.SUPABASE_SERVICE_ROLE_KEY || !service) {
    return NextResponse.json(
      {
        ok: false,
        env: {
          hasUrl: Boolean(rawUrl),
          normalizedUrl,
          serviceKeyKind: keyKind(env.SUPABASE_SERVICE_ROLE_KEY),
          hasAuditSecret: Boolean(env.AUDIT_LOG_SECRET)
        },
        error: "Missing Supabase server environment variables."
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();
  const { data, error, status, statusText } = await service
    .from("app_users")
    .select("name,role")
    .eq("name", "jinoz")
    .maybeSingle();

  return NextResponse.json(
    {
      ok: !error,
      env: {
        hasUrl: true,
        normalizedUrl,
        serviceKeyKind: keyKind(env.SUPABASE_SERVICE_ROLE_KEY),
        hasAuditSecret: Boolean(env.AUDIT_LOG_SECRET)
      },
      query: {
        durationMs: Date.now() - startedAt,
        status,
        statusText,
        user: data ? { name: data.name, role: data.role } : null,
        error: error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : null
      }
    },
    { status: error ? 500 : 200 }
  );
}
