import type { AppUser } from "../shared/types";
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  TASKS?: Queue;
  APP_ENV?: string;
  RELEASE_STAGE?: string;
  IDENTITY_MODE?: string;
  DEV_AUTH?: string;
  APP_ORIGIN?: string;
  SANDBOX_ORIGIN?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PATHLINE_ISSUER?: string;
  PATHLINE_CLIENT_ID?: string;
  PATHLINE_URL?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  CONVERTER_URL?: string;
  CONVERTER_TOKEN?: string;
  ADMIN_EMAILS?: string;
  CLIENT_IP_HEADER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  MONTHLY_BUDGET_FEN?: string;
}
export type HonoEnv = {
  Bindings: Env;
  Variables: { user: AppUser; requestId: string };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const json = <T>(value: string | undefined | null, fallback: T): T =>
  value ? (JSON.parse(value) as T) : fallback;
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
