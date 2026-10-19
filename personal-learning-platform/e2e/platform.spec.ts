import { test, expect } from "@playwright/test";
test("desktop framework, real attempt, notes and private archive", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/learn/sample-probability/conditional");
  await expect(
    page.getByRole("heading", { name: "条件概率：信息怎样改变判断" }),
  ).toBeVisible();
  const response = await request.post("/api/v1/courses/sample", { data: {} });
  expect(response.status()).toBe(201);
  const { course } = await response.json();
  try {
    await page.reload();
    await page.getByRole("link", { name: "我的课程", exact: true }).click();
    await expect(
      page.getByText("概率与决策", { exact: false }).first(),
    ).toBeVisible();
    const lessons = await (
      await request.get(`/api/v1/courses/${course.id}/lessons`)
    ).json();
    const raw = JSON.stringify(lessons);
    expect(raw).not.toContain('"solution"');
    expect(raw).not.toContain('"hints"');
    const notes = await request.post(`/api/v1/courses/${course.id}/notes`, {
      data: {
        title: "Browser test note",
        body: "A condition narrows the reference set. ".repeat(5),
        conceptId: "conditional",
      },
    });
    expect(notes.status()).toBe(201);
    await page.getByRole("link", { name: "知识笔记", exact: true }).click();
    await expect(
      page.getByText("Browser test note", { exact: true }).first(),
    ).toBeVisible();
    const archive = await request.get("/api/v1/export/archive");
    expect(archive.headers()["content-type"]).toBe("application/zip");
    expect((await archive.body()).readUInt32LE(0)).toBe(0x04034b50);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/v1/courses/${course.id}`);
  }
});
test("phone layout, language and keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn/sample-probability/conditional");
  await expect(
    page.getByRole("button", { name: "切换为英文", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Read aloud", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.keyboard.press("Tab");
  expect(await page.locator(":focus").count()).toBe(1);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("SQL executes in a separate domain without account access", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "代码实验室", exact: true }).click();
  await page.getByRole("button", { name: "SQL", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "运行代码", exact: true }).click();
  await expect(page.locator(".code-output")).toContainText("mean_questions");
  const frame = page.frames().find((f) => f.url().includes("/sandbox/"))!;
  expect(new URL(frame.url()).origin).not.toBe("http://localhost:8787");
  expect(
    await frame.evaluate(() => {
      try {
        return parent.document.title;
      } catch {
        return "isolated";
      }
    }),
  ).toBe("isolated");
  expect(
    (await page.request.get("http://localhost:8788/api/v1/me")).status(),
  ).toBe(404);
});
test("Python runs scientific libraries and renders a plot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "代码实验室", exact: true }).click();
  await page
    .locator(".code-input")
    .fill(
      'import numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\nprint(np.mean([2,4,6]))\nprint(pd.DataFrame({"x":[1,2]}).shape)\nplt.plot([1,2,3],[2,1,4])',
    );
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "运行代码", exact: true }).click();
  await expect(page.locator(".code-output")).toContainText("4.0", {
    timeout: 95000,
  });
  await expect(page.locator(".code-chart")).toHaveCount(1);
});

test("today, evidence sheet, line map and AI handoff", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await request.post("/api/v1/courses/sample", { data: {} });
  const { course } = await response.json();
  try {
    await page.goto("/");
    await expect(page.getByText("下一小步").first()).toBeVisible();
    await page.getByRole("button", { name: "开始这一步" }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.id}/`));
    await page.goto(`/learn/${course.id}/conditional`);
    await page.locator(".mastery-row").click();
    await expect(page.getByRole("dialog", { name: /掌握度证据/ })).toBeVisible();
    await expect(page.getByText("升到 L2 还需要")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "线路图" }).click();
    await expect(
      page.getByRole("group", { name: "知识线路图" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /贝叶斯更新/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.id}/bayes$`));
    await page.getByRole("button", { name: "交给我的 AI 助教" }).first().click();
    await expect(page.getByLabel("交接内容")).toContainText("学习交接");
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/v1/courses/${course.id}`);
  }
});

test("cheat sheet exposes exam scope and highlight choices", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/v1/courses", {
    data: {
      title: "Cheat sheet layout test",
      description: "A tiny course for the browser regression.",
      goal: "exam",
      language: "mixed",
      strategy: "framework",
      examDate: "2026-11-01",
      generate: false,
    },
  });
  expect(created.status()).toBe(201);
  const { course } = await created.json();
  try {
    const patched = await request.patch(`/api/v1/courses/${course.id}`, {
      data: {
        revision: 0,
        concepts: [
          {
            id: "layout",
            title: "Layout under pressure",
            purpose: "Check the two-page A4 builder",
            summary: "A narrow three-column page must remain scannable.",
            prerequisites: [],
            parentId: null,
            applications: [],
            sourceIds: [],
          },
        ],
      },
    });
    expect(patched.status()).toBe(200);
    await page.goto(`/learn/${course.id}`);
    await page.getByRole("link", { name: "速查表", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "考试速查表", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("高亮公式", { exact: true })).toBeVisible();
    await expect(page.getByText("高亮易错点", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Layout under pressure", { exact: false }).first(),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/v1/courses/${course.id}`);
  }
});
