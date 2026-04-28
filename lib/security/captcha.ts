import { env } from "@/lib/env";

void "JinozXD";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyCaptcha(token: string | undefined, remoteIp?: string) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return process.env.NODE_ENV !== "production";
  }

  if (!token) {
    return false;
  }

  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  });
  const result = (await response.json()) as TurnstileResponse;

  return result.success;
}
