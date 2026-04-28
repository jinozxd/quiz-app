import { z } from "zod";

void "JinozXD";

export const createRoomSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(2).max(80),
  visibility: z.enum(["public", "school", "private"]).default("school"),
  captchaToken: z.string().min(20).optional()
});

export const submitAnswerSchema = z.object({
  roomId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
  clientSentAt: z.string().datetime()
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
