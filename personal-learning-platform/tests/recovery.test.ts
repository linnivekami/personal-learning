import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { testEnvironment } from "./support";
import { app } from "../server/app";
import { enqueue, processJob } from "../server/jobs";
describe("encrypted recovery drill", () => {
  it("decrypts an actual backup and restores a new empty migrated database", async () => {
    const original = testEnvironment(),
      recovered = testEnvironment(),
      folder = mkdtempSync(join(tmpdir(), "pl-recovery-"));
    const key = "synthetic-recovery-test-key-with-no-real-secrets";
    original.env.BETTER_AUTH_SECRET = key;
    try {
      const response = await app.request(
        "https://learning.test/api/v1/courses/sample",
        {
          method: "POST",
          headers: {
            "oai-authenticated-user-id": "learner",
            "oai-authenticated-user-email": "learner@learning.test",
          },
        },
        original.env,
      );
      expect(response.status).toBe(201);
      const { course } = (await response.json()) as { course: { id: string } };
      original.db
        .prepare(
          "INSERT INTO notes(id,user_id,course_id,title,body,updated_at) VALUES('note','learner',?,?,?,?)",
        )
        .run(
          course.id,
          "Learner's note",
          "Retain actual evidence, not a fabricated score.",
          new Date().toISOString(),
        );
      const job = await enqueue(original.env, "admin", "backup", {});
      await processJob(original.env, job);
      const manifest = original.objects.get(`backups/${job}/manifest.json`);
      expect(manifest).toBeDefined();
      for (const [name, object] of original.objects)
        if (name.startsWith(`backups/${job}/`))
          writeFileSync(join(folder, basename(name)), object.bytes);
      const output = join(folder, "restored.sql"),
        result = spawnSync(
          process.execPath,
          ["scripts/restore-backup.mjs", folder, output],
          {
            encoding: "utf8",
            env: { ...process.env, BETTER_AUTH_SECRET: key },
          },
        );
      expect(result.status, result.stderr).toBe(0);
      recovered.db.exec(readFileSync(output, "utf8"));
      expect(
        recovered.db.prepare("SELECT COUNT(*) n FROM courses").get(),
      ).toMatchObject({ n: 1 });
      expect(
        recovered.db.prepare("SELECT title FROM notes").get(),
      ).toMatchObject({ title: "Learner's note" });
      expect(recovered.db.prepare("PRAGMA foreign_key_check").all()).toEqual(
        [],
      );
      const wrong = spawnSync(
        process.execPath,
        ["scripts/restore-backup.mjs", folder, join(folder, "wrong.sql")],
        {
          encoding: "utf8",
          env: { ...process.env, BETTER_AUTH_SECRET: "wrong-key" },
        },
      );
      expect(wrong.status).not.toBe(0);
    } finally {
      original.close();
      recovered.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
