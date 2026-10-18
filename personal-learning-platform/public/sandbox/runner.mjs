let worker = null,
  current = null;
const parentWindow = parent;
addEventListener("message", (event) => {
  if (event.source !== parentWindow) return;
  const d = event.data;
  if (d?.type === "stop") {
    worker?.terminate();
    worker = null;
    parentWindow.postMessage(
      { type: "error", requestId: current, error: "Execution stopped." },
      "*",
    );
    return;
  }
  if (
    d?.type !== "run" ||
    !["python", "sql"].includes(d.language) ||
    typeof d.code !== "string" ||
    d.code.length > 50000
  )
    return;
  worker?.terminate();
  current = d.requestId;
  const moduleURL = new URL(`/sandbox/${d.language}.mjs`, location.href).href;
  const workerURL = URL.createObjectURL(
    new Blob([`import ${JSON.stringify(moduleURL)};`], {
      type: "application/javascript",
    }),
  );
  worker = new Worker(workerURL, { type: "module" });
  const timer = setTimeout(() => {
    worker?.terminate();
    parentWindow.postMessage(
      {
        type: "error",
        requestId: current,
        error: "Execution time limit reached.",
      },
      "*",
    );
  }, 80000);
  worker.onmessage = (message) => {
    if (message.data?.protocol !== "personal-learning") return;
    parentWindow.postMessage({ ...message.data, requestId: current }, "*");
    if (["result", "error"].includes(message.data.type)) {
      URL.revokeObjectURL(workerURL);
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
    }
  };
  worker.onerror = (e) => {
    URL.revokeObjectURL(workerURL);
    clearTimeout(timer);
    parentWindow.postMessage(
      { type: "error", requestId: current, error: e.message || "Runtime could not load. Check your connection and try again." },
      "*",
    );
    worker?.terminate();
    worker = null;
  };
  worker.postMessage({
    code: d.code,
    files: Array.isArray(d.files) ? d.files.slice(0, 3) : [],
  });
});
parentWindow.postMessage({ type: "ready" }, "*");
