import { NextResponse } from "next/server";
import type { AppSession } from "@/lib/app-auth";
import { getBearerToken, verifySessionToken } from "@/lib/app-auth";
import { decryptJsonForUser, encryptJsonForUser, isEncryptedJsonEnvelope } from "@/lib/security/app-data-crypto";
import { sanitizeAppDataPayload } from "@/lib/security/app-data-guard";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const MAX_PAYLOAD_BYTES = 750_000;
const EMPTY_SAVED = { items: {}, order: [], starredQuestionIds: [], results: [] };
const EMPTY_PROFILE_PROGRESS = { level: 1, xp: 0, awardedResultIds: [], unlockedAchievementIds: [] };
const EMPTY_PROFILE_MEDIA = {};
const PROFILE_MEDIA_BUCKET = "profile-media";

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
    .select("id,is_banned,password_changed_at")
    .eq("id", session.id)
    .maybeSingle();

  if (error || !user || user.is_banned) {
    return { error: "Phiên đăng nhập không còn hợp lệ.", status: 401 as const };
  }

  const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
  if (passwordChangedAt && passwordChangedAt > session.iat) {
    return { error: "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại.", status: 401 as const };
  }

  return { service };
}

async function signProfileMedia(service: NonNullable<ReturnType<typeof createServiceClient>>, profileMedia: Record<string, { avatarPath?: string; coverPath?: string }>) {
  const signed: Record<string, { avatar?: string; cover?: string }> = {};

  for (const [name, media] of Object.entries(profileMedia)) {
    const next: { avatar?: string; cover?: string } = {};
    if (media.avatarPath) {
      const { data } = await service.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(media.avatarPath, 60 * 60);
      if (data?.signedUrl) {
        next.avatar = data.signedUrl;
      }
    }
    if (media.coverPath) {
      const { data } = await service.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(media.coverPath, 60 * 60);
      if (data?.signedUrl) {
        next.cover = data.signedUrl;
      }
    }
    if (next.avatar || next.cover) {
      signed[name] = next;
    }
  }

  return signed;
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

  const saved = decryptJsonForUser(data?.saved, session.id, "saved", EMPTY_SAVED);
  const profileProgress = decryptJsonForUser(data?.profile_progress, session.id, "profile_progress", EMPTY_PROFILE_PROGRESS);
  const profileMedia = decryptJsonForUser<Record<string, { avatarPath?: string; coverPath?: string }>>(data?.profile_media, session.id, "profile_media", EMPTY_PROFILE_MEDIA);
  const clean = sanitizeAppDataPayload({
    saved,
    profileMedia,
    profileProgress
  }, session);
  const signedProfileMedia = await signProfileMedia(liveUser.service, profileMedia);

  if (clean && data && (!isEncryptedJsonEnvelope(data.saved) || !isEncryptedJsonEnvelope(data.profile_progress) || !isEncryptedJsonEnvelope(data.profile_media))) {
    try {
      void liveUser.service.from("app_user_data").upsert({
        user_id: session.id,
        saved: encryptJsonForUser(clean.saved, session.id, "saved"),
        profile_media: encryptJsonForUser(profileMedia, session.id, "profile_media"),
        profile_progress: encryptJsonForUser(clean.profileProgress, session.id, "profile_progress"),
        updated_at: new Date().toISOString()
      });
    } catch {
      return NextResponse.json({ error: "Thiếu khóa mã hóa dữ liệu học tập." }, { status: 500 });
    }
  }

  return NextResponse.json({
    saved: clean?.saved ?? undefined,
    profileMedia: signedProfileMedia,
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

  let encryptedSaved: ReturnType<typeof encryptJsonForUser>;
  let encryptedProfileProgress: ReturnType<typeof encryptJsonForUser>;
  let encryptedProfileMedia: ReturnType<typeof encryptJsonForUser>;
  try {
    encryptedSaved = encryptJsonForUser(clean.saved, session.id, "saved");
    encryptedProfileProgress = encryptJsonForUser(clean.profileProgress, session.id, "profile_progress");
    const { data: existing } = await liveUser.service
      .from("app_user_data")
      .select("profile_media")
      .eq("user_id", session.id)
      .maybeSingle();
    const profileMedia = decryptJsonForUser(existing?.profile_media, session.id, "profile_media", EMPTY_PROFILE_MEDIA);
    encryptedProfileMedia = encryptJsonForUser(profileMedia, session.id, "profile_media");
  } catch {
    return NextResponse.json({ error: "Thiếu khóa mã hóa dữ liệu học tập." }, { status: 500 });
  }

  const { error } = await liveUser.service.from("app_user_data").upsert({
    user_id: session.id,
    saved: encryptedSaved,
    profile_media: encryptedProfileMedia,
    profile_progress: encryptedProfileProgress,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: "Không lưu được dữ liệu học tập." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
