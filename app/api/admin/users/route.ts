import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppSession } from "@/lib/app-auth";
import { getBearerToken, verifySessionToken } from "@/lib/app-auth";
import { decryptJsonForUser } from "@/lib/security/app-data-crypto";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const EMPTY_SAVED = { items: {}, order: [], starredQuestionIds: [], results: [] };
const EMPTY_PROFILE_PROGRESS = { level: 1, xp: 0, awardedResultIds: [], unlockedAchievementIds: [] };

const updateSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["ban", "unban", "delegate", "revokeDelegate", "promote", "demote"])
});

function getSession(request: Request) {
  return verifySessionToken(getBearerToken(request));
}

async function requireAdminAccess(session: AppSession, write = false) {
  const service = createServiceClient();
  if (!service) {
    return { error: "Thiếu cấu hình database server.", status: 500 as const };
  }

  const { data: user, error } = await service
    .from("app_users")
    .select("id,role,delegated_at,is_banned,password_changed_at")
    .eq("id", session.id)
    .maybeSingle();

  if (error || !user || user.is_banned) {
    return { error: "Phiên quản trị không còn hợp lệ.", status: 401 as const };
  }

  const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
  if (passwordChangedAt && passwordChangedAt > session.iat) {
    return { error: "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại.", status: 401 as const };
  }

  const canRead = user.role === "admin" || Boolean(user.delegated_at);
  const canWrite = user.role === "admin";
  if ((write && !canWrite) || (!write && !canRead)) {
    return { error: "Bạn không có quyền dùng khu vực kiểm soát.", status: 403 as const };
  }

  return { service, user };
}

export async function GET(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `admin-users:${ip}`, limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn tải khu vực kiểm soát quá nhanh." }, { status: 429 });
  }

  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const admin = await requireAdminAccess(session);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const [{ data: users, error: usersError }, { data: userData, error: dataError }, { data: loginEvents }] = await Promise.all([
    admin.service
      .from("app_users")
      .select("id,email,name,role,is_banned,delegated_at,created_at,updated_at,password_changed_at,last_login_at,last_login_ip,last_user_agent,login_count")
      .order("created_at", { ascending: false }),
    admin.service
      .from("app_user_data")
      .select("user_id,saved,profile_progress,updated_at"),
    admin.service
      .from("app_user_login_events")
      .select("user_id,ip,user_agent,device_key,created_at")
      .order("created_at", { ascending: false })
      .limit(5000)
  ]);

  if (usersError || dataError) {
    return NextResponse.json({ error: "Không đọc được dữ liệu quản trị." }, { status: 500 });
  }

  const dataByUser = new Map((userData ?? []).map((item) => [item.user_id, item]));
  const eventsByUser = new Map<string, NonNullable<typeof loginEvents>>();
  for (const event of loginEvents ?? []) {
    const list = eventsByUser.get(event.user_id) ?? [];
    list.push(event);
    eventsByUser.set(event.user_id, list);
  }

  return NextResponse.json({
    users: (users ?? []).map((user) => {
      const data = dataByUser.get(user.id);
      const events = eventsByUser.get(user.id) ?? [];
      const deviceCount = new Set(events.map((event) => event.device_key).filter(Boolean)).size;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        banned: Boolean(user.is_banned),
        delegated: Boolean(user.delegated_at),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        passwordChangedAt: user.password_changed_at,
        lastLoginAt: user.last_login_at,
        lastLoginIp: user.last_login_ip,
        lastUserAgent: user.last_user_agent,
        loginCount: user.login_count ?? events.length,
        deviceCount,
        loginEvents: events.slice(0, 12).map((event) => ({
          ip: event.ip,
          userAgent: event.user_agent,
          deviceKey: event.device_key,
          createdAt: event.created_at
        })),
        dataUpdatedAt: data?.updated_at,
        saved: decryptJsonForUser(data?.saved, user.id, "saved", EMPTY_SAVED),
        profileProgress: decryptJsonForUser(data?.profile_progress, user.id, "profile_progress", EMPTY_PROFILE_PROGRESS)
      };
    })
  });
}

export async function PATCH(request: Request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const admin = await requireAdminAccess(session, true);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Lệnh quản trị không hợp lệ." }, { status: 400 });
  }

  if (parsed.data.userId === session.id && ["ban", "demote"].includes(parsed.data.action)) {
    return NextResponse.json({ error: "Không thể tự khóa hoặc hạ quyền chính mình." }, { status: 400 });
  }

  const patch = {
    ban: { is_banned: true },
    unban: { is_banned: false },
    delegate: { delegated_at: new Date().toISOString(), delegated_by: session.id },
    revokeDelegate: { delegated_at: null, delegated_by: null },
    promote: { role: "admin" },
    demote: { role: "member", delegated_at: null, delegated_by: null }
  }[parsed.data.action];

  const { error } = await admin.service
    .from("app_users")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) {
    return NextResponse.json({ error: "Không cập nhật được tài khoản." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
