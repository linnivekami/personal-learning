import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const allowed = new Set(["index.html", "runner.mjs", "python.mjs", "sql.mjs"]);
createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.replace(
    "/sandbox/",
    "",
  );
  if (!allowed.has(name)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    name.endsWith(".html") ? "text/html" : "application/javascript",
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net/pyodide/v0.28.3/full/ https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/ 'wasm-unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net/pyodide/v0.28.3/full/ https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/; worker-src 'self' blob: https://cdn.jsdelivr.net/pyodide/v0.28.3/full/ https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/; img-src data: blob:; frame-ancestors http://localhost:8787 http://127.0.0.1:8787",
  );
  try {
    res.end(
      await readFile(new URL(`../public/sandbox/${name}`, import.meta.url)),
    );
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(8788, "127.0.0.1", () =>
  console.log("Isolated local runner on http://localhost:8788"),
);
