import type { Course, LearningState, Concept, Material } from "../shared/types";
import type { Env } from "./env";
import { chooseNext } from "../shared/core";
import { ApiError, json, now } from "./env";
export async function rows<T>(
  env: Env,
  sql: string,
  ...args: unknown[]
): Promise<T[]> {
  const r = await env.DB.prepare(sql)
    .bind(...args)
    .all<T>();
  return r.results;
}
export async function first<T>(
  env: Env,
  sql: string,
  ...args: unknown[]
): Promise<T | null> {
  return env.DB.prepare(sql)
    .bind(...args)
    .first<T>();
}
export async function run(env: Env, sql: string, ...args: unknown[]) {
  return env.DB.prepare(sql)
    .bind(...args)
    .run();
}
export interface CourseRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  goal: Course["goal"];
  language: Course["language"];
  strategy: Course["strategy"];
  exam_date: string | null;
  concepts: string;
  state: string;
  revision: number;
  created_at: string;
}
export function courseFromRow(r: CourseRow): Course {
  const concepts = json<Concept[]>(r.concepts, []),
    state = {
      ...json<LearningState>(r.state, {} as LearningState),
      revision: r.revision,
      examDate: r.exam_date,
    };
  state.nextAction = chooseNext(concepts, state, now());
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    goal: r.goal,
    language: r.language,
    strategy: r.strategy,
    examDate: r.exam_date,
    concepts,
    state,
    createdAt: r.created_at,
  };
}
export async function getCourse(env: Env, userId: string, id: string) {
  const r = await first<CourseRow>(
    env,
    "SELECT * FROM courses WHERE id=? AND user_id=?",
    id,
    userId,
  );
  if (!r) throw new ApiError(404, "COURSE_NOT_FOUND", "课程不存在或无权访问。");
  return courseFromRow(r);
}
export async function saveCourse(
  env: Env,
  userId: string,
  course: Course,
  expected: number,
) {
  const r = await run(
    env,
    "UPDATE courses SET title=?,description=?,goal=?,language=?,strategy=?,exam_date=?,concepts=?,state=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?",
    course.title,
    course.description,
    course.goal,
    course.language,
    course.strategy,
    course.examDate,
    JSON.stringify(course.concepts),
    JSON.stringify({ ...course.state, revision: expected + 1 }),
    now(),
    course.id,
    userId,
    expected,
  );
  if (!r.meta.changes)
    throw new ApiError(
      409,
      "REVISION_CONFLICT",
      "另一处学习已更新，请刷新后继续。",
    );
  return { ...course, state: { ...course.state, revision: expected + 1 } };
}
export function materialFromRow(r: Record<string, unknown>): Material {
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    name: r.name as string,
    mime: r.mime as string,
    bytes: r.bytes as number,
    pages: r.pages as number,
    status: r.status as Material["status"],
    error: r.error as string | null,
    createdAt: r.created_at as string,
  };
}
