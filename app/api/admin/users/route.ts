import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppSession } from "@/lib/app-auth";
import { createSessionToken, getBearerToken, verifyPassword, verifySessionToken } from "@/lib/app-auth";
import { decryptJsonForUser, encryptJsonForUser } from "@/lib/security/app-data-crypto";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { recordAppSessionActivity } from "@/lib/security/session-activity";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const EMPTY_SAVED = { items: {}, order: [], starredQuestionIds: [], wrongPracticeSeen: {}, results: [] };
const EMPTY_PROFILE_PROGRESS = { level: 1, xp: 0, awardedResultIds: [] as string[], unlockedAchievementIds: [] as string[] };
const NAME_CHANGE_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    userId: z.string().uuid(),
    action: z.enum(["ban", "unban", "delegate", "revokeDelegate", "promote", "demote"])
  }),
  z.object({
    userId: z.string().uuid(),
    action: z.literal("editProfile"),
    name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}_ .-]+$/u).optional(),
    email: z.string().trim().email().max(120).optional(),
    password: z.string().min(6).max(128).optional(),
    level: z.number().int().min(1).max(9999).optional(),
    xp: z.number().int().min(0).max(100).optional(),
    unlockedAchievementIds: z.array(z.string()).optional()
  })
]);

type SessionUser = {
  id: string;
  name: string;
  role: "admin" | "member";
  delegated_at?: string | null;
  name_changed_at?: string | null;
};

function getSession(request: Request) {
  return verifySessionToken(getBearerToken(request));
}

function cleanSessionUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    delegated: Boolean(user.delegated_at),
    nameChangedAt: user.name_changed_at
  };
}

function getDatabaseUpdateMessage(error: { code?: string } | null | undefined) {
  if (error?.code === "23505") {
    return { error: "Email hoặc tên này đã có người dùng khác.", status: 409 as const };
  }

  return { error: "Không cập nhật được thông tin tài khoản.", status: 500 as const };
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST204" || message.includes("could not find") || message.includes("column");
}

async function requireAdminAccess(session: AppSession, request: Request, write = false) {
  const service = createServiceClient();
  if (!service) {
    return { error: "Thiếu cấu hình database server.", status: 500 as const };
  }

  let { data: user, error } = await service
    .from("app_users")
    .select("id,role,delegated_at,is_banned,password_changed_at,name_changed_at,password_hash,password_salt")
    .eq("id", session.id)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    const fallback = await service
      .from("app_users")
      .select("id,role,password_changed_at,password_hash,password_salt")
      .eq("id", session.id)
      .maybeSingle();
    user = fallback.data ? { ...fallback.data, delegated_at: null, is_banned: false, name_changed_at: null } : null;
    error = fallback.error;
  }

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

  await recordAppSessionActivity(service, session.id, request);

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

  const admin = await requireAdminAccess(session, request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let { data: users, error: usersError } = await admin.service
    .from("app_users")
    .select("id,email,name,role,is_banned,delegated_at,created_at,updated_at,password_changed_at,name_changed_at,last_login_at,last_login_ip,last_user_agent,login_count")
    .order("created_at", { ascending: false });

  if (usersError && isMissingColumnError(usersError)) {
    const fallback = await admin.service
      .from("app_users")
      .select("id,email,name,role,created_at,updated_at,password_changed_at")
      .order("created_at", { ascending: false });
    users = (fallback.data ?? []).map((user) => ({
      ...user,
      is_banned: false,
      delegated_at: null,
      name_changed_at: null,
      last_login_at: null,
      last_login_ip: null,
      last_user_agent: null,
      login_count: 0
    }));
    usersError = fallback.error;
  }

  const [{ data: userData, error: dataError }, { data: loginEvents, error: loginEventsError }] = await Promise.all([
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

  const canSeeAccountDetails = admin.user.role === "admin";
  const dataByUser = new Map((userData ?? []).map((item) => [item.user_id, item]));
  const eventsByUser = new Map<string, NonNullable<typeof loginEvents>>();
  for (const event of loginEventsError ? [] : loginEvents ?? []) {
    const list = eventsByUser.get(event.user_id) ?? [];
    list.push(event);
    eventsByUser.set(event.user_id, list);
  }

  return NextResponse.json({
    users: (users ?? []).map((user) => {
      const data = dataByUser.get(user.id);
      const events = eventsByUser.get(user.id) ?? [];
      const deviceCount = new Set(events.map((event) => event.device_key).filter(Boolean)).size || (user.last_user_agent || user.last_login_ip ? 1 : 0);

      return {
        id: user.id,
        email: canSeeAccountDetails ? user.email : "",
        name: user.name,
        role: user.role,
        banned: Boolean(user.is_banned),
        delegated: Boolean(user.delegated_at),
        createdAt: canSeeAccountDetails ? user.created_at : undefined,
        updatedAt: canSeeAccountDetails ? user.updated_at : data?.updated_at,
        passwordChangedAt: canSeeAccountDetails ? user.password_changed_at : undefined,
        lastLoginAt: canSeeAccountDetails ? user.last_login_at : undefined,
        lastLoginIp: canSeeAccountDetails ? user.last_login_ip : undefined,
        lastUserAgent: canSeeAccountDetails ? user.last_user_agent : undefined,
        loginCount: user.login_count ?? events.length,
        deviceCount: canSeeAccountDetails ? deviceCount : 0,
        loginEvents: canSeeAccountDetails
          ? events.slice(0, 12).map((event) => ({
              ip: event.ip,
              userAgent: event.user_agent,
              deviceKey: event.device_key,
              createdAt: event.created_at
            }))
          : [],
        dataUpdatedAt: data?.updated_at,
        nameChangedAt: user.name_changed_at,
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

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Lệnh quản trị không hợp lệ." }, { status: 400 });
  }

  const isSelf = parsed.data.userId === session.id;
  const admin = await requireAdminAccess(session, request, !isSelf);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (parsed.data.userId === session.id && ["ban", "demote"].includes(parsed.data.action)) {
    return NextResponse.json({ error: "Không thể tự khóa hoặc hạ quyền chính mình." }, { status: 400 });
  }

  if (parsed.data.action === "editProfile") {
    const { userId, name, email, password, level, xp, unlockedAchievementIds } = parsed.data;
    let updatedSessionUser: SessionUser | null = null;

    const accountPatch: Record<string, any> = {};
    if (name) {
      if (!password) {
        return NextResponse.json({ error: "Cần nhập mật khẩu để đổi tên tài khoản." }, { status: 400 });
      }

      const { data: targetUser } = await admin.service
        .from("app_users")
        .select("password_hash,password_salt,role,delegated_at,name_changed_at")
        .eq("id", userId)
        .single();

      if (!targetUser || !(await verifyPassword(password, targetUser.password_hash, targetUser.password_salt))) {
        return NextResponse.json({ error: "Mật khẩu xác nhận không đúng." }, { status: 401 });
      }

      const isPrivileged = targetUser.role === "admin" || Boolean(targetUser.delegated_at);
      if (!isPrivileged && targetUser.name_changed_at) {
        const lastChanged = new Date(targetUser.name_changed_at).getTime();
        const elapsed = Date.now() - lastChanged;
        if (elapsed < NAME_CHANGE_COOLDOWN_MS) {
          const remainingDays = Math.ceil((NAME_CHANGE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
          return NextResponse.json({ error: `Bạn chỉ có thể đổi tên sau mỗi 3 tháng. Vui lòng đợi thêm ${remainingDays} ngày.` }, { status: 429 });
        }
      }

      accountPatch.name = name;
      accountPatch.name_changed_at = new Date().toISOString();
    }
    if (email) accountPatch.email = email.toLowerCase();

    if (Object.keys(accountPatch).length > 0) {
      const { data: updatedUser, error: userError } = await admin.service
        .from("app_users")
        .update({ ...accountPatch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id,name,role,delegated_at,name_changed_at")
        .single();

      if (userError || !updatedUser) {
        const message = getDatabaseUpdateMessage(userError);
        return NextResponse.json({ error: message.error }, { status: message.status });
      }

      updatedSessionUser = updatedUser as SessionUser;
    }

    if (level !== undefined || xp !== undefined || unlockedAchievementIds !== undefined) {
      const { data: userData, error: dataError } = await admin.service
        .from("app_user_data")
        .select("profile_progress")
        .eq("user_id", userId)
        .maybeSingle();

      if (dataError) {
        return NextResponse.json({ error: "Không đọc được dữ liệu tiến trình." }, { status: 500 });
      }

      const currentProgress = decryptJsonForUser(userData?.profile_progress, userId, "profile_progress", EMPTY_PROFILE_PROGRESS);
      const newProgress = { ...currentProgress };
      if (level !== undefined) newProgress.level = level;
      if (xp !== undefined) newProgress.xp = xp;
      if (unlockedAchievementIds !== undefined) newProgress.unlockedAchievementIds = unlockedAchievementIds;

      const { error: saveError } = await admin.service
        .from("app_user_data")
        .upsert({
          user_id: userId,
          profile_progress: encryptJsonForUser(newProgress, userId, "profile_progress"),
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (saveError) {
        return NextResponse.json({ error: "Không lưu được tiến trình." }, { status: 500 });
      }
    }

    if (userId === session.id) {
      if (!updatedSessionUser) {
        const { data: current } = await admin.service
          .from("app_users")
          .select("id,name,role,delegated_at,name_changed_at")
          .eq("id", userId)
          .single();
        updatedSessionUser = current as SessionUser | null;
      }

      if (updatedSessionUser) {
        const user = cleanSessionUser(updatedSessionUser);
        return NextResponse.json({ ok: true, user, token: createSessionToken(user) });
      }
    }

    return NextResponse.json({ ok: true });
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
