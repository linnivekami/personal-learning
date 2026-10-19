import { describe, it, expect } from "vitest";
import {
  applyEvent,
  emptyState,
  masteryFor,
  masteryProgress,
  recommend,
  chooseNext,
  rewardState,
  billableCharacters,
  localDay,
  costFen,
} from "../shared/core";
import type { LearningEvent, Concept } from "../shared/types";
const concepts: Concept[] = [
  {
    id: "p",
    title: "条件概率",
    purpose: "说明条件改变参照范围",
    summary: "",
    parentId: null,
    prerequisites: [],
    applications: [],
    sourceIds: [],
  },
  {
    id: "b",
    title: "贝叶斯",
    purpose: "更新判断",
    summary: "",
    parentId: null,
    prerequisites: ["p"],
    applications: [],
    sourceIds: [],
  },
];
let counter = 0;
const event = (changes: Partial<LearningEvent> = {}): LearningEvent => ({
  id: `event-${++counter}`,
  attemptId: `attempt-${counter}`,
  conceptId: "p",
  ability: "application",
  outcome: "demonstrated",
  assistance: 0,
  occurredAt: "2026-10-14T10:00:00.000Z",
  evidence: "正确说明本次能力",
  confidence: null,
  strategy: "framework",
  source: "tutor",
  ...(changes.ability === "review"
    ? {
        reviewedAbilities: [
          "explanation",
          "application",
        ] as LearningEvent["reviewedAbilities"],
      }
    : {}),
  ...changes,
});
describe("cumulative evidence", () => {
  it("unknown is not failure", () => expect(masteryFor([])).toBe(0));
  it("insufficient evidence does not mean exposed or unable", () =>
    expect(masteryFor([event({ outcome: "insufficient" })])).toBe(0));
  it("exposure is familiarity", () =>
    expect(masteryFor([event({ ability: "exposure" })])).toBe(1));
  it("assisted success is not independent ability", () =>
    expect(masteryFor([event({ assistance: 2 })])).toBe(1));
  it("first independent application remains developing", () =>
    expect(masteryFor([event()])).toBe(2));
  it("first independent explanation remains developing", () =>
    expect(masteryFor([event({ ability: "explanation" })])).toBe(2));
  it("same-day variation cannot skip retention", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ ability: "variation" }),
      ]),
    ).toBe(2));
  it("transfer cannot skip missing explanation", () =>
    expect(
      masteryFor([
        event(),
        event({ ability: "transfer", occurredAt: "2026-10-18T10:00:00.000Z" }),
      ]),
    ).toBe(2));
  it("different first abilities days apart do not prove retention", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event({ occurredAt: "2026-10-18T10:00:00.000Z" }),
      ]),
    ).toBe(2));
  it("functional needs independent explanation, application and delayed evidence", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
      ]),
    ).toBe(3));
  it("retention boundary is two full days", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ ability: "review", occurredAt: "2026-10-16T09:59:59.000Z" }),
      ]),
    ).toBe(2));
  it("assisted delayed review does not prove retention", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({
          ability: "review",
          assistance: 1,
          occurredAt: "2026-10-18T10:00:00.000Z",
        }),
      ]),
    ).toBe(2));
  it("variation adds level four only after prerequisites", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ ability: "variation" }),
        event({ ability: "review", occurredAt: "2026-10-18T11:00:00.000Z" }),
      ]),
    ).toBe(4));
  it("cross-domain transfer adds level five cumulatively", () =>
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ ability: "variation" }),
        event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
        event({ ability: "transfer", occurredAt: "2026-10-18T11:00:00.000Z" }),
      ]),
    ).toBe(5));
  it("self-report does not confer mastery", () =>
    expect(masteryFor([event({ source: "self_report" })])).toBe(0));
  it("historical imports do not confer new mastery", () =>
    expect(masteryFor([event({ source: "legacy" })])).toBe(0));
});
describe("state loop", () => {
  it("an event atomically advances revision and next action", () => {
    const old = emptyState();
    old.nextAction = {
      id: "old",
      conceptId: "p",
      kind: "practice",
      title: "已完成的题",
      reason: "",
      estimatedMinutes: 10,
      completed: false,
    };
    const next = applyEvent(old, event(), concepts);
    expect(next.revision).toBe(1);
    expect(next.nextAction?.id).not.toBe("old");
    expect(next.concepts.p.mastery).toBe(2);
    expect(next.concepts.p.nextReview).toBe("2026-10-17T10:00:00.000Z");
    expect(old.revision).toBe(0);
  });
  it("replayed event is a no-op", () => {
    const e = event(),
      s = applyEvent(emptyState(), e, concepts);
    expect(applyEvent(s, e, concepts)).toBe(s);
  });
  it("replayed attempt with a new event ID is a no-op", () => {
    const e = event(),
      s = applyEvent(emptyState(), e, concepts);
    expect(applyEvent(s, { ...e, id: "different" }, concepts)).toBe(s);
  });
  it("unknown concepts cannot mutate state", () =>
    expect(() =>
      applyEvent(emptyState(), event({ conceptId: "elsewhere" }), concepts),
    ).toThrow());
  it("calculation mistakes preserve conceptual evidence", () => {
    let s = emptyState();
    for (const e of [
      event({ ability: "explanation" }),
      event(),
      event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
    ])
      s = applyEvent(s, e, concepts);
    const next = applyEvent(
      s,
      event({
        outcome: "not_demonstrated",
        misconception: "calculation:local arithmetic slip",
      }),
      concepts,
    );
    expect(next.concepts.p.mastery).toBe(3);
  });
  it("ambiguous expression does not downgrade mastery", () => {
    let s = applyEvent(emptyState(), event(), concepts);
    s = applyEvent(
      s,
      event({ outcome: "insufficient", misconception: "expression:unclear" }),
      concepts,
    );
    expect(s.concepts.p.mastery).toBe(2);
  });
  it("future review is not immediately due", () => {
    const s = applyEvent(emptyState(), event(), concepts);
    expect(chooseNext(concepts, s, "2026-10-14T11:00:00.000Z")?.kind).not.toBe(
      "review",
    );
  });
  it("due review becomes a task", () => {
    const s = applyEvent(emptyState(), event(), [concepts[0]]);
    expect(chooseNext([concepts[0]], s, "2026-10-18T10:00:00.000Z")?.kind).toBe(
      "review",
    );
  });
  it("goal modes do not change mastery rules", () => {
    for (const goal of ["mastery", "exam", "habit"] as const)
      expect(
        applyEvent(emptyState(goal), event(), concepts).concepts.p.mastery,
      ).toBe(2);
  });
});
describe("teaching decisions", () => {
  it("success breaks a run of failed explanations", () => {
    let s = emptyState();
    for (const outcome of [
      "not_demonstrated",
      "demonstrated",
      "not_demonstrated",
      "demonstrated",
    ] as const)
      s = applyEvent(s, event({ outcome }), concepts);
    expect(recommend(concepts[0], s).strategy).toBe("framework");
  });
  it("framework is the default", () =>
    expect(recommend(concepts[0], emptyState()).strategy).toBe("framework"));
  it("a blocking prerequisite is named", () =>
    expect(recommend(concepts[1], emptyState()).prerequisiteId).toBe("p"));
  it("two failures change representation", () => {
    let s = emptyState();
    s = applyEvent(s, event({ outcome: "not_demonstrated" }), concepts);
    s = applyEvent(s, event({ outcome: "not_demonstrated" }), concepts);
    expect(recommend(concepts[0], s).strategy).toBe("example");
  });
  it("effective methods are observed per concept", () => {
    let s = emptyState();
    s = applyEvent(s, event({ strategy: "example" }), concepts);
    s = applyEvent(s, event({ strategy: "example" }), concepts);
    expect(recommend(concepts[0], s).strategy).toBe("example");
  });
  it("a preference is not proof of ability", () => {
    const s = emptyState("mastery", "example");
    expect(s.concepts.p).toBeUndefined();
    expect(recommend(concepts[0], s).strategy).toBe("example");
  });
});
describe("multi-turn teaching contract", () => {
  const advanced = () => {
    let s = emptyState();
    for (const e of [
      event({ ability: "explanation" }),
      event(),
      event({ ability: "variation" }),
      event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
      event({ ability: "transfer", occurredAt: "2026-10-18T10:01:00.000Z" }),
    ])
      s = applyEvent(s, e, concepts);
    return s;
  };
  it("recognition and definition recall cannot certify free application", () => {
    expect(masteryFor([event({ source: "objective" })])).toBe(1);
    expect(masteryFor([event({ ability: "recall" })])).toBe(1);
  });
  it("a late hint restarts retention before the first functional claim", () => {
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({ assistance: 2, occurredAt: "2026-10-18T09:45:00.000Z" }),
        event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
      ]),
    ).toBe(2);
  });
  it("a definition review does not establish application retention", () => {
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({
          ability: "review",
          reviewedAbilities: ["recall"],
          occurredAt: "2026-10-18T10:00:00.000Z",
        }),
      ]),
    ).toBe(2);
  });
  it("reliable delayed failure drops one level and assisted repair cannot restore it", () => {
    let s = advanced();
    expect(s.concepts.p.mastery).toBe(5);
    s = applyEvent(
      s,
      event({
        ability: "review",
        outcome: "not_demonstrated",
        misconception: "concept:denominator",
        occurredAt: "2026-10-22T10:00:00.000Z",
      }),
      concepts,
    );
    expect(s.concepts.p.mastery).toBe(4);
    expect(s.concepts.p.nextReview).toBe("2026-10-24T10:00:00.000Z");
    s = applyEvent(
      s,
      event({ assistance: 2, occurredAt: "2026-10-22T10:05:00.000Z" }),
      concepts,
    );
    expect(s.concepts.p.mastery).toBe(4);
    s = applyEvent(
      s,
      event({ ability: "recall", occurredAt: "2026-10-22T10:10:00.000Z" }),
      concepts,
    );
    expect(s.concepts.p.mastery).toBe(4);
    expect(s.concepts.p.weaknesses).toContain("concept:denominator");
  });
  it("immediate same-capability success cannot erase a failed retention interval", () => {
    let s = advanced();
    s = applyEvent(
      s,
      event({
        ability: "review",
        reviewedAbilities: ["application"],
        outcome: "not_demonstrated",
        misconception: "application:denominator",
        occurredAt: "2026-10-22T10:00:00.000Z",
      }),
      concepts,
    );
    s = applyEvent(
      s,
      event({
        ability: "review",
        reviewedAbilities: ["application"],
        occurredAt: "2026-10-22T10:05:00.000Z",
      }),
      concepts,
    );
    expect(s.concepts.p.mastery).toBe(4);
    expect(s.concepts.p.weaknesses).toContain("application:denominator");
    expect(s.concepts.p.nextReview).toBe("2026-10-24T10:00:00.000Z");
    s = applyEvent(
      s,
      event({ ability: "recall", occurredAt: "2026-10-22T10:06:00.000Z" }),
      concepts,
    );
    expect(s.concepts.p.nextReview).toBe("2026-10-24T10:00:00.000Z");
  });
  it("an empty review scope neither certifies nor downgrades nor defers review", () => {
    const before = advanced(),
      next = applyEvent(
        before,
        event({
          ability: "review",
          reviewedAbilities: [],
          outcome: "not_demonstrated",
          misconception: "concept:unknown scope",
          occurredAt: "2026-10-22T10:00:00.000Z",
        }),
        concepts,
      );
    expect(next.concepts.p).toEqual(before.concepts.p);
  });
  it("a delayed compound review can record genuine variation coverage", () => {
    expect(
      masteryFor([
        event({ ability: "explanation" }),
        event(),
        event({
          ability: "review",
          reviewedAbilities: ["explanation", "variation"],
          occurredAt: "2026-10-18T10:00:00.000Z",
        }),
      ]),
    ).toBe(4);
  });
  it("exposure records familiarity without changing verification or rewards", () => {
    const s = applyEvent(
      emptyState(),
      event({ ability: "exposure" }),
      concepts,
    );
    expect(s.concepts.p.lastVerified).toBeNull();
    expect(s.concepts.p.mastery).toBe(1);
    expect(rewardState(s.events).xp).toBe(0);
  });
  it("legacy history changes neither strategies, review nor rewards", () => {
    const s = applyEvent(emptyState(), event({ source: "legacy" }), concepts);
    expect(s.concepts.p.effectiveStrategies).toEqual({});
    expect(s.concepts.p.nextReview).toBeNull();
    expect(s.concepts.p.lastVerified).toBeNull();
    expect(rewardState(s.events).xp).toBe(0);
  });
});
describe("rewards and billing", () => {
  it("browsing grants no XP", () =>
    expect(rewardState([event({ ability: "exposure" })]).xp).toBe(0));
  it("duplicate attempts grant no duplicate reward", () => {
    const e = event();
    expect(rewardState([e, { ...e, id: "copy" }]).xp).toBe(20);
  });
  it("assisted participation can earn effort rewards", () =>
    expect(rewardState([event({ assistance: 3 })]).xp).toBe(20));
  it("self-reported mastery grants no XP", () =>
    expect(rewardState([event({ source: "self_report" })]).xp).toBe(0));
  it("confidence cannot increase mastery", () =>
    expect(masteryFor([event({ confidence: 10 })])).toBe(2));
  it("Chinese TTS characters count twice", () =>
    expect(billableCharacters("你好 abc!")).toBe(9));
  it("model estimates round up to whole fen", () =>
    expect(costFen(40000, 6000)).toBe(13));
  it("local quota dates follow the user timezone", () => {
    expect(localDay(new Date("2026-10-18T20:00:00Z"), "Asia/Singapore")).toBe(
      "2026-10-19",
    );
    expect(localDay(new Date("2026-10-18T20:00:00Z"), "America/New_York")).toBe(
      "2026-10-18",
    );
  });
});

describe("mastery progress explanation", () => {
  it("names the missing gate and the earliest retest", () => {
    const p = masteryProgress([event({ ability: "explanation" }), event()]);
    expect(p.level).toBe(2);
    expect(p.independent).toEqual({ explanation: true, application: true });
    expect(p.retained).toEqual({ explanation: false, application: false });
    expect(p.retestFrom).toBe("2026-10-16T10:00:00.000Z");
  });
  it("agrees with masteryFor after a delayed review", () => {
    const events = [
      event({ ability: "explanation" }),
      event(),
      event({ ability: "variation" }),
      event({ ability: "review", occurredAt: "2026-10-18T11:00:00.000Z" }),
    ];
    const p = masteryProgress(events);
    expect(p.level).toBe(masteryFor(events));
    expect(p.retained).toEqual({ explanation: true, application: true });
    expect(p.variation).toBe(true);
    expect(p.transfer).toBe(false);
  });
  it("ignores assisted and self-reported work for the gates", () => {
    const p = masteryProgress([
      event({ assistance: 2 }),
      event({ source: "self_report", ability: "explanation" }),
    ]);
    expect(p.level).toBe(1);
    expect(p.independent).toEqual({ explanation: false, application: false });
  });
  it("marks a reliable delayed failure as capped", () => {
    const p = masteryProgress([
      event({ ability: "explanation" }),
      event(),
      event({ ability: "review", occurredAt: "2026-10-18T10:00:00.000Z" }),
      event({
        outcome: "not_demonstrated",
        misconception: "concept:confuses the reference set",
        occurredAt: "2026-10-21T10:00:00.000Z",
      }),
    ]);
    expect(p.level).toBe(2);
    expect(p.capped).toBe(true);
    expect(p.weaknesses).toEqual(["concept:confuses the reference set"]);
  });
});
