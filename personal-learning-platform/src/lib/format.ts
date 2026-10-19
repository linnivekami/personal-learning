import type { Language, Tr } from "../app/i18n";

const DAY = 86_400_000;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole local days from today to the date (negative = past). */
export function daysFrom(iso: string, now = new Date()) {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY);
}

export function shortDate(iso: string, language: Language) {
  return new Date(iso).toLocaleDateString(
    language === "zh" ? "zh-CN" : "en-GB",
    {
      month: "short",
      day: "numeric",
    },
  );
}

export function dueLabel(iso: string, tr: Tr, language: Language) {
  const d = daysFrom(iso);
  if (d < -1) return tr(`逾期 ${-d} 天`, `${-d} days overdue`);
  if (d === -1) return tr("昨天到期", "Due yesterday");
  if (d === 0) return tr("今天", "Today");
  if (d === 1) return tr("明天", "Tomorrow");
  if (d < 7) return tr(`${d} 天后`, `In ${d} days`);
  return shortDate(iso, language);
}

export function todayLine(language: Language) {
  return new Date().toLocaleDateString(language === "zh" ? "zh-CN" : "en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A short line code for a course, like Pathline's route codes. */
export function courseCode(title: string) {
  const latin = title.match(/[A-Za-z][A-Za-z0-9]*/g);
  if (latin?.length)
    return (
      latin.length > 1 ? latin.map((w) => w[0]).join("") : latin[0].slice(0, 4)
    )
      .slice(0, 4)
      .toUpperCase();
  return [...title.replace(/\s/g, "")].slice(0, 2).join("");
}
