import { z } from "zod";

/**
 * A cheat sheet is a flat, ordered list of compact topics. The server packs
 * that list into six narrow columns (three per A4 side) so the printed result
 * is always exactly two pages, regardless of how many topics the model wrote.
 */
export const cheatTopicSchema = z.object({
  code: z.string().min(1).max(24),
  title: z.string().min(1).max(90),
  body: z.string().min(1).max(700),
  formulas: z.array(z.string().min(1).max(280)).max(4).default([]),
  pitfalls: z.array(z.string().min(1).max(280)).max(3).default([]),
  /** Which A4 side the generator assigned this box to. */
  page: z.number().int().min(1).max(2).optional(),
});
export type CheatTopic = z.infer<typeof cheatTopicSchema>;

/**
 * Compact wire format: one string per box, fields separated by "||" and list
 * items by ";;". It spends far fewer output tokens than nested objects, which
 * matters because a two-page sheet is a large single generation.
 */
export const cheatDraftSchema = z.object({
  lines: z.array(z.string().min(1).max(900)).min(10).max(80),
});
export type CheatDraft = z.infer<typeof cheatDraftSchema>;

export function parseCheatLines(lines: string[]): CheatTopic[] {
  const topics: CheatTopic[] = [];
  for (const raw of lines) {
    const parts = raw.replace(/\n/g, " ").split("||").map((part) => part.trim());
    if (parts.length < 3) continue;
    const [code, title, body] = parts;
    if (!code || !title || !body) continue;
    topics.push({
      code,
      title,
      body,
      formulas: (parts[3] ?? "")
        .split(";;")
        .map((value) => value.trim())
        .filter(Boolean),
      pitfalls: (parts[4] ?? "")
        .split(";;")
        .map((value) => value.trim())
        .filter(Boolean),
    });
  }
  return topics;
}

/**
 * Parse the plain-text wire format. Header lines and markdown fences are
 * ignored; a wrapped continuation line is joined to the previous box.
 */
export function parseCheatText(text: string): CheatTopic[] {
  const joined: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("```")) continue;
    const line = trimmed.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim();
    const fields = line.split("||");
    const looksLikeTopic =
      fields.length >= 3 && fields[0].trim().length > 0 && fields[0].trim().length <= 24;
    if (!looksLikeTopic && joined.length) {
      joined[joined.length - 1] += ` ${line}`;
      continue;
    }
    joined.push(line);
  }
  return parseCheatLines(joined.filter((line) => line.includes("||")));
}

export const cheatSheetOptionsSchema = z.object({
  highlightFormulas: z.boolean().default(true),
  highlightMistakes: z.boolean().default(true),
});
export type CheatSheetOptions = z.infer<typeof cheatSheetOptionsSchema>;

export const cheatSheetContentSchema = z.object({
  title: z.string().min(1).max(160),
  subtitle: z.string().max(240),
  topics: z.array(cheatTopicSchema).min(6).max(96),
});
export type CheatSheetContent = z.infer<typeof cheatSheetContentSchema>;

export interface CheatSheetPage {
  columns: CheatTopic[][];
}

export interface CheatSheet {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  scope: string;
  options: CheatSheetOptions;
  topicCount: number;
  pages: CheatSheetPage[];
  createdAt: string;
}

export interface CheatSheetSummary {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  scope: string;
  options: CheatSheetOptions;
  topicCount: number;
  createdAt: string;
}

export const CHEAT_COLUMNS = 6;

/** Split selected concepts across the two sides, keeping course order. */
export function splitForSides<T>(items: T[]): [T[], T[]] {
  if (items.length <= 3) return [items, items];
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}

function wraps(text: string, width: number): number {
  return text
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(Array.from(line).length / width)),
      0,
    );
}

/**
 * Approximate rendered height in "body lines". It intentionally favours CJK
 * width, because the generated sheets are mixed Chinese/English and the
 * narrow A4 columns hold fewer Latin characters than a screen column.
 */
export function cheatTopicWeight(topic: CheatTopic): number {
  const formulas = topic.formulas.reduce(
    (n, formula) => n + wraps(formula, 34) + 0.35,
    0,
  );
  const pitfalls = topic.pitfalls.reduce(
    (n, pitfall) => n + wraps(pitfall, 34) + 0.35,
    0,
  );
  return (
    1.35 +
    wraps(topic.title, 24) * 1.08 +
    wraps(topic.body, 34) +
    formulas +
    pitfalls
  );
}

/**
 * Partition an ordered list into `parts` contiguous groups that minimise the
 * heaviest group. This keeps every column as full as the others while making
 * sure a session is never split across a page boundary more than necessary.
 */
export function partitionTopics(
  topics: CheatTopic[],
  parts = CHEAT_COLUMNS,
): CheatTopic[][] {
  const n = topics.length;
  if (!n) return Array.from({ length: parts }, () => []);
  if (n <= parts) {
    const groups = topics.map((topic) => [topic]);
    while (groups.length < parts) groups.push([]);
    return groups;
  }
  const weights = topics.map(cheatTopicWeight);
  const prefix = [0];
  for (const weight of weights) prefix.push(prefix[prefix.length - 1] + weight);
  const dp = Array.from({ length: parts + 1 }, () =>
    Array<number>(n + 1).fill(Number.POSITIVE_INFINITY),
  );
  const cut = Array.from({ length: parts + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  dp[0][0] = 0;
  for (let group = 1; group <= parts; group++) {
    // Reserve one item for each remaining group.
    for (let end = group; end <= n - (parts - group); end++) {
      for (let start = group - 1; start < end; start++) {
        if (!Number.isFinite(dp[group - 1][start])) continue;
        const value = Math.max(
          dp[group - 1][start],
          prefix[end] - prefix[start],
        );
        if (value < dp[group][end]) {
          dp[group][end] = value;
          cut[group][end] = start;
        }
      }
    }
  }
  const groups: CheatTopic[][] = [];
  let end = n;
  for (let group = parts; group >= 1; group--) {
    const start = cut[group][end];
    groups.unshift(topics.slice(start, end));
    end = start;
  }
  return groups;
}

export function pagesFromTopics(topics: CheatTopic[]): CheatSheetPage[] {
  const front = topics.filter((topic) => topic.page === 1);
  const back = topics.filter((topic) => topic.page === 2);
  if (front.length && back.length)
    return [
      { columns: partitionTopics(front, 3) },
      { columns: partitionTopics(back, 3) },
    ];
  const columns = partitionTopics(topics, CHEAT_COLUMNS);
  return [
    { columns: columns.slice(0, 3) },
    { columns: columns.slice(3, 6) },
  ];
}

/** Clean model output before it is stored or measured. */
export function normalizeCheatTopics(topics: CheatTopic[]): CheatTopic[] {
  const seen = new Set<string>();
  const out: CheatTopic[] = [];
  for (const [index, topic] of topics.entries()) {
    const title = topic.title.replace(/\s+/g, " ").trim();
    const key = title.toLowerCase().replace(/[\s·:：,，.。\-—_]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const body = topic.body
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!body) continue;
    out.push({
      code: topic.code.replace(/\s+/g, " ").trim().slice(0, 24) || `${index + 1}`,
      title: title.slice(0, 90),
      body: body.slice(0, 700),
      formulas: topic.formulas
        .map((value) => value.trim().slice(0, 280))
        .filter(Boolean)
        .slice(0, 4),
      pitfalls: topic.pitfalls
        .map((value) => value.trim().slice(0, 280))
        .filter(Boolean)
        .slice(0, 3),
      ...(topic.page ? { page: topic.page } : {}),
    });
    if (out.length >= 96) break;
  }
  return out;
}
