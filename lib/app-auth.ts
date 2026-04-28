import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { env } from "@/lib/env";

const scrypt = promisify(scryptCallback);
const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AppSession = {
  id: string;
  name: string;
  role: "admin" | "member";
  iat: number;
  exp: number;
};

function getSecret() {
  if (!env.AUDIT_LOG_SECRET || env.AUDIT_LOG_SECRET.length < 24) {
    throw new Error("AUDIT_LOG_SECRET must be set to at least 24 characters for app sessions.");
  }

  return env.AUDIT_LOG_SECRET;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return {
    hash: derivedKey.toString("base64url"),
    salt
  };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(hash, "base64url");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

export function createSessionToken(session: Omit<AppSession, "exp" | "iat"> & { iat?: number }) {
  const now = Date.now();
  const payload = JSON.stringify({ ...session, iat: session.iat ?? now, exp: now + TOKEN_TTL_MS });
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload);
  return `${TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): AppSession | null {
  if (!token) {
    return null;
  }

  const [version, encodedPayload, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const session = JSON.parse(fromBase64Url(encodedPayload)) as AppSession;
    if (!session.id || !session.name || !session.iat || (session.role !== "admin" && session.role !== "member") || session.exp < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}
