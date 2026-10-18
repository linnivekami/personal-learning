import { assets } from "./generated-assets";
export default {
  fetch(request: Request, env: { APP_ORIGIN?: string }) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/sandbox/") || !assets[path])
      return new Response("Not found", { status: 404 });
    const asset = assets[path],
      packages =
        "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/ https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/";
    return new Response(
      Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0)),
      {
        headers: {
          "Content-Type": asset.type,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public,max-age=3600",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "Permissions-Policy": "camera=(),microphone=(),geolocation=()",
          "Content-Security-Policy": `default-src 'none'; script-src 'self' ${packages} 'wasm-unsafe-eval'; worker-src 'self' blob: ${packages}; connect-src 'self' ${packages}; img-src data: blob:; frame-ancestors ${env.APP_ORIGIN ?? "'none'"}; base-uri 'none'; object-src 'none'`,
        },
      },
    );
  },
};
