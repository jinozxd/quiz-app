import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppSession } from "@/lib/app-auth";
import { getBearerToken, verifySessionToken } from "@/lib/app-auth";
import { decryptJsonForUser, encryptJsonForUser } from "@/lib/security/app-data-crypto";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const PROFILE_MEDIA_BUCKET = "profile-media";
const MIN_SYNC_LEVEL = 36;
const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_COVER_BYTES = 1536 * 1024;
const EMPTY_PROFILE_MEDIA = {};
const EMPTY_PROFILE_PROGRESS = { level: 1, xp: 0, awardedResultIds: [], unlockedAchievementIds: [] };

const uploadSchema = z.object({
  kind: z.enum(["avatar", "cover"]),
  dataUrl: z.string().startsWith("data:image/").max(2_400_000)
});

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

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  return {
    buffer: Buffer.from(match[2], "base64"),
    extension,
    mimeType
  };
}

async function getEligibility(service: NonNullable<ReturnType<typeof createServiceClient>>, session: AppSession) {
  if (session.role === "admin") {
    return { ok: true, level: 100 };
  }

  const { data } = await service
    .from("app_user_data")
    .select("profile_progress")
    .eq("user_id", session.id)
    .maybeSingle();
  const profileProgress = decryptJsonForUser(data?.profile_progress, session.id, "profile_progress", EMPTY_PROFILE_PROGRESS);
  return {
    ok: profileProgress.level >= MIN_SYNC_LEVEL,
    level: profileProgress.level
  };
}

async function removeOldProfileMedia(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
  kind: "avatar" | "cover",
  keepPath: string,
  knownOldPath?: string
) {
  const removePaths = new Set<string>();
  if (knownOldPath && knownOldPath !== keepPath) {
    removePaths.add(knownOldPath);
  }

  const { data: files } = await service.storage.from(PROFILE_MEDIA_BUCKET).list(userId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" }
  });

  for (const file of files ?? []) {
    const path = `${userId}/${file.name}`;
    if (file.name.startsWith(`${kind}-`) && path !== keepPath) {
      removePaths.add(path);
    }
  }

  if (removePaths.size > 0) {
    await service.storage.from(PROFILE_MEDIA_BUCKET).remove([...removePaths]);
  }
}

export async function POST(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `profile-media:${ip}`, limit: 12, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn đổi ảnh quá nhanh." }, { status: 429 });
  }

  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const liveUser = await requireLiveUser(session);
  if ("error" in liveUser) {
    return NextResponse.json({ error: liveUser.error }, { status: liveUser.status });
  }

  const eligibility = await getEligibility(liveUser.service, session);
  if (!eligibility.ok) {
    return NextResponse.json({ error: `Profile chỉ hỗ trợ sync khi đạt LV ${MIN_SYNC_LEVEL} trở lên.` }, { status: 403 });
  }

  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ảnh không hợp lệ." }, { status: 400 });
  }

  const image = parseImageDataUrl(parsed.data.dataUrl);
  if (!image) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP." }, { status: 400 });
  }

  const maxBytes = parsed.data.kind === "avatar" ? MAX_AVATAR_BYTES : MAX_COVER_BYTES;
  if (image.buffer.byteLength > maxBytes) {
    return NextResponse.json({ error: parsed.data.kind === "avatar" ? "Avatar tối đa 512KB." : "Ảnh bìa tối đa 1.5MB." }, { status: 413 });
  }

  const { data: existing } = await liveUser.service
    .from("app_user_data")
    .select("profile_media")
    .eq("user_id", session.id)
    .maybeSingle();
  const profileMedia = decryptJsonForUser<Record<string, { avatarPath?: string; coverPath?: string }>>(existing?.profile_media, session.id, "profile_media", EMPTY_PROFILE_MEDIA);
  const currentMedia = profileMedia[session.name] ?? {};
  const oldPath = parsed.data.kind === "avatar" ? currentMedia.avatarPath : currentMedia.coverPath;
  const newPath = `${session.id}/${parsed.data.kind}-${Date.now()}.${image.extension}`;

  const { error: uploadError } = await liveUser.service.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(newPath, image.buffer, {
      contentType: image.mimeType,
      upsert: false
    });

  if (uploadError) {
    return NextResponse.json({ error: "Không upload được ảnh profile. Kiểm tra bucket Supabase Storage." }, { status: 500 });
  }

  const nextMedia = {
    ...profileMedia,
    [session.name]: {
      ...currentMedia,
      [parsed.data.kind === "avatar" ? "avatarPath" : "coverPath"]: newPath
    }
  };

  const { error: saveError } = await liveUser.service
    .from("app_user_data")
    .upsert({
      user_id: session.id,
      profile_media: encryptJsonForUser(nextMedia, session.id, "profile_media"),
      updated_at: new Date().toISOString()
    });

  if (saveError) {
    void liveUser.service.storage.from(PROFILE_MEDIA_BUCKET).remove([newPath]);
    return NextResponse.json({ error: "Không lưu được ảnh profile." }, { status: 500 });
  }

  void removeOldProfileMedia(liveUser.service, session.id, parsed.data.kind, newPath, oldPath);

  const { data: signed } = await liveUser.service.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(newPath, 60 * 60);

  return NextResponse.json({
    kind: parsed.data.kind,
    url: signed?.signedUrl,
    minSyncLevel: MIN_SYNC_LEVEL
  });
}
