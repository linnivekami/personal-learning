import { z } from "zod";
import {
  conceptSchema,
  eventSchema,
  goalSchema,
  strategySchema,
  type Concept,
} from "../shared/types";
import { emptyState, chooseNext, blankConcept } from "../shared/core";
import { ApiError, now, uid, type Env } from "./env";
import { rows } from "./db";
const decoded = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
const rawCourse = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(100000).optional(),
    language: z.enum(["zh", "en", "mixed"]).default("mixed"),
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
    exam_date: z.string().nullable().optional(),
    legacy_data: z.unknown().optional(),
    concepts: z.unknown(),
    state: z.unknown(),
  })
  .passthrough();
export const importSchema = z
  .object({
    format: z.literal("personal-learning"),
    version: z.literal(2),
    policy: z.string().optional(),
    courses: z.array(rawCourse).max(100),
    notes: z.array(z.unknown()).max(5000).optional(),
    sources: z.array(z.unknown()).max(5000).optional(),
    legacyProfile: z.unknown().optional(),
  })
  .passthrough();
function prepare(data: unknown) {
  const input = importSchema.parse(data),
    seen = new Set<string>(),
    titles = new Set<string>();
  const courses = input.courses.map((raw) => {
    if (seen.has(raw.id))
      throw new ApiError(400, "IMPORT_DUPLICATE", "导入包含重复课程编号。");
    seen.add(raw.id);
    if (titles.has(raw.title))
      throw new ApiError(400, "IMPORT_DUPLICATE", "导入包含重复课程名称。");
    titles.add(raw.title);
    const concepts = z
      .array(conceptSchema)
      .max(2000)
      .parse(decoded(raw.concepts));
    const ids = new Set(concepts.map((c) => c.id));
    if (ids.size !== concepts.length)
      throw new ApiError(400, "IMPORT_GRAPH", "知识点编号重复。");
    const visiting = new Set<string>(),
      visited = new Set<string>();
    function visit(id: string) {
      if (visiting.has(id))
        throw new ApiError(400, "IMPORT_GRAPH", "知识图谱包含循环。");
      if (visited.has(id)) return;
      visiting.add(id);
      const c = concepts.find((n) => n.id === id)!;
      for (const ref of [
        ...c.prerequisites,
        ...(c.parentId ? [c.parentId] : []),
      ]) {
        if (!ids.has(ref))
          throw new ApiError(400, "IMPORT_GRAPH", "知识关系引用不存在的节点。");
        visit(ref);
      }
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of ids) visit(id);
    const old = z
      .object({
        goal: goalSchema,
        strategy: strategySchema,
        concepts: z.record(z.string(), z.unknown()),
        events: z.array(eventSchema).max(20000).default([]),
      })
      .passthrough()
      .parse(decoded(raw.state));
    const state = emptyState(old.goal, old.strategy);
    for (const concept of concepts) {
      const historical = z
        .object({
          mastery: z.number().int().min(0).max(5).optional(),
          historicalMastery: z.number().int().min(0).max(5).optional(),
          pendingVerification: z.string().optional(),
          lastVerified: z.string().nullable().optional(),
        })
        .passthrough()
        .parse(old.concepts[concept.id] ?? {});
      state.concepts[concept.id] = {
        ...blankConcept(concept.id),
        historicalMastery:
          historical.historicalMastery ?? historical.mastery ?? 0,
        pendingVerification:
          historical.pendingVerification ??
          "导入历史记录：按当前证据规则待核验",
        lastVerified: historical.lastVerified ?? null,
      };
    }
    // Keep the exact evidence, timestamp and assistance. Imported evidence is
    // archival, never a trusted assessment or a source of fresh rewards.
    state.events = old.events.map((e) => {
      if (!ids.has(e.conceptId))
        throw new ApiError(400, "IMPORT_EVENT", "历史证据指向不存在的知识点。");
      return {
        ...e,
        source: "legacy" as const,
        evidence: `[imported:${e.source}] ${e.evidence}`,
      };
    });
    state.nextAction = chooseNext(concepts, state, now());
    return { raw, concepts, state };
  });
  return { input, courses };
}
export async function previewImport(env: Env, user: string, data: unknown) {
  const { input, courses } = prepare(data),
    existing = await rows<{ id: string; title: string }>(
      env,
      "SELECT id,title FROM courses WHERE user_id=?",
      user,
    );
  return {
    courses: courses.map((c) => ({ id: c.raw.id, title: c.raw.title })),
    conflicts: courses
      .filter((c) =>
        existing.some((e) => e.id === c.raw.id || e.title === c.raw.title),
      )
      .map((c) => c.raw.title),
    evidenceCount: courses.reduce((n, c) => n + c.state.events.length, 0),
    notice:
      "保留原始证据、日期、辅助程度及历史分数。导入记录归档并待核验；不自动授予掌握度或奖励。文件正文和附件清单保存在历史档案中；二进制附件需从导出归档重新上传。",
    version: input.version,
    policyVersion: input.policy ?? "unknown",
    policyNotice:
      input.policy && input.policy !== "2.0.0"
        ? "规则版本不同：历史证据仅归档，不自动覆盖当前状态。"
        : null,
  };
}
export async function commitImport(env: Env, user: string, data: unknown) {
  const { input, courses } = prepare(data),
    report = await previewImport(env, user, data);
  if (report.conflicts.length)
    throw new ApiError(
      409,
      "IMPORT_CONFLICT",
      "课程存在冲突，请先重命名；未导入任何记录。",
    );
  const batch: D1PreparedStatement[] = [],
    mapping = new Map<string, string>(),
    sourceIds = new Map<string, string>();
  for (const value of input.sources ?? []) {
    const s = z.object({ id: z.string() }).parse(value);
    if (sourceIds.has(s.id))
      throw new ApiError(400, "IMPORT_SOURCE", "来源编号重复。");
    sourceIds.set(s.id, uid());
  }
  for (const c of courses) mapping.set(c.raw.id, uid());
  for (const { raw, concepts, state } of courses) {
    const id = mapping.get(raw.id)!;
    const mappedConcepts = concepts.map((c) => ({
      ...c,
      sourceIds: c.sourceIds
        .map((id) => sourceIds.get(id))
        .filter((id): id is string => !!id),
    }));
    batch.push(
      env.DB.prepare(
        "INSERT INTO courses(id,user_id,title,description,goal,language,strategy,exam_date,concepts,state,legacy_data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        id,
        user,
        raw.title,
        raw.description ?? "",
        state.goal,
        raw.language,
        state.strategy,
        raw.exam_date ?? null,
        JSON.stringify(mappedConcepts),
        JSON.stringify(state),
        JSON.stringify({
          originalCourseId: raw.id,
          originalState: decoded(raw.state),
          archive: decoded(raw.legacy_data ?? {}),
          profile: input.legacyProfile ?? null,
          attachments: (Array.isArray(input.materials)
            ? input.materials
            : []
          ).filter(
            (m: unknown) =>
              typeof m === "object" &&
              m !== null &&
              "course_id" in m &&
              m.course_id === raw.id,
          ),
        }),
        raw.created_at ?? raw.createdAt ?? now(),
        now(),
      ),
    );
  }
  // State contains original historical IDs; event rows use new, owner-scoped IDs.
  // This avoids collisions across accounts without altering the archival evidence.
  for (const { raw, state } of courses)
    for (const e of state.events)
      batch.push(
        env.DB.prepare(
          "INSERT INTO events(id,user_id,course_id,concept_id,attempt_id,event,occurred_at) VALUES(?,?,?,?,?,?,?)",
        ).bind(
          uid(),
          user,
          mapping.get(raw.id)!,
          e.conceptId,
          uid(),
          JSON.stringify(e),
          e.occurredAt,
        ),
      );
  for (const value of input.notes ?? []) {
    const n = z
      .object({
        course_id: z.string(),
        concept_id: z.string().nullable().optional(),
        title: z.string(),
        body: z.string(),
        updated_at: z.string(),
      })
      .parse(value);
    const course = mapping.get(n.course_id);
    if (!course) throw new ApiError(400, "IMPORT_NOTE", "笔记课程不存在。");
    batch.push(
      env.DB.prepare(
        "INSERT INTO notes(id,user_id,course_id,concept_id,title,body,updated_at) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        uid(),
        user,
        course,
        n.concept_id ?? null,
        n.title,
        n.body,
        n.updated_at,
      ),
    );
  }
  for (const value of input.sources ?? []) {
    const s = z
      .object({
        id: z.string(),
        course_id: z.string(),
        title: z.string(),
        content: z.string(),
        page: z.number().nullable().optional(),
        url: z
          .string()
          .url()
          .refine((s) => /^https?:\/\//.test(s))
          .nullable()
          .optional(),
        created_at: z.string(),
      })
      .parse(value);
    const course = mapping.get(s.course_id);
    if (!course) throw new ApiError(400, "IMPORT_SOURCE", "来源课程不存在。");
    batch.push(
      env.DB.prepare(
        "INSERT INTO sources(id,user_id,course_id,material_id,title,page,url,content,created_at) VALUES(?,?,?,NULL,?,?,?,?,?)",
      ).bind(
        sourceIds.get(s.id)!,
        user,
        course,
        s.title,
        s.page ?? null,
        s.url ?? null,
        s.content,
        s.created_at,
      ),
    );
  }
  // D1 batch is transactional. All validation happens before the first write.
  if (batch.length > 1000)
    throw new ApiError(400, "IMPORT_SIZE", "单次导入过大，请按课程分开导入。");
  if (batch.length) await env.DB.batch(batch);
  return {
    ok: true,
    imported: courses.length,
    courseIds: Object.fromEntries(mapping),
  };
}
