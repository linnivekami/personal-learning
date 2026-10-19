import { z } from "zod";
export const goalSchema = z.enum(["mastery", "exam", "habit"]);
export const strategySchema = z.enum(["framework", "example", "diagnostic"]);
export type Goal = z.infer<typeof goalSchema>;
export type Strategy = z.infer<typeof strategySchema>;
export type Language = "zh" | "en" | "mixed";
export const sourceSchema = z.object({
  id: z.string(),
  materialId: z.string().optional(),
  title: z.string(),
  page: z.number().int().positive().optional(),
  url: z.string().url().optional(),
  excerpt: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceSchema>;
export const conceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string(),
  summary: z.string(),
  prerequisites: z.array(z.string()),
  parentId: z.string().nullable(),
  applications: z.array(z.string()),
  sourceIds: z.array(z.string()),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type Concept = z.infer<typeof conceptSchema>;
export const eventSchema = z.object({
  id: z.string().min(8),
  conceptId: z.string(),
  attemptId: z.string(),
  ability: z.enum([
    "exposure",
    "explanation",
    "recall",
    "application",
    "variation",
    "transfer",
    "review",
  ]),
  outcome: z.enum([
    "demonstrated",
    "partial",
    "not_demonstrated",
    "insufficient",
  ]),
  assistance: z.number().int().min(0).max(5),
  occurredAt: z.string().datetime(),
  evidence: z.string(),
  confidence: z.number().min(1).max(10).nullable(),
  strategy: strategySchema,
  source: z.enum(["tutor", "objective", "legacy", "self_report"]),
  misconception: z.string().optional(),
  assessmentId: z.string().optional(),
  reviewedAbilities: z
    .array(
      z.enum(["explanation", "application", "variation", "transfer", "recall"]),
    )
    .optional(),
});
export type LearningEvent = z.infer<typeof eventSchema>;
export interface ConceptState {
  conceptId: string;
  mastery: number;
  historicalMastery?: number;
  pendingVerification?: string;
  lastVerified: string | null;
  reviewStep: number;
  nextReview: string | null;
  weaknesses: string[];
  effectiveStrategies: Partial<Record<Strategy, number>>;
  failedStrategies: Partial<Record<Strategy, number>>;
}
export interface NextAction {
  id: string;
  conceptId: string;
  kind: "diagnose" | "explain" | "practice" | "review" | "transfer";
  title: string;
  reason: string;
  estimatedMinutes: number;
  completed: boolean;
}
export interface LearningState {
  examDate?: string | null;
  revision: number;
  goal: Goal;
  strategy: Strategy;
  concepts: Record<string, ConceptState>;
  events: LearningEvent[];
  nextAction: NextAction | null;
}
export interface TeachingDecision {
  strategy: Strategy;
  reason: string;
  needsDiagnosis: boolean;
  prerequisiteId: string | null;
}
const optionSchema = z.object({ id: z.string(), text: z.string() });
export const cardSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "explanation",
    "choice",
    "multi_choice",
    "order",
    "match",
    "steps",
    "free",
    "formula",
    "image",
    "simulation",
    "python",
    "sql",
    "recall",
  ]),
  conceptId: z.string(),
  ability: z.enum([
    "explanation",
    "recall",
    "application",
    "variation",
    "transfer",
    "review",
  ]),
  title: z.string(),
  body: z.string(),
  difficulty: z.number().int().min(1).max(5),
  options: z.array(optionSchema).optional(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  starter: z.string().optional(),
  solution: z.string().optional(),
  rubric: z.array(z.string()).optional(),
  hints: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()),
  reviewedAbilities: z
    .array(
      z.enum(["explanation", "application", "variation", "transfer", "recall"]),
    )
    .optional(),
  teachingStrategy: strategySchema.optional(),
  plot: z
    .object({
      kind: z.enum(["linear", "quadratic", "normal", "compound"]),
      min: z.number(),
      max: z.number(),
      initial: z.number(),
      label: z.string(),
    })
    .optional(),
});
export type LearningCard = z.infer<typeof cardSchema>;
export const lessonSchema = z.object({
  title: z.string(),
  position: z.string(),
  purpose: z.string(),
  connections: z.array(z.string()),
  body: z.string(),
  cards: z.array(cardSchema).max(8),
  sourceIds: z.array(z.string()),
});
export type Lesson = z.infer<typeof lessonSchema>;
export const curriculumSchema = z.object({
  title: z.string(),
  overview: z.string(),
  concepts: z.array(conceptSchema).min(1).max(60),
});
export const evaluationSchema = z.object({
  outcome: z.enum([
    "demonstrated",
    "partial",
    "not_demonstrated",
    "insufficient",
  ]),
  feedback: z.string(),
  evidence: z.string(),
  errorType: z
    .enum([
      "concept",
      "prerequisite",
      "reasoning",
      "calculation",
      "recall",
      "application",
      "expression",
      "unknown",
    ])
    .nullable(),
  suggestedStrategy: strategySchema,
});
export interface Course {
  id: string;
  title: string;
  description: string;
  goal: Goal;
  language: Language;
  strategy: Strategy;
  examDate: string | null;
  concepts: Concept[];
  state: LearningState;
  createdAt: string;
}
export interface Note {
  id: string;
  courseId: string;
  conceptId: string | null;
  title: string;
  body: string;
  updatedAt: string;
}
export interface Material {
  id: string;
  courseId: string;
  name: string;
  mime: string;
  bytes: number;
  pages: number;
  status: "uploaded" | "processing" | "ready" | "partial" | "failed";
  error: string | null;
  createdAt: string;
}
export interface RewardState {
  challenges?: {
    day: string;
    week: string;
    weeklyGoal: number;
    weeklyProgress: number;
    dailyComplete: boolean;
    weeklyComplete: boolean;
  };
  xp: number;
  coins: number;
  level: number;
  streak: number;
  effectiveDays: string[];
  badges: string[];
  owned: string[];
  equippedTheme: string;
  equippedAvatar: string;
}
export const reminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1),
  email: z.boolean(),
  push: z.boolean(),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weeklyGoal: z.number().int().min(1).max(7),
});
export type ReminderSettings = z.infer<typeof reminderSchema>;
export interface AppUser {
  id: string;
  email: string;
  name: string;
  admin: boolean;
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  asrSeconds: number;
  ttsCharacters: number;
  materialPages: number;
  storageBytes: number;
}
export const noteSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(100000),
  conceptId: z.string().nullable(),
});
