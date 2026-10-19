import type { Hono } from "hono";
import type { HonoEnv } from "./env";
import { assets } from "./generated-assets";

const decoded = new Map<string, Uint8Array<ArrayBuffer>>();
function bytes(path: string, body: string) {
  let b = decoded.get(path);
  if (!b) {
    b = Uint8Array.from(atob(body), (v) => v.charCodeAt(0));
    decoded.set(path, b);
  }
  return b;
}

// The client build is embedded in the server bundle. Unknown non-API paths
// fall back to index.html so deep links such as /learn/<course> work.
export function installStatic(app: Hono<HonoEnv>) {
  app.get("*", (c) => {
    const path = c.req.path;
    const key = Object.hasOwn(assets, path)
      ? path
      : !path.startsWith("/api/") && !path.startsWith("/sandbox/")
        ? "/index.html"
        : undefined;
    const asset = key ? assets[key] : undefined;
    if (!key || !asset) return c.notFound();
    const origin = new URL(c.req.url).origin;
    const headers = new Headers({
      "Content-Type": asset.type,
      "Cache-Control": path.startsWith("/assets/")
        ? "public,max-age=31536000,immutable"
        : path.startsWith("/fonts/")
          ? "public,max-age=2592000"
          : "no-cache",
    });
    if (path.startsWith("/sandbox/")) {
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set(
        "Content-Security-Policy",
        `default-src 'none'; script-src 'self' ${origin}/sandbox/ https://cdn.jsdelivr.net 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src ${origin}/sandbox/ https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; img-src data: blob:`,
      );
    } else {
      const ancestors =
        c.env.IDENTITY_MODE === "sites"
          ? "'self' https://chatgpt.com https://*.chatgpt.com"
          : "'self'";
      headers.set(
        "Content-Security-Policy",
        `default-src 'self'; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' ${c.env.SANDBOX_ORIGIN ?? ""}; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${ancestors}`,
      );
    }
    return new Response(bytes(key, asset.body), { headers });
  });
}
