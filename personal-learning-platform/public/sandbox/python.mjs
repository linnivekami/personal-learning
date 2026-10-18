import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ protocol: "personal-learning",
      type: "status",
      text: "Loading Python, NumPy, pandas and Matplotlib…",
    });
    const py = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
    });
    await py.loadPackage(["numpy", "pandas", "matplotlib"]);
    let output = "";
    const append = (s) => {
      if (output.length < 100000) output += s + "\n";
    };
    py.setStdout({ batched: append });
    py.setStderr({ batched: append });
    for (const f of data.files ?? []) {
      if (
        typeof f.name === "string" &&
        typeof f.content === "string" &&
        f.content.length <= 2000000
      )
        py.FS.writeFile(
          `/home/pyodide/${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
          new TextEncoder().encode(f.content),
        );
    }
    for(const name of ["XMLHttpRequest","WebSocket","EventSource","Worker","SharedWorker","importScripts"])Object.defineProperty(self,name,{value:()=>{throw new Error("Network and nested workers are disabled during execution.")},writable:false,configurable:false});
    Object.defineProperty(self, "fetch", {
      value: () =>
        Promise.reject(new Error("Network is disabled during code execution.")),
      writable: false,
      configurable: false,
    });
    await py.runPythonAsync(
      'import os\nos.chdir("/home/pyodide")\nimport matplotlib\nmatplotlib.use("Agg")',
    );
    const result = await py.runPythonAsync(data.code);
    if (result !== undefined) {
      append(String(result));
      if (result?.destroy) result.destroy();
    }
    const encoded=await py.runPythonAsync('import io, base64\nimport matplotlib.pyplot as plt\n_pl_images=[]\nfor _pl_n in plt.get_fignums()[:3]:\n    _pl_buffer=io.BytesIO()\n    plt.figure(_pl_n).savefig(_pl_buffer, format="png", dpi=100, bbox_inches="tight")\n    if _pl_buffer.tell() < 2000000:\n        _pl_images.append("data:image/png;base64,"+base64.b64encode(_pl_buffer.getvalue()).decode())\n_pl_images');
    const images=encoded.toJs();encoded.destroy();
    self.postMessage({ protocol: "personal-learning",type: "result",output: output || "Execution completed.",images});
  } catch (e) {
    self.postMessage({ protocol: "personal-learning", type: "error", error: String(e) });
  }
};
