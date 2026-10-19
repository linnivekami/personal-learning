import { ApiError, uid, now, type Env } from "./env";
import { first, run } from "./db";
import { limitsFor } from "./quota";
import { policy } from "../shared/core";
export async function putPrivateObject(
  env: Env,
  user: string,
  key: string,
  bytes: Uint8Array | ArrayBuffer,
  options: R2PutOptions = {},
  material: string | null = null,
  expires: string | null = null,
) {
  if (!key.startsWith(`${user}/`))
    throw new Error("Object must be owner-scoped");
  const limits = await limitsFor(env);
  const size = bytes.byteLength,
    version = uid(),
    old = await first<{ size: number; version: string }>(
      env,
      "SELECT size,version FROM stored_objects WHERE key=? AND user_id=?",
      key,
      user,
    );
  const updated = await run(
    env,
    `INSERT INTO stored_objects(key,user_id,material_id,size,version,expires_at,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM stored_objects WHERE user_id=? AND key<>?)+?<=? AND (SELECT COALESCE(SUM(size),0) FROM stored_objects WHERE key<>?)+?<=? ON CONFLICT(key) DO UPDATE SET size=excluded.size,version=excluded.version,expires_at=excluded.expires_at`,
    key,
    user,
    material,
    size,
    version,
    expires,
    now(),
    user,
    key,
    size,
    limits.storageBytes,
    key,
    size,
    limits.globalStorageBytes,
  );
  if (!updated.meta.changes)
    throw new ApiError(429, "STORAGE_LIMIT", "个人或平台存储空间不足。");
  try {
    await env.BUCKET.put(key, bytes, options);
  } catch (e) {
    if (old)
      await run(
        env,
        "UPDATE stored_objects SET size=?,version=? WHERE key=? AND version=?",
        old.size,
        old.version,
        key,
        version,
      );
    else
      await run(
        env,
        "DELETE FROM stored_objects WHERE key=? AND version=?",
        key,
        version,
      );
    throw e;
  }
}
export async function cleanupExpiredObjects(env: Env) {
  const expired = await env.DB.prepare(
    "SELECT key FROM stored_objects WHERE expires_at IS NOT NULL AND expires_at<? LIMIT 100",
  )
    .bind(now())
    .all<{ key: string }>();
  for (const o of expired.results) {
    await env.BUCKET.delete(o.key);
    await run(env, "DELETE FROM stored_objects WHERE key=?", o.key);
  }
}
