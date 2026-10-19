import type { Hono } from "hono";
import type { HonoEnv } from "../env";
import { z } from "zod";
import { ApiError, uid, now, json, type Env } from "../env";
import {
  rows,
  run,
  getCourse,
  courseFromRow,
  saveCourse,
  type CourseRow,
} from "../db";
import { emptyState, chooseNext } from "../../shared/core";
import {
  goalSchema,
  strategySchema,
  conceptSchema,
  curriculumSchema,
  type SourceRef,
  type Lesson,
  type Concept,
} from "../../shared/types";
import { generate, publicLesson } from "../llm";
import { sampleCourse, sampleLesson } from "../../shared/sample";
import { graphCheck } from "../graph";

export async function sourcesFor(
  env: Env,
  user: string,
  course: string,
  query = "",
): Promise<SourceRef[]> {
  let found: Record<string, unknown>[] = [];
  if (query) {
    const terms = query
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((s) => s.length > 1)
      .slice(0, 8);
    if (terms.length)
      try {
        found = await rows(
          env,
          "SELECT s.* FROM source_search f JOIN sources s ON s.id=f.source_id WHERE source_search MATCH ? AND s.user_id=? AND s.course_id=? ORDER BY rank LIMIT 8",
          terms.map((s) => `"${s}"`).join(" OR "),
          user,
          course,
        );
      } catch {
        /* Non-tokenized CJK fallback below. */
      }
  }
  if (!found.length)
    found = await rows(
      env,
      "SELECT * FROM sources WHERE user_id=? AND course_id=? ORDER BY page LIMIT 8",
      user,
      course,
    );
  return found.map((r) => ({
    id: r.id as string,
    materialId: r.material_id as string | undefined,
    title: r.title as string,
    page: r.page as number | undefined,
    url: r.url as string | undefined,
    excerpt: (r.content as string).slice(0, 1800),
  }));
}
export function installCourseRoutes(app: Hono<HonoEnv>) {
  app.get("/api/v1/courses", async (c) =>
    c.json({
      courses: (
        await rows<CourseRow>(
          c.env,
          "SELECT * FROM courses WHERE user_id=? ORDER BY updated_at DESC",
          c.get("user").id,
        )
      ).map(courseFromRow),
    }),
  );
  app.post("/api/v1/courses", async (c) => {
    const data = z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(3000).default(""),
        goal: goalSchema,
        language: z.enum(["zh", "en", "mixed"]),
        strategy: strategySchema,
        examDate: z.string().nullable().default(null),
        generate: z.boolean().default(true),
      })
      .parse(await c.req.json());
    const user = c.get("user");
    let title = data.title,
      description = data.description,
      concepts: Concept[] = [];
    if (data.generate) {
      const curriculum = await generate(
        c.env,
        user.id,
        curriculumSchema,
        "curriculum",
        `Create a coherent knowledge framework for this learner goal. Use stable ASCII concept IDs, a shallow hierarchy, useful prerequisite links, concrete purposes and applications. No sources have been supplied yet, so leave sourceIds empty and do not invent sources. Requested language ${data.language}. User request DATA: ${JSON.stringify(data)}`,
        { maxOutput: 2500 },
      );
      title = curriculum.title;
      description = curriculum.overview;
      concepts = curriculum.concepts;
      graphCheck(concepts);
    }
    const id = uid(),
      state = emptyState(data.goal, data.strategy);
    state.examDate = data.examDate;
    state.nextAction = chooseNext(concepts, state, now());
    await run(
      c.env,
      "INSERT INTO courses(id,user_id,title,description,goal,language,strategy,exam_date,concepts,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      user.id,
      title,
      description,
      data.goal,
      data.language,
      data.strategy,
      data.examDate,
      JSON.stringify(concepts),
      JSON.stringify(state),
      now(),
      now(),
    );
    return c.json({ course: await getCourse(c.env, user.id, id) }, 201);
  });
  app.post("/api/v1/courses/sample", async (c) => {
    const u = c.get("user"),
      id = uid(),
      course = structuredClone(sampleCourse);
    course.id = id;
    course.createdAt = now();
    const lesson = structuredClone(sampleLesson);
    for (const card of lesson.cards) card.id = uid();
    const statements = [
      c.env.DB.prepare(
        "INSERT INTO courses(id,user_id,title,description,goal,language,strategy,concepts,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        id,
        u.id,
        course.title,
        course.description,
        course.goal,
        course.language,
        course.strategy,
        JSON.stringify(course.concepts),
        JSON.stringify(course.state),
        now(),
        now(),
      ),
      c.env.DB.prepare(
        "INSERT INTO lessons(id,user_id,course_id,concept_id,body,created_at) VALUES(?,?,?,?,?,?)",
      ).bind(uid(), u.id, id, "conditional", JSON.stringify(lesson), now()),
    ];
    for (const card of lesson.cards)
      if (!["explanation", "simulation"].includes(card.kind))
        statements.push(
          c.env.DB.prepare(
            "INSERT INTO assessments(id,user_id,course_id,concept_id,card,created_at) VALUES(?,?,?,?,?,?)",
          ).bind(
            card.id,
            u.id,
            id,
            card.conceptId,
            JSON.stringify(card),
            now(),
          ),
        );
    await c.env.DB.batch(statements);
    return c.json({ course }, 201);
  });
  app.get("/api/v1/courses/:id", async (c) =>
    c.json({
      course: await getCourse(c.env, c.get("user").id, c.req.param("id")),
    }),
  );
  app.patch("/api/v1/courses/:id", async (c) => {
    const data = z
      .object({
        revision: z.number().int(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10000).optional(),
        goal: goalSchema.optional(),
        language: z.enum(["zh", "en", "mixed"]).optional(),
        strategy: strategySchema.optional(),
        examDate: z.string().nullable().optional(),
        concepts: z.array(conceptSchema).max(200).optional(),
      })
      .parse(await c.req.json());
    const course = await getCourse(c.env, c.get("user").id, c.req.param("id"));
    if (data.concepts) {
      graphCheck(data.concepts);
      const ids = new Set(data.concepts.map((n) => n.id));
      if (course.state.events.some((e) => !ids.has(e.conceptId)))
        throw new ApiError(
          409,
          "GRAPH_EVIDENCE",
          "已有学习证据的节点不能直接删除；请重命名或调整关系。",
        );
    }
    const next = {
      ...course,
      ...data,
      state: {
        ...course.state,
        goal: data.goal ?? course.goal,
        strategy: data.strategy ?? course.strategy,
        examDate: data.examDate === undefined ? course.examDate : data.examDate,
      },
    };
    next.state.nextAction = chooseNext(next.concepts, next.state, now());
    return c.json({
      course: await saveCourse(c.env, c.get("user").id, next, data.revision),
    });
  });
  app.delete("/api/v1/courses/:id", async (c) => {
    const user = c.get("user");
    await getCourse(c.env, user.id, c.req.param("id"));
    const files = await rows<{ object_key: string; id: string }>(
      c.env,
      "SELECT object_key,id FROM materials WHERE course_id=? AND user_id=?",
      c.req.param("id"),
      user.id,
    );
    for (const f of files) {
      let cursor: string | undefined;
      do {
        const listing = await c.env.BUCKET.list({
          prefix: `${user.id}/${f.id}/`,
          cursor,
        });
        if (listing.objects.length)
          await c.env.BUCKET.delete(listing.objects.map((o) => o.key));
        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor);
      await run(
        c.env,
        "DELETE FROM stored_objects WHERE user_id=? AND material_id=?",
        user.id,
        f.id,
      );
    }
    await c.env.DB.batch([
      c.env.DB.prepare(
        "DELETE FROM source_search WHERE course_id=? AND user_id=?",
      ).bind(c.req.param("id"), user.id),
      c.env.DB.prepare(
        "DELETE FROM assessments WHERE course_id=? AND user_id=?",
      ).bind(c.req.param("id"), user.id),
      c.env.DB.prepare(
        "DELETE FROM cheat_sheets WHERE course_id=? AND user_id=?",
      ).bind(c.req.param("id"), user.id),
      c.env.DB.prepare("DELETE FROM courses WHERE id=? AND user_id=?").bind(
        c.req.param("id"),
        user.id,
      ),
    ]);
    return c.json({ ok: true });
  });
  app.get("/api/v1/courses/:id/sources", async (c) => {
    await getCourse(c.env, c.get("user").id, c.req.param("id"));
    return c.json({
      sources: await sourcesFor(
        c.env,
        c.get("user").id,
        c.req.param("id"),
        c.req.query("q"),
      ),
    });
  });
  app.post("/api/v1/courses/:id/organize", async (c) => {
    const u = c.get("user"),
      course = await getCourse(c.env, u.id, c.req.param("id"));
    const rawSources = await rows<{
      id: string;
      material_id: string | null;
      title: string;
      page: number | null;
      url: string | null;
      content: string;
    }>(
      c.env,
      "SELECT * FROM sources WHERE user_id=? AND course_id=? ORDER BY material_id,page",
      u.id,
      course.id,
    );
    const sources = rawSources.map((s) => ({
      id: s.id,
      materialId: s.material_id,
      title: s.title,
      page: s.page,
      url: s.url,
      excerpt: s.content.slice(0, 600),
    }));
    if (!sources.length)
      throw new ApiError(400, "NO_SOURCES", "请先导入并解析资料。");
    const out = await generate(
      c.env,
      u.id,
      curriculumSchema,
      "curriculum",
      `Organize the supplied source DATA into a connected editable knowledge framework. Preserve existing concept IDs where the meaning is unchanged. Reference only supplied source IDs. Language ${course.language}. DATA:${JSON.stringify({ existing: course.concepts, sources })}`,
      { maxOutput: 3000 },
    );
    graphCheck(out.concepts);
    // A model must not silently remove a node with evidence or user notes.
    const generatedIds = new Set(out.concepts.map((n) => n.id));
    const preserved = course.concepts.filter((n) => !generatedIds.has(n.id));
    const merged = [...out.concepts, ...preserved];
    graphCheck(merged);
    const allowedSources = new Set(sources.map((s) => s.id));
    for (const node of merged)
      node.sourceIds = node.sourceIds.filter((id) => allowedSources.has(id));
    const next = { ...course, concepts: merged, description: out.overview };
    next.state.nextAction = chooseNext(next.concepts, next.state, now());
    return c.json({
      course: await saveCourse(c.env, u.id, next, course.state.revision),
    });
  });
  app.get("/api/v1/courses/:id/lessons", async (c) => {
    await getCourse(c.env, c.get("user").id, c.req.param("id"));
    const list = await rows<{
      id: string;
      body: string;
      concept_id: string;
      created_at: string;
    }>(
      c.env,
      "SELECT * FROM lessons WHERE user_id=? AND course_id=? ORDER BY created_at DESC LIMIT 100",
      c.get("user").id,
      c.req.param("id"),
    );
    return c.json({
      lessons: list.map((r) => ({
        id: r.id,
        conceptId: r.concept_id,
        createdAt: r.created_at,
        ...publicLesson(json<Lesson>(r.body, {} as Lesson)),
      })),
    });
  });
}
