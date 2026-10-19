import type { Hono } from "hono";
import { putPrivateObject } from "./storage";
import { z } from "zod";
import type { HonoEnv, Env } from "./env";
import { ApiError, uid, now } from "./env";
import { first, rows, run, getCourse, materialFromRow } from "./db";
import { reserve, settle, usageFor, limitsFor } from "./quota";
import { policy, billableCharacters } from "../shared/core";
import { generate } from "./llm";
import { enqueue, authorizeCallback, completeConversion } from "./jobs";
const allowed: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};
export function base64(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 8192)
    s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s);
}
export async function addSource(
  env: Env,
  user: string,
  course: string,
  material: string | null,
  title: string,
  page: number | null,
  content: string,
  url: string | null = null,
) {
  const id = material
    ? await digest(`${user}:${material}:${page}:${title}`)
    : uid();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sources(id,user_id,course_id,material_id,title,page,url,content,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
    ).bind(id, user, course, material, title, page, url, content, now()),
    env.DB.prepare(
      "DELETE FROM source_search WHERE source_id=? AND user_id=?",
    ).bind(id, user),
    env.DB.prepare(
      "INSERT INTO source_search(source_id,course_id,user_id,content) VALUES(?,?,?,?)",
    ).bind(id, course, user, content),
  ]);
  return id;
}
export function installMediaRoutes(app: Hono<HonoEnv>) {
  app.put("/internal/materials/:id/pdf", async (c) => {
    const user = await authorizeCallback(
      c.env,
      c.req.param("id"),
      c.req.header("X-Job-ID") ?? "",
      c.req.header("Authorization")?.replace(/^Bearer /, "") ?? "",
    );
    const b = await c.req.arrayBuffer();
    if (b.byteLength > 30 * 1024 * 1024)
      throw new ApiError(413, "PDF_SIZE", "转换后的 PDF 超过 30MB。");
    if (!new TextDecoder().decode(b.slice(0, 5)).startsWith("%PDF-"))
      throw new ApiError(415, "PDF_SIGNATURE", "转换结果不是 PDF。");
    const key = `${user}/${c.req.param("id")}/normalized.pdf`;
    await putPrivateObject(
      c.env,
      user,
      key,
      b,
      {
        httpMetadata: { contentType: "application/pdf" },
      },
      c.req.param("id"),
    );
    await run(
      c.env,
      "UPDATE materials SET normalized_key=?,updated_at=? WHERE id=? AND user_id=?",
      key,
      now(),
      c.req.param("id"),
      user,
    );
    return c.json({ ok: true });
  });
  app.post("/internal/materials/:id/:kind", async (c) => {
    if (!["page", "complete"].includes(c.req.param("kind")))
      throw new ApiError(404, "CALLBACK", "转换回调不存在。");
    const user = await authorizeCallback(
      c.env,
      c.req.param("id"),
      c.req.header("X-Job-ID") ?? "",
      c.req.header("Authorization")?.replace(/^Bearer /, "") ?? "",
    );
    const data = z
      .object({
        pages: z.number().int().min(1).max(100),
        complete: z.boolean().optional(),
        page: z.number().int().min(1).max(100).optional(),
        text: z.string().max(50000).optional(),
        image: z.string().max(3000000).nullable().optional(),
        hasGraphics: z.boolean().optional(),
      })
      .parse(await c.req.json());
    await completeConversion(c.env, user, c.req.param("id"), {
      ...data,
      image: data.image ?? undefined,
    });
    return c.json({ ok: true });
  });
  app.get("/api/v1/courses/:id/materials", async (c) => {
    await getCourse(c.env, c.get("user").id, c.req.param("id"));
    return c.json({
      materials: (
        await rows<Record<string, unknown>>(
          c.env,
          "SELECT * FROM materials WHERE user_id=? AND course_id=? ORDER BY created_at DESC",
          c.get("user").id,
          c.req.param("id"),
        )
      ).map(materialFromRow),
    });
  });
  app.post("/api/v1/courses/:id/materials", async (c) => {
    const u = c.get("user");
    await getCourse(c.env, u.id, c.req.param("id"));
    const data = await c.req.formData(),
      file = data.get("file");
    if (!(file instanceof File))
      throw new ApiError(400, "FILE_REQUIRED", "请选择要导入的文件。");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "",
      mime = allowed[extension];
    if (!mime)
      throw new ApiError(
        415,
        "FILE_TYPE",
        "支持 PDF、PPTX、DOCX、图片、文本和 CSV 文件。",
      );
    const limits = await limitsFor(c.env);
    if (
      !file.size ||
      file.size > Math.min(limits.fileBytes, policy.limits.fileBytes)
    )
      throw new ApiError(413, "FILE_SIZE", "单文件需在 1 字节至 20MB 之间。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const prefix = new TextDecoder().decode(bytes.slice(0, 8));
    if (extension === "pdf" && !prefix.startsWith("%PDF-"))
      throw new ApiError(415, "FILE_SIGNATURE", "PDF 文件签名无效。");
    if (
      ["docx", "pptx"].includes(extension) &&
      !(bytes[0] === 80 && bytes[1] === 75)
    )
      throw new ApiError(415, "FILE_SIGNATURE", "Office 文件格式无效。");
    if (
      mime === "image/png" &&
      !(bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78)
    )
      throw new ApiError(415, "FILE_SIGNATURE", "图片格式无效。");
    if (mime === "image/jpeg" && !(bytes[0] === 255 && bytes[1] === 216))
      throw new ApiError(415, "FILE_SIGNATURE", "图片格式无效。");
    const id = uid(),
      key = `${u.id}/${id}/original.${extension}`;
    await putPrivateObject(
      c.env,
      u.id,
      key,
      bytes,
      {
        httpMetadata: { contentType: mime },
        customMetadata: { owner: u.id },
      },
      id,
    );
    await run(
      c.env,
      "INSERT INTO materials(id,user_id,course_id,name,mime,bytes,status,object_key,created_at,updated_at) VALUES(?,?,?,?,?,?,'uploaded',?,?,?)",
      id,
      u.id,
      c.req.param("id"),
      file.name.slice(0, 200),
      mime,
      bytes.length,
      key,
      now(),
      now(),
    );
    if (data.get("purpose") !== "answer")
      await enqueue(c.env, u.id, "material", { materialId: id });
    return c.json(
      {
        material: materialFromRow(
          (await first<Record<string, unknown>>(
            c.env,
            "SELECT * FROM materials WHERE id=?",
            id,
          ))!,
        ),
      },
      201,
    );
  });
  app.get("/api/v1/materials/:id/file", async (c) => {
    const m = await first<{
      object_key: string;
      normalized_key: string | null;
      mime: string;
      name: string;
    }>(
      c.env,
      "SELECT * FROM materials WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    if (!m) throw new ApiError(404, "MATERIAL", "资料不存在。");
    const normalized = c.req.query("normalized") === "1" && m.normalized_key;
    const r = await c.env.BUCKET.get(
      normalized ? m.normalized_key! : m.object_key,
    );
    if (!r) throw new ApiError(404, "FILE", "文件尚未生成或已删除。");
    return new Response(r.body, {
      headers: {
        "Content-Type": normalized ? "application/pdf" : m.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(m.name)}`,
        "Cache-Control": "private,no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  });
  app.post("/api/v1/materials/:id/retry", async (c) => {
    const m = await first<{ id: string }>(
      c.env,
      "SELECT id FROM materials WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    if (!m) throw new ApiError(404, "MATERIAL", "资料不存在。");
    await run(
      c.env,
      "UPDATE materials SET status='uploaded',error=NULL WHERE id=?",
      m.id,
    );
    await enqueue(c.env, c.get("user").id, "material", { materialId: m.id });
    return c.json({ ok: true });
  });
  app.delete("/api/v1/materials/:id", async (c) => {
    const m = await first<{ id: string }>(
      c.env,
      "SELECT id FROM materials WHERE id=? AND user_id=?",
      c.req.param("id"),
      c.get("user").id,
    );
    if (!m) throw new ApiError(404, "MATERIAL", "资料不存在。");
    let cursor: string | undefined;
    do {
      const list = await c.env.BUCKET.list({
        prefix: `${c.get("user").id}/${m.id}/`,
        cursor,
      });
      if (list.objects.length)
        await c.env.BUCKET.delete(list.objects.map((o) => o.key));
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "DELETE FROM stored_objects WHERE material_id=? AND user_id=?",
      ).bind(m.id, c.get("user").id),
      c.env.DB.prepare(
        "DELETE FROM source_search WHERE source_id IN(SELECT id FROM sources WHERE material_id=? AND user_id=?)",
      ).bind(m.id, c.get("user").id),
      c.env.DB.prepare(
        "DELETE FROM sources WHERE material_id=? AND user_id=?",
      ).bind(m.id, c.get("user").id),
      c.env.DB.prepare("DELETE FROM materials WHERE id=? AND user_id=?").bind(
        m.id,
        c.get("user").id,
      ),
    ]);
    return c.json({ ok: true });
  });
  app.post("/api/v1/courses/:id/web", async (c) => {
    const d = z.object({ url: z.string().url() }).parse(await c.req.json());
    const u = c.get("user");
    await getCourse(c.env, u.id, c.req.param("id"));
    const url = new URL(d.url);
    if (
      url.protocol !== "https:" ||
      !!url.username ||
      !!url.password ||
      !publicHost(url.hostname)
    )
      throw new ApiError(400, "URL", "请输入公开 HTTPS 网页地址。");
    if (!c.env.DEEPSEEK_API_KEY)
      throw new ApiError(
        503,
        "SEARCH_NOT_CONFIGURED",
        "请先配置 DeepSeek 网页读取服务。",
      );
    const reservation = await reserve(
      c.env,
      u.id,
      "model",
      policy.pricing.searchFenPerRequest,
    );
    try {
      const r = await fetch(
        `${c.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/v1/tools/fetch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: d.url }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!r.ok)
        throw new ApiError(
          502,
          "WEB_FETCH",
          `网页读取失败（HTTP ${r.status}），未建立来源。`,
        );
      const data = (await r.json()) as {
        content?: string;
        markdown?: string;
        text?: string;
        title?: string;
        data?: { content?: string; markdown?: string; title?: string };
      };
      const text =
        data.markdown ??
        data.content ??
        data.text ??
        data.data?.markdown ??
        data.data?.content;
      if (!text)
        throw new ApiError(502, "WEB_FORMAT", "网页服务没有返回可读取正文。");
      const id = await addSource(
        c.env,
        u.id,
        c.req.param("id"),
        null,
        data.title ?? data.data?.title ?? url.hostname,
        null,
        text.slice(0, 50000),
        d.url,
      );
      await settle(c.env, reservation, policy.pricing.searchFenPerRequest);
      return c.json({ sourceId: id });
    } catch (e) {
      await settle(c.env, reservation, reservation.fen, {}, true);
      throw e;
    }
  });
  app.post("/api/v1/courses/:id/search", async (c) => {
    const { query } = z
        .object({ query: z.string().trim().min(1).max(128) })
        .parse(await c.req.json()),
      u = c.get("user");
    await getCourse(c.env, u.id, c.req.param("id"));
    if (!c.env.DEEPSEEK_API_KEY)
      throw new ApiError(
        503,
        "SEARCH_NOT_CONFIGURED",
        "网页搜索服务尚未配置。",
      );
    const reservation = await reserve(
      c.env,
      u.id,
      "model",
      policy.pricing.searchFenPerRequest,
    );
    let settled = false;
    try {
      const r = await fetch(
        `${c.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/v1/tools/search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, count: 5, need_content: true }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!r.ok)
        throw new ApiError(
          502,
          "SEARCH_FAILED",
          `搜索服务失败（HTTP ${r.status}）。`,
        );
      const result = z
        .object({
          results: z.array(
            z.object({
              title: z.string(),
              url: z.string().url(),
              snippet: z.string(),
              content: z.string().optional(),
            }),
          ),
        })
        .parse(await r.json());
      await settle(c.env, reservation, policy.pricing.searchFenPerRequest);
      settled = true;
      const results = [];
      for (const item of result.results) {
        const url = new URL(item.url);
        if (
          url.protocol !== "https:" ||
          !publicHost(url.hostname) ||
          url.username ||
          url.password
        )
          continue;
        let sourceId = null;
        if (item.content?.trim())
          sourceId = await addSource(
            c.env,
            u.id,
            c.req.param("id"),
            null,
            item.title,
            null,
            item.content.slice(0, 50000),
            item.url,
          );
        results.push({ ...item, content: undefined, sourceId });
      }
      return c.json({
        results,
        notice:
          "仅实际取得的正文已保存为讲解来源；只有摘要的结果可单独导入网页。",
      });
    } catch (e) {
      if (!settled) await settle(c.env, reservation, reservation.fen, {}, true);
      throw e;
    }
  });
  app.post("/api/v1/voice/transcribe", async (c) => {
    if (!c.env.DASHSCOPE_API_KEY || !c.env.DASHSCOPE_BASE_URL)
      throw new ApiError(503, "VOICE_NOT_CONFIGURED", "语音服务尚未配置。");
    const data = await c.req.formData(),
      file = data.get("audio"),
      duration = Number(data.get("duration"));
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 60
    )
      throw new ApiError(400, "AUDIO", "语音消息最长 60 秒、最大 5MB。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const measured = Math.ceil(wavDuration(bytes));
    const reservation = await reserve(
      c.env,
      c.get("user").id,
      "voice",
      Math.ceil(measured * policy.pricing.asrFenPerSecond),
      { asr: measured },
    );
    let settled = false;
    try {
      const r = await fetch(
        `${c.env.DASHSCOPE_BASE_URL.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.DASHSCOPE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen3-asr-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: {
                      data: `data:${file.type || "audio/webm"};base64,${base64(bytes)}`,
                    },
                  },
                ],
              },
            ],
            asr_options: { enable_itn: true },
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (!r.ok)
        throw new ApiError(
          502,
          "ASR_FAILED",
          `语音识别失败（HTTP ${r.status}）。请保留原意并改用文字。`,
        );
      const d = (await r.json()) as {
        choices?: { message: { content: string } }[];
        usage?: {
          input_tokens_details?: { audio_seconds?: number };
          seconds?: number;
        };
      };
      const text = d.choices?.[0]?.message.content;
      if (!text)
        throw new ApiError(
          502,
          "ASR_EMPTY",
          "语音未被识别，请重新录制或输入文字。",
        );
      const actual =
        d.usage?.input_tokens_details?.audio_seconds ??
        d.usage?.seconds ??
        measured;
      await settle(
        c.env,
        reservation,
        Math.ceil(actual * policy.pricing.asrFenPerSecond),
        { asr: actual },
      );
      settled = true;
      return c.json({
        text,
        notice:
          "请确认术语、数字和公式的转写，再提交作答。识别结果尚未计入学习证据。",
      });
    } catch (e) {
      if (!settled) await settle(c.env, reservation, reservation.fen, {}, true);
      throw e;
    }
  });
  app.post("/api/v1/voice/synthesize", async (c) => {
    const { text, language } = z
      .object({
        text: z.string().min(1).max(4000),
        language: z.enum(["zh", "en", "mixed"]),
      })
      .parse(await c.req.json());
    if (!c.env.DASHSCOPE_API_KEY || !c.env.DASHSCOPE_BASE_URL)
      throw new ApiError(503, "VOICE_NOT_CONFIGURED", "朗读服务尚未配置。");
    const hash = await digest(`${language}:${text}`),
      key = `${c.get("user").id}/audio/${hash}.wav`;
    const cached = await c.env.BUCKET.head(key);
    if (cached) return c.json({ url: `/api/v1/voice/audio/${hash}` });
    const chars = billableCharacters(text),
      rsv = await reserve(
        c.env,
        c.get("user").id,
        "voice",
        Math.ceil(chars * policy.pricing.ttsFenPerCharacter),
        { tts: chars },
      );
    let settled = false;
    try {
      const chunks = splitSpeech(text);
      const outputs: Uint8Array[] = [];
      for (const chunk of chunks) {
        const base = c.env.DASHSCOPE_BASE_URL.replace(
          /\/compatible-mode\/v1\/?$/,
          "",
        );
        const r = await fetch(
          `${base}/api/v1/services/aigc/multimodal-generation/generation`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${c.env.DASHSCOPE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "qwen3-tts-flash",
              input: {
                text: chunk,
                voice: "Cherry",
                language_type:
                  language === "zh"
                    ? "Chinese"
                    : language === "en"
                      ? "English"
                      : "Auto",
              },
            }),
            signal: AbortSignal.timeout(60000),
          },
        );
        if (!r.ok)
          throw new ApiError(
            502,
            "TTS_FAILED",
            `朗读服务失败（HTTP ${r.status}）。`,
          );
        const d = (await r.json()) as { output?: { audio?: { url?: string } } };
        const audioUrl = d.output?.audio?.url;
        if (!audioUrl || new URL(audioUrl).protocol !== "https:")
          throw new ApiError(502, "TTS_AUDIO", "服务未返回有效音频。");
        const audio = await fetch(audioUrl, {
          signal: AbortSignal.timeout(30000),
        });
        if (!audio.ok)
          throw new ApiError(502, "AUDIO_FETCH", "生成音频下载失败。");
        const b = new Uint8Array(await audio.arrayBuffer());
        if (b.length > 8 * 1024 * 1024)
          throw new ApiError(502, "AUDIO_SIZE", "生成音频超过限制。");
        outputs.push(b);
      }
      const wav = joinWav(outputs);
      await putPrivateObject(
        c.env,
        c.get("user").id,
        key,
        wav,
        {
          httpMetadata: { contentType: "audio/wav" },
          customMetadata: {
            owner: c.get("user").id,
            expires: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        },
        null,
        new Date(Date.now() + 30 * 86400000).toISOString(),
      );
      await settle(
        c.env,
        rsv,
        Math.ceil(chars * policy.pricing.ttsFenPerCharacter),
      );
      settled = true;
      return c.json({ url: `/api/v1/voice/audio/${hash}` });
    } catch (e) {
      if (!settled) await settle(c.env, rsv, rsv.fen, {}, true);
      throw e;
    }
  });
  app.get("/api/v1/voice/audio/:id", async (c) => {
    if (!/^[a-f0-9]{64}$/.test(c.req.param("id")))
      throw new ApiError(400, "AUDIO_ID", "音频编号无效。");
    const r = await c.env.BUCKET.get(
      `${c.get("user").id}/audio/${c.req.param("id")}.wav`,
    );
    if (!r) throw new ApiError(404, "AUDIO", "音频已过期，请重新生成。");
    return new Response(r.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private,max-age=86400",
      },
    });
  });
}
function publicHost(host: string) {
  return !(
    /(^localhost$|\.local$|\.internal$|^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^0\.|:)/i.test(
      host,
    ) || !host.includes(".")
  );
}
export async function digest(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function splitSpeech(text: string) {
  const out: string[] = [];
  let chunk = "";
  for (const sentence of text.split(/(?<=[。！？.!?\n])/u)) {
    if (chunk.length + sentence.length > 500 && chunk) {
      out.push(chunk);
      chunk = "";
    }
    if (sentence.length > 500) {
      for (let i = 0; i < sentence.length; i += 500)
        out.push(sentence.slice(i, i + 500));
    } else chunk += sentence;
  }
  if (chunk) out.push(chunk);
  return out;
}
export function joinWav(chunks: Uint8Array[]) {
  if (chunks.length === 1) return chunks[0];
  const pcm: Uint8Array[] = [];
  let format: Uint8Array | undefined;
  for (const b of chunks) {
    if (new TextDecoder().decode(b.slice(0, 4)) !== "RIFF")
      throw new ApiError(502, "AUDIO_FORMAT", "音频格式无法合并。");
    let pos = 12;
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    while (pos + 8 <= b.length) {
      const name = new TextDecoder().decode(b.slice(pos, pos + 4)),
        len = view.getUint32(pos + 4, true);
      if (name === "fmt ") {
        const f = b.slice(pos + 8, pos + 8 + len);
        if (format && format.some((v, i) => v !== f[i]))
          throw new ApiError(502, "AUDIO_FORMAT", "音频分段格式不一致。");
        format = f;
      }
      if (name === "data") pcm.push(b.slice(pos + 8, pos + 8 + len));
      pos += 8 + len + (len % 2);
    }
  }
  if (!format) throw new ApiError(502, "AUDIO_FORMAT", "缺少音频格式信息。");
  const len = pcm.reduce((a, b) => a + b.length, 0),
    out = new Uint8Array(12 + 8 + format.length + 8 + len),
    v = new DataView(out.buffer);
  const str = (s: string, p: number) => out.set(new TextEncoder().encode(s), p);
  str("RIFF", 0);
  v.setUint32(4, out.length - 8, true);
  str("WAVEfmt ", 8);
  v.setUint32(16, format.length, true);
  out.set(format, 20);
  const p = 20 + format.length;
  str("data", p);
  v.setUint32(p + 4, len, true);
  let at = p + 8;
  for (const chunk of pcm) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
// Duration comes from the PCM container, never from a client-supplied timer.
export function wavDuration(bytes: Uint8Array) {
  const text = new TextDecoder(),
    v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length < 44 ||
    text.decode(bytes.slice(0, 4)) !== "RIFF" ||
    text.decode(bytes.slice(8, 12)) !== "WAVE"
  )
    throw new ApiError(400, "AUDIO_FORMAT", "请上传 PCM WAV 语音。");
  let rate = 0,
    size = 0,
    align = 0;
  for (let at = 12; at + 8 <= bytes.length;) {
    const length = v.getUint32(at + 4, true),
      kind = text.decode(bytes.slice(at, at + 4));
    if (at + 8 + length > bytes.length)
      throw new ApiError(400, "AUDIO_FORMAT", "音频数据不完整。");
    if (kind === "fmt ") {
      if (length < 16 || v.getUint16(at + 8, true) !== 1)
        throw new ApiError(400, "AUDIO_FORMAT", "仅支持 PCM WAV。");
      const channels = v.getUint16(at + 10, true),
        sampleRate = v.getUint32(at + 12, true),
        bits = v.getUint16(at + 22, true);
      rate = v.getUint32(at + 16, true);
      align = v.getUint16(at + 20, true);
      if (
        ![1, 2].includes(channels) ||
        ![8, 16, 24, 32].includes(bits) ||
        sampleRate < 8000 ||
        sampleRate > 48000 ||
        align !== (channels * bits) / 8 ||
        rate !== sampleRate * align
      )
        throw new ApiError(400, "AUDIO_FORMAT", "PCM WAV 参数无效。");
    }
    if (kind === "data") size += length;
    at += 8 + length + (length % 2);
  }
  const duration = size / rate;
  if (
    !rate ||
    !size ||
    size % align ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 60
  )
    throw new ApiError(400, "AUDIO_DURATION", "语音消息最长 60 秒。");
  return duration;
}
