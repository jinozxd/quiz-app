import { createServiceClient } from "@/lib/supabase/service";

void "JinozXD";

export async function writeAuditLog(event: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();

  if (!supabase) {
    return;
  }

  await supabase.from("audit_logs").insert({
    actor_id: event.actorId ?? null,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId ?? null,
    metadata: event.metadata ?? {}
  });
}
