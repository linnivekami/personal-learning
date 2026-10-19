import sqlite3InitModule from "https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/sqlite-wasm/jswasm/sqlite3.mjs";
self.onmessage = async ({ data }) => {
  let db;
  try {
    self.postMessage({ protocol: "personal-learning", type: "status", text: "Loading SQLite…" });
    const sqlite3 = await sqlite3InitModule({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.50.0-build1/sqlite-wasm/jswasm/${file}`,
    });
    for(const name of ["XMLHttpRequest","WebSocket","EventSource","Worker","SharedWorker","importScripts"])Object.defineProperty(self,name,{value:()=>{throw new Error("Network and nested workers are disabled during execution.")},writable:false,configurable:false});
    Object.defineProperty(self, "fetch", {
      value: () =>
        Promise.reject(new Error("Network is disabled during code execution.")),
      writable: false,
      configurable: false,
    });
    db = new sqlite3.oo1.DB(":memory:", "c");
    const rows = [],
      columns = [];
    db.exec({
      sql: data.code,
      rowMode: "object",
      callback: (row) => {
        if (rows.length < 500) rows.push(row);
      },
    });
    self.postMessage({ protocol: "personal-learning",
      type: "result",
      output: rows.length
        ? JSON.stringify(rows, null, 2).slice(0, 100000)
        : "SQL executed successfully (no result rows).",
    });
  } catch (e) {
    self.postMessage({ protocol: "personal-learning", type: "error", error: String(e) });
  } finally {
    db?.close();
  }
};
