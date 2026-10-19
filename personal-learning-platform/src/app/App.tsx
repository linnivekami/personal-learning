import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarClock,
  Code2,
  Flame,
  FolderOpen,
  Library,
  LogIn,
  Moon,
  NotebookPen,
  ScrollText,
  Settings,
  ShieldCheck,
  Sprout,
  Sun,
  SunMoon,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { I18nProvider, storage, useI18n } from "./i18n";
import { LearningProvider, useLearning } from "./store";
import { Link, navigate, useRoute, type Route, type RouteName } from "./router";
import { api } from "../lib/api";
import { reviews } from "../lib/plan";
import { daysFrom } from "../lib/format";
import { Brand } from "../ui/Brand";
import type { AppNotification } from "./types";
import { TodayPage } from "../features/today/TodayPage";
import { LearnPage } from "../features/learn/LearnPage";
import { CoursesPage } from "../features/courses/CoursesPage";
import { ReviewPage } from "../features/review/ReviewPage";
import { CheatSheetPage } from "../features/cheatsheet/CheatSheetPage";
import { NotesPage } from "../features/notes/NotesPage";
import { MaterialsPage } from "../features/materials/MaterialsPage";
import { CodeLabPage } from "../features/lab/CodeLabPage";
import { GrowthPage } from "../features/growth/GrowthPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { AdminPage } from "../features/admin/AdminPage";
import { LoginModal } from "../features/auth/LoginModal";

export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}
function Root() {
  const { tr } = useI18n();
  return (
    <LearningProvider
      messages={{
        chooseCourse: tr(
          "先创建自己的课程，或把示例保存为我的课程。",
          "Create a course, or save the sample as your own, first.",
        ),
      }}
    >
      <Shell />
    </LearningProvider>
  );
}

interface NavItem {
  name: RouteName;
  icon: LucideIcon;
  label: [string, string];
}
const primary: NavItem[] = [
  { name: "today", icon: Sun, label: ["今天", "Today"] },
  { name: "learn", icon: BookOpen, label: ["学习", "Learn"] },
  { name: "review", icon: CalendarClock, label: ["复习", "Review"] },
  { name: "cheatsheet", icon: ScrollText, label: ["速查表", "Cheat sheet"] },
  { name: "courses", icon: Library, label: ["我的课程", "Courses"] },
  { name: "notes", icon: NotebookPen, label: ["知识笔记", "Notes"] },
  { name: "materials", icon: FolderOpen, label: ["学习资料", "Materials"] },
  { name: "lab", icon: Code2, label: ["代码实验室", "Code lab"] },
  { name: "growth", icon: Sprout, label: ["我的成长", "Growth"] },
];
const mobile: RouteName[] = [
  "today",
  "learn",
  "review",
  "cheatsheet",
  "notes",
  "settings",
];

type Scheme = "system" | "light" | "dark";
function useScheme(): [Scheme, () => void] {
  const [scheme, setScheme] = useState<Scheme>(
    () => (storage("pl:scheme") as Scheme | null) ?? "system",
  );
  useEffect(() => {
    if (scheme === "system") delete document.documentElement.dataset.scheme;
    else document.documentElement.dataset.scheme = scheme;
    storage("pl:scheme", scheme);
  }, [scheme]);
  return [
    scheme,
    () =>
      setScheme(
        scheme === "system" ? "light" : scheme === "light" ? "dark" : "system",
      ),
  ];
}

function Shell() {
  const route = useRoute();
  const { tr } = useI18n();
  const L = useLearning();
  const [fromPathline] = useState(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("from") === "pathline") storage("pl:from-pathline", "1");
    return q.get("from") === "pathline" || storage("pl:from-pathline") === "1";
  });
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("signin") === "failed")
      L.notify(
        tr(
          "登录没有完成。Pathline 只允许已验证学校邮箱的账号登录，可以稍后重试。",
          "Sign-in did not complete. Pathline admits accounts with a confirmed university email; try again later.",
        ),
      );
    // Drop one-off parameters but keep the page.
    if (["lang", "from", "signin"].some((k) => q.has(k))) {
      ["lang", "from", "signin"].forEach((k) => q.delete(k));
      const rest = q.toString();
      history.replaceState(
        null,
        "",
        location.pathname + (rest ? `?${rest}` : ""),
      );
    }
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const page = (() => {
    switch (route.name) {
      case "learn":
        return (
          <LearnPage courseId={route.courseId} conceptId={route.conceptId} />
        );
      case "courses":
        return <CoursesPage />;
      case "review":
        return <ReviewPage />;
      case "cheatsheet":
        return <CheatSheetPage />;
      case "notes":
        return <NotesPage />;
      case "materials":
        return <MaterialsPage />;
      case "lab":
        return <CodeLabPage />;
      case "growth":
        return <GrowthPage />;
      case "settings":
        return <SettingsPage />;
      case "admin":
        return L.user?.admin ? <AdminPage /> : <TodayPage />;
      default:
        return <TodayPage />;
    }
  })();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {tr("跳到正文", "Skip to content")}
      </a>
      <Sidebar route={route} fromPathline={fromPathline} />
      <div className="app-body">
        <Topbar route={route} />
        {L.config?.releaseStage === "internal" && (
          <div className="banner">
            {tr(
              "内部验收环境 · 外部服务待配置，尚未正式上线。",
              "Internal validation · provider setup pending; not formally released.",
            )}
          </div>
        )}
        {L.offline && (
          <div className="banner warn" role="status">
            {tr(
              "当前离线。已载入的内容可以继续阅读；输入会保留，联网后再提交。",
              "You are offline. Keep reading what is loaded; submit after reconnecting.",
            )}
          </div>
        )}
        {page}
      </div>
      <MobileNav route={route} />
      {L.toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{L.toast}</span>
          <button
            className="icon-button"
            aria-label={tr("关闭提示", "Dismiss")}
            onClick={L.dismissToast}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {L.loginOpen && <LoginModal />}
    </div>
  );
}

function useDueCount() {
  const { courses } = useLearning();
  return reviews(courses).filter((r) => daysFrom(r.due) <= 0).length;
}

function Sidebar({
  route,
  fromPathline,
}: {
  route: Route;
  fromPathline: boolean;
}) {
  const { tr } = useI18n();
  const L = useLearning();
  const due = useDueCount();
  const pathlineUrl = L.config?.pathlineUrl;
  return (
    <aside
      className="sidebar"
      aria-label={tr("工作区导航", "Workspace navigation")}
    >
      <Link
        to={{ name: "today" }}
        className="sidebar-brand"
        aria-label="Personal Learning"
      >
        <Brand />
      </Link>
      <nav className="nav-list" aria-label={tr("主导航", "Main navigation")}>
        {primary.map((n) => (
          <NavLink key={n.name} item={n} route={route}>
            {n.name === "review" && due > 0 && (
              <span
                className="nav-count"
                aria-label={tr(`${due} 项到期`, `${due} due`)}
              >
                {due}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {pathlineUrl && (
          <a
            className="nav-item pathline-link"
            href={fromPathline ? pathlineUrl : `${pathlineUrl}/`}
          >
            <ArrowUpRight size={18} aria-hidden="true" />
            <span>
              {fromPathline
                ? tr("返回 Pathline", "Back to Pathline")
                : "Pathline"}
            </span>
          </a>
        )}
        {L.user?.admin && (
          <NavLink
            item={{
              name: "admin",
              icon: ShieldCheck,
              label: ["管理控制台", "Admin"],
            }}
            route={route}
          />
        )}
        <NavLink
          item={{
            name: "settings",
            icon: Settings,
            label: ["设置", "Settings"],
          }}
          route={route}
        />
        <button
          className="profile-button"
          onClick={() =>
            L.user ? navigate({ name: "settings" }) : L.openLogin()
          }
        >
          <span className="avatar" aria-hidden="true">
            {L.user ? (
              (L.user.name || L.user.email).slice(0, 1).toUpperCase()
            ) : (
              <UserRound size={16} />
            )}
          </span>
          <span className="profile-text">
            <strong>{L.user ? L.user.name : tr("登录", "Sign in")}</strong>
            <small>
              {L.user
                ? L.pathline?.linked
                  ? `Pathline${L.pathline.school ? ` · ${L.pathline.school.toUpperCase()}` : ""}`
                  : L.user.email
                : tr("保存知识框架与证据", "Keep your framework and evidence")}
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  route,
  children,
  compact = false,
}: {
  item: NavItem;
  route: Route;
  children?: ReactNode;
  compact?: boolean;
}) {
  const { tr } = useI18n();
  const active = route.name === item.name;
  return (
    <Link
      to={{ name: item.name } as Route}
      className={`nav-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <item.icon size={compact ? 21 : 18} aria-hidden="true" />
      <span>{tr(...item.label)}</span>
      {children}
    </Link>
  );
}

const titles: Record<RouteName, [string, string]> = {
  today: ["今天", "Today"],
  learn: ["学习", "Learn"],
  review: ["复习", "Review"],
  cheatsheet: ["速查表", "Cheat sheet"],
  courses: ["我的课程", "Courses"],
  notes: ["知识笔记", "Notes"],
  materials: ["学习资料", "Materials"],
  lab: ["代码实验室", "Code lab"],
  growth: ["我的成长", "Growth"],
  settings: ["设置", "Settings"],
  admin: ["管理控制台", "Admin"],
};

function Topbar({ route }: { route: Route }) {
  const { tr, language, setLanguage } = useI18n();
  const L = useLearning();
  const [scheme, cycle] = useScheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const SchemeIcon =
    scheme === "dark" ? Moon : scheme === "light" ? Sun : SunMoon;
  return (
    <header className="topbar">
      <Link
        to={{ name: "today" }}
        className="topbar-brand"
        aria-label="Personal Learning"
      >
        <Brand compact />
      </Link>
      <div className="topbar-title">
        <span>{tr(...titles[route.name])}</span>
        {["learn", "notes", "materials", "cheatsheet"].includes(route.name) && (
          <>
            <span className="topbar-sep" aria-hidden="true">
              /
            </span>
            <strong>{L.course.title}</strong>
          </>
        )}
      </div>
      <div className="topbar-actions">
        {L.user && (
          <Link
            to={{ name: "growth" }}
            className="streak"
            title={tr("连续学习天数", "Day streak")}
          >
            <Flame size={16} aria-hidden="true" />
            <span>
              {L.rewards?.streak ?? 0}
              <span className="visually-hidden">
                {tr(" 天连续学习", " day streak")}
              </span>
            </span>
          </Link>
        )}
        <button
          className="icon-button text"
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
          aria-label={tr("切换为英文", "Switch to Chinese")}
        >
          {language === "zh" ? "EN" : "中"}
        </button>
        <button
          className="icon-button"
          onClick={cycle}
          aria-label={
            scheme === "system"
              ? tr("外观：跟随系统", "Appearance: system")
              : scheme === "light"
                ? tr("外观：浅色", "Appearance: light")
                : tr("外观：深色", "Appearance: dark")
          }
          title={tr("切换外观", "Change appearance")}
        >
          <SchemeIcon size={18} />
        </button>
        {L.user ? (
          <div className="popover-anchor">
            <button
              className="icon-button"
              aria-label={tr("学习提醒", "Learning reminders")}
              aria-expanded={open}
              onClick={async () => {
                setOpen(!open);
                if (!open)
                  try {
                    const d = await api<{ notifications: AppNotification[] }>(
                      "/notifications",
                    );
                    setItems(d.notifications);
                  } catch (e) {
                    L.notify(e instanceof Error ? e.message : String(e));
                  }
              }}
            >
              <Bell size={18} />
              {items.some((n) => !n.isRead) && (
                <i className="dot" aria-hidden="true" />
              )}
            </button>
            {open && (
              <div
                className="popover"
                role="dialog"
                aria-label={tr("学习提醒", "Learning reminders")}
              >
                <div className="popover-heading">
                  <strong>{tr("学习提醒", "Learning reminders")}</strong>
                  <button
                    className="icon-button"
                    aria-label={tr("关闭", "Close")}
                    onClick={() => setOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                {items.length ? (
                  items.map((n) => (
                    <button
                      key={n.id}
                      className={`notification ${n.isRead ? "" : "unread"}`}
                      onClick={async () => {
                        await api(`/notifications/${n.id}`, {
                          method: "PATCH",
                        }).catch(() => {});
                        setItems(
                          items.map((x) =>
                            x.id === n.id ? { ...x, isRead: 1 } : x,
                          ),
                        );
                        setOpen(false);
                        navigate({ name: "today" });
                      }}
                    >
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    {tr(
                      "有到期复习或新任务时，会在这里提醒你。",
                      "Due reviews and new tasks will appear here.",
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          L.ready && (
            <button className="button small" onClick={L.openLogin}>
              <LogIn size={16} aria-hidden="true" />
              {tr("登录", "Sign in")}
            </button>
          )
        )}
      </div>
    </header>
  );
}

function MobileNav({ route }: { route: Route }) {
  const { tr } = useI18n();
  const due = useDueCount();
  const items = [
    ...primary,
    { name: "settings", icon: Settings, label: ["我的", "Me"] } as NavItem,
  ].filter((n) => mobile.includes(n.name));
  return (
    <nav className="mobile-nav" aria-label={tr("主导航", "Main navigation")}>
      {items.map((n) => {
        const active = route.name === n.name;
        return (
          <Link
            key={n.name}
            to={{ name: n.name } as Route}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <n.icon size={21} aria-hidden="true" />
            <span>{tr(...n.label)}</span>
            {n.name === "review" && due > 0 && (
              <i className="dot" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
