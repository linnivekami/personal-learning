import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppUser,
  Course,
  ReminderSettings,
  RewardState,
  Usage,
} from "../../shared/types";
import { sampleCourse } from "../../shared/sample";
import { api, RequestError } from "../lib/api";
import { storage } from "./i18n";
import type { Configuration, PathlineLink, Profile } from "./types";

const defaultReminders: ReminderSettings = {
  enabled: false,
  time: "19:00",
  timezone: "Asia/Hong_Kong",
  email: false,
  push: false,
  quietStart: "22:00",
  quietEnd: "08:00",
  weeklyGoal: 5,
};
interface MeResponse {
  user: AppUser;
  profile: Profile & { reminders: ReminderSettings };
  usage: Usage;
  pathline?: PathlineLink | null;
}
export interface Learning {
  config: Configuration | null;
  user: AppUser | null;
  /** True once the first session check finished (signed in or not). */
  ready: boolean;
  offline: boolean;
  profile: Profile;
  reminders: ReminderSettings;
  usage: Usage | null;
  pathline: PathlineLink | null;
  courses: Course[];
  rewards: RewardState | null;
  /** The course pages act on: the learner's choice, else the sample. */
  course: Course;
  /** The built-in sample is showing (guest, or no course chosen yet). */
  sample: boolean;
  toast: string | null;
  loginOpen: boolean;
  refresh: () => Promise<Course[]>;
  selectCourse: (id: string) => void;
  updateCourse: (course: Course) => void;
  setReminders: (r: ReminderSettings) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  /** True when the learner can write to their own course; prompts otherwise. */
  requireCourse: () => boolean;
  signedOut: () => void;
}
const Context = createContext<Learning | null>(null);
export function useLearning() {
  const value = useContext(Context);
  if (!value) throw new Error("useLearning outside LearningProvider");
  return value;
}

function cached<T>(key: string): T | null {
  try {
    const raw = storage(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function LearningProvider({
  children,
  messages,
}: {
  children: ReactNode;
  messages: { chooseCourse: string };
}) {
  const [config, setConfig] = useState<Configuration | null>(null),
    [user, setUser] = useState<AppUser | null>(null),
    [ready, setReady] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [profile, setProfile] = useState<Profile>({
      timezone: "Asia/Hong_Kong",
      name: "",
      preferences: {},
    }),
    [reminders, setReminders] = useState(defaultReminders),
    [usage, setUsage] = useState<Usage | null>(null),
    [pathline, setPathline] = useState<PathlineLink | null>(null),
    [courses, setCourses] = useState<Course[]>([]),
    [rewards, setRewards] = useState<RewardState | null>(null),
    [courseId, setCourseId] = useState<string | null>(() =>
      storage("pl:last-course"),
    ),
    [toast, setToast] = useState<string | null>(null),
    [loginOpen, setLoginOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 7000);
  }, []);
  const apply = useCallback((me: MeResponse) => {
    setUser(me.user);
    setUsage(me.usage);
    setPathline(me.pathline ?? null);
    setReminders({ ...defaultReminders, ...me.profile.reminders });
    setProfile({
      timezone: me.profile.timezone,
      name: me.user.name,
      preferences: me.profile.preferences ?? {},
    });
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [me, list, reward] = await Promise.all([
        api<MeResponse>("/me"),
        api<{ courses: Course[] }>("/courses"),
        api<{ rewards: RewardState }>("/rewards"),
      ]);
      apply(me);
      setCourses(list.courses);
      setRewards(reward.rewards);
      storage("pl:last-session", JSON.stringify(me));
      storage(`pl:courses:${me.user.id}`, JSON.stringify(list.courses));
      return list.courses;
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        setUser(null);
        setCourses([]);
        setRewards(null);
        setPathline(null);
        return [];
      }
      throw e;
    }
  }, [apply]);
  useEffect(() => {
    void api<Configuration>("/config")
      .then(setConfig)
      .catch((e: Error) => notify(e.message));
    void refresh()
      .catch((e: Error) => {
        // Offline: continue with the last loaded session, read-only.
        const me = cached<MeResponse>("pl:last-session");
        if (!navigator.onLine && me) {
          apply(me);
          setCourses(cached<Course[]>(`pl:courses:${me.user.id}`) ?? []);
        } else notify(e.message);
      })
      .finally(() => setReady(true));
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, [refresh, apply, notify]);
  useEffect(() => {
    const line = String(profile.preferences.theme ?? "forest");
    document.documentElement.dataset.line = line;
  }, [profile.preferences]);
  const own = courses.find((c) => c.id === courseId) ?? courses[0];
  const course = user && own ? own : sampleCourse;
  const sample = course.id === sampleCourse.id;
  const selectCourse = useCallback((id: string) => {
    setCourseId(id);
    storage("pl:last-course", id);
  }, []);
  const updateCourse = useCallback((next: Course) => {
    setCourses((old) => {
      const list = old.map((c) => (c.id === next.id ? next : c));
      return list.some((c) => c.id === next.id) ? list : [next, ...list];
    });
  }, []);
  const requireCourse = useCallback(() => {
    if (!user) {
      setLoginOpen(true);
      return false;
    }
    if (sample) {
      notify(messages.chooseCourse);
      return false;
    }
    return true;
  }, [user, sample, notify, messages.chooseCourse]);
  const signedOut = useCallback(() => {
    setUser(null);
    setCourses([]);
    setRewards(null);
    setPathline(null);
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("pl:") && k !== "pl:language")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const value = useMemo<Learning>(
    () => ({
      config,
      user,
      ready,
      offline,
      profile,
      reminders,
      usage,
      pathline,
      courses,
      rewards,
      course,
      sample,
      toast,
      loginOpen,
      refresh,
      selectCourse,
      updateCourse,
      setReminders,
      notify,
      dismissToast: () => setToast(null),
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      requireCourse,
      signedOut,
    }),
    [
      config,
      user,
      ready,
      offline,
      profile,
      reminders,
      usage,
      pathline,
      courses,
      rewards,
      course,
      sample,
      toast,
      loginOpen,
      refresh,
      selectCourse,
      updateCourse,
      notify,
      requireCourse,
      signedOut,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
