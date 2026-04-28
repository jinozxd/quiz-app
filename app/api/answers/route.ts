import { NextResponse } from "next/server";
import { submitAnswerSchema } from "@/lib/validation/quiz";
import { getIp, rateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/security/audit";

void "JinozXD";

export async function POST(request: Request) {
  const ip = getIp(request);
  const limited = rateLimit({ key: `answers:${ip}`, limit: 90, windowMs: 60_000 });

  if (!limited.ok) {
    return NextResponse.json({ error: "Bạn gửi đáp án quá nhanh." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = submitAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đáp án không hợp lệ." }, { status: 400 });
  }

  const clientSentAt = new Date(parsed.data.clientSentAt).getTime();
  const now = Date.now();
  if (clientSentAt > now + 5_000 || clientSentAt < now - 10 * 60_000) {
    return NextResponse.json({ error: "Thời điểm gửi đáp án không hợp lệ." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Thiếu cấu hình server validation." }, { status: 500 });
  }

  const { data: option, error: optionError } = await service
    .from("question_options")
    .select("id,is_correct,question_id")
    .eq("id", parsed.data.optionId)
    .eq("question_id", parsed.data.questionId)
    .single();

  if (optionError || !option) {
    return NextResponse.json({ error: "Đáp án không tồn tại." }, { status: 404 });
  }

  const { error } = await service.from("answer_submissions").insert({
    room_id: parsed.data.roomId,
    question_id: parsed.data.questionId,
    option_id: parsed.data.optionId,
    user_id: user.id,
    is_correct: option.is_correct,
    client_sent_at: parsed.data.clientSentAt
  });

  if (error) {
    return NextResponse.json({ error: "Không thể ghi nhận đáp án." }, { status: 500 });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "answer.submitted",
    targetType: "question",
    targetId: parsed.data.questionId,
    metadata: { roomId: parsed.data.roomId }
  });

  return NextResponse.json({ correct: option.is_correct });
}
