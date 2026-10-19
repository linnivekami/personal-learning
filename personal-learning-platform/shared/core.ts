import policy from "./policy.json";
import type {
  Concept,
  ConceptState,
  LearningEvent,
  LearningState,
  NextAction,
  Strategy,
  Goal,
  TeachingDecision,
  RewardState,
} from "./types";
export { policy };
const DAY = 86400000;
export function emptyState(
  goal: Goal = "mastery",
  strategy: Strategy = "framework",
): LearningState {
  return {
    revision: 0,
    goal,
    strategy,
    concepts: {},
    events: [],
    nextAction: null,
  };
}
export function blankConcept(id: string): ConceptState {
  return {
    conceptId: id,
    mastery: 0,
    lastVerified: null,
    reviewStep: 0,
    nextReview: null,
    weaknesses: [],
    effectiveStrategies: {},
    failedStrategies: {},
  };
}
// Review capability is explicit: recalling a definition cannot certify application.
export function eventAbilities(e: LearningEvent): string[] {
  if (e.ability === "review") return e.reviewedAbilities ?? [];
  return [e.ability];
}
const hasEvidence = (e: LearningEvent) =>
  e.ability !== "review" || !!e.reviewedAbilities?.length;
const trusted = (e: LearningEvent) =>
  !["legacy", "self_report"].includes(e.source);
const independent = (e: LearningEvent) =>
  trusted(e) &&
  e.source !== "objective" &&
  e.assistance === 0 &&
  e.ability !== "exposure";
const coreAbility = (a: string) =>
  ["variation", "transfer"].includes(a) ? "application" : a;
function deriveEvidence(events: LearningEvent[]) {
  let level = 0,
    lastLearning = -Infinity;
  const seen = new Set<string>(),
    retained = new Set<string>();
  let cap = 5;
  const gaps: {
    text: string;
    abilities: string[];
    at: number;
    downgraded: boolean;
  }[] = [];
  for (const e of [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  )) {
    if (!trusted(e) || !hasEvidence(e) || e.outcome === "insufficient")
      continue;
    const at = Date.parse(e.occurredAt),
      abilities = eventAbilities(e).map(coreAbility);
    const delayed =
      at - lastLearning >= policy.mastery.minimumRetentionDays * DAY &&
      Number.isFinite(lastLearning);
    const free = independent(e);
    level = Math.max(level, 1);
    if (e.outcome === "demonstrated" && free) {
      if (delayed) for (const a of abilities) if (seen.has(a)) retained.add(a);
      for (const a of abilities) seen.add(a);
      // Recognition and recall do not meet the explanation/application gate.
      const hasBase = seen.has("explanation") || seen.has("application");
      let earned = hasBase ? 2 : 1;
      if (
        seen.has("explanation") &&
        seen.has("application") &&
        retained.has("explanation") &&
        retained.has("application")
      ) {
        earned = 3;
        if (seen.has("variation-evidence")) earned = 4;
        if (earned === 4 && seen.has("transfer-evidence")) earned = 5;
      }
      if (eventAbilities(e).includes("variation"))
        seen.add("variation-evidence");
      if (eventAbilities(e).includes("transfer")) seen.add("transfer-evidence");
      if (earned >= 3 && seen.has("variation-evidence"))
        earned = seen.has("transfer-evidence") ? 5 : 4;
      for (let i = gaps.length - 1; i >= 0; i--) {
        const g = gaps[i];
        if (
          g.abilities.length &&
          g.abilities.every((a) => abilities.includes(a)) &&
          (!g.downgraded ||
            (delayed && at - g.at >= policy.mastery.minimumRetentionDays * DAY))
        )
          gaps.splice(i, 1);
      }
      if (!gaps.some((g) => g.downgraded)) cap = 5;
      level = Math.min(Math.max(level, earned), cap);
    }
    if (e.outcome === "not_demonstrated" && e.misconception) {
      const reliable =
        free &&
        delayed &&
        /^(concept|prerequisite|reasoning|application):/.test(e.misconception);
      if (reliable) {
        cap = Math.max(1, level - 1);
        level = cap;
      }
      gaps.push({ text: e.misconception, abilities, at, downgraded: reliable });
    }
    // Review itself is retrieval; consecutive parts of the same review can cover
    // distinct abilities. Teaching, hints and new learning restart the interval.
    if (
      e.ability === "exposure" ||
      e.assistance > 0 ||
      (free && e.outcome === "demonstrated" && e.ability !== "review")
    )
      lastLearning = at;
  }
  return {
    mastery: level,
    weaknesses: [...new Set(gaps.map((g) => g.text))],
    seen,
    retained,
    capped: gaps.some((g) => g.downgraded),
    lastLearning,
  };
}
export function masteryFor(events: LearningEvent[]): number {
  if (new Set(events.map((e) => e.conceptId)).size > 1)
    throw new Error("Mastery evidence must belong to one concept.");
  return deriveEvidence(events).mastery;
}
export interface MasteryProgress {
  level: number;
  independent: { explanation: boolean; application: boolean };
  retained: { explanation: boolean; application: boolean };
  variation: boolean;
  transfer: boolean;
  /** A reliable delayed failure lowered the ceiling until it is re-proven. */
  capped: boolean;
  weaknesses: string[];
  /** Earliest moment an unassisted retest can count as retention. */
  retestFrom: string | null;
}
// Read-only explanation of the cumulative gates for one concept's events;
// the level is the same derivation masteryFor and applyEvent use.
export function masteryProgress(events: LearningEvent[]): MasteryProgress {
  const d = deriveEvidence(events);
  return {
    level: d.mastery,
    independent: {
      explanation: d.seen.has("explanation"),
      application: d.seen.has("application"),
    },
    retained: {
      explanation: d.retained.has("explanation"),
      application: d.retained.has("application"),
    },
    variation: d.seen.has("variation-evidence"),
    transfer: d.seen.has("transfer-evidence"),
    capped: d.capped,
    weaknesses: d.weaknesses,
    retestFrom: Number.isFinite(d.lastLearning)
      ? new Date(
          d.lastLearning + policy.mastery.minimumRetentionDays * DAY,
        ).toISOString()
      : null,
  };
}
export function recommend(
  concept: Concept,
  state: LearningState,
): TeachingDecision {
  const s = state.concepts[concept.id] ?? blankConcept(concept.id);
  const blocked =
    concept.prerequisites.find(
      (id) => (state.concepts[id]?.mastery ?? 0) < 2,
    ) ?? null;
  const recent = state.events
    .filter(
      (e) =>
        e.conceptId === concept.id &&
        trusted(e) &&
        e.ability !== "exposure" &&
        e.outcome !== "insufficient",
    )
    .slice(-2);
  if (blocked)
    return {
      strategy: "example",
      reason: "先补足阻碍当前理解的前置关系，再回到本主题。",
      needsDiagnosis: true,
      prerequisiteId: blocked,
    };
  if (
    recent.length === 2 &&
    recent.every(
      (e) =>
        e.outcome === "not_demonstrated" &&
        e.strategy === state.strategy &&
        !e.misconception?.startsWith("calculation:"),
    )
  )
    return {
      strategy: state.strategy === "framework" ? "example" : "framework",
      reason: "同一方法连续未解决障碍，切换表示方式并重新建立概念联系。",
      needsDiagnosis: true,
      prerequisiteId: null,
    };
  const best = Object.entries(s.effectiveStrategies).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (best && best[1] >= 2)
    return {
      strategy: best[0] as Strategy,
      reason: "这种讲解方法曾帮助你在本知识点独立作答，优先沿用并继续观察。",
      needsDiagnosis: false,
      prerequisiteId: null,
    };
  return {
    strategy: state.strategy,
    reason:
      state.strategy === "framework"
        ? "先建立整体位置、问题和关系，再逐层展开。"
        : state.strategy === "example"
          ? "先用具体情境建立直觉，再连接原理和框架。"
          : "先通过区分性问题确认已有理解，再安排讲解。",
    needsDiagnosis: s.mastery === 0 && state.strategy === "diagnostic",
    prerequisiteId: null,
  };
}
export function chooseNext(
  concepts: Concept[],
  state: LearningState,
  now: string,
): NextAction | null {
  if (!concepts.length) return null;
  const candidates = concepts
    .map((c, i) => {
      const s = state.concepts[c.id] ?? blankConcept(c.id);
      const gap = c.prerequisites.some(
        (id) => (state.concepts[id]?.mastery ?? 0) < 2,
      );
      const overdue = s.nextReview !== null && s.nextReview <= now;
      const rank = s.weaknesses.length
        ? 100
        : overdue
          ? 90
          : s.mastery < 2
            ? state.goal === "exam"
              ? 85
              : 75
            : s.mastery < 3
              ? 65
              : state.goal === "mastery" && s.mastery < 5
                ? 45
                : 10;
      const daysToExam = state.examDate
        ? (Date.parse(state.examDate) - Date.parse(now)) / DAY
        : Infinity;
      const examPriority =
        state.goal === "exam" &&
        daysToExam >= 0 &&
        daysToExam <= 14 &&
        s.mastery >= 1 &&
        s.mastery < 3
          ? 30
          : 0;
      return { c, s, score: rank + examPriority - (gap ? 50 : 0) - i / 100 };
    })
    .sort((a, b) => b.score - a.score);
  const { c, s } = candidates[0];
  const review = s.nextReview !== null && s.nextReview <= now;
  const kind = review
    ? "review"
    : s.mastery === 0
      ? "explain"
      : s.weaknesses.length
        ? "diagnose"
        : s.mastery >= 3
          ? "transfer"
          : "practice";
  const labels = {
    review: "间隔复习",
    explain: "建立知识框架",
    diagnose: "定位并修复障碍",
    transfer: "新情境应用",
    practice: "独立练习",
  };
  return {
    id: `next:${c.id}:${state.revision}:${kind}`,
    conceptId: c.id,
    kind,
    title: `${labels[kind]}：${c.title}`,
    reason: review
      ? "复习已到期，用无提示的新题确认保持。"
      : s.weaknesses.length
        ? s.weaknesses[0]
        : s.mastery === 0
          ? c.purpose
          : "根据当前证据补足下一项能力。",
    estimatedMinutes: state.goal === "habit" ? 5 : 10,
    completed: false,
  };
}
export function applyEvent(
  state: LearningState,
  event: LearningEvent,
  concepts: Concept[],
): LearningState {
  if (
    state.events.some(
      (e) => e.id === event.id || e.attemptId === event.attemptId,
    )
  )
    return state;
  if (!concepts.some((c) => c.id === event.conceptId))
    throw new Error("Unknown concept");
  const events = [...state.events, event];
  const old = state.concepts[event.conceptId] ?? blankConcept(event.conceptId);
  const scoped = events.filter((e) => e.conceptId === event.conceptId);
  const derived = deriveEvidence(scoped);
  const observable = trusted(event) && hasEvidence(event);
  const valid =
    observable && independent(event) && event.outcome === "demonstrated";
  const effective = { ...old.effectiveStrategies },
    failed = { ...old.failedStrategies };
  if (valid) effective[event.strategy] = (effective[event.strategy] ?? 0) + 1;
  if (observable && event.outcome === "not_demonstrated")
    failed[event.strategy] = (failed[event.strategy] ?? 0) + 1;
  const reviewStep = valid
    ? Math.min(old.reviewStep + (event.ability === "review" ? 1 : 0), 3)
    : old.reviewStep;
  const failure = observable && event.outcome === "not_demonstrated";
  let nextReview = valid
    ? new Date(
        Date.parse(event.occurredAt) +
          policy.mastery.reviewIntervalsDays[reviewStep] * DAY,
      ).toISOString()
    : failure
      ? new Date(Date.parse(event.occurredAt) + 2 * DAY).toISOString()
      : old.nextReview;
  const mastery =
    observable && event.outcome !== "insufficient"
      ? derived.mastery
      : old.mastery;
  const weaknesses = observable ? derived.weaknesses : old.weaknesses;
  if (
    valid &&
    weaknesses.length &&
    old.nextReview &&
    (!nextReview || old.nextReview < nextReview)
  )
    nextReview = old.nextReview;
  const next: LearningState = {
    ...state,
    revision: state.revision + 1,
    events,
    concepts: {
      ...state.concepts,
      [event.conceptId]: {
        ...old,
        mastery,
        lastVerified:
          !observable ||
          event.ability === "exposure" ||
          event.outcome === "insufficient"
            ? old.lastVerified
            : event.occurredAt,
        reviewStep,
        nextReview,
        weaknesses,
        effectiveStrategies: effective,
        failedStrategies: failed,
      },
    },
  };
  next.nextAction = chooseNext(concepts, next, event.occurredAt);
  return next;
}
export function effectiveEvent(e: LearningEvent): boolean {
  return (
    hasEvidence(e) &&
    e.ability !== "exposure" &&
    e.outcome !== "insufficient" &&
    !["self_report", "legacy"].includes(e.source)
  );
}
export function rewardState(
  events: LearningEvent[],
  timezone = "Asia/Singapore",
  owned: string[] = [],
  equippedTheme = "forest",
  equippedAvatar = "seed",
): RewardState {
  const ids = new Set<string>();
  const unique = events.filter((e) => {
    if (ids.has(e.attemptId) || !effectiveEvent(e)) return false;
    ids.add(e.attemptId);
    return true;
  });
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const days = [
    ...new Set(unique.map((e) => fmt.format(new Date(e.occurredAt)))),
  ].sort();
  const xp = unique.reduce(
    (n, e) =>
      n +
      (e.ability === "review"
        ? policy.rewards.reviewXp
        : e.ability === "explanation"
          ? policy.rewards.explanationXp
          : policy.rewards.attemptXp),
    0,
  );
  let streak = 0;
  let d = new Date();
  if (!days.includes(fmt.format(d))) d = new Date(d.getTime() - DAY);
  while (days.includes(fmt.format(d))) {
    streak++;
    d = new Date(d.getTime() - DAY);
  }
  const badges = [
    ...(unique.length ? ["first-step"] : []),
    ...(days.length >= 7 ? ["seven-days"] : []),
    ...(unique.some((e) => e.ability === "review") ? ["remember"] : []),
    ...(unique.some(
      (e) => e.ability === "transfer" && e.outcome === "demonstrated",
    )
      ? ["connector"]
      : []),
    ...(unique.filter((e) => e.assistance === 0 && e.outcome === "demonstrated")
      .length >= 10
      ? ["independent"]
      : []),
  ];
  return {
    xp,
    coins: unique.length * policy.rewards.coinsPerEffectiveTask,
    level: 1 + Math.floor(xp / policy.rewards.levelXp),
    streak,
    effectiveDays: days,
    badges,
    owned: ["forest", "seed", ...owned],
    equippedTheme,
    equippedAvatar,
  };
}
export function billableCharacters(text: string) {
  return [...text].reduce(
    (n, c) => n + (/[\u3400-\u9fff]/u.test(c) ? 2 : 1),
    0,
  );
}
export function costFen(input: number, output: number) {
  return Math.ceil(
    (input * policy.pricing.inputFenPerMillion +
      output * policy.pricing.outputFenPerMillion) /
      1e6,
  );
}
export function localDay(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
