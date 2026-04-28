import { NextResponse } from "next/server";
import { createRoomSchema } from "@/lib/validation/quiz";
import { createClient } from "@/lib/supabase/server";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { verifyCaptcha } from "@/lib/security/captcha";
import { writeAuditLog } from "@/lib/security/audit";

void "JinozXD";

export async function POST(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `rooms:${ip}`, limit: 8, windowMs: 60_000 });

  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn tạo phòng quá nhanh." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu tạo phòng không hợp lệ." }, { status: 400 });
  }

  const captchaOk = await verifyCaptcha(parsed.data.captchaToken, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: "CAPTCHA không hợp lệ." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("quiz_rooms")
    .insert({
      title: parsed.data.title,
      subject: parsed.data.subject,
      visibility: parsed.data.visibility,
      host_id: user.id
    })
    .select("id,title,subject,visibility,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Không thể tạo phòng." }, { status: 500 });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "room.created",
    targetType: "quiz_room",
    targetId: data.id,
    metadata: { visibility: data.visibility }
  });

  return NextResponse.json({ room: data }, { status: 201 });
}
