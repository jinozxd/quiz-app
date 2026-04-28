import { NextResponse } from "next/server";
import type { AppSession } from "@/lib/app-auth";
import { getBearerToken, verifySessionToken } from "@/lib/app-auth";
import { sanitizeAppDataPayload } from "@/lib/security/app-data-guard";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const MAX_PAYLOAD_BYTES = 750_000;

function getSession(request: Request) {
  return verifySessionToken(getBearerToken(request));
}

async function requireLiveUser(session: AppSession) {
  const service = createServiceClient();
  if (!service) {
    return { error: "Thiếu cấu hình database server.", status: 500 as const };
  }

  const { data: user, error } = await service
    .from("app_users")
    .select("id,password_changed_at")
    .eq("id", session.id)
    .maybeSingle();

  if (error || !user) {
    return { error: "Phiên đăng nhập không còn hợp lệ.", status: 401 as const };
  }

  const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
  if (passwordChangedAt && passwordChangedAt > session.iat) {
    return { error: "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại.", status: 401 as const };
  }

  return { service };
}

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const liveUser = await requireLiveUser(session);
  if ("error" in liveUser) {
    return NextResponse.json({ error: liveUser.error }, { status: liveUser.status });
  }

  const { data, error } = await liveUser.service
    .from("app_user_data")
    .select("saved,profile_media,profile_progress,updated_at")
    .eq("user_id", session.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Không đọc được dữ liệu học tập." }, { status: 500 });
  }

  const clean = sanitizeAppDataPayload({
    saved: data?.saved ?? { items: {}, order: [], starredQuestionIds: [], results: [] },
    profileMedia: data?.profile_media ?? {},
    profileProgress: data?.profile_progress ?? undefined
  }, session);

  return NextResponse.json({
    saved: clean?.saved ?? undefined,
    profileMedia: clean?.profileMedia ?? undefined,
    profileProgress: clean?.profileProgress ?? undefined,
    updatedAt: data?.updated_at ?? undefined
  });
}

export async function PUT(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `app-data:${ip}`, limit: 30, windowMs: 60_000 });

  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn đồng bộ dữ liệu quá nhanh." }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Dữ liệu đồng bộ quá lớn." }, { status: 413 });
  }

  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const clean = sanitizeAppDataPayload(payload, session);
  if (!clean) {
    return NextResponse.json({ error: "Dữ liệu học tập không hợp lệ." }, { status: 400 });
  }

  const liveUser = await requireLiveUser(session);
  if ("error" in liveUser) {
    return NextResponse.json({ error: liveUser.error }, { status: liveUser.status });
  }

  const { error } = await liveUser.service.from("app_user_data").upsert({
    user_id: session.id,
    saved: clean.saved,
    profile_media: clean.profileMedia,
    profile_progress: clean.profileProgress,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: "Không lưu được dữ liệu học tập." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
