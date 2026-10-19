import type { Hono } from "hono";
import type { HonoEnv } from "../env";
import { z } from "zod";
import { ApiError, uid, now, json } from "../env";
import { first, rows, run } from "../db";
import { policy } from "../../shared/core";
import { enqueue } from "../jobs";

export function installAdminRoutes(app: Hono<HonoEnv>) {
  app.use("/api/v1/admin/*", async (c, next) => {
    if (!c.get("user").admin)
      throw new ApiError(403, "ADMIN_REQUIRED", "需要管理员权限。");
    await next();
  });
  app.get("/api/v1/admin/overview", async (c) =>
    c.json({
      budgets: await rows(
        c.env,
        "SELECT * FROM budgets WHERE month=?",
        now().slice(0, 7),
      ),
      users: await rows(
        c.env,
        "SELECT user_id,email,name,created_at FROM profiles ORDER BY created_at DESC LIMIT 100",
      ),
      jobs: await rows(
        c.env,
        "SELECT id,kind,status,attempts,error,created_at FROM jobs ORDER BY created_at DESC LIMIT 100",
      ),
      feedback: await rows(
        c.env,
        "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100",
      ),
      settings: await rows(c.env, "SELECT * FROM settings"),
      audit: await rows(
        c.env,
        "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50",
      ),
    }),
  );
  app.put("/api/v1/admin/settings", async (c) => {
    const d = z
      .object({
        key: z.enum(["quota", "budget"]),
        value: z.record(z.string(), z.number().nonnegative()),
      })
      .parse(await c.req.json());
    const allowed =
      d.key === "quota"
        ? Object.keys(policy.limits)
        : Object.keys(policy.budget);
    if (Object.keys(d.value).some((k) => !allowed.includes(k)))
      throw new ApiError(400, "SETTING_KEY", "设置项不受支持。");
    if (Object.values(d.value).some((v) => !Number.isSafeInteger(v)))
      throw new ApiError(400, "SETTING_VALUE", "额度和预算必须使用非负整数。");
    if (d.key === "budget") {
      const old = await first<{ value: string }>(
        c.env,
        "SELECT value FROM settings WHERE key='budget'",
      );
      const b = { ...policy.budget, ...json(old?.value, {}), ...d.value };
      if (
        b.totalFen > 30000 ||
        b.modelFen + b.voiceFen + b.infrastructureFen + b.reserveFen >
          b.totalFen
      )
        throw new ApiError(
          400,
          "BUDGET_LIMIT",
          "预算分配总额不能超过每月 300 元，分项之和不能超过总额。",
        );
    }
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)",
      ).bind(d.key, JSON.stringify(d.value), now()),
      c.env.DB.prepare(
        "INSERT INTO audit_log(id,actor,action,details,created_at) VALUES(?,?,?,?,?)",
      ).bind(uid(), c.get("user").id, "settings", JSON.stringify(d), now()),
    ]);
    return c.json({ ok: true });
  });
  app.post("/api/v1/admin/jobs/:id/retry", async (c) => {
    await run(
      c.env,
      "UPDATE jobs SET status='pending',attempts=0,error=NULL,next_run=?,updated_at=? WHERE id=? AND status='failed'",
      now(),
      now(),
      c.req.param("id"),
    );
    return c.json({ ok: true });
  });
  app.patch("/api/v1/admin/feedback/:id", async (c) => {
    await run(
      c.env,
      "UPDATE feedback SET status='resolved' WHERE id=?",
      c.req.param("id"),
    );
    return c.json({ ok: true });
  });
  app.post("/api/v1/admin/backup", async (c) => {
    const id = await enqueue(c.env, c.get("user").id, "backup", {});
    return c.json({ jobId: id });
  });
}
