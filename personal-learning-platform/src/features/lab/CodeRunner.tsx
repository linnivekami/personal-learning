import { useEffect, useRef, useState } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Upload,
  LoaderCircle,
  Terminal,
} from "lucide-react";
export function CodeRunner({
  language,
  starter,
  onAnswer,
  onError,
  sandboxOrigin,
  tr,
}: {
  language: "python" | "sql";
  starter: string;
  onAnswer?: (value: string) => void;
  onError: (message: string) => void;
  sandboxOrigin: string | null;
  tr: (a: string, b: string) => string;
}) {
  const [code, setCode] = useState(starter),
    [output, setOutput] = useState(""),
    [images, setImages] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const frame = useRef<HTMLIFrameElement>(null),
    request = useRef<string | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isolated =
    !!sandboxOrigin &&
    new URL(sandboxOrigin, location.href).origin !== location.origin;
  const src = `${sandboxOrigin ?? ""}/sandbox/index.html`;
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "ready") {
        setReady(true);
        return;
      }
      if (event.data?.requestId !== request.current) return;
      if (event.data.type === "status") setOutput(String(event.data.text));
      if (event.data.type === "result" || event.data.type === "error") {
        setBusy(false);
        if (timeout.current) clearTimeout(timeout.current);
        setOutput(
          String(event.data.output ?? event.data.error).slice(0, 100000),
        );
        setImages(
          Array.isArray(event.data.images)
            ? event.data.images
                .filter(
                  (s: unknown) =>
                    typeof s === "string" &&
                    s.startsWith("data:image/png;base64,") &&
                    s.length < 2800000,
                )
                .slice(0, 3)
            : [],
        );
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);
  useEffect(() => setCode(starter), [starter]);
  const send = () => {
    if (!ready) {
      onError(
        tr(
          "运行环境正在加载，请稍候。",
          "The runtime is loading. Please try again shortly.",
        ),
      );
      return;
    }
    request.current = crypto.randomUUID();
    setBusy(true);
    setImages([]);
    setOutput(tr("正在加载学习运行环境…", "Loading the learning runtime…"));
    frame.current?.contentWindow?.postMessage(
      { type: "run", requestId: request.current, language, code, files },
      "*",
    );
    timeout.current = setTimeout(() => {
      frame.current?.contentWindow?.postMessage(
        { type: "stop", requestId: request.current },
        "*",
      );
      setBusy(false);
      setOutput(
        tr(
          "执行已超时并停止。请缩小计算范围。",
          "Execution timed out. Reduce the computation and try again.",
        ),
      );
    }, 90000);
  };
  return (
    <div className="code-runner">
      <div className="code-toolbar">
        <span>
          <Terminal size={15} />
          {language === "python" ? "Python · NumPy / pandas" : "SQL · SQLite"}
        </span>
        <div>
          <label className="text-button">
            <Upload size={14} />
            {tr("数据文件", "Dataset")}
            <input
              type="file"
              accept=".csv,.txt,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  onError(
                    tr("练习数据不能超过 2MB。", "Dataset must be under 2MB."),
                  );
                  return;
                }
                setFiles([
                  {
                    name: f.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
                    content: await f.text(),
                  },
                ]);
              }}
            />
          </label>
          <button
            className="icon-button"
            title={tr("重置代码", "Reset code")}
            onClick={() => {
              setCode(starter);
              setOutput("");
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <textarea
        className="code-input"
        value={code}
        spellCheck={false}
        aria-label={`${language} code`}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const a = e.currentTarget.selectionStart,
              b = e.currentTarget.selectionEnd;
            setCode(code.slice(0, a) + "    " + code.slice(b));
            setTimeout(
              () => e.currentTarget?.setSelectionRange(a + 4, a + 4),
              0,
            );
          }
        }}
      />
      {files.length > 0 && (
        <small className="file-chip">
          {tr("已选数据：", "Selected dataset: ")}
          {files[0].name}
        </small>
      )}
      <div className="code-actions">
        <button
          className="button small"
          disabled={busy || !sandboxOrigin}
          onClick={send}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Play size={15} />
          )}{" "}
          {tr("运行代码", "Run code")}
        </button>
        {busy && (
          <button
            className="button secondary small"
            onClick={() => {
              frame.current?.contentWindow?.postMessage(
                { type: "stop", requestId: request.current },
                "*",
              );
              setBusy(false);
              setOutput(tr("执行已停止。", "Execution stopped."));
            }}
          >
            <Square size={12} />
            {tr("停止", "Stop")}
          </button>
        )}
        <span>{tr("在浏览器内运行", "Runs in your browser")}</span>
      </div>
      {output && (
        <pre className="code-output" role="status">
          {output}
        </pre>
      )}
      {images.map((src, i) => (
        <img
          key={i}
          className="code-chart"
          src={src}
          alt={tr(`代码生成的图表 ${i + 1}`, `Plot ${i + 1} generated by code`)}
        />
      ))}
      {onAnswer && (
        <button
          className="text-button"
          onClick={() => onAnswer(`${code}\n\nOutput:\n${output}`)}
        >
          {tr("将代码和结果作为答案", "Use code and output as my answer")}
        </button>
      )}
      {!sandboxOrigin && (
        <p className="notice-banner">
          {tr(
            "代码运行区待配置独立域名。代码草稿仍可编辑和保存。",
            "The isolated runtime domain is awaiting configuration. You can still edit and retain your code draft.",
          )}
        </p>
      )}
      {sandboxOrigin && (
        <iframe
          ref={frame}
          src={src}
          sandbox={
            isolated ? "allow-scripts allow-same-origin" : "allow-scripts"
          }
          title="Isolated code execution"
          onLoad={() =>
            frame.current?.contentWindow?.postMessage({ type: "ping" }, "*")
          }
          className="runtime-frame"
        />
      )}
    </div>
  );
}
