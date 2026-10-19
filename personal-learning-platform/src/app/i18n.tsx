import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "zh" | "en";
export type Tr = (zh: string, en: string) => string;

function storage(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* Private windows may block storage; the page still works. */
  }
  return null;
}
// ?lang=zh|en (used by Pathline links) wins, then the last choice; Chinese
// is the default for this workspace.
function initialLanguage(): Language {
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked === "zh" || asked === "en") return asked;
  return storage("pl:language") === "en" ? "en" : "zh";
}

const I18n = createContext<{
  language: Language;
  setLanguage: (l: Language) => void;
  tr: Tr;
}>({ language: "zh", setLanguage: () => {}, tr: (zh) => zh });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    storage("pl:language", language);
  }, [language]);
  const tr = useCallback<Tr>(
    (zh, en) => (language === "zh" ? zh : en),
    [language],
  );
  const value = useMemo(() => ({ language, setLanguage, tr }), [language, tr]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
export { storage };
