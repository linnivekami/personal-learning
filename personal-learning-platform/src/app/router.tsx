import { useEffect, useState, type AnchorHTMLAttributes } from "react";

// Path-based routes, so pages can be bookmarked and Pathline can deep-link:
// /, /learn/<course>/<concept>, /review, /courses, /notes, /materials, …
export type Route =
  | { name: "today" }
  | { name: "learn"; courseId?: string; conceptId?: string }
  | { name: "courses" }
  | { name: "review" }
  | { name: "cheatsheet" }
  | { name: "notes" }
  | { name: "materials" }
  | { name: "lab" }
  | { name: "growth" }
  | { name: "settings" }
  | { name: "admin" };
export type RouteName = Route["name"];
const pages = [
  "courses",
  "review",
  "cheatsheet",
  "notes",
  "materials",
  "lab",
  "growth",
  "settings",
  "admin",
] as const;

export function parseRoute(pathname: string): Route {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (!parts.length || parts[0] === "today") return { name: "today" };
  if (parts[0] === "learn")
    return { name: "learn", courseId: parts[1], conceptId: parts[2] };
  if ((pages as readonly string[]).includes(parts[0]))
    return { name: parts[0] as (typeof pages)[number] };
  return { name: "today" };
}

export function routeHref(route: Route): string {
  if (route.name === "today") return "/";
  if (route.name === "learn") {
    const parts = ["learn"];
    if (route.courseId) {
      parts.push(encodeURIComponent(route.courseId));
      if (route.conceptId) parts.push(encodeURIComponent(route.conceptId));
    }
    return `/${parts.join("/")}`;
  }
  return `/${route.name}`;
}

const listeners = new Set<() => void>();
export function navigate(
  to: Route | string,
  options: { replace?: boolean } = {},
) {
  const url = typeof to === "string" ? to : routeHref(to);
  if (url !== location.pathname + location.search)
    history[options.replace ? "replaceState" : "pushState"](null, "", url);
  listeners.forEach((l) => l());
  if (!options.replace) window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(location.pathname));
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return route;
}

/** An <a> that navigates in-app but still opens in a new tab on ⌘/Ctrl-click. */
export function Link({
  to,
  onClick,
  ...rest
}: { to: Route } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a
      {...rest}
      href={routeHref(to)}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        navigate(to);
      }}
    />
  );
}
