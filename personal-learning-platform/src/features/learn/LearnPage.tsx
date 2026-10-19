import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Network } from "lucide-react";
import type {
  Course,
  Lesson,
  SourceRef,
  Strategy,
} from "../../../shared/types";
import { sampleCourse, sampleLesson } from "../../../shared/sample";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { navigate } from "../../app/router";
import { api, post, teachStream } from "../../lib/api";
import { FrameworkPanel } from "./FrameworkPanel";
import { LessonView } from "./LessonView";
import { EvidenceSheet } from "./EvidenceSheet";
import { LineMap } from "./LineMap";
import { EditFramework } from "./EditFramework";
import { HandoffModal } from "./HandoffModal";
import { Modal } from "../../ui/primitives";

export type TeachKind = "lesson" | "practice" | "summary" | "explain";
type SavedLesson = { conceptId: string } & Lesson;

export function emptyLesson(c: Course, id?: string): Lesson {
  const n = c.concepts.find((x) => x.id === (id ?? c.concepts[0]?.id));
  return {
    title: n?.title ?? c.title,
    position: c.title,
    purpose: n?.purpose ?? c.description,
    connections: n?.applications ?? [],
    body: n?.summary ?? c.description,
    cards: [],
    sourceIds: n?.sourceIds ?? [],
  };
}

export function LearnPage({
  courseId,
  conceptId,
}: {
  courseId?: string;
  conceptId?: string;
}) {
  const { tr } = useI18n();
  const L = useLearning();
  // The route names the course; fall back to the current one.
  const course: Course = useMemo(() => {
    if (courseId === sampleCourse.id) return sampleCourse;
    return L.courses.find((c) => c.id === courseId) ?? L.course;
  }, [courseId, L.courses, L.course]);
  const sample = course.id === sampleCourse.id;
  const guest = !L.user || sample;
  useEffect(() => {
    if (!sample && course.id !== L.course.id) L.selectCourse(course.id);
    // Keep the address honest when it named an unknown course.
    if (L.ready && courseId && courseId !== course.id)
      navigate(
        { name: "learn", courseId: course.id, conceptId },
        { replace: true },
      );
  }, [course.id, courseId, conceptId, sample, L]);
  const concept =
    course.concepts.find((n) => n.id === conceptId) ??
    course.concepts.find((n) => n.id === course.state.nextAction?.conceptId) ??
    course.concepts[0];
  const [lessons, setLessons] = useState<SavedLesson[]>([]),
    [lesson, setLesson] = useState<Lesson>(() =>
      emptyLesson(course, concept?.id),
    ),
    [sources, setSources] = useState<SourceRef[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState<"framework" | "lesson">("lesson"),
    [sheet, setSheet] = useState<
      null | "evidence" | "map" | "edit" | "handoff"
    >(null);
  // Saved lessons and sources load once per course.
  useEffect(() => {
    if (guest) {
      setLessons([]);
      setSources([]);
      return;
    }
    let live = true;
    void Promise.all([
      api<{ lessons: SavedLesson[] }>(`/courses/${course.id}/lessons`),
      api<{ sources: SourceRef[] }>(`/courses/${course.id}/sources`),
    ])
      .then(([l, s]) => {
        if (!live) return;
        setLessons(l.lessons);
        setSources(s.sources);
      })
      .catch((e: Error) => L.notify(e.message));
    return () => {
      live = false;
    };
  }, [course.id, guest]);
  useEffect(() => {
    if (!concept) return setLesson(emptyLesson(course));
    if (sample)
      return setLesson(
        concept.id === "conditional"
          ? sampleLesson
          : emptyLesson(course, concept.id),
      );
    setLesson(
      lessons.find((l) => l.conceptId === concept.id) ??
        emptyLesson(course, concept.id),
    );
  }, [concept?.id, lessons, sample, course.id]);
  const select = useCallback(
    (id: string) => {
      setTab("lesson");
      navigate({ name: "learn", courseId: course.id, conceptId: id });
    },
    [course.id],
  );
  const patchCourse = async (data: Partial<Course>) => {
    if (guest) {
      L.notify(
        tr(
          "示例课程不能修改。保存为自己的课程后即可编辑。",
          "The sample is read-only. Save it as your own course to edit.",
        ),
      );
      return false;
    }
    try {
      const d = await api<{ course: Course }>(`/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, revision: course.state.revision }),
      });
      L.updateCourse(d.course);
      return true;
    } catch (e) {
      L.notify(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const teach = async (kind: TeachKind, request = "", override?: Strategy) => {
    if (guest) {
      if (concept?.id === "conditional") {
        setLesson({
          ...sampleLesson,
          ...(override === "example"
            ? { title: "从一个学习小组开始理解条件概率" }
            : override === "diagnostic"
              ? { title: "先找出判断里的参照范围" }
              : {}),
        });
        L.notify(
          tr(
            "这是示例讲解。登录并建立自己的课程后，讲解会按你的证据调整。",
            "This is the sample lesson. Sign in and create your course for teaching that adapts to your evidence.",
          ),
        );
      } else
        L.notify(
          tr(
            "登录并创建课程后，才能生成自适应讲解。",
            "Sign in and create a course for adaptive teaching.",
          ),
        );
      return false;
    }
    if (!concept) {
      L.notify(
        tr("请先在左侧添加知识点。", "Add a concept to the framework first."),
      );
      return false;
    }
    setBusy(true);
    setStatus(
      tr(
        "正在整理上下文与知识联系…",
        "Connecting your context and the framework…",
      ),
    );
    let ok = false;
    try {
      await teachStream(
        `/courses/${course.id}/teach`,
        {
          conceptId: concept.id,
          request,
          strategy: override ?? course.strategy,
          kind,
        },
        (name, value) => {
          const d = value as Record<string, unknown>;
          if (name === "status")
            setStatus(
              tr(
                "正在生成适合当前理解的讲解…",
                "Preparing guidance for your current understanding…",
              ),
            );
          if (name === "lesson") {
            const next = d.course as Course | undefined;
            if (next) L.updateCourse(next);
            const l = d.lesson as Lesson;
            setLesson(l);
            setLessons((old) => [{ ...l, conceptId: concept.id }, ...old]);
            setSources(d.sources as SourceRef[]);
            ok = true;
            if (kind === "summary")
              void post(`/courses/${course.id}/notes`, {
                title: l.title,
                body: l.body,
                conceptId: concept.id,
              })
                .then(() =>
                  L.notify(
                    tr(
                      "总结已保存到知识笔记。",
                      "Summary saved to your notes.",
                    ),
                  ),
                )
                .catch((e: Error) => L.notify(e.message));
          }
          if (name === "error") throw new Error(String(d.message));
        },
      );
      void L.refresh();
    } catch (e) {
      L.notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
    return ok;
  };
  return (
    <main className="workspace" id="main">
      <div
        className="segmented mobile-only"
        role="tablist"
        aria-label={tr("工作台视图", "Workspace view")}
      >
        <button
          role="tab"
          aria-selected={tab === "framework"}
          className={tab === "framework" ? "active" : ""}
          onClick={() => setTab("framework")}
        >
          <Network size={16} aria-hidden="true" />
          {tr("知识线路", "Framework")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "lesson"}
          className={tab === "lesson" ? "active" : ""}
          onClick={() => setTab("lesson")}
        >
          <BookOpen size={16} aria-hidden="true" />
          {tr("当前学习", "Learning")}
        </button>
      </div>
      <div className={`workspace-grid show-${tab}`}>
        <FrameworkPanel
          course={course}
          sample={sample}
          selected={concept?.id ?? null}
          onSelect={select}
          onMap={() => setSheet("map")}
          onEdit={() => setSheet("edit")}
          onGoal={(goal) => void patchCourse({ goal })}
        />
        <LessonView
          course={course}
          concept={concept ?? null}
          lesson={lesson}
          sources={sources}
          guest={guest}
          sample={sample}
          busy={busy}
          status={status}
          teach={teach}
          onStrategy={async (strategy) => {
            if (await patchCourse({ strategy }))
              void teach("lesson", "", strategy);
            else if (guest) void teach("lesson", "", strategy);
          }}
          onEvidence={() => setSheet("evidence")}
          onMap={() => setSheet("map")}
          onHandoff={() => setSheet("handoff")}
        />
      </div>
      {sheet === "evidence" && concept && (
        <EvidenceSheet
          course={course}
          concept={concept}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "map" && (
        <Modal
          title={tr("知识线路图", "Line map")}
          size="wide"
          onClose={() => setSheet(null)}
        >
          <LineMap
            course={course}
            selected={concept?.id ?? null}
            onSelect={(id) => {
              setSheet(null);
              select(id);
            }}
          />
        </Modal>
      )}
      {sheet === "edit" && (
        <EditFramework
          course={course}
          onClose={() => setSheet(null)}
          onSave={async (concepts) => {
            if (await patchCourse({ concepts })) setSheet(null);
          }}
        />
      )}
      {sheet === "handoff" && (
        <HandoffModal
          course={course}
          conceptId={concept?.id ?? null}
          onClose={() => setSheet(null)}
        />
      )}
    </main>
  );
}
