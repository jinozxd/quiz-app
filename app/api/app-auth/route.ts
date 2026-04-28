import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getBearerToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/app-auth";
import { writeAuditLog } from "@/lib/security/audit";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const PASSWORD_CHANGE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
const RESERVED_PUBLIC_NAMES = new Set(["admin", "administrator", "admintrator"]);

const loginSchema = z.object({
  action: z.literal("login"),
  name: z.string().trim().min(2).max(40),
  password: z.string().min(6).max(128)
});

const registerSchema = z.object({
  action: z.literal("register"),
  email: z.string().trim().email().max(120),
  name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}_ .-]+$/u),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
});

const changePasswordSchema = z.object({
  action: z.literal("change-password"),
  currentPassword: z.string().min(6).max(128),
  nextPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
});

const requestSchema = z.discriminatedUnion("action", [loginSchema, registerSchema, changePasswordSchema]);

function cleanUser(user: { id: string; name: string; role: "admin" | "member" }) {
  return {
    id: user.id,
    name: user.name,
    role: user.role
  };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `app-auth:${ip}`, limit: 15, windowMs: 60_000 });

  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn thao tác đăng nhập quá nhanh." }, { status: 429 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Thiếu cấu hình database server." }, { status: 500 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu tài khoản không hợp lệ." }, { status: 400 });
  }

  if (parsed.data.action === "register") {
    const registerLimited = rateLimit({ key: `app-auth-register:${ip}`, limit: 4, windowMs: 10 * 60_000 });
    if (!registerLimited.ok) {
      return NextResponse.json({ error: "Bạn tạo tài khoản quá nhanh, thử lại sau ít phút." }, { status: 429 });
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json({ error: "Mật khẩu xác nhận không khớp." }, { status: 400 });
    }

    if (RESERVED_PUBLIC_NAMES.has(normalizeName(parsed.data.name))) {
      return NextResponse.json({ error: "Tên này được giữ riêng cho quản trị, vui lòng chọn tên khác." }, { status: 400 });
    }

    const { hash, salt } = await hashPassword(parsed.data.password);
    const { data, error } = await service
      .from("app_users")
      .insert({
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        password_hash: hash,
        password_salt: salt,
        role: "member"
      })
      .select("id,name,role")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Email hoặc tên này đã có người dùng." }, { status: 409 });
    }

    await service.from("app_user_data").insert({ user_id: data.id });
    await writeAuditLog({ actorId: null, action: "app_user.registered", targetType: "app_user", targetId: data.id });

    const user = cleanUser(data);
    return NextResponse.json({ user, token: createSessionToken(user) }, { status: 201 });
  }

  if (parsed.data.action === "login") {
    const nameKey = parsed.data.name.toLowerCase();
    const loginLimited = rateLimit({ key: `app-auth-login:${ip}:${nameKey}`, limit: 6, windowMs: 10 * 60_000 });
    if (!loginLimited.ok) {
      return NextResponse.json({ error: "Tài khoản này đăng nhập sai quá nhiều lần. Thử lại sau ít phút." }, { status: 429 });
    }

    const { data: user } = await service
      .from("app_users")
      .select("id,name,role,password_hash,password_salt")
      .eq("name", parsed.data.name)
      .maybeSingle();

    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash, user.password_salt))) {
      return NextResponse.json({ error: "Sai tên đăng nhập hoặc mật khẩu." }, { status: 401 });
    }

    await writeAuditLog({ actorId: null, action: "app_user.logged_in", targetType: "app_user", targetId: user.id });
    const clean = cleanUser(user);
    return NextResponse.json({ user: clean, token: createSessionToken(clean) });
  }

  const session = verifySessionToken(getBearerToken(request));
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  if (parsed.data.nextPassword !== parsed.data.confirmPassword) {
    return NextResponse.json({ error: "Mật khẩu xác nhận không khớp." }, { status: 400 });
  }

  const { data: user } = await service
    .from("app_users")
    .select("id,name,role,password_hash,password_salt,password_changed_at")
    .eq("id", session.id)
    .single();

  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash, user.password_salt))) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 401 });
  }

  const lastChangedAt = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
  if (lastChangedAt && lastChangedAt > session.iat) {
    return NextResponse.json({ error: "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (lastChangedAt && Date.now() - lastChangedAt < PASSWORD_CHANGE_COOLDOWN_MS) {
    return NextResponse.json({ error: "Bạn chỉ có thể đổi mật khẩu sau 15 ngày từ lần đổi gần nhất." }, { status: 429 });
  }

  const { hash, salt } = await hashPassword(parsed.data.nextPassword);
  await service
    .from("app_users")
    .update({ password_hash: hash, password_salt: salt, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", session.id);

  await writeAuditLog({ actorId: null, action: "app_user.password_changed", targetType: "app_user", targetId: session.id });
  const clean = cleanUser(user);
  return NextResponse.json({ ok: true, user: clean, token: createSessionToken(clean) });
}
