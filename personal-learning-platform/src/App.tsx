import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  Compass,
  FileText,
  Flame,
  FolderOpen,
  Globe,
  GraduationCap,
  Home,
  Layers3,
  Leaf,
  Lightbulb,
  LoaderCircle,
  LogIn,
  Map,
  MessageCircle,
  MoreHorizontal,
  Network,
  NotebookPen,
  PanelLeftClose,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  X,
  Bell,
  ArrowRight,
  ArrowUpRight,
  Link2,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";
import type {
  Course,
  Lesson,
  SourceRef,
  Note,
  Material,
  AppUser,
  Usage,
  RewardState,
  ReminderSettings,
  Strategy,
  Goal,
  Concept,
} from "../shared/types";
import { sampleCourse, sampleLesson } from "../shared/sample";
import { policy } from "../shared/core";
import { api, post, teachStream, RequestError } from "./api";
import { RichText } from "./RichText";
import { PracticeCard } from "./Cards";
import { Recorder, Speaker } from "./Voice";
import { CodeRunner } from "./CodeRunner";
import { SettingsPage } from "./Settings";
import {
  MaterialsPage,
  NotesPage,
  GrowthPage,
  AdminPage,
  CodeLab,
} from "./Pages";
type Tr = (a: string, b: string) => string;
export interface Configuration {
  development: boolean;
  releaseStage?: string;
  identityMode: string;
  services: Record<string, boolean>;
  vapidPublicKey: string | null;
  sandboxOrigin: string | null;
}
type View =
  | "learn"
  | "courses"
  | "materials"
  | "notes"
  | "review"
  | "growth"
  | "settings"
  | "admin"
  | "code";
const goals: Record<Goal, [string, string]> = {
  mastery: ["长期掌握", "Lasting mastery"],
  exam: ["考试冲刺", "Exam preparation"],
  habit: ["习惯养成", "Build a habit"],
};
const strategies: Record<Strategy, [string, string]> = {
  framework: ["框架先行", "Framework first"],
  example: ["案例先行", "Example first"],
  diagnostic: ["诊断先行", "Diagnosis first"],
};
export default function App() {
  const [language, setLanguage] = useState<"zh" | "en">(() =>
    localStorage.getItem("pl:language") === "en" ? "en" : "zh",
  );
  const tr: Tr = (a, b) => (language === "zh" ? a : b);
  const [user, setUser] = useState<AppUser | null>(null),
    [config, setConfig] = useState<Configuration | null>(null),
    [courses, setCourses] = useState<Course[]>([]),
    [course, setCourse] = useState<Course>(sampleCourse),
    [view, setView] = useState<View>("learn"),
    [conceptId, setConceptId] = useState("conditional"),
    [lesson, setLesson] = useState<Lesson>(sampleLesson),
    [sources, setSources] = useState<SourceRef[]>([]),
    [notes, setNotes] = useState<Note[]>([]),
    [materials, setMaterials] = useState<Material[]>([]),
    [usage, setUsage] = useState<Usage | null>(null),
    [rewards, setRewards] = useState<RewardState | null>(null),
    [reminders, setReminders] = useState<ReminderSettings>({
      enabled: false,
      time: "19:00",
      timezone: "Asia/Singapore",
      email: false,
      push: false,
      quietStart: "22:00",
      quietEnd: "08:00",
      weeklyGoal: 5,
    }),
    [profile, setProfile] = useState<{
      timezone: string;
      name: string;
      preferences: Record<string, unknown>;
    }>({ timezone: "Asia/Singapore", name: "", preferences: {} });
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [toast, setToast] = useState<string | null>(null),
    [showLogin, setShowLogin] = useState(false),
    [showCreate, setShowCreate] = useState(false),
    [showGraph, setShowGraph] = useState(false),
    [showEdit, setShowEdit] = useState(false),
    [showNotifications, setShowNotifications] = useState(false),
    [notifications, setNotifications] = useState<
      { id: string; title: string; body: string; isRead: number; url: string }[]
    >([]),
    [query, setQuery] = useState(""),
    [request, setRequest] = useState(""),
    [mobileTab, setMobileTab] = useState<"framework" | "lesson">("lesson"),
    [frameworkFilter, setFrameworkFilter] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const error = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }, []);
  const guest = !user || course.id === sampleCourse.id;
  const concept =
    course.concepts.find((n) => n.id === conceptId) ?? course.concepts[0];
  const updateCourse = (next: Course) => {
    setCourse(next);
    setCourses((old) => old.map((c) => (c.id === next.id ? next : c)));
    if (user)
      localStorage.setItem(
        `pl:courses:${user.id}`,
        JSON.stringify(courses.map((c) => (c.id === next.id ? next : c))),
      );
  };
  const refresh = useCallback(async () => {
    try {
      const [{ user, profile, usage }, { courses }, { rewards }] =
        await Promise.all([
          api<{
            user: AppUser;
            profile: {
              timezone: string;
              name: string;
              preferences: Record<string, unknown>;
              reminders: ReminderSettings;
            };
            usage: Usage;
          }>("/me"),
          api<{ courses: Course[] }>("/courses"),
          api<{ rewards: RewardState }>("/rewards"),
        ]);
      setUser(user);
      setUsage(usage);
      setCourses(courses);
      setRewards(rewards);
      setReminders(profile.reminders);
      setProfile({
        timezone: profile.timezone,
        name: user.name,
        preferences: profile.preferences,
      });
      localStorage.setItem(
        "pl:last-session",
        JSON.stringify({ user, profile, usage }),
      );
      localStorage.setItem(`pl:courses:${user.id}`, JSON.stringify(courses));
      return courses;
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        setUser(null);
        return [];
      }
      throw e;
    }
  }, []);
  useEffect(() => {
    void api<Configuration>("/config")
      .then(setConfig)
      .catch((e) => error(e.message));
    void refresh()
      .then((list) => {
        if (list.length) {
          setCourse(list[0]);
          setConceptId(
            list[0].state.nextAction?.conceptId ??
              list[0].concepts[0]?.id ??
              "",
          );
          setLesson(emptyLesson(list[0]));
        }
      })
      .catch((e) => {
        if (!navigator.onLine) {
          const cached = localStorage.getItem("pl:last-session");
          if (cached) {
            const s = JSON.parse(cached);
            setUser(s.user);
            setProfile(s.profile);
            setUsage(s.usage);
            const cs = JSON.parse(
              localStorage.getItem(`pl:courses:${s.user.id}`) ?? "[]",
            );
            setCourses(cs);
            if (cs[0]) {
              setCourse(cs[0]);
              setConceptId(cs[0].concepts[0]?.id ?? "");
              setLesson(emptyLesson(cs[0]));
            }
          }
        } else error(e.message);
      });
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [refresh, error]);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    localStorage.setItem("pl:language", language);
  }, [language]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = String(
      profile.preferences.theme ?? "forest",
    );
  }, [profile.preferences]);
  useEffect(() => {
    if (guest) return;
    void Promise.all([
      api<{ notes: Note[] }>(`/courses/${course.id}/notes`),
      api<{ materials: Material[] }>(`/courses/${course.id}/materials`),
      api<{ sources: SourceRef[] }>(`/courses/${course.id}/sources`),
    ])
      .then(([n, m, s]) => {
        setNotes(n.notes);
        setMaterials(m.materials);
        setSources(s.sources);
      })
      .catch((e) => error(e.message));
  }, [course.id, guest, view, error]);
  useEffect(() => {
    if (
      view !== "materials" ||
      guest ||
      !materials.some((m) =>
        ["uploaded", "processing", "partial"].includes(m.status),
      )
    )
      return;
    const timer = setInterval(
      () =>
        void api<{ materials: Material[] }>(`/courses/${course.id}/materials`)
          .then((d) => setMaterials(d.materials))
          .catch(() => {}),
      6000,
    );
    return () => clearInterval(timer);
  }, [view, materials, course.id, guest]);
  const selectConcept = async (id: string, c = course) => {
    setConceptId(id);
    setMobileTab("lesson");
    if (c.id === sampleCourse.id) {
      setLesson(id === "conditional" ? sampleLesson : emptyLesson(c, id));
      return;
    }
    try {
      const saved = await api<{ lessons: ({ conceptId: string } & Lesson)[] }>(
        `/courses/${c.id}/lessons`,
      );
      setLesson(
        saved.lessons.find((l) => l.conceptId === id) ?? emptyLesson(c, id),
      );
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
    }
  };
  const selectCourse = (c: Course) => {
    setCourse(c);
    setSources([]);
    setNotes([]);
    setMaterials([]);
    const id = c.state.nextAction?.conceptId ?? c.concepts[0]?.id ?? "";
    setConceptId(id);
    setLesson(emptyLesson(c, id));
    setView("learn");
    void selectConcept(id, c);
  };
  const teach = async (
    kind: "lesson" | "practice" | "summary" | "explain" = "lesson",
    extra = request,
    override?: Strategy,
  ) => {
    if (guest) {
      if (conceptId === "conditional") {
        setLesson({
          ...sampleLesson,
          ...(override === "example"
            ? { title: "从一个学习小组开始理解条件概率" }
            : override === "diagnostic"
              ? { title: "先找出判断里的参照范围" }
              : {}),
        });
        setRequest("");
        if (kind === "summary")
          error(
            tr(
              "这是示例讲解。登录后可生成和保存自己的总结。",
              "This is a sample lesson. Sign in to generate and save your own summaries.",
            ),
          );
      } else
        error(
          tr(
            "请登录并创建课程，使用自适应讲解。",
            "Sign in and create a course for adaptive teaching.",
          ),
        );
      return;
    }
    if (!concept) {
      error(tr("请先建立知识框架。", "Create your knowledge framework first."));
      return;
    }
    setBusy(true);
    setStatus(
      tr("正在整理上下文与知识联系…", "Connecting your context and knowledge…"),
    );
    try {
      await teachStream(
        `/courses/${course.id}/teach`,
        {
          conceptId: concept.id,
          request: extra,
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
            if (d.course) {
              setCourse(d.course as Course);
              setCourses((cs) =>
                cs.map((c) =>
                  c.id === (d.course as Course).id ? (d.course as Course) : c,
                ),
              );
            }
            const l = d.lesson as Lesson;
            setLesson(l);
            setSources(d.sources as SourceRef[]);
            setRequest("");
            if (kind === "summary")
              void post(`/courses/${course.id}/notes`, {
                title: l.title,
                body: l.body,
                conceptId: concept.id,
              })
                .then(() =>
                  error(
                    tr(
                      "总结已保存到知识笔记。",
                      "Summary saved to your notes.",
                    ),
                  ),
                )
                .catch((e) => error(e.message));
          }
          if (name === "error") throw new Error(String(d.message));
        },
      );
      void refresh();
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };
  const patchCourse = async (data: Partial<Course>) => {
    if (guest) {
      setCourse({
        ...course,
        ...data,
        state: {
          ...course.state,
          goal: data.goal ?? course.goal,
          strategy: data.strategy ?? course.strategy,
        },
      });
      return true;
    }
    try {
      const d = await api<{ course: Course }>(`/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, revision: course.state.revision }),
      });
      updateCourse(d.course);
      return true;
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const requireLogin = () => {
    if (!user) {
      setShowLogin(true);
      return false;
    }
    if (guest) {
      error(
        tr(
          "先创建课程或打开示例课程的个人副本。",
          "Create a course or open your own copy of the sample.",
        ),
      );
      return false;
    }
    return true;
  };
  const seed = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    try {
      const r = await post<{ course: Course }>("/courses/sample", {});
      await refresh();
      selectCourse(r.course);
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
    }
  };
  const nav: { id: View; icon: typeof Home; label: [string, string] }[] = [
    { id: "learn", icon: Compass, label: ["学习工作台", "Workspace"] },
    { id: "courses", icon: BookOpen, label: ["我的课程", "My courses"] },
    { id: "materials", icon: FolderOpen, label: ["学习资料", "Materials"] },
    { id: "notes", icon: NotebookPen, label: ["知识笔记", "Knowledge notes"] },
    { id: "review", icon: CalendarDays, label: ["复习计划", "Review plan"] },
    { id: "code", icon: BrainCircuit, label: ["代码实验室", "Code lab"] },
    { id: "growth", icon: Trophy, label: ["我的成长", "My growth"] },
  ];
  const completed = course.concepts.filter(
    (n) => (course.state.concepts[n.id]?.mastery ?? 0) >= 3,
  ).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setView("learn");
          }}
        >
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          <span>
            Personal
            <br />
            <b>Learning</b>
          </span>
        </a>
        <div className="workspace-label">
          {tr("你的学习空间", "Your learning space")}
        </div>
        <nav aria-label={tr("主导航", "Main navigation")}>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              aria-label={tr(...n.label)}
              title={tr(...n.label)}
              onClick={() => setView(n.id)}
            >
              <n.icon size={19} />
              <span>{tr(...n.label)}</span>
              {n.id === "review" &&
                courses.some((c) =>
                  Object.values(c.state.concepts).some(
                    (s) =>
                      s.nextReview && s.nextReview < new Date().toISOString(),
                  ),
                ) && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="grow-note">
            <span>🌱</span>
            <p>
              {tr(
                "理解会一点点生长。",
                "Understanding grows, one connection at a time.",
              )}
              <small>
                {tr(
                  "今天，从一个小问题开始。",
                  "Start with one small question today.",
                )}
              </small>
            </p>
          </div>
          {user?.admin && (
            <button
              className={`nav-item ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <ShieldCheck size={18} />
              {tr("管理控制台", "Admin console")}
            </button>
          )}
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <Settings size={18} />
            {tr("学习设置", "Settings")}
          </button>
          <button
            className="profile-button"
            onClick={() => (user ? setView("settings") : setShowLogin(true))}
          >
            <span className="avatar">
              {user ? user.name.slice(0, 1).toUpperCase() : "K"}
            </span>
            <span>
              {user ? user.name : tr("开始你的学习", "Begin your learning")}
              <small>
                {user
                  ? tr("个人学习空间", "Personal workspace")
                  : tr("登录以保存进度", "Sign in to save progress")}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{tr("学习空间", "Workspace")}</span>
            <ChevronRight size={14} />
            <strong>
              {view === "learn"
                ? course.title
                : tr(
                    ...(nav.find((n) => n.id === view)?.label ?? [
                      view === "admin" ? "管理控制台" : "学习设置",
                      view === "admin" ? "Admin console" : "Settings",
                    ]),
                  )}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="streak-pill">
              <Flame size={16} />
              {rewards?.streak ?? 0} {tr("天", "days")}
            </span>
            <button
              className="icon-button language-button"
              onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
              aria-label={tr("切换为英文", "Switch to Chinese")}
            >
              <Globe size={17} />
              <span>{language === "zh" ? "EN" : "中"}</span>
            </button>
            <button
              className="icon-button notification-button"
              aria-label={tr("通知", "Notifications")}
              onClick={async () => {
                setShowNotifications(!showNotifications);
                if (user)
                  try {
                    const d = await api<{
                      notifications: typeof notifications;
                    }>("/notifications");
                    setNotifications(d.notifications);
                  } catch (e) {
                    error(e instanceof Error ? e.message : String(e));
                  }
              }}
            >
              <Bell size={19} />
              {notifications.some((n) => !n.isRead) && <i />}
            </button>
          </div>
        </header>
        {config?.releaseStage === "internal" && (
          <div className="notice-banner">
            {tr(
              "内部验收环境 · 外部服务待配置，尚未正式上线。",
              "Internal validation · provider setup pending; not formally released.",
            )}
          </div>
        )}
        {offline && (
          <div className="notice-banner">
            {tr(
              "当前离线。已载入的内容可继续阅读；输入会保留，联网后再提交。",
              "You are offline. Keep reading loaded content; submit your work after reconnecting.",
            )}
          </div>
        )}
        {guest && (
          <div className="sample-banner">
            <span>
              <span className="sample-dot" />
              {tr(
                "当前为内置示例，掌握度和记录从真实作答开始。",
                "Built-in sample. Your learning record starts with your own work.",
              )}
            </span>
            <button onClick={() => void seed()}>
              {user
                ? tr("保存为我的课程", "Make this my course")
                : tr("登录，开启个人学习", "Sign in and start learning")}
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {view === "learn" && (
          <>
            <div className="course-toolbar">
              <div className="course-select">
                <GraduationCap size={18} />
                <select
                  aria-label={tr("选择课程", "Choose course")}
                  value={course.id}
                  onChange={(e) => {
                    const c = courses.find((c) => c.id === e.target.value);
                    if (c) selectCourse(c);
                  }}
                >
                  {guest && (
                    <option value={sampleCourse.id}>
                      {sampleCourse.title} · {tr("示例", "Sample")}
                    </option>
                  )}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  aria-label={tr("新建课程", "New course")}
                  onClick={() =>
                    user ? setShowCreate(true) : setShowLogin(true)
                  }
                >
                  <Plus size={17} />
                </button>
              </div>
              <div className="mode-select">
                <Target size={15} />
                <select
                  aria-label={tr("学习目标", "Learning goal")}
                  value={course.goal}
                  onChange={(e) =>
                    void patchCourse({ goal: e.target.value as Goal })
                  }
                >
                  {Object.entries(goals).map(([id, l]) => (
                    <option key={id} value={id}>
                      {tr(...l)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="course-progress">
                <span>
                  {tr("已验证掌握", "Verified mastery")} <b>{completed}</b> /{" "}
                  {course.concepts.length}
                </span>
                <div>
                  <i
                    style={{
                      width: `${course.concepts.length ? (completed / course.concepts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mobile-tabs">
              <button
                className={mobileTab === "framework" ? "active" : ""}
                onClick={() => setMobileTab("framework")}
              >
                <Network size={16} />
                {tr("知识框架", "Framework")}
              </button>
              <button
                className={mobileTab === "lesson" ? "active" : ""}
                onClick={() => setMobileTab("lesson")}
              >
                <BookOpen size={16} />
                {tr("当前学习", "Learning")}
              </button>
            </div>
            <div className={`learning-layout mobile-${mobileTab}`}>
              <aside className="framework-panel">
                <div className="panel-heading">
                  <h2>{tr("知识框架", "Knowledge framework")}</h2>
                  <button
                    className="icon-button"
                    title={tr("编辑框架", "Edit framework")}
                    onClick={() => setShowEdit(true)}
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                </div>
                <p className="framework-description">
                  {tr("看见知识之间的联系", "See how the ideas connect")}
                </p>
                <div className="framework-search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tr("查找知识点", "Find a concept")}
                    aria-label={tr("查找知识点", "Find a concept")}
                  />
                </div>
                <div className="framework-filters">
                  <button
                    className={frameworkFilter ? "active" : ""}
                    onClick={() => setFrameworkFilter(!frameworkFilter)}
                  >
                    {tr("只看薄弱点", "Show gaps")}
                  </button>
                  <button onClick={() => setShowGraph(true)}>
                    <Network size={13} />
                    {tr("查看关联", "Relations")}
                  </button>
                </div>
                <div className="knowledge-tree">
                  {course.concepts
                    .filter(
                      (n) =>
                        (!query ||
                          `${n.title} ${n.summary}`
                            .toLowerCase()
                            .includes(query.toLowerCase())) &&
                        (!frameworkFilter ||
                          !!course.state.concepts[n.id]?.weaknesses.length ||
                          [1, 2].includes(
                            course.state.concepts[n.id]?.mastery ?? 0,
                          )),
                    )
                    .map((n, i) => (
                      <button
                        key={n.id}
                        className={`tree-node ${n.parentId ? "child" : ""} ${conceptId === n.id ? "selected" : ""}`}
                        onClick={() => void selectConcept(n.id)}
                      >
                        <span
                          className={`mastery-dot level-${course.state.concepts[n.id]?.mastery ?? 0}`}
                        >
                          {(course.state.concepts[n.id]?.mastery ?? 0) >= 3 ? (
                            <Check size={11} />
                          ) : null}
                        </span>
                        <span>{n.title}</span>
                        {conceptId === n.id && (
                          <span className="current-marker">
                            {tr("当前", "Here")}
                          </span>
                        )}
                      </button>
                    ))}
                  {!course.concepts.length && (
                    <Empty
                      icon={Network}
                      title={tr(
                        "你的框架从这里开始",
                        "Your framework starts here",
                      )}
                      text={tr(
                        "导入资料后整理知识点，或直接创建想学的主题。",
                        "Organize uploaded materials, or create a topic you want to learn.",
                      )}
                    />
                  )}
                </div>
                <div className="framework-legend">
                  <span>
                    <i className="mastery-dot level-0" />
                    {tr("待了解", "Not assessed")}
                  </span>
                  <span>
                    <i className="mastery-dot level-2" />
                    {tr("练习中", "Developing")}
                  </span>
                  <span>
                    <i className="mastery-dot level-3" />
                    {tr("已验证", "Verified")}
                  </span>
                </div>
                <button className="map-link" onClick={() => setShowGraph(true)}>
                  <Map size={17} />
                  {tr("展开完整知识地图", "Open the knowledge map")}
                  <ArrowUpRight size={15} />
                </button>
                <div className="next-action">
                  <span>
                    <Compass size={15} />
                    {tr("下一小步", "Your next small step")}
                  </span>
                  <p>
                    {course.state.nextAction?.title ??
                      tr(
                        "先选择一个想了解的知识点",
                        "Choose a concept to begin",
                      )}
                  </p>
                  <small>{course.state.nextAction?.reason}</small>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (course.state.nextAction)
                        void selectConcept(course.state.nextAction.conceptId);
                    }}
                  >
                    {tr("从这里继续", "Continue here")}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </aside>
              <main className="lesson-panel">
                <div className="lesson-topline">
                  <span>
                    <span className="tiny-node" />
                    {tr("理解与联系", "Understand & connect")}
                  </span>
                  <div>
                    <button
                      className="text-button"
                      onClick={() => setShowGraph(true)}
                    >
                      <Layers3 size={15} />
                      {tr("整体位置", "In the bigger picture")}
                    </button>
                    <select
                      aria-label={tr("讲解路径", "Teaching approach")}
                      value={course.strategy}
                      onChange={(e) => {
                        const strategy = e.target.value as Strategy;
                        void patchCourse({ strategy }).then((ok) => {
                          if (ok) void teach("lesson", "", strategy);
                        });
                      }}
                    >
                      {Object.entries(strategies).map(([id, v]) => (
                        <option key={id} value={id}>
                          {tr(...v)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="lesson-breadcrumb">
                  {lesson.position || course.title}
                </div>
                <h1>{lesson.title || concept?.title || course.title}</h1>
                <p className="lesson-purpose">
                  {lesson.purpose || concept?.purpose || course.description}
                </p>
                <div className="learning-context">
                  <Lightbulb size={19} />
                  <div>
                    <strong>
                      {tr("为什么学这一点？", "Why this idea matters")}
                    </strong>
                    <p>{concept?.purpose ?? course.description}</p>
                  </div>
                  <span>{tr("约 10 分钟", "About 10 min")}</span>
                </div>
                {busy && (
                  <div className="thinking-status" role="status">
                    <LoaderCircle size={19} className="spin" />
                    {status}
                  </div>
                )}
                <article className="lesson-body">
                  <RichText
                    text={lesson.body || concept?.summary || course.description}
                  />
                </article>
                {!!lesson.connections.length && (
                  <div className="connections">
                    <span>
                      <Link2 size={16} />
                      {tr("把知识连起来", "Connect the ideas")}
                    </span>
                    {lesson.connections.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                  </div>
                )}
                <div className="lesson-action-row">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void teach("lesson")}
                  >
                    <Sparkles size={16} />
                    {tr("继续展开讲解", "Explain this further")}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void teach(
                        "practice",
                        tr(
                          "请围绕当前理解给一道适当难度的独立练习。",
                          "Give me an appropriately challenging independent practice task.",
                        ),
                      )
                    }
                  >
                    <BrainCircuit size={16} />
                    {tr("给我一道练习", "Give me practice")}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void teach(
                        "summary",
                        "生成有层次的知识总结，标出联系和待确认理解。",
                      )
                    }
                  >
                    <NotebookPen size={16} />
                    {tr("梳理成总结", "Make a connected summary")}
                  </button>
                </div>
                <Speaker
                  text={lesson.body || concept?.summary || ""}
                  language={course.language}
                  onError={error}
                  tr={tr}
                />
                <div className="practice-stack">
                  {lesson.cards.map((card) => (
                    <PracticeCard
                      key={card.id}
                      card={card}
                      course={course}
                      guest={guest}
                      onCourse={(c) => {
                        updateCourse(c);
                        void refresh();
                      }}
                      onError={error}
                      sandboxOrigin={config?.sandboxOrigin ?? null}
                      tr={tr}
                    />
                  ))}
                </div>
                {!!sources.length && (
                  <details className="source-list">
                    <summary>
                      {tr("来源与资料位置", "Sources and locations")} ·{" "}
                      {sources.length}
                    </summary>
                    {sources.map((s) => (
                      <div key={s.id}>
                        <FileText size={15} />
                        <span>
                          {s.title}
                          {s.page
                            ? ` · ${tr("第", "p. ")}${s.page}${tr("页", "")}`
                            : ""}
                        </span>
                        {s.materialId ? (
                          <a
                            href={`/api/v1/materials/${s.materialId}/file?normalized=1#page=${s.page ?? 1}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tr("回看原文", "View source")}
                          </a>
                        ) : s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {tr("网页", "Web page")}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </details>
                )}
                <div className="question-composer">
                  <div>
                    <MessageCircle size={17} />
                    <span>
                      {tr(
                        "有一个地方还没连上？",
                        "Is there a connection that is still unclear?",
                      )}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder={tr(
                      "说说你卡在哪里，或试着提出自己的理解…",
                      "Tell me where you are stuck, or explain your understanding…",
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void teach("explain");
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <Recorder
                      tr={tr}
                      onText={(s) =>
                        setRequest(request ? `${request}\n${s}` : s)
                      }
                      onError={error}
                    />
                    <span>
                      {tr(
                        "按你的节奏，随时换一种讲法",
                        "Your pace. A different explanation whenever you need it.",
                      )}
                    </span>
                    <button
                      className="send-button"
                      aria-label={tr("发送问题", "Send question")}
                      disabled={busy || !request.trim()}
                      onClick={() => void teach("explain")}
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </div>
                <div className="lesson-footer">
                  <Leaf size={14} />
                  {tr(
                    "看懂只是开始，能独立解释和应用，才是你自己的知识。",
                    "Understanding begins here. Independent explanation and application make it yours.",
                  )}
                </div>
              </main>
            </div>
          </>
        )}
        {view === "courses" && (
          <Page
            title={tr("我的课程", "My courses")}
            subtitle={tr(
              "每个学习目标，都有一张持续生长的知识地图。",
              "Every learning goal has a knowledge map that keeps growing.",
            )}
            action={
              <button
                className="button"
                onClick={() =>
                  user ? setShowCreate(true) : setShowLogin(true)
                }
              >
                <Plus size={17} />
                {tr("创建课程", "New course")}
              </button>
            }
          >
            <div className="course-grid">
              {courses.map((c) => (
                <button
                  className="course-card"
                  key={c.id}
                  onClick={() => selectCourse(c)}
                >
                  <span className="course-icon">
                    <BookOpen size={24} />
                  </span>
                  <span className="soft-tag">{tr(...goals[c.goal])}</span>
                  <h2>{c.title}</h2>
                  <p>{c.description}</p>
                  <footer>
                    <span>
                      {c.concepts.length} {tr("个知识点", "concepts")}
                    </span>
                    <ArrowUpRight size={18} />
                  </footer>
                </button>
              ))}
              <button
                className="course-card sample-course"
                onClick={() => void seed()}
              >
                <span className="course-icon">🌿</span>
                <span className="soft-tag">
                  {tr("内置示例", "Built-in sample")}
                </span>
                <h2>{sampleCourse.title}</h2>
                <p>{sampleCourse.description}</p>
                <footer>
                  <span>
                    {tr(
                      "从完整的知识框架开始体验",
                      "Explore a connected knowledge framework",
                    )}
                  </span>
                  <Plus size={18} />
                </footer>
              </button>
            </div>
          </Page>
        )}
        {view === "materials" && (
          <MaterialsPage
            course={course}
            materials={materials}
            setMaterials={setMaterials}
            requireLogin={requireLogin}
            onError={error}
            onOrganized={updateCourse}
            tr={tr}
          />
        )}
        {view === "notes" && (
          <NotesPage
            course={course}
            notes={notes}
            setNotes={setNotes}
            requireLogin={requireLogin}
            onError={error}
            tr={tr}
          />
        )}
        {view === "review" && (
          <Page
            title={tr("复习，让理解留下来", "Review, so understanding stays")}
            subtitle={tr(
              "用间隔后的新尝试，区分熟悉感与真正保持。",
              "A fresh attempt after a gap separates familiarity from retention.",
            )}
          >
            <div className="review-intro">
              <CalendarDays size={28} />
              <div>
                <h3>
                  {tr(
                    "跟随证据安排，不必补完所有旧任务",
                    "Follow the evidence, one useful task at a time",
                  )}
                </h3>
                <p>
                  {tr(
                    "优先解决阻碍当前理解的缺口，再做已到期的无提示复习。",
                    "Repair blocking gaps and revisit due concepts without hints.",
                  )}
                </p>
              </div>
            </div>
            {courses.flatMap((c) =>
              Object.entries(c.state.concepts)
                .filter(([, s]) => s.nextReview)
                .map(([id, s]) => (
                  <button
                    className="review-row"
                    key={`${c.id}:${id}`}
                    onClick={() => {
                      selectCourse(c);
                      void selectConcept(id, c);
                    }}
                  >
                    <span className={`mastery-dot level-${s.mastery}`} />
                    <div>
                      <strong>
                        {c.concepts.find((n) => n.id === id)?.title ?? id}
                      </strong>
                      <small>{c.title}</small>
                    </div>
                    <span
                      className={
                        s.nextReview! < new Date().toISOString()
                          ? "due"
                          : "muted"
                      }
                    >
                      {new Date(s.nextReview!).toLocaleDateString(
                        language === "zh" ? "zh-CN" : "en-GB",
                      )}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                )),
            )}
            {!courses.some((c) =>
              Object.values(c.state.concepts).some((s) => s.nextReview),
            ) && (
              <Empty
                icon={CalendarDays}
                title={tr(
                  "复习会随学习证据生成",
                  "Reviews grow from your learning evidence",
                )}
                text={tr(
                  "完成独立作答后，系统会安排下一次间隔复习。",
                  "After an independent attempt, your next spaced review will appear here.",
                )}
              />
            )}
          </Page>
        )}
        {view === "code" && (
          <Page
            title={tr("代码实验室", "Code lab")}
            subtitle={tr(
              "动手验证想法，把结果连接回原理。",
              "Test an idea, then connect the result back to the principle.",
            )}
          >
            <CodeLab
              tr={tr}
              onError={error}
              sandboxOrigin={config?.sandboxOrigin ?? null}
            />
          </Page>
        )}
        {view === "growth" && (
          <GrowthPage
            rewards={rewards}
            refresh={refresh}
            onError={error}
            tr={tr}
            user={user}
          />
        )}
        {view === "settings" && (
          <SettingsPage
            config={config}
            user={user}
            profile={profile}
            reminders={reminders}
            usage={usage}
            language={language}
            tr={tr}
            onError={error}
            refresh={refresh}
            setReminders={setReminders}
            onLogin={() => setShowLogin(true)}
            onLogout={() => {
              setUser(null);
              setCourse(sampleCourse);
              setLesson(sampleLesson);
              setCourses([]);
              setView("learn");
              Object.keys(localStorage)
                .filter((k) => k.startsWith("pl:") && k !== "pl:language")
                .forEach((k) => localStorage.removeItem(k));
            }}
          />
        )}
        {view === "admin" && user?.admin && (
          <AdminPage tr={tr} onError={error} />
        )}
      </div>
      <nav className="mobile-nav">
        {nav
          .filter((n) => ["learn", "courses", "notes", "growth"].includes(n.id))
          .map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
            >
              <n.icon size={20} />
              <span>{tr(...n.label)}</span>
            </button>
          ))}
        <button
          onClick={() => setView("settings")}
          className={view === "settings" ? "active" : ""}
        >
          <Settings size={20} />
          <span>{tr("设置", "Settings")}</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="alert">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label={tr("关闭", "Close")}
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {showLogin && (
        <LoginModal
          tr={tr}
          config={config}
          onClose={() => setShowLogin(false)}
          onError={error}
          onDone={async () => {
            setShowLogin(false);
            const list = await refresh();
            if (list?.[0]) selectCourse(list[0]);
          }}
        />
      )}
      {showCreate && (
        <CreateCourse
          tr={tr}
          onClose={() => setShowCreate(false)}
          onError={error}
          onCreated={async (c) => {
            setShowCreate(false);
            await refresh();
            selectCourse(c);
          }}
        />
      )}
      {showGraph && (
        <Modal
          title={tr("知识之间，怎样相连", "How these ideas connect")}
          onClose={() => setShowGraph(false)}
          wide
        >
          <KnowledgeGraph
            course={course}
            selected={conceptId}
            onSelect={(id) => {
              setShowGraph(false);
              void selectConcept(id);
            }}
            tr={tr}
          />
        </Modal>
      )}
      {showEdit && (
        <EditFramework
          course={course}
          tr={tr}
          onClose={() => setShowEdit(false)}
          onSave={async (concepts) => {
            await patchCourse({ concepts });
            setShowEdit(false);
          }}
        />
      )}
      {showNotifications && (
        <div className="notification-popover">
          <div className="panel-heading">
            <h3>{tr("学习提醒", "Learning reminders")}</h3>
            <button
              className="icon-button"
              onClick={() => setShowNotifications(false)}
            >
              <X size={16} />
            </button>
          </div>
          {notifications.length ? (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`notification-item ${n.isRead ? "" : "unread"}`}
                onClick={async () => {
                  await api(`/notifications/${n.id}`, { method: "PATCH" });
                  setNotifications(
                    notifications.map((x) =>
                      x.id === n.id ? { ...x, isRead: 1 } : x,
                    ),
                  );
                  setShowNotifications(false);
                  setView("learn");
                }}
              >
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </button>
            ))
          ) : (
            <p className="muted">
              {tr(
                "有新任务时，会在这里提醒你。",
                "New learning reminders will appear here.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function emptyLesson(c: Course, id?: string): Lesson {
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
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </main>
  );
}
export function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Home;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <Icon size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function LoginModal({
  tr,
  config,
  onClose,
  onDone,
  onError,
}: {
  tr: Tr;
  config: Configuration | null;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [otp, setOtp] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const execute = async () => {
    setBusy(true);
    try {
      if (!sent) {
        await post("/api/auth/email-otp/send-verification-otp", {
          email,
          type: "sign-in",
        });
        setSent(true);
      } else {
        await post("/api/auth/sign-in/email-otp", { email, otp });
        await onDone();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr("让学习从这里接上", "Pick up your learning here")}
      onClose={onClose}
    >
      <p className="muted">
        {tr(
          "保存知识地图、学习证据和每一次新的理解。",
          "Save your knowledge maps, learning evidence and new understanding.",
        )}
      </p>
      {config?.identityMode === "sites" && (
        <a
          className="button full"
          href="/signin-with-chatgpt?return_to=/"
          target="_top"
        >
          {tr("使用 ChatGPT 账号继续", "Continue with ChatGPT")}
        </a>
      )}
      {config?.services.google && (
        <button
          className="button secondary full"
          onClick={async () => {
            try {
              const r = await post<{ url: string }>(
                "/api/auth/sign-in/social",
                { provider: "google", callbackURL: location.origin },
              );
              if (r.url) location.assign(r.url);
            } catch (e) {
              onError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          {tr("使用 Google 继续", "Continue with Google")}
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void execute();
        }}
      >
        <label>
          {tr("邮箱", "Email")}
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </label>
        {sent && (
          <label>
            {tr("6 位验证码", "6-digit code")}
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
            />
          </label>
        )}
        <button
          className="button full"
          disabled={busy || !config?.services.email}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <LogIn size={17} />
          )}{" "}
          {sent
            ? tr("登录 / 注册", "Sign in / Sign up")
            : tr("发送登录验证码", "Send sign-in code")}
        </button>
        {!config?.services.email && (
          <p className="form-help">
            {tr(
              "邮件登录尚未配置。管理员可通过配置向导接入邮件服务。",
              "Email sign-in is not configured. The administrator can enable it with the setup wizard.",
            )}
          </p>
        )}
      </form>
    </Modal>
  );
}
function CreateCourse({
  tr,
  onClose,
  onCreated,
  onError,
}: {
  tr: Tr;
  onClose: () => void;
  onCreated: (c: Course) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [goal, setGoal] = useState<Goal>("mastery"),
    [strategy, setStrategy] = useState<Strategy>("framework"),
    [language, setLanguage] = useState("mixed"),
    [examDate, setExamDate] = useState(""),
    [generate, setGenerate] = useState(true),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={tr("你想把什么学明白？", "What do you want to understand?")}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await post<{ course: Course }>("/courses", {
              title,
              description,
              goal,
              strategy,
              language,
              examDate: examDate || null,
              generate,
            });
            await onCreated(r.course);
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tr("课程或主题", "Course or topic")}
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr(
              "例如：统计推断、运营管理、Python 数据分析",
              "For example: statistical inference or Python data analysis",
            )}
          />
        </label>
        <label>
          {tr("你希望学会什么？", "What do you want to be able to do?")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={tr(
              "告诉系统你的目标、已有基础或正在卡住的地方。",
              "Describe your goals, background or current difficulty.",
            )}
          />
        </label>
        <div className="form-grid">
          <label>
            {tr("学习目标", "Learning goal")}
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
            >
              {Object.entries(goals).map(([id, l]) => (
                <option key={id} value={id}>
                  {tr(...l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("讲解路径", "Teaching approach")}
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
            >
              {Object.entries(strategies).map(([id, l]) => (
                <option key={id} value={id}>
                  {tr(...l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("课程语言", "Course language")}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="mixed">
                {tr("中文讲解 + 英文术语", "Chinese with English terms")}
              </option>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {goal === "exam" && (
            <label>
              {tr("考试日期", "Exam date")}
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>
          )}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
          />
          {tr("让 AI 先建立知识框架", "Generate a knowledge framework with AI")}
        </label>
        <p className="form-help">
          {tr(
            "也可以先创建空课程，再上传自己的课件组织框架。",
            "You can also create an empty course and build its framework from your materials.",
          )}
        </p>
        <button className="button full" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Plus size={17} />
          )}{" "}
          {tr("建立我的学习空间", "Create my learning space")}
        </button>
      </form>
    </Modal>
  );
}
function KnowledgeGraph({
  course,
  selected,
  onSelect,
  tr,
}: {
  course: Course;
  selected: string;
  onSelect: (id: string) => void;
  tr: Tr;
}) {
  return (
    <div className="graph-modal">
      <p className="muted">
        {tr(
          "实线表示层级，虚线表示先修联系。选择任意节点进入学习。",
          "Solid lines show hierarchy; dashed lines show prerequisites. Select a concept to explore.",
        )}
      </p>
      <div className="graph-canvas">
        <svg
          viewBox={`0 0 800 ${Math.max(400, Math.ceil(course.concepts.length / 3) * 150 + 100)}`}
          role="img"
          aria-label={tr("知识关联图", "Knowledge relationship map")}
        >
          {course.concepts.flatMap((n, i) =>
            [
              ...(n.parentId ? [{ id: n.parentId, dash: false }] : []),
              ...n.prerequisites
                .filter((p) => p !== n.parentId)
                .map((id) => ({ id, dash: true })),
            ].map((link, j) => {
              const index = course.concepts.findIndex((c) => c.id === link.id);
              if (index < 0) return null;
              return (
                <path
                  key={`${n.id}:${j}`}
                  d={`M${140 + (index % 3) * 260} ${65 + Math.floor(index / 3) * 150} C${140 + (index % 3) * 260} ${140 + Math.floor(index / 3) * 150},${140 + (i % 3) * 260} ${-10 + Math.floor(i / 3) * 150},${140 + (i % 3) * 260} ${65 + Math.floor(i / 3) * 150}`}
                  fill="none"
                  stroke={link.dash ? "#a5b4a9" : "#7e9f8c"}
                  strokeDasharray={link.dash ? "5 5" : undefined}
                />
              );
            }),
          )}
          {course.concepts.map((n, i) => (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={n.title}
              onClick={() => onSelect(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.id);
                }
              }}
              className="graph-node"
            >
              <rect
                x={40 + (i % 3) * 260}
                y={40 + Math.floor(i / 3) * 150}
                width="200"
                height="54"
                rx="12"
                fill={selected === n.id ? "#173e3a" : "#fff"}
                stroke="#ccdad0"
              />
              <text
                x={140 + (i % 3) * 260}
                y={72 + Math.floor(i / 3) * 150}
                textAnchor="middle"
                fill={selected === n.id ? "#fff" : "#173e3a"}
                fontSize="14"
              >
                {n.title.length > 13 ? n.title.slice(0, 12) + "…" : n.title}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
function EditFramework({
  course,
  tr,
  onClose,
  onSave,
}: {
  course: Course;
  tr: Tr;
  onClose: () => void;
  onSave: (concepts: Concept[]) => Promise<void>;
}) {
  const [concepts, setConcepts] = useState(course.concepts),
    [selected, setSelected] = useState(course.concepts[0]?.id ?? ""),
    [busy, setBusy] = useState(false);
  const node = concepts.find((n) => n.id === selected);
  const change = (partial: Partial<Concept>) =>
    setConcepts(
      concepts.map((n) => (n.id === selected ? { ...n, ...partial } : n)),
    );
  return (
    <Modal
      title={tr("编辑知识框架", "Edit knowledge framework")}
      onClose={onClose}
      wide
    >
      <div className="framework-editor">
        <div>
          {concepts.map((n) => (
            <button
              className={selected === n.id ? "active" : ""}
              key={n.id}
              onClick={() => setSelected(n.id)}
            >
              {n.title}
            </button>
          ))}
          <button
            className="text-button"
            onClick={() => {
              const id = crypto.randomUUID();
              setConcepts([
                ...concepts,
                {
                  id,
                  title: tr("新的知识点", "New concept"),
                  summary: "",
                  purpose: "",
                  prerequisites: [],
                  parentId: null,
                  applications: [],
                  sourceIds: [],
                },
              ]);
              setSelected(id);
            }}
          >
            <Plus size={15} />
            {tr("添加知识点", "Add concept")}
          </button>
        </div>
        {node && (
          <div className="editor-fields">
            <label>
              {tr("名称", "Title")}
              <input
                value={node.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              {tr("为什么学它", "Purpose")}
              <input
                value={node.purpose}
                onChange={(e) => change({ purpose: e.target.value })}
              />
            </label>
            <label>
              {tr("核心含义", "Core meaning")}
              <textarea
                value={node.summary}
                onChange={(e) => change({ summary: e.target.value })}
              />
            </label>
            <label>
              {tr("上级节点", "Parent")}
              <select
                value={node.parentId ?? ""}
                onChange={(e) => change({ parentId: e.target.value || null })}
              >
                <option value="">{tr("顶层节点", "Top-level concept")}</option>
                {concepts
                  .filter((n) => n.id !== selected)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
              </select>
            </label>
            <fieldset>
              <legend>{tr("先修知识", "Prerequisites")}</legend>
              {concepts
                .filter((n) => n.id !== selected)
                .map((n) => (
                  <label className="check-label" key={n.id}>
                    <input
                      type="checkbox"
                      checked={node.prerequisites.includes(n.id)}
                      onChange={(e) =>
                        change({
                          prerequisites: e.target.checked
                            ? [...node.prerequisites, n.id]
                            : node.prerequisites.filter((id) => id !== n.id),
                        })
                      }
                    />
                    {n.title}
                  </label>
                ))}
            </fieldset>
            <label>
              {tr("应用场景，每行一个", "Applications, one per line")}
              <textarea
                value={node.applications.join("\n")}
                onChange={(e) =>
                  change({
                    applications: e.target.value.split("\n").filter(Boolean),
                  })
                }
              />
            </label>
            <button
              className="text-button danger"
              onClick={() => {
                setConcepts(
                  concepts
                    .filter((n) => n.id !== selected)
                    .map((n) => ({
                      ...n,
                      parentId: n.parentId === selected ? null : n.parentId,
                      prerequisites: n.prerequisites.filter(
                        (id) => id !== selected,
                      ),
                    })),
                );
                setSelected(concepts.find((n) => n.id !== selected)?.id ?? "");
              }}
            >
              {tr("移除此节点", "Remove this concept")}
            </button>
          </div>
        )}
      </div>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(concepts);
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr("保存框架", "Save framework")}
      </button>
    </Modal>
  );
}
