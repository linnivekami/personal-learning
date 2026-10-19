import type { Hono } from "hono";
import type { HonoEnv } from "../env";
import { z } from "zod";
import { ApiError, uid, now, json, hash } from "../env";
import { first, rows, run, getCourse } from "../db";
import { reminderSchema } from "../../shared/types";
import { usageFor } from "../quota";
import { pathlineClaims } from "../auth";
import { zipStream, accountEntries, exportData } from "../archive";
import { previewImport, commitImport } from "../imports";

export function installAccountRoutes(app: Hono<HonoEnv>) {
  app.get("/api/v1/me", async (c) => {
    const user = c.get("user");
    const p = await first<{
      timezone: string;
      language: string;
      preferences: string;
      reminders: string;
    }>(c.env, "SELECT * FROM profiles WHERE user_id=?", user.id);
    return c.json({
      user,
      profile: {
        ...p,
        preferences: json(p?.preferences, {}),
        reminders: json(p?.reminders, {}),
      },
      usage: await usageFor(c.env, user.id),
      pathline: await pathlineClaims(c.env, user.id).catch(() => null),
    });
  });
  app.patch("/api/v1/me", async (c) => {
    const data = z
      .object({
        name: z.string().min(1).max(80),
        timezone: z.string(),
        language: z.enum(["zh", "en"]),
        preferences: z.record(z.string(), z.unknown()),
      })
      .parse(await c.req.json());
    try {
      new Intl.DateTimeFormat("en", { timeZone: data.timezone });
    } catch {
      throw new ApiError(400, "TIMEZONE", "时区无效。");
    }
    await run(
      c.env,
      "UPDATE profiles SET name=?,timezone=?,language=?,preferences=? WHERE user_id=?",
      data.name,
      data.timezone,
      data.language,
      JSON.stringify(data.preferences),
      c.get("user").id,
    );
    return c.json({ ok: true });
  });
  app.get("/api/v1/notifications", async (c) =>
    c.json({
      notifications: await rows(
        c.env,
        "SELECT id,title,body,url,is_read isRead,created_at createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        c.get("user").id,
      ),
    }),
  );
  app.patch("/api/v1/notifications/:id", async (c) => {
    await run(
      c.env,
      "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    return c.json({ ok: true });
  });
  app.put("/api/v1/reminders", async (c) => {
    const d = reminderSchema.parse(await c.req.json());
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
    } catch {
      throw new ApiError(400, "TIMEZONE", "时区无效。");
    }
    await run(
      c.env,
      "UPDATE profiles SET reminders=?,timezone=? WHERE user_id=?",
      JSON.stringify(d),
      d.timezone,
      c.get("user").id,
    );
    return c.json({ ok: true });
  });
  app.post("/api/v1/push", async (c) => {
    const sub = z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      })
      .parse(await c.req.json());
    const endpoint = new URL(sub.endpoint);
    if (
      ![
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].some(
        (h) => endpoint.hostname === h || endpoint.hostname.endsWith(`.${h}`),
      )
    )
      throw new ApiError(400, "PUSH_ENDPOINT", "推送服务端点不受支持。");
    await run(
      c.env,
      "INSERT OR REPLACE INTO push_subscriptions(id,user_id,subscription,created_at) VALUES(?,?,?,?)",
      await hash(sub.endpoint),
      c.get("user").id,
      JSON.stringify(sub),
      now(),
    );
    return c.json({ ok: true });
  });
  app.delete("/api/v1/push", async (c) => {
    await run(
      c.env,
      "DELETE FROM push_subscriptions WHERE user_id=?",
      c.get("user").id,
    );
    return c.json({ ok: true });
  });
  app.post("/api/v1/feedback", async (c) => {
    const d = z
      .object({
        body: z.string().min(5).max(5000),
        courseId: z.string().nullable().default(null),
      })
      .parse(await c.req.json());
    await run(
      c.env,
      "INSERT INTO feedback(id,user_id,course_id,body,created_at) VALUES(?,?,?,?,?)",
      uid(),
      c.get("user").id,
      d.courseId,
      d.body,
      now(),
    );
    return c.json({ ok: true });
  });
  app.get("/api/v1/export", async (c) => {
    c.header(
      "Content-Disposition",
      'attachment; filename="personal-learning-export.json"',
    );
    return c.json(await exportData(c.env, c.get("user").id));
  });
  app.get(
    "/api/v1/export/archive",
    async (c) =>
      new Response(
        zipStream(
          accountEntries(
            c.env,
            c.get("user").id,
            await exportData(c.env, c.get("user").id),
          ),
        ),
        {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="personal-learning-private-backup.zip"',
            "Cache-Control": "no-store",
          },
        },
      ),
  );
  app.post("/api/v1/import/preview", async (c) =>
    c.json(await previewImport(c.env, c.get("user").id, await c.req.json())),
  );
  app.post("/api/v1/import", async (c) => {
    const d = z
      .object({ data: z.unknown(), confirm: z.literal(true) })
      .parse(await c.req.json());
    return c.json(await commitImport(c.env, c.get("user").id, d.data));
  });
  app.get("/api/v1/courses/:id/archive", async (c) => {
    await getCourse(c.env, c.get("user").id, c.req.param("id"));
    const row = await first<{ legacy_data: string }>(
      c.env,
      "SELECT legacy_data FROM courses WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    return c.json({ archive: json(row?.legacy_data ?? "{}", {}) });
  });
  app.delete("/api/v1/me", async (c) => {
    const { confirm } = z
      .object({ confirm: z.literal("DELETE") })
      .parse(await c.req.json());
    const user = c.get("user");
    let cursor: string | undefined;
    do {
      const listed = await c.env.BUCKET.list({ prefix: `${user.id}/`, cursor });
      if (listed.objects.length)
        await c.env.BUCKET.delete(listed.objects.map((o) => o.key));
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    const tables = [
      "source_search",
      "teaching_decisions",
      "stored_objects",
      "events",
      "assessments",
      "lessons",
      "messages",
      "notes",
      "materials",
      "sources",
      "cheat_sheets",
      "courses",
      "activities",
      "purchases",
      "push_subscriptions",
      "notifications",
      "feedback",
      "jobs",
      "profiles",
    ];
    await c.env.DB.batch(
      tables.map((t) =>
        c.env.DB.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(user.id),
      ),
    );
    await run(c.env, "DELETE FROM user WHERE id=?", user.id);
    return c.json({ ok: true });
  });
}
