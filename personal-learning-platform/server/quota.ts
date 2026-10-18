import { policy, localDay } from "../shared/core";
import type { Usage } from "../shared/types";
import type { Env } from "./env";
import { ApiError, uid, now } from "./env";
import { first, run } from "./db";
export interface Reservation {
  id: string;
  userId: string;
  month: string;
  bucket: "model" | "voice";
  fen: number;
  input: number;
  output: number;
  asr: number;
  tts: number;
  pages: number;
}
export async function reserve(
  env: Env,
  userId: string,
  bucket: "model" | "voice",
  fen: number,
  amount: Partial<{
    input: number;
    output: number;
    asr: number;
    tts: number;
    pages: number;
  }> = {},
): Promise<Reservation> {
  const profile = await first<{ timezone: string }>(
    env,
    "SELECT timezone FROM profiles WHERE user_id=?",
    userId,
  );
  const day = localDay(new Date(), profile?.timezone ?? "Asia/Singapore"),
    month = new Date().toISOString().slice(0, 7);
  const config = await first<{ value: string }>(
    env,
    "SELECT value FROM settings WHERE key='quota'",
  );
  const limits = {
    ...policy.limits,
    ...(config ? JSON.parse(config.value) : {}),
  };
  const budget = await first<{ value: string }>(
    env,
    "SELECT value FROM settings WHERE key='budget'",
  );
  const b = { ...policy.budget, ...(budget ? JSON.parse(budget.value) : {}) };
  const cap = bucket === "model" ? b.modelFen : b.voiceFen;
  await run(
    env,
    "INSERT INTO budgets(month,bucket,limit_fen) VALUES(?,?,?) ON CONFLICT(month,bucket) DO UPDATE SET limit_fen=excluded.limit_fen",
    month,
    bucket,
    cap,
  );
  const r: Reservation = {
    id: uid(),
    userId,
    month,
    bucket,
    fen: Math.max(1, Math.ceil(fen)),
    input: amount.input ?? 0,
    output: amount.output ?? 0,
    asr: amount.asr ?? 0,
    tts: amount.tts ?? 0,
    pages: amount.pages ?? 0,
  };
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO reservations(id,user_id,day,month,bucket,status,reserved_fen,input_tokens,output_tokens,asr_seconds,tts_characters,pages,created_at)
 SELECT ?,?,?,?,?,'reserved',?,?,?,?,?,?,? WHERE
 (SELECT spent+reserved FROM budgets WHERE month=? AND bucket=?)+? <= (SELECT limit_fen FROM budgets WHERE month=? AND bucket=?)
 AND (SELECT COALESCE(SUM(spent+reserved),0) FROM budgets WHERE month=?)+?<=?
 AND (SELECT COALESCE(SUM(input_tokens),0) FROM reservations WHERE user_id=? AND day=? AND status!='cancelled')+?<=?
 AND (SELECT COALESCE(SUM(output_tokens),0) FROM reservations WHERE user_id=? AND day=? AND status!='cancelled')+?<=?
 AND (SELECT COALESCE(SUM(asr_seconds),0) FROM reservations WHERE user_id=? AND day=? AND status!='cancelled')+?<=?
 AND (SELECT COALESCE(SUM(tts_characters),0) FROM reservations WHERE user_id=? AND day=? AND status!='cancelled')+?<=?
 AND (SELECT COALESCE(SUM(pages),0) FROM reservations WHERE user_id=? AND month=? AND status!='cancelled')+?<=?`,
    ).bind(
      r.id,
      userId,
      day,
      month,
      bucket,
      r.fen,
      r.input,
      r.output,
      r.asr,
      r.tts,
      r.pages,
      now(),
      month,
      bucket,
      r.fen,
      month,
      bucket,
      month,
      r.fen,
      Math.min(
        b.totalFen - b.infrastructureFen - b.reserveFen,
        Number(env.MONTHLY_BUDGET_FEN ?? 30000) -
          b.infrastructureFen -
          b.reserveFen,
      ),
      userId,
      day,
      r.input,
      limits.dailyInputTokens,
      userId,
      day,
      r.output,
      limits.dailyOutputTokens,
      userId,
      day,
      r.asr,
      limits.dailyAsrSeconds,
      userId,
      day,
      r.tts,
      limits.dailyTtsCharacters,
      userId,
      month,
      r.pages,
      limits.monthlyMaterialPages,
    ),
    env.DB.prepare(
      "UPDATE budgets SET reserved=reserved+? WHERE month=? AND bucket=? AND EXISTS(SELECT 1 FROM reservations WHERE id=? AND status='reserved')",
    ).bind(r.fen, month, bucket, r.id),
  ]);
  if (!results[0].meta.changes)
    throw new ApiError(
      429,
      "QUOTA_EXCEEDED",
      "今日个人额度或全站预算不足。已有资料、笔记和本地练习仍可使用。",
    );
  return r;
}
export async function settle(
  env: Env,
  r: Reservation,
  actualFen: number,
  actual: Partial<{
    input: number;
    output: number;
    asr: number;
    tts: number;
  }> = {},
  uncertain = false,
) {
  const cost = Math.max(0, Math.ceil(actualFen));
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE budgets SET reserved=MAX(0,reserved-?),spent=spent+? WHERE month=? AND bucket=? AND EXISTS(SELECT 1 FROM reservations WHERE id=? AND status='reserved')",
    ).bind(r.fen, cost, r.month, r.bucket, r.id),
    env.DB.prepare(
      "UPDATE reservations SET status=?,actual_fen=?,input_tokens=?,output_tokens=?,asr_seconds=?,tts_characters=?,completed_at=? WHERE id=? AND status='reserved'",
    ).bind(
      uncertain ? "uncertain" : "settled",
      cost,
      actual.input ?? r.input,
      actual.output ?? r.output,
      actual.asr ?? r.asr,
      actual.tts ?? r.tts,
      now(),
      r.id,
    ),
  ]);
}
export async function usageFor(env: Env, userId: string): Promise<Usage> {
  const p = await first<{ timezone: string }>(
    env,
    "SELECT timezone FROM profiles WHERE user_id=?",
    userId,
  );
  const day = localDay(new Date(), p?.timezone ?? "Asia/Singapore");
  const a = await first<Record<string, number>>(
    env,
    "SELECT COALESCE(SUM(input_tokens),0) inputTokens,COALESCE(SUM(output_tokens),0) outputTokens,COALESCE(SUM(asr_seconds),0) asrSeconds,COALESCE(SUM(tts_characters),0) ttsCharacters FROM reservations WHERE user_id=? AND day=? AND status!='cancelled'",
    userId,
    day,
  );
  const b = await first<{ pages: number }>(
    env,
    "SELECT COALESCE(SUM(pages),0) pages FROM reservations WHERE user_id=? AND month=? AND status!='cancelled'",
    userId,
    new Date().toISOString().slice(0, 7),
  );
  const c = await first<{ bytes: number }>(
    env,
    "SELECT COALESCE(SUM(size),0) bytes FROM stored_objects WHERE user_id=?",
    userId,
  );
  return {
    inputTokens: a?.inputTokens ?? 0,
    outputTokens: a?.outputTokens ?? 0,
    asrSeconds: a?.asrSeconds ?? 0,
    ttsCharacters: a?.ttsCharacters ?? 0,
    materialPages: b?.pages ?? 0,
    storageBytes: c?.bytes ?? 0,
  };
}

export async function limitsFor(env: Env) {
  const r = await first<{ value: string }>(
    env,
    "SELECT value FROM settings WHERE key='quota'",
  );
  return {
    ...policy.limits,
    ...(r ? JSON.parse(r.value) : {}),
  } as typeof policy.limits;
}
