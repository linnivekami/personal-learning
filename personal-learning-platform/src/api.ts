export class RequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function errorMessage(code: string, message: string) {
  if (localStorage.getItem("pl:language") !== "en") return message;
  const en: Record<string, string> = {
    MODEL_NOT_CONFIGURED: "The teaching service has not been configured yet.",
    VOICE_NOT_CONFIGURED: "The voice service has not been configured yet.",
    EMAIL_NOT_CONFIGURED: "Email sign-in has not been configured yet.",
    AUTH_NOT_CONFIGURED: "Account sign-in is awaiting configuration.",
    SEARCH_NOT_CONFIGURED: "Web search is awaiting configuration.",
    CONVERTER_NOT_CONFIGURED:
      "Document conversion is awaiting configuration. Your original file is retained.",
    QUOTA_EXCEEDED:
      "Your personal allowance or the site budget is exhausted. Existing materials and local exercises remain available.",
    REVISION_CONFLICT:
      "Another device updated this course. Refresh and try again; no duplicate evidence was recorded.",
    UNAUTHENTICATED: "Sign in to save and continue learning.",
    COURSE_NOT_FOUND:
      "This course does not exist or belongs to another account.",
    INVALID_INPUT: "Check the entered values and try again.",
    STORAGE_LIMIT: "Personal or site storage is full.",
    IMPORT_CONFLICT:
      "Resolve conflicting course names before importing. Nothing was overwritten.",
    MODEL_FORMAT:
      "The model returned an incomplete format. No learning state was changed.",
    MODEL_SCHEMA:
      "The model response failed validation. No learning state was changed.",
    MODEL_REQUEST_FAILED:
      "The teaching provider is temporarily unavailable. Please try again.",
    MODEL_INCOMPLETE:
      "The model did not finish. Usage was recorded; try a smaller request.",
    CARD_SCOPE:
      "The model did not specify the assessed capabilities. This exercise was not published.",
    NO_SOURCES: "Import and parse materials first.",
    EMAIL_LIMIT:
      "Today’s email allowance is exhausted. Try another sign-in method.",
    ADMIN_REQUIRED: "Administrator access is required.",
    FILE_SIZE:
      "Each file must be within the configured size limit (at most 20 MB).",
    FILE_TYPE: "Use PDF, PPTX, DOCX, image, text or CSV files.",
    PAGES: "The document exceeds the page limit.",
    AUDIO_DURATION: "Voice messages must be no longer than 60 seconds.",
    ASR_FAILED: "Transcription failed. Please try again or type your answer.",
    TTS_FAILED: "Speech synthesis failed. Please try again.",
    ATTEMPT_SCOPE:
      "This attempt ID belongs to a different course. Start a new attempt.",
  };
  return (
    en[code] ??
    "This action could not be completed. Please check your input or try again."
  );
}
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const r = await fetch(path.startsWith("/api/") ? path : `/api/v1${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const d = (await r.json()) as { error?: { code?: string; message?: string } };
  if (!r.ok)
    throw new RequestError(
      d.error?.code ?? "REQUEST",
      errorMessage(d.error?.code ?? "REQUEST", d.error?.message ?? "请求失败"),
      r.status,
    );
  return d as T;
}
export const post = <T = Record<string, unknown>>(
  path: string,
  body: unknown,
) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function teachStream(
  path: string,
  body: unknown,
  onEvent: (name: string, data: unknown) => void,
) {
  const r = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const d = (await r.json()) as { error?: { code: string; message: string } };
    throw new RequestError(
      d.error?.code ?? "REQUEST",
      errorMessage(d.error?.code ?? "REQUEST", d.error?.message ?? "请求失败"),
      r.status,
    );
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error("浏览器不支持流式读取。");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const part = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const name =
          part
            .split("\n")
            .find((s) => s.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "message";
        const data = part
          .split("\n")
          .filter((s) => s.startsWith("data:"))
          .map((s) => s.slice(5).trim())
          .join("\n");
        if (data) onEvent(name, JSON.parse(data));
      }
    }
  } finally {
    reader.releaseLock();
  }
}
