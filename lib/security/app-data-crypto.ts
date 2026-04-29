import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ENCRYPTION_VERSION = 1;

type EncryptedJsonEnvelope = {
  __encrypted: true;
  v: typeof ENCRYPTION_VERSION;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

export function isEncryptedJsonEnvelope(value: unknown) {
  return Boolean(value && typeof value === "object" && "__encrypted" in value);
}

function getKey() {
  const secret = env.APP_DATA_ENCRYPTION_KEY || env.AUDIT_LOG_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("APP_DATA_ENCRYPTION_KEY or AUDIT_LOG_SECRET must be set to encrypt app data.");
  }

  return createHash("sha256").update(secret).digest();
}

function getAad(userId: string, field: string) {
  return Buffer.from(`app_user_data:${userId}:${field}`);
}

export function encryptJsonForUser(value: unknown, userId: string, field: string): EncryptedJsonEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(getAad(userId, field));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);

  return {
    __encrypted: true,
    v: ENCRYPTION_VERSION,
    alg: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url")
  };
}

export function decryptJsonForUser<T>(value: unknown, userId: string, field: string, fallback: T): T {
  if (!value || typeof value !== "object" || !("__encrypted" in value)) {
    return (value ?? fallback) as T;
  }

  const envelope = value as Partial<EncryptedJsonEnvelope>;
  if (
    envelope.__encrypted !== true ||
    envelope.v !== ENCRYPTION_VERSION ||
    envelope.alg !== "aes-256-gcm" ||
    !envelope.iv ||
    !envelope.tag ||
    !envelope.data
  ) {
    return fallback;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(envelope.iv, "base64url"));
    decipher.setAAD(getAad(userId, field));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64url")),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return fallback;
  }
}
