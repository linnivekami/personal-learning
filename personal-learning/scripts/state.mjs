#!/usr/bin/env node
import {
  readFile,
  writeFile,
  rename,
  copyFile,
  open,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import {
  applyEvent,
  emptyState,
  blankConcept,
  chooseNext,
  masteryFor,
  eventSchema,
  conceptSchema,
} from "../shared/engine.mjs";
const [cmd, ...args] = process.argv.slice(2),
  flags = Object.fromEntries(
    args
      .map((v, i) =>
        v.startsWith("--")
          ? [
              v.slice(2),
              args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true,
            ]
          : null,
      )
      .filter(Boolean),
  );
const read = async (path) =>
  JSON.parse(await readFile(resolve(String(path)), "utf8"));
if (cmd === "grade") {
  const events = (await read(flags.events)).map((e) => eventSchema.parse(e));
  console.log(JSON.stringify({ mastery: masteryFor(events) }));
} else if (cmd === "apply") {
  const path = resolve(String(flags.state)),
    old = await read(path),
    concepts = (await read(flags.concepts)).map((c) => conceptSchema.parse(c)),
    event = eventSchema.parse(await read(flags.event));
  if (Number(flags.revision) !== old.revision)
    throw new Error(
      "Revision conflict: preview changes against the latest state.",
    );
  const next = applyEvent(old, event, concepts);
  console.log(
    JSON.stringify(
      {
        oldRevision: old.revision,
        newRevision: next.revision,
        concept: next.concepts[event.conceptId],
        nextAction: next.nextAction,
      },
      null,
      2,
    ),
  );
  if (flags.commit) {
    const lockPath = path + ".lock";
    const lock = await open(lockPath, "wx", 0o600).catch(() => {
      throw new Error(
        "State is locked by another writer; inspect the lock before retrying.",
      );
    });
    try {
      await lock.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        }),
      );
      const latest = await read(path);
      if (latest.revision !== old.revision)
        throw new Error("Revision conflict before commit");
      await copyFile(path, path + ".backup");
      const temp = path + ".pending";
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temp, path);
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
} else if (cmd === "audit") {
  const data = await read(flags.state),
    concepts = (await read(flags.concepts)).map((c) => conceptSchema.parse(c));
  let state = emptyState(data.goal, data.strategy);
  state.examDate = data.examDate ?? null;
  const asOf = String(flags["as-of"] ?? new Date().toISOString()),
    errors = [];
  for (const raw of data.events) {
    const event = eventSchema.parse(raw);
    if (event.occurredAt > asOf) errors.push(`future-event:${event.id}`);
    state = applyEvent(state, event, concepts);
  }
  if (state.revision !== data.revision) errors.push("revision");
  for (const concept of concepts) {
    const actual = state.concepts[concept.id] ?? blankConcept(concept.id),
      saved = data.concepts[concept.id] ?? blankConcept(concept.id);
    for (const field of [
      "mastery",
      "lastVerified",
      "reviewStep",
      "nextReview",
      "weaknesses",
      "effectiveStrategies",
      "failedStrategies",
    ])
      if (JSON.stringify(actual[field]) !== JSON.stringify(saved[field]))
        errors.push(`${concept.id}:${field}`);
  }
  const expected = chooseNext(concepts, state, asOf),
    saved = data.nextAction;
  for (const field of [
    "conceptId",
    "kind",
    "title",
    "reason",
    "estimatedMinutes",
    "completed",
  ])
    if ((expected?.[field] ?? null) !== (saved?.[field] ?? null))
      errors.push(`nextAction:${field}`);
  console.log(JSON.stringify({ ok: !errors.length, errors }));
  if (errors.length) process.exitCode = 1;
} else
  throw new Error(
    "Usage: state.mjs grade --events file | apply --state file --concepts file --event file --revision N [--commit] | audit --state file --concepts file",
  );
