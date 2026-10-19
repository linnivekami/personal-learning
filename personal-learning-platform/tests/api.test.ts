import type { Course } from "../shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unsubscribeURL } from "../server/unsubscribe";
import { putPrivateObject } from "../server/storage";
import { processDueJobs } from "../server/jobs";
import { app } from "../server/app";
import { testEnvironment } from "./support";
import { reserve, settle, usageFor } from "../server/quota";
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
async function sample(user = "learner") {
  const r = await request("/courses/sample", "POST", {}, user);
  expect(r.status).toBe(201);
  return (
    (await r.json()) as { course: { id: string; state: { revision: number } } }
  ).course;
}
describe("account and tenant boundaries", () => {
  it("health is public", async () =>
    expect((await request("/health")).status).toBe(200));
  it("configuration exposes booleans and never secrets", async () => {
    t.env.DEEPSEEK_API_KEY = "secret-value";
    const data = await (await request("/config")).text();
    expect(data).toContain('"model":true');
    expect(data).not.toContain("secret-value");
  });
  it("app identity mode ignores untrusted identity headers", async () => {
    t.env.IDENTITY_MODE = "app";
    expect((await request("/courses")).status).toBe(401);
  });
  it("unauthenticated requests cannot save learning data", async () => {
    expect(
      (await app.request("https://learning.test/api/v1/courses", {}, t.env))
        .status,
    ).toBe(401);
  });
  it("private courses cannot be read by another learner", async () => {
    const c = await sample();
    expect(
      (await request(`/courses/${c.id}`, "GET", undefined, "someone")).status,
    ).toBe(404);
  });
  it("private materials cannot be listed under another course", async () => {
    const c = await sample();
    expect(
      (await request(`/courses/${c.id}/materials`, "GET", undefined, "someone"))
        .status,
    ).toBe(404);
  });
  it("admin operations enforce server permissions", async () =>
    expect((await request("/admin/overview")).status).toBe(403));
  it("configured administrators can inspect operational metadata", async () =>
    expect(
      (await request("/admin/overview", "GET", undefined, "admin")).status,
    ).toBe(200));
  it("cross-site mutations are rejected", async () => {
    const r = await app.request(
      "https://learning.test/api/v1/courses",
      {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      },
      t.env,
    );
    expect(r.status).toBe(403);
  });
});
describe("learning state and evidence", () => {
  it("course creation can start from an empty material-based framework", async () => {
    const r = await request("/courses", "POST", {
      title: "Statistics",
      description: "",
      goal: "mastery",
      language: "en",
      strategy: "framework",
      generate: false,
    });
    expect(r.status).toBe(201);
  });
  it("missing API configuration fails explicitly", async () => {
    const r = await request("/courses", "POST", {
      title: "Statistics",
      goal: "mastery",
      language: "en",
      strategy: "framework",
      generate: true,
    });
    expect(r.status).toBe(503);
    expect(t.db.prepare("SELECT COUNT(*) n FROM courses").get()?.n).toBe(0);
  });
  it("sample course starts without invented mastery", async () => {
    const c = await sample();
    const data = (await (await request(`/courses/${c.id}`)).json()) as {
      course: { state: { events: unknown[]; concepts: unknown } };
    };
    expect(data.course.state.events).toHaveLength(0);
    expect(data.course.state.concepts).toEqual({});
  });
  it("saved lessons do not reveal correct solutions or complete hint ladders", async () => {
    const c = await sample();
    const text = await (await request(`/courses/${c.id}/lessons`)).text();
    expect(text).not.toContain('"solution"');
    expect(text).not.toContain('"rubric"');
    expect(text).not.toContain('"hints"');
  });
  it("objective answers advance state and refresh the next action", async () => {
    const c = await sample();
    const a = t.db
      .prepare(
        "SELECT id FROM assessments WHERE user_id=? AND json_extract(card,'$.kind')=?",
      )
      .get("learner", "choice")!;
    const r = await request(`/courses/${c.id}/attempts`, "POST", {
      attemptId: crypto.randomUUID(),
      assessmentId: a.id,
      answer: "b",
      assistance: 0,
      confidence: 8,
    });
    expect(r.status).toBe(200);
    const d = (await r.json()) as {
      course: {
        state: {
          revision: number;
          concepts: Record<string, { mastery: number }>;
          nextAction: { id: string };
        };
      };
    };
    expect(d.course.state.revision).toBe(1);
    expect(d.course.state.concepts.conditional.mastery).toBe(1);
    expect(d.course.state.nextAction.id).toContain(":1:");
  });
  it("request replay creates one event and one effort reward", async () => {
    const c = await sample();
    const a = t.db
      .prepare("SELECT id FROM assessments WHERE json_extract(card,'$.kind')=?")
      .get("choice")!;
    const body = {
      attemptId: crypto.randomUUID(),
      assessmentId: a.id,
      answer: "b",
      assistance: 0,
      confidence: null,
    };
    await request(`/courses/${c.id}/attempts`, "POST", body);
    const second = await request(`/courses/${c.id}/attempts`, "POST", body);
    expect(second.status).toBe(200);
    expect(t.db.prepare("SELECT COUNT(*) n FROM events").get()?.n).toBe(1);
    expect(t.db.prepare("SELECT COUNT(*) n FROM activities").get()?.n).toBe(1);
  });
  it("viewing a hint records its clock before any subsequent assessment", async () => {
    const c = await sample();
    const a = t.db
      .prepare("SELECT id FROM assessments WHERE course_id=? LIMIT 1")
      .get(c.id) as { id: string };
    const result = (await (
      await request(`/assessments/${a.id}/hint`, "POST", {})
    ).json()) as { course: Course };
    expect(result.course.state.events.at(-1)).toMatchObject({
      ability: "exposure",
      assistance: 1,
    });
    expect(result.course.state.concepts.conditional.lastVerified).toBeNull();
  });
  it("hint use cannot be hidden by the client", async () => {
    const c = await sample(),
      a = t.db
        .prepare(
          "SELECT id FROM assessments WHERE json_extract(card,'$.kind')=?",
        )
        .get("choice")!;
    await request(`/assessments/${a.id}/hint`, "POST", {});
    const r = await request(`/courses/${c.id}/attempts`, "POST", {
      attemptId: crypto.randomUUID(),
      assessmentId: a.id,
      answer: "b",
      assistance: 0,
      confidence: null,
    });
    const d = (await r.json()) as {
      event: { assistance: number };
      course: { state: { concepts: Record<string, { mastery: number }> } };
    };
    expect(d.event.assistance).toBe(1);
    expect(d.course.state.concepts.conditional.mastery).toBe(1);
  });
  it("invalid graph relationships are rejected before saving", async () => {
    const c = await sample();
    const r = await request(`/courses/${c.id}`, "PATCH", {
      revision: 0,
      concepts: [
        {
          id: "a",
          title: "a",
          purpose: "",
          summary: "",
          parentId: null,
          prerequisites: ["b"],
          applications: [],
          sourceIds: [],
        },
      ],
    });
    expect(r.status).toBe(400);
  });
  it("optimistic revision checks prevent overwrites", async () => {
    const c = await sample();
    expect(
      (
        await request(`/courses/${c.id}`, "PATCH", {
          revision: 0,
          title: "Updated",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/courses/${c.id}`, "PATCH", {
          revision: 0,
          title: "Stale",
        })
      ).status,
    ).toBe(409);
  });
  it("mode changes never manufacture mastery", async () => {
    const c = await sample();
    await request(`/courses/${c.id}`, "PATCH", { revision: 0, goal: "exam" });
    expect(t.db.prepare("SELECT COUNT(*) n FROM events").get()?.n).toBe(0);
  });
});
describe("quotas and failure accounting", () => {
  it("pre-reserves and settles actual costs", async () => {
    const r = await reserve(t.env, "learner", "model", 50, {
      input: 1000,
      output: 500,
    });
    expect(t.db.prepare("SELECT reserved FROM budgets").get()?.reserved).toBe(
      50,
    );
    await settle(t.env, r, 20, { input: 100, output: 50 });
    expect(
      t.db.prepare("SELECT spent,reserved FROM budgets").get(),
    ).toMatchObject({ spent: 20, reserved: 0 });
  });
  it("settlement is idempotent", async () => {
    const r = await reserve(t.env, "learner", "model", 50);
    await settle(t.env, r, 20);
    await settle(t.env, r, 20);
    expect(t.db.prepare("SELECT spent FROM budgets").get()?.spent).toBe(20);
  });
  it("daily token limit includes in-flight requests", async () => {
    await reserve(t.env, "learner", "model", 10, { input: 39000 });
    await expect(
      reserve(t.env, "learner", "model", 10, { input: 2000 }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });
  it("whole-site model budget is enforced across users", async () => {
    await reserve(t.env, "a", "model", 13000);
    await expect(reserve(t.env, "b", "model", 1)).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
    });
  });
  it("voice and model budgets are separate", async () => {
    await reserve(t.env, "a", "model", 13000);
    await expect(reserve(t.env, "b", "voice", 10)).resolves.toBeDefined();
  });
  it("uncertain provider failures keep a conservative charge", async () => {
    const r = await reserve(t.env, "learner", "model", 50);
    await settle(t.env, r, 50, {}, true);
    expect(t.db.prepare("SELECT status FROM reservations").get()?.status).toBe(
      "uncertain",
    );
    expect(t.db.prepare("SELECT spent FROM budgets").get()?.spent).toBe(50);
  });
  it("quota exhaustion leaves notes accessible", async () => {
    const c = await sample();
    await reserve(t.env, "learner", "model", 13000);
    expect((await request(`/courses/${c.id}/notes`)).status).toBe(200);
  });
});
describe("notes, privacy and settings", () => {
  it("notes survive reload and remain private", async () => {
    const c = await sample();
    const r = await request(`/courses/${c.id}/notes`, "POST", {
      title: "My understanding",
      body: "A condition changes the sample space.",
      conceptId: "conditional",
    });
    expect(r.status).toBe(201);
    const d = (await (await request(`/courses/${c.id}/notes`)).json()) as {
      notes: unknown[];
    };
    expect(d.notes).toHaveLength(1);
    const id = ((await r.json()) as { id: string }).id;
    expect(
      (
        await request(
          `/notes/${id}`,
          "PUT",
          { title: "attack", body: "overwrite", conceptId: null },
          "someone",
        )
      ).status,
    ).toBe(404);
  });
  it("empty reflections do not award coins", async () => {
    const c = await sample();
    const n = (await (
      await request(`/courses/${c.id}/notes`, "POST", {
        title: "Short",
        body: "tiny",
        conceptId: null,
      })
    ).json()) as { id: string };
    expect((await request(`/notes/${n.id}/reflect`, "POST", {})).status).toBe(
      400,
    );
  });
  it("an invalid timezone cannot break reminder jobs", async () =>
    expect(
      (
        await request("/reminders", "PUT", {
          enabled: true,
          time: "19:00",
          timezone: "not-a-zone",
          email: true,
          push: false,
          quietStart: "22:00",
          quietEnd: "08:00",
          weeklyGoal: 5,
        })
      ).status,
    ).toBe(400));
  it("private network push endpoints are rejected", async () =>
    expect(
      (
        await request("/push", "POST", {
          endpoint: "https://127.0.0.1/secret",
          keys: { p256dh: "x", auth: "y" },
        })
      ).status,
    ).toBe(400));
  it("record export contains only the requesting learner", async () => {
    await sample("learner");
    await sample("someone");
    const text = await (await request("/export")).text();
    expect(text).not.toContain("someone@learning.test");
  });
  it("account deletion removes private course data", async () => {
    await sample();
    expect((await request("/me", "DELETE", { confirm: "DELETE" })).status).toBe(
      200,
    );
    expect(
      t.db
        .prepare("SELECT COUNT(*) n FROM courses WHERE user_id=?")
        .get("learner")?.n,
    ).toBe(0);
  });
  it("file callbacks reject missing scoped authorization", async () =>
    expect(
      (
        await app.request(
          "https://learning.test/internal/materials/x/complete",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: '{"pages":1,"complete":true}',
          },
          t.env,
        )
      ).status,
    ).toBe(403));
});

describe("complete migration and derived participation", () => {
  it("imports evidence and notes atomically with new owner-scoped IDs", async () => {
    const c = await sample("original");
    const original = (await (
      await request(`/courses/${c.id}`, "GET", undefined, "original")
    ).json()) as { course: any };
    original.course.state.events = [
      {
        id: "old-event-01",
        attemptId: "old-attempt",
        conceptId: "conditional",
        ability: "application",
        outcome: "demonstrated",
        assistance: 2,
        occurredAt: "2026-10-14T10:00:00.000Z",
        evidence: "original hint record",
        confidence: 8,
        strategy: "example",
        source: "tutor",
      },
    ];
    const data = {
      format: "personal-learning",
      version: 2,
      courses: [original.course],
      notes: [
        {
          course_id: c.id,
          concept_id: "conditional",
          title: "old note",
          body: "retained",
          updated_at: "2026-10-14",
        },
      ],
    };
    expect(
      (await request("/import/preview", "POST", data, "new-owner")).status,
    ).toBe(200);
    const imported = await request(
      "/import",
      "POST",
      { data, confirm: true },
      "new-owner",
    );
    expect(imported.status).toBe(200);
    const ids = (
      (await imported.json()) as { courseIds: Record<string, string> }
    ).courseIds;
    expect(ids[c.id]).not.toBe(c.id);
    const restored = (await (
      await request(`/courses/${ids[c.id]}`, "GET", undefined, "new-owner")
    ).json()) as { course: any };
    expect(restored.course.state.events[0]).toMatchObject({
      source: "legacy",
      assistance: 2,
      occurredAt: "2026-10-14T10:00:00.000Z",
    });
    expect(restored.course.state.concepts.conditional.mastery).toBe(0);
    expect(
      await (
        await request(
          `/courses/${ids[c.id]}/notes`,
          "GET",
          undefined,
          "new-owner",
        )
      ).text(),
    ).toContain("old note");
    expect(
      (await request(`/courses/${ids[c.id]}`, "GET", undefined, "original"))
        .status,
    ).toBe(404);
  });
  it("invalid later courses cannot leave an earlier course partially imported", async () => {
    const c = await sample();
    const full = (await (await request(`/courses/${c.id}`)).json()) as {
      course: any;
    };
    const data = {
      format: "personal-learning",
      version: 2,
      courses: [
        full.course,
        { id: "invalid", title: "bad", concepts: [], state: {} },
      ],
    };
    expect(
      (await request("/import", "POST", { data, confirm: true }, "importer"))
        .status,
    ).toBe(400);
    expect(
      await (await request("/courses", "GET", undefined, "importer")).json(),
    ).toMatchObject({ courses: [] });
  });
  it("daily challenge grants exactly one reward, and reflection counts for streak", async () => {
    const c = await sample();
    t.db
      .prepare(
        "INSERT INTO activities(id,user_id,course_id,kind,day,xp,coins,created_at) VALUES(?,?,?,'reflection',?,15,5,?)",
      )
      .run(
        "reflection-01",
        "learner",
        c.id,
        new Date().toISOString().slice(0, 10),
        new Date().toISOString(),
      );
    const a = (await (await request("/rewards")).json()) as { rewards: any };
    const b = (await (await request("/rewards")).json()) as { rewards: any };
    expect(b.rewards.xp).toBe(a.rewards.xp);
    expect(b.rewards.challenges.dailyComplete).toBe(true);
    expect(b.rewards.streak).toBe(1);
  });
  it("teaching exposure uses actual strategy and never verifies a response", async () => {
    const c = await sample();
    t.env.DEEPSEEK_API_KEY = "test-model";
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string | URL | Request, init?: RequestInit) => {
          calls.push({
            url: String(url),
            body: JSON.parse(String(init?.body)),
          });
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                title: "new explanation",
                position: "course",
                purpose: "test",
                connections: [],
                body: "Connected explanation.",
                cards: [],
                sourceIds: [],
              }),
              usage: { input_tokens: 100, output_tokens: 100 },
            }),
            { status: 200 },
          );
        },
      ),
    );
    const r = await request(`/courses/${c.id}/teach`, "POST", {
      conceptId: "conditional",
      kind: "explain",
      request: "explain",
      strategy: "example",
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("event: lesson");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/responses$/);
    expect(calls[0].body.model).toBe("deepseek-flash");
    const full = (await (await request(`/courses/${c.id}`)).json()) as {
      course: any;
    };
    expect(full.course.state.concepts.conditional).toMatchObject({
      mastery: 1,
      lastVerified: null,
    });
    expect(full.course.state.events.at(-1).strategy).toBe("example");
  });
  it("model policy cannot be overridden to a non-Flash model", async () => {
    const c = await sample();
    t.env.DEEPSEEK_API_KEY = "test-model";
    // Even if a deployment tries to inject another model name, the server
    // constant remains the only value sent to DeepSeek.
    (t.env as unknown as Record<string, string>).DEEPSEEK_MODEL =
      "deepseek-v4-pro";
    let sent: any;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "new explanation",
              position: "course",
              purpose: "test",
              connections: [],
              body: "Connected explanation.",
              cards: [],
              sourceIds: [],
            }),
            usage: { input_tokens: 100, output_tokens: 100 },
          }),
          { status: 200 },
        );
      }),
    );
    const r = await request(`/courses/${c.id}/teach`, "POST", {
      conceptId: "conditional",
      kind: "explain",
      request: "explain",
      strategy: "example",
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("event: lesson");
    expect(sent.model).toBe("deepseek-flash");
  });
  it("retries once with Flash when structured output is invalid", async () => {
    const c = await sample();
    t.env.DEEPSEEK_API_KEY = "test-model";
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        const output_text =
          calls === 1
            ? JSON.stringify({ title: "incomplete" })
            : JSON.stringify({
                title: "new explanation",
                position: "course",
                purpose: "test",
                connections: [],
                body: "Connected explanation.",
                cards: [],
                sourceIds: [],
              });
        return new Response(
          JSON.stringify({
            output_text,
            usage: { input_tokens: 100, output_tokens: 100 },
          }),
          { status: 200 },
        );
      }),
    );
    const r = await request(`/courses/${c.id}/teach`, "POST", {
      conceptId: "conditional",
      kind: "explain",
      request: "explain",
      strategy: "example",
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("event: lesson");
    expect(calls).toBe(2);
  });
});

describe("operational boundaries", () => {
  it("storage preallocation rejects a concurrent quota overrun", async () => {
    await request("/me");
    t.db
      .prepare("INSERT INTO settings(key,value,updated_at) VALUES('quota',?,?)")
      .run(JSON.stringify({ storageBytes: 10 }), new Date().toISOString());
    const result = await Promise.allSettled([
      putPrivateObject(t.env, "learner", "learner/a", new Uint8Array(8)),
      putPrivateObject(t.env, "learner", "learner/b", new Uint8Array(8)),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await usageFor(t.env, "learner")).storageBytes).toBe(8);
  });
  it("a signed reminder unsubscribe disables only learning email", async () => {
    await request("/me");
    t.env.BETTER_AUTH_SECRET = "a".repeat(48);
    const url = await unsubscribeURL(t.env, "learner");
    const bad = await app.request(
      url.replace(/token=[a-f0-9]+/, "token=" + "0".repeat(64)),
      { method: "POST" },
      t.env,
    );
    expect(bad.status).toBe(400);
    const r = await app.request(url, { method: "POST" }, t.env);
    expect(r.status).toBe(200);
    const profile = t.db
      .prepare("SELECT reminders FROM profiles WHERE user_id=?")
      .get("learner") as { reminders: string };
    expect(JSON.parse(profile.reminders).email).toBe(false);
  });
  it("repeated Cron sends only one in-app reminder per local day", async () => {
    await request("/me");
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    t.db.prepare("UPDATE profiles SET reminders=? WHERE user_id=?").run(
      JSON.stringify({
        enabled: true,
        time,
        timezone: "Asia/Singapore",
        quietStart: "00:00",
        quietEnd: "00:00",
        email: false,
        push: false,
      }),
      "learner",
    );
    // Use a nonempty quiet interval which does not include the current time.
    const hour = Number(time.slice(0, 2)),
      start = String((hour + 2) % 24).padStart(2, "0") + ":00",
      end = String((hour + 3) % 24).padStart(2, "0") + ":00";
    t.db
      .prepare(
        "UPDATE profiles SET reminders=json_set(reminders,'$.quietStart',?,'$.quietEnd',?) WHERE user_id=?",
      )
      .run(start, end, "learner");
    await processDueJobs(t.env);
    await processDueJobs(t.env);
    expect(
      (
        t.db.prepare("SELECT COUNT(*) n FROM notifications").get() as {
          n: number;
        }
      ).n,
    ).toBe(1);
  });
});
