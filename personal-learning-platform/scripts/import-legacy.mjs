import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(process.argv[2] ?? "../personal-learning"),
  output = resolve(process.argv[3] ?? "private/legacy-import.json");
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 20);
const courses = [];
for (const dir of (
  await readdir(resolve(root, "data/projects"), { withFileTypes: true })
)
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const files = {};
  for (const name of await readdir(resolve(root, "data/projects", dir.name)))
    if (/\.(md|json|jsonl)$/.test(name))
      files[name] = await readFile(
        resolve(root, "data/projects", dir.name, name),
        "utf8",
      );
  const text = files["state.md"];
  if (!text) continue;
  const concepts = [],
    states = {},
    historicalRows = [];
  let header = null;
  for (const [i, line] of text.split("\n").entries()) {
    if (!line.startsWith("|")) {
      if (line.trim()) header = null;
      continue;
    }
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((s) => s.trim());
    if (cells[0] === "Topic" && cells.some((c) => c.startsWith("Mastery"))) {
      header = cells;
      continue;
    }
    if (!header || /^[- :]+$/.test(cells[0])) continue;
    const mi = header.findIndex((c) => c.startsWith("Mastery"));
    if (!/^[0-5]$/.test(cells[mi]))
      throw new Error(`${dir.name}:${i + 1}: invalid mastery`);
    const id = `legacy-${hash(dir.name + ":" + cells[0])}`,
      evidence = cells[header.indexOf("Evidence")] ?? "",
      date = cells[header.indexOf("Last Verified")] ?? "";
    concepts.push({
      id,
      title: cells[0],
      purpose: "连接课程原始知识框架；在需要时核验当前能力。",
      summary: evidence,
      prerequisites: [],
      parentId: null,
      applications: [],
      sourceIds: [],
    });
    states[id] = {
      conceptId: id,
      mastery: 0,
      historicalMastery: Number(cells[mi]),
      pendingVerification: evidence.includes("待按")
        ? evidence
        : "历史文本证据完整保留；按当前结构化规则待核验",
      lastVerified: date === "-" || date === "—" ? null : date,
      reviewStep: 0,
      nextReview: null,
      weaknesses: [],
      effectiveStrategies: {},
      failedStrategies: {},
    };
    historicalRows.push({
      topic: cells[0],
      grade: Number(cells[mi]),
      evidence,
      lastVerified: date,
      datePrecision: "original-text",
      source: `data/projects/${dir.name}/state.md`,
      line: i + 1,
      raw: line,
    });
  }
  courses.push({
    id: `legacy-${dir.name}`,
    title: text.match(/Course \/ Domain:\s*(.+)/)?.[1]?.trim() ?? dir.name,
    description: `从 ${dir.name} 迁移；历史分数待核验。`,
    goal: "mastery",
    language: "mixed",
    strategy: "framework",
    concepts,
    state: {
      revision: 0,
      goal: "mastery",
      strategy: "framework",
      concepts: states,
      events: [],
      nextAction: null,
    },
    legacy_data: {
      format: "personal-learning-markdown",
      project: dir.name,
      files,
      historicalRows,
      knowledgeMap: files["knowledge-map.md"],
      originalNextAction: text.split("## Next Action")[1] ?? "",
    },
  });
}
const legacyProfile = await readFile(
  resolve(root, "data/learner-profile.md"),
  "utf8",
);
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      format: "personal-learning",
      version: 2,
      policy: "2.0.0",
      exportedAt: new Date().toISOString(),
      legacyProfile,
      courses,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `Prepared ${courses.length} private courses, ${courses.reduce((n, c) => n + c.concepts.length, 0)} historical rows. No invented timestamps or new mastery. ${relative(process.cwd(), output)}`,
);
