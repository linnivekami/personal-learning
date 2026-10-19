import type { Hono } from "hono";
import type { HonoEnv } from "../env";
import { ApiError, uid, now } from "../env";
import { first, rows, run, getCourse } from "../db";
import { localDay } from "../../shared/core";
import { noteSchema } from "../../shared/types";

export function installNoteRoutes(app: Hono<HonoEnv>) {
  app.get("/api/v1/courses/:id/notes", async (c) => {
    await getCourse(c.env, c.get("user").id, c.req.param("id"));
    return c.json({
      notes: await rows(
        c.env,
        "SELECT id,course_id courseId,concept_id conceptId,title,body,updated_at updatedAt FROM notes WHERE user_id=? AND course_id=? ORDER BY updated_at DESC",
        c.get("user").id,
        c.req.param("id"),
      ),
    });
  });
  app.post("/api/v1/courses/:id/notes", async (c) => {
    const d = noteSchema.parse(await c.req.json()),
      u = c.get("user");
    await getCourse(c.env, u.id, c.req.param("id"));
    const id = uid();
    await run(
      c.env,
      "INSERT INTO notes(id,user_id,course_id,concept_id,title,body,updated_at) VALUES(?,?,?,?,?,?,?)",
      id,
      u.id,
      c.req.param("id"),
      d.conceptId,
      d.title,
      d.body,
      now(),
    );
    return c.json({ id }, 201);
  });
  app.put("/api/v1/notes/:id", async (c) => {
    const d = noteSchema.parse(await c.req.json());
    const r = await run(
      c.env,
      "UPDATE notes SET title=?,body=?,concept_id=?,updated_at=? WHERE id=? AND user_id=?",
      d.title,
      d.body,
      d.conceptId,
      now(),
      c.req.param("id"),
      c.get("user").id,
    );
    if (!r.meta.changes)
      throw new ApiError(404, "NOTE_NOT_FOUND", "笔记不存在。");
    return c.json({ ok: true });
  });
  app.delete("/api/v1/notes/:id", async (c) => {
    await run(
      c.env,
      "DELETE FROM notes WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    return c.json({ ok: true });
  });
  app.post("/api/v1/notes/:id/reflect", async (c) => {
    const n = await first<{ body: string; course_id: string }>(
      c.env,
      "SELECT body,course_id FROM notes WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    if (!n || n.body.trim().length < 80)
      throw new ApiError(
        400,
        "REFLECTION_SHORT",
        "自主总结至少写 80 个字符，再记录为有效学习。",
      );
    const p = await first<{ timezone: string }>(
      c.env,
      "SELECT timezone FROM profiles WHERE user_id=?",
      c.get("user").id,
    );
    const day = localDay(new Date(), p?.timezone ?? "Asia/Singapore");
    await run(
      c.env,
      "INSERT OR IGNORE INTO activities(id,user_id,course_id,kind,day,xp,coins,created_at) VALUES(?,?,?,'reflection',?,15,5,?)",
      `reflection:${c.get("user").id}:${day}`,
      c.get("user").id,
      n.course_id,
      day,
      now(),
    );
    return c.json({ ok: true });
  });
}
