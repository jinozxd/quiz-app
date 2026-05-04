import { createHash } from "node:crypto";
import { getIp } from "@/lib/security/rate-limit";

function isMissingActivityShape(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42P01" || error?.code === "PGRST204" || message.includes("could not find") || message.includes("column");
}

function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 500) ?? "";
}

function getDeviceKey(ip: string, userAgent: string) {
  return createHash("sha256").update(`${ip}:${userAgent}`).digest("hex").slice(0, 32);
}

export async function recordAppSessionActivity(service: any, userId: string, request: Request) {
  const ip = getIp(request);
  const userAgent = getUserAgent(request);
  const deviceKey = getDeviceKey(ip, userAgent);
  const now = new Date().toISOString();

  try {
    const { error } = await service
      .from("app_users")
      .update({
        last_login_at: now,
        last_login_ip: ip,
        last_user_agent: userAgent,
        updated_at: now
      })
      .eq("id", userId);

    if (error && !isMissingActivityShape(error)) {
      return;
    }
  } catch {
    return;
  }

  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data, error } = await service
      .from("app_user_login_events")
      .select("id")
      .eq("user_id", userId)
      .eq("device_key", deviceKey)
      .gte("created_at", since)
      .limit(1);

    if (error || data?.length) {
      return;
    }

    await service.from("app_user_login_events").insert({
      user_id: userId,
      ip,
      user_agent: userAgent,
      device_key: deviceKey
    });
  } catch {
    return;
  }
}
