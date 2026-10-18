import { test, expect } from "@playwright/test";
test("desktop framework, real attempt, notes and private archive", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "知识框架", exact: true }),
  ).toBeVisible();
  const response = await request.post("/api/v1/courses/sample", { data: {} });
  expect(response.status()).toBe(201);
  const { course } = await response.json();
  try {
    await page.reload();
    await page.getByRole("button", { name: "我的课程", exact: true }).click();
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
    await page.getByRole("button", { name: "知识笔记", exact: true }).click();
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
  await page.goto("/");
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
  await page.getByRole("button", { name: "代码实验室", exact: true }).click();
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
  await page.getByRole("button", { name: "代码实验室", exact: true }).click();
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
