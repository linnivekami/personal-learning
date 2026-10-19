import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cheatTopicSchema,
  normalizeCheatTopics,
  pagesFromTopics,
  parseCheatText,
  partitionTopics,
  type CheatTopic,
} from "../shared/cheatsheet";
import { app } from "../server/app";
import { testEnvironment } from "./support";

let t: ReturnType<typeof testEnvironment>;
beforeEach(() => {
  t = testEnvironment();
});
afterEach(() => {
  t.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function request(
  path: string,
  method = "GET",
  body?: unknown,
  user = "learner",
) {
  return app.request(
    `https://learning.test/api/v1${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "oai-authenticated-user-id": user,
        "oai-authenticated-user-email": `${user}@learning.test`,
        Origin: "https://learning.test",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    t.env,
  );
}

function topic(index: number, code = `S1 · ${String(index + 1).padStart(2, "0")}`): CheatTopic {
  return {
    code,
    title: `Knowledge point ${index + 1}`,
    body: `这是一个用于排版测试的知识点，包含 English terms、公式与关键数字 ${index + 1}。`.repeat(
      1 + (index % 3),
    ),
    formulas: index % 4 === 0 ? [`$x_${index} = y + z$`] : [],
    pitfalls: index % 5 === 0 ? [`不要混淆变量 ${index} 与 ${index + 1}。`] : [],
  };
}

describe("cheat sheet packing", () => {
  it("keeps order, fills six columns, and balances the heaviest column", () => {
    const topics = Array.from({ length: 71 }, (_, index) => topic(index));
    const pages = pagesFromTopics(topics);
    expect(pages).toHaveLength(2);
    expect(pages.every((page) => page.columns.length === 3)).toBe(true);
    const flat = pages.flatMap((page) => page.columns.flat());
    expect(flat.map((item) => item.code)).toEqual(topics.map((item) => item.code));
    expect(pages.flatMap((page) => page.columns).every((column) => column.length > 0)).toBe(
      true,
    );
    const weights = partitionTopics(topics).map((column) =>
      column.reduce((sum, item) => sum + item.body.length, 0),
    );
    expect(Math.max(...weights) / Math.min(...weights)).toBeLessThan(1.8);
  });

  it("puts one topic per column when the sheet is small", () => {
    const pages = pagesFromTopics([topic(0), topic(1), topic(2), topic(3)]);
    expect(pages[0].columns.map((column) => column.length)).toEqual([1, 1, 1]);
    expect(pages[1].columns.map((column) => column.length)).toEqual([1, 0, 0]);
  });

  it("normalizes headings, bullets and duplicate titles", () => {
    const topics = normalizeCheatTopics([
      {
        ...topic(0),
        title: "Same title",
        body: "# Heading\n- first point\n- second point",
      },
      {
        ...topic(1),
        title: "same   TITLE",
        body: "duplicate",
      },
    ]);
    expect(topics).toHaveLength(1);
    expect(topics[0].body).toBe("Heading\n• first point\n• second point");
  });

  it("parses the plain-text wire format, joining wrapped lines", () => {
    const topics = parseCheatText(
      [
        "```text",
        "S1 · 01 || Supply chain || first line",
        "continues here || $SC = value - cost$ ;; $SC = revenue - cost$",
        "|| do not draw a line",
        "S1 · 02 || Flows || material, cash, information ||  || ",
        "```",
      ].join("\n"),
    );
    expect(topics).toHaveLength(2);
    expect(topics[0].body).toBe("first line continues here");
    expect(topics[0].formulas).toHaveLength(2);
    expect(topics[0].pitfalls).toEqual(["do not draw a line"]);
    expect(topics[1].formulas).toEqual([]);
  });

  it("packs the generated front and back independently", () => {
    const front = Array.from({ length: 7 }, (_, index) => ({
      ...topic(index, `F${index}`),
      page: 1 as const,
    }));
    const back = Array.from({ length: 5 }, (_, index) => ({
      ...topic(index, `B${index}`),
      page: 2 as const,
    }));
    const pages = pagesFromTopics([...front, ...back]);
    expect(pages[0].columns.flat().map((item) => item.code)).toEqual(
      front.map((item) => item.code),
    );
    expect(pages[1].columns.flat().map((item) => item.code)).toEqual(
      back.map((item) => item.code),
    );
  });

  it("rejects a topic without a body", () => {
    expect(cheatTopicSchema.safeParse({ code: "S1 · 01", title: "x", body: "" }).success).toBe(
      false,
    );
  });
});

function mockModel() {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      call += 1;
      const payload = JSON.parse(String(init.body)) as {
        input?: { content?: { text?: string }[] }[];
      };
      const prompt = payload.input?.[0]?.content?.[0]?.text ?? "";
      const back = prompt.includes('"side":"back"');
      const lines = Array.from({ length: 24 }, (_, index) => {
        const formula = "$Q^* = \\sqrt{2KD/H}$";
        const pitfall = index === 0 ? "不要把乘数写成 Net income / COGS。" : "";
        return [
          `${back ? "B" : "F"}${String(index + 1).padStart(2, "0")}`,
          `${back ? "Back" : "Front"} point ${index + 1}`,
          `${back ? "反面" : "正面"}知识点 ${index + 1}：COGS / Net income = multiplier；保留 English terms。`,
          formula,
          pitfall,
        ].join(" || ");
      });
      return new Response(
        JSON.stringify({
          status: "completed",
          output_text: lines.join("\n"),
          usage: { input_tokens: 120, output_tokens: 240 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
  return () => call;
}

describe("cheat sheet API", () => {
  it("generates and stores exactly two A4 sides", async () => {
    t.env.DEEPSEEK_API_KEY = "test-key";
    const calls = mockModel();
    const sample = await request("/courses/sample", "POST", {});
    const { course } = (await sample.json()) as { course: { id: string } };
    const response = await request(`/courses/${course.id}/cheatsheets`, "POST", {
      scope: "Sessions 1–2, midterm",
      conceptIds: [],
      highlightFormulas: true,
      highlightMistakes: false,
    });
    expect(response.status).toBe(200);
    const stream = await response.text();
    expect(calls()).toBe(2);
    expect(stream).toContain("event: sheet");
    const data = stream
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
    const done = data.find((item) => "sheet" in item) as {
      sheet: {
        id: string;
        pages: { columns: CheatTopic[][] }[];
        options: { highlightMistakes: boolean };
        topicCount: number;
      };
    };
    expect(done.sheet.pages).toHaveLength(2);
    expect(done.sheet.pages.every((page) => page.columns.length === 3)).toBe(true);
    expect(done.sheet.pages.flatMap((page) => page.columns.flat())).toHaveLength(48);
    expect(done.sheet.topicCount).toBe(48);
    expect(done.sheet.options.highlightMistakes).toBe(false);
    expect(
      t.db.prepare("SELECT COUNT(*) n FROM cheat_sheets").get()?.n,
    ).toBe(1);
  });

  it("persists options and topics for later previews", async () => {
    t.env.DEEPSEEK_API_KEY = "test-key";
    mockModel();
    const { course } = (await (
      await request("/courses/sample", "POST", {})
    ).json()) as { course: { id: string } };
    const stream = await (
      await request(`/courses/${course.id}/cheatsheets`, "POST", {
        scope: "",
        conceptIds: [],
        highlightFormulas: false,
        highlightMistakes: true,
      })
    ).text();
    const sheet = stream
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>)
      .find((item) => "sheet" in item) as {
      sheet: { id: string };
    };
    const one = (await (await request(`/cheatsheets/${sheet.sheet.id}`)).json()) as {
      sheet: {
        options: { highlightFormulas: boolean; highlightMistakes: boolean };
        pages: { columns: CheatTopic[][] }[];
      };
    };
    expect(one.sheet.options).toEqual({
      highlightFormulas: false,
      highlightMistakes: true,
    });
    expect(one.sheet.pages).toHaveLength(2);
    expect(
      (await request(`/cheatsheets/${sheet.sheet.id}`, "GET", undefined, "other"))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/cheatsheets/${sheet.sheet.id}`,
          "DELETE",
          undefined,
          "other",
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(`/cheatsheets/${sheet.sheet.id}`, "DELETE")).status,
    ).toBe(200);
  });

  it("refuses empty scopes and missing model configuration", async () => {
    const { course } = (await (
      await request("/courses/sample", "POST", {})
    ).json()) as { course: { id: string } };
    const noModel = await request(`/courses/${course.id}/cheatsheets`, "POST", {
      scope: "",
      conceptIds: [],
    });
    expect(noModel.status).toBe(503);
    t.env.DEEPSEEK_API_KEY = "test-key";
    const empty = await request(`/courses/${course.id}/cheatsheets`, "POST", {
      scope: "",
      conceptIds: ["not-a-concept"],
    });
    expect(empty.status).toBe(400);
    expect(
      (
        (await empty.json()) as { error: { code: string } }
      ).error.code,
    ).toBe("CHEAT_SCOPE");
  });
});
