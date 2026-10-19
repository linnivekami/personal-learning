import { putPrivateObject, cleanupExpiredObjects } from "./storage";
import type { Env } from "./env";
import { ApiError, uid, now, json } from "./env";
import { first, rows, run } from "./db";
import { addSource, base64, digest } from "./media";
import { generate } from "./llm";
import { z } from "zod";
import { localDay, policy } from "../shared/core";
import { reserve, settle } from "./quota";
import { unsubscribeURL } from "./unsubscribe";
import { sendMail } from "./auth";
import webPush from "web-push";
export async function enqueue(
  env: Env,
  userId: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  const id = uid();
  await run(
    env,
    "INSERT INTO jobs(id,user_id,kind,payload,status,next_run,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?)",
    id,
    userId,
    kind,
    JSON.stringify(payload),
    now(),
    now(),
    now(),
  );
  if (env.TASKS) await env.TASKS.send({ jobId: id });
  return id;
}
interface Job {
  id: string;
  user_id: string;
  kind: string;
  payload: string;
  attempts: number;
  status: string;
}
export async function processJob(env: Env, id: string) {
  const claimed = await run(
    env,
    "UPDATE jobs SET status='running',lease_until=?,attempts=attempts+1,updated_at=? WHERE id=? AND (status='pending' OR (status='running' AND lease_until<?))",
    new Date(Date.now() + 600000).toISOString(),
    now(),
    id,
    now(),
  );
  if (!claimed.meta.changes) return;
  const job = (await first<Job>(env, "SELECT * FROM jobs WHERE id=?", id))!;
  try {
    if (job.kind === "material") await materialJob(env, job);
    else if (job.kind === "vision") await visionJob(env, job);
    else if (job.kind === "backup") await backupJob(env, job);
    else if (job.kind === "reminder") await sendReminders(env);
    else throw new Error("Unknown background job");
    await run(
      env,
      "UPDATE jobs SET status='done',error=NULL,lease_until=NULL,updated_at=? WHERE id=?",
      now(),
      id,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "后台任务失败";
    const retry =
      job.attempts < 3 &&
      !(e instanceof ApiError && [400, 413, 415, 429, 503].includes(e.status));
    await run(
      env,
      "UPDATE jobs SET status=?,error=?,next_run=?,lease_until=NULL,updated_at=? WHERE id=?",
      retry ? "pending" : "failed",
      message,
      new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString(),
      now(),
      id,
    );
    const p = json<{ materialId?: string }>(job.payload, {});
    if (p.materialId)
      await run(
        env,
        "UPDATE materials SET status='failed',error=?,updated_at=? WHERE id=? AND user_id=?",
        message,
        now(),
        p.materialId,
        job.user_id,
      );
    if (retry && env.TASKS)
      await env.TASKS.send(
        { jobId: id },
        { delaySeconds: Math.pow(2, job.attempts) * 60 },
      );
  }
}
export async function handleQueue(
  batch: MessageBatch<{ jobId: string }>,
  env: Env,
) {
  for (const message of batch.messages) {
    await processJob(env, message.body.jobId);
    message.ack();
  }
}
export async function processDueJobs(env: Env) {
  const due = await rows<{ id: string }>(
    env,
    "SELECT id FROM jobs WHERE (status='pending' AND next_run<=?) OR (status='running' AND lease_until<?) ORDER BY next_run LIMIT 5",
    now(),
    now(),
  );
  for (const j of due) {
    if (env.TASKS) await env.TASKS.send({ jobId: j.id });
    else await processJob(env, j.id);
  }
  await sendReminders(env);
  await cleanupExpiredObjects(env);
}
async function materialJob(env: Env, job: Job) {
  const { materialId } = json<{ materialId: string }>(job.payload, {
    materialId: "",
  });
  const m = await first<{
    id: string;
    mime: string;
    object_key: string;
    name: string;
    course_id: string;
    status: string;
  }>(
    env,
    "SELECT * FROM materials WHERE id=? AND user_id=?",
    materialId,
    job.user_id,
  );
  if (!m || m.status === "ready") return;
  await run(
    env,
    "UPDATE materials SET status='processing',error=NULL,updated_at=? WHERE id=?",
    now(),
    m.id,
  );
  const object = await env.BUCKET.get(m.object_key);
  if (!object) throw new ApiError(404, "FILE", "找不到原始资料。");
  if (m.mime.startsWith("text/")) {
    const text = await object.text();
    const pages = Math.max(1, Math.ceil(text.length / 6000));
    if (pages > 100)
      throw new ApiError(413, "PAGES", "文本超过 100 页等效长度，请拆分导入。");
    const r = await reserve(env, job.user_id, "model", 1, { pages });
    for (let i = 0; i < pages; i++)
      await addSource(
        env,
        job.user_id,
        m.course_id,
        m.id,
        m.name,
        i + 1,
        text.slice(i * 6000, (i + 1) * 6000),
      );
    await settle(env, r, 0);
    await run(
      env,
      "UPDATE materials SET status='ready',pages=?,updated_at=? WHERE id=?",
      pages,
      now(),
      m.id,
    );
    return;
  }
  if (m.mime.startsWith("image/")) {
    await enqueue(env, job.user_id, "vision", {
      materialId: m.id,
      page: 1,
      key: m.object_key,
    });
    return;
  }
  if (!env.CONVERTER_URL || !env.CONVERTER_TOKEN)
    throw new ApiError(
      503,
      "CONVERTER_NOT_CONFIGURED",
      "文档转换服务尚未配置。原文件已保存，配置后可重新解析。",
    );
  const token = uid() + uid();
  const payload = { materialId, callbackHash: await digest(token) };
  await run(
    env,
    "UPDATE jobs SET payload=? WHERE id=?",
    JSON.stringify(payload),
    job.id,
  );
  const body = new FormData();
  body.append(
    "file",
    new Blob([await object.arrayBuffer()], { type: m.mime }),
    m.name,
  );
  body.append("callback", `${env.APP_ORIGIN}/internal/materials/${m.id}`);
  body.append("jobId", job.id);
  body.append("callbackToken", token);
  const r = await fetch(`${env.CONVERTER_URL.replace(/\/$/, "")}/convert`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CONVERTER_TOKEN}` },
    body,
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok)
    throw new ApiError(
      502,
      "CONVERSION_FAILED",
      `转换服务失败（HTTP ${r.status}）。原文件已保留。`,
    );
}
async function visionJob(env: Env, job: Job) {
  const p = json<{ materialId: string; page: number; key: string }>(
    job.payload,
    {} as never,
  );
  const m = await first<{ course_id: string; name: string; mime: string }>(
    env,
    "SELECT * FROM materials WHERE id=? AND user_id=?",
    p.materialId,
    job.user_id,
  );
  if (!m) return;
  const object = await env.BUCKET.get(p.key);
  if (!object) throw new ApiError(404, "IMAGE", "缺少待识别图片。");
  const bytes = new Uint8Array(await object.arrayBuffer());
  const out = await generate(
    env,
    job.user_id,
    z.object({ text: z.string(), uncertainties: z.array(z.string()) }),
    "page_extraction",
    `Transcribe the literal text and equations of this source page, preserving the diagram's labels and relationships. Describe charts only to the extent visible. State uncertainty rather than invent missing values. This is source extraction, not teaching. Page DATA:${JSON.stringify({ title: m.name, page: p.page })}`,
    {
      maxOutput: 1800,
      images: [
        `data:${m.mime.startsWith("image/") ? m.mime : "image/png"};base64,${base64(bytes)}`,
      ],
    },
  );
  await addSource(
    env,
    job.user_id,
    m.course_id,
    p.materialId,
    m.name,
    p.page,
    `${out.text}${out.uncertainties.length ? "\n识别待核对：" + out.uncertainties.join("；") : ""}`,
  );
  await run(
    env,
    "UPDATE materials SET status='partial',pages=MAX(pages,?),error='图像内容经自动识别，请回看原页核对公式、图表和数字。',updated_at=? WHERE id=?",
    p.page,
    now(),
    p.materialId,
  );
}
export async function authorizeCallback(
  env: Env,
  id: string,
  jobId: string,
  token: string,
) {
  const j = await first<{
    user_id: string;
    payload: string;
    status: string;
    lease_until: string;
  }>(env, "SELECT * FROM jobs WHERE id=?", jobId);
  if (!j || j.status !== "running" || j.lease_until < now())
    throw new ApiError(403, "CALLBACK_EXPIRED", "转换任务授权已过期。");
  const p = json<{ materialId: string; callbackHash: string }>(
    j.payload,
    {} as never,
  );
  if (p.materialId !== id || !token || (await digest(token)) !== p.callbackHash)
    throw new ApiError(403, "CALLBACK_AUTH", "转换任务授权无效。");
  return j.user_id;
}
export async function completeConversion(
  env: Env,
  user: string,
  material: string,
  data: {
    pages: number;
    complete?: boolean;
    page?: number;
    text?: string;
    image?: string;
    hasGraphics?: boolean;
  },
) {
  const m = await first<{ name: string; course_id: string }>(
    env,
    "SELECT name,course_id FROM materials WHERE id=? AND user_id=?",
    material,
    user,
  );
  if (!m) throw new ApiError(404, "MATERIAL", "资料已删除。");
  if (data.pages < 1 || data.pages > 100)
    throw new ApiError(413, "PAGES", "文档最多 100 页。");
  if (data.page) {
    if (data.text?.trim())
      await addSource(
        env,
        user,
        m.course_id,
        material,
        m.name,
        data.page,
        data.text,
      );
    if (data.image) {
      const decoded = Uint8Array.from(atob(data.image), (v) => v.charCodeAt(0));
      if (decoded.length > 2 * 1024 * 1024)
        throw new ApiError(413, "PAGE_SIZE", "页面图像超过 2MB。");
      const key = `${user}/${material}/pages/${data.page}.png`;
      await putPrivateObject(
        env,
        user,
        key,
        decoded,
        {
          httpMetadata: { contentType: "image/png" },
        },
        material,
      );
      if (!data.text || data.text.trim().length < 40 || data.hasGraphics)
        await enqueue(env, user, "vision", {
          materialId: material,
          page: data.page,
          key,
        });
    }
  }
  if (data.complete) {
    const r = await reserve(env, user, "model", 1, { pages: data.pages });
    await settle(env, r, 0);
    const vision = await first<{ n: number }>(
      env,
      "SELECT COUNT(*) n FROM jobs WHERE user_id=? AND kind='vision' AND json_extract(payload,'$.materialId')=? AND status!='done'",
      user,
      material,
    );
    await run(
      env,
      "UPDATE materials SET pages=?,status=?,error=?,updated_at=? WHERE id=?",
      data.pages,
      (vision?.n ?? 0) ? "partial" : "ready",
      (vision?.n ?? 0) ? "页面已转换；图表或扫描内容正在进行视觉识别。" : null,
      now(),
      material,
    );
  }
}
async function sendReminders(env: Env) {
  const profiles = await rows<{
    user_id: string;
    email: string;
    reminders: string;
  }>(
    env,
    "SELECT user_id,email,reminders FROM profiles WHERE json_extract(reminders,'$.enabled')=1 LIMIT 1000",
  );
  for (const p of profiles) {
    const s = json<{
      time: string;
      timezone: string;
      quietStart: string;
      quietEnd: string;
      push: boolean;
      email: boolean;
    }>(p.reminders, {} as never);
    let day: string, time: string;
    try {
      day = localDay(new Date(), s.timezone);
      time = new Intl.DateTimeFormat("en-GB", {
        timeZone: s.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
    } catch {
      continue;
    }
    if (time !== s.time) continue;
    const quiet =
      s.quietStart < s.quietEnd
        ? time >= s.quietStart && time < s.quietEnd
        : time >= s.quietStart || time < s.quietEnd;
    if (quiet) continue;
    if (
      await first(
        env,
        "SELECT id FROM activities WHERE user_id=? AND day=? LIMIT 1",
        p.user_id,
        day,
      )
    )
      continue;
    const id = `reminder:${p.user_id}:${day}`,
      title = "给知识一点生长的时间",
      body = "从一个 5–10 分钟的小任务开始。你可以直接接着上次学习。";
    const inserted = await run(
      env,
      "INSERT OR IGNORE INTO notifications(id,user_id,title,body,url,created_at) VALUES(?,?,?,?,?,?)",
      id,
      p.user_id,
      title,
      body,
      "/",
      now(),
    );
    if (!inserted.meta.changes) continue;
    if (s.email && env.RESEND_API_KEY)
      try {
        await sendMail(
          env,
          p.email,
          title,
          `${body}\n${env.APP_ORIGIN}\n\n取消订阅 / Unsubscribe: ${await unsubscribeURL(env, p.user_id)}`,
          `${id}:email`,
        );
      } catch (e) {
        console.error(
          "Reminder email failed",
          id,
          e instanceof Error ? e.message : "",
        );
      }
    if (s.push && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      const subs = await rows<{ id: string; subscription: string }>(
        env,
        "SELECT id,subscription FROM push_subscriptions WHERE user_id=?",
        p.user_id,
      );
      for (const sub of subs)
        try {
          const req = webPush.generateRequestDetails(
            JSON.parse(sub.subscription),
            JSON.stringify({ title, body, url: "/" }),
            {
              vapidDetails: {
                subject: env.VAPID_SUBJECT ?? `mailto:${env.MAIL_FROM}`,
                publicKey: env.VAPID_PUBLIC_KEY,
                privateKey: env.VAPID_PRIVATE_KEY,
              },
              TTL: 3600,
            },
          );
          const r = await fetch(req.endpoint, {
            method: req.method,
            headers: req.headers,
            body: new Uint8Array(req.body),
          });
          if ([404, 410].includes(r.status))
            await run(env, "DELETE FROM push_subscriptions WHERE id=?", sub.id);
        } catch (e) {
          console.error("Push failed", sub.id);
        }
    }
  }
}
async function backupJob(env: Env, job: Job) {
  if (!env.BETTER_AUTH_SECRET)
    throw new ApiError(503, "BACKUP_KEY", "请先设置认证密钥以加密备份。");
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`backup:v1:${env.BETTER_AUTH_SECRET}`),
  );
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
  ]);
  const tables = [
    "user",
    "account",
    "session",
    "verification",
    "profiles",
    "courses",
    "events",
    "notes",
    "sources",
    "materials",
    "activities",
    "purchases",
    "settings",
    "assessments",
    "lessons",
    "messages",
    "budgets",
    "reservations",
    "stored_objects",
    "teaching_decisions",
    "notifications",
    "push_subscriptions",
    "feedback",
    "mail_deliveries",
    "audit_log",
  ];
  const manifest: { version: number; createdAt: string; files: string[] } = {
    version: 1,
    createdAt: now(),
    files: [],
  };
  for (const table of tables) {
    for (let offset = 0; ; offset += 200) {
      const r = await rows(
        env,
        `SELECT * FROM ${table} LIMIT 200 OFFSET ?`,
        offset,
      );
      if (!r.length) break;
      const iv = crypto.getRandomValues(new Uint8Array(12)),
        plain = new TextEncoder().encode(JSON.stringify({ table, rows: r }));
      const cipher = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
      );
      const output = new Uint8Array(12 + cipher.length);
      output.set(iv);
      output.set(cipher, 12);
      const path = `backups/${job.id}/${table}-${offset}.enc`;
      await env.BUCKET.put(path, output, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      manifest.files.push(path);
    }
  }
  await env.BUCKET.put(
    `backups/${job.id}/manifest.json`,
    JSON.stringify(manifest),
    { httpMetadata: { contentType: "application/json" } },
  );
  await run(
    env,
    "INSERT INTO audit_log(id,actor,action,details,created_at) VALUES(?,?,?,?,?)",
    uid(),
    job.user_id,
    "backup",
    JSON.stringify({ jobId: job.id, files: manifest.files.length }),
    now(),
  );
}
