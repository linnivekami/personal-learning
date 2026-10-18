import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, LoaderCircle } from "lucide-react";
import { api, post } from "./api";
import type { Language } from "../shared/types";
export function Recorder({
  onText,
  onError,
  tr,
}: {
  onText: (s: string) => void;
  onError: (s: string) => void;
  tr: (a: string, b: string) => string;
}) {
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    start = useRef(0),
    stream = useRef<MediaStream | null>(null);
  useEffect(
    () => () => {
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
  };
  const begin = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          tr(
            "当前环境不支持录音，请使用 HTTPS 或本机浏览器。",
            "Recording requires HTTPS and browser microphone support.",
          ),
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const rec = new MediaRecorder(media),
        chunks: BlobPart[] = [];
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const audio = new Blob(chunks, { type: rec.mimeType }),
            context = new AudioContext();
          const decoded = await context.decodeAudioData(
            await audio.arrayBuffer(),
          );
          const wav = encodeWav(decoded);
          await context.close();
          const data = new FormData();
          data.append(
            "audio",
            new File([wav], "message.wav", { type: "audio/wav" }),
          );
          data.append(
            "duration",
            String(Math.min(60, (Date.now() - start.current) / 1000)),
          );
          const result = await api<{ text: string }>("/voice/transcribe", {
            method: "POST",
            body: data,
          });
          onText(result.text);
        } catch (e) {
          onError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      start.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const n = Math.floor((Date.now() - start.current) / 1000);
        setSeconds(n);
        if (n >= 59) stop();
      }, 1000);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <button
      type="button"
      className={`icon-button ${recording ? "recording" : ""}`}
      disabled={busy}
      onClick={recording ? stop : begin}
      title={tr(
        "语音输入，转写后可修改",
        "Record a voice message; edit the transcript before submitting",
      )}
      aria-label={tr("语音输入", "Voice input")}
    >
      {busy ? (
        <LoaderCircle size={18} className="spin" />
      ) : recording ? (
        <>
          <Square size={15} />
          <span>{seconds}s</span>
        </>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
function encodeWav(buffer: AudioBuffer) {
  const n = buffer.length,
    out = new ArrayBuffer(44 + n * 2),
    v = new DataView(out);
  const str = (s: string, p: number) =>
    [...s].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
  str("RIFF", 0);
  v.setUint32(4, 36 + n * 2, true);
  str("WAVEfmt ", 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str("data", 36);
  v.setUint32(40, n * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  for (let i = 0; i < n; i++) {
    const x = channels.reduce((s, c) => s + c[i], 0) / channels.length;
    v.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, x)) * (x < 0 ? 32768 : 32767),
      true,
    );
  }
  return out;
}
export function Speaker({
  text,
  language,
  onError,
  tr,
}: {
  text: string;
  language: Language;
  onError: (s: string) => void;
  tr: (a: string, b: string) => string;
}) {
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState<string | null>(null),
    [rate, setRate] = useState(1);
  const ref = useRef<HTMLAudioElement>(null);
  const paragraphs = spoken(text, language)
    .split(/\n\s*\n/)
    .filter((s) => s.trim());
  const [paragraph, setParagraph] = useState(0);
  return (
    <div className="speaker">
      <select
        aria-label={tr("选择朗读段落", "Choose a paragraph")}
        value={paragraph}
        onChange={(e) => {
          setParagraph(Number(e.target.value));
          setUrl(null);
        }}
      >
        {paragraphs.map((s, i) => (
          <option key={i} value={i}>
            {tr("段落", "Paragraph")} {i + 1} · {s.slice(0, 32)}…
          </option>
        ))}
      </select>
      <button
        className="text-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const d = await post<{ url: string }>("/voice/synthesize", {
              text: (paragraphs[paragraph] ?? paragraphs[0] ?? "").slice(
                0,
                500,
              ),
              language,
            });
            setUrl(d.url);
            setTimeout(() => {
              if (ref.current) {
                ref.current.playbackRate = rate;
                void ref.current.play().catch(() => {});
              }
            }, 50);
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Volume2 size={16} />
        )}{" "}
        {tr("朗读这段", "Read aloud")}
      </button>
      {url && (
        <>
          <audio ref={ref} src={url} controls />
          <select
            aria-label={tr("播放速度", "Playback speed")}
            value={rate}
            onChange={(e) => {
              const n = Number(e.target.value);
              setRate(n);
              if (ref.current) ref.current.playbackRate = n;
            }}
          >
            {[0.8, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
function spoken(s: string, lang: Language) {
  return s
    .replace(/\$+/g, "")
    .replace(
      /\\frac\{([^}]+)\}\{([^}]+)\}/g,
      lang === "en" ? "$1 divided by $2" : "$1 除以 $2",
    )
    .replace(
      /\\sqrt\{([^}]+)\}/g,
      lang === "en" ? "square root of $1" : "根号 $1",
    )
    .replace(/\\mid/g, lang === "en" ? " given " : " 在以下条件下 ")
    .replace(/\\cap/g, lang === "en" ? " intersect " : " 并且 ")
    .replace(/\\(?:qquad|quad|,|;)/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[#*_`{}]/g, "");
}
