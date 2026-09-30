import { expect, test } from "@playwright/test";

test("player portraits fall back cleanly when image assets are unavailable", async ({
  page,
}) => {
  await page.route("**/assets/players/**", (route) => route.abort());
  await page.goto("/setup/ai");
  await expect(
    page.getByRole("heading", { name: "配置 AI 对局" }),
  ).toBeVisible();
  await expect(page.locator('[data-avatar-fallback="true"]')).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: /开始 AI 对局/ }),
  ).toBeEnabled();
});

test("AI first turn is played in the browser without a server match endpoint", async ({
  page,
}) => {
  const matchApiRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(sandbox\/matches|ai\/matches)/.test(request.url()))
      matchApiRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /开始一场对决/ }).click();
  await page.getByRole("button", { name: /单人 AI 对战/ }).click();
  await expect(
    page.getByRole("heading", { name: "配置 AI 对局" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "困难" }).click();
  await page.getByRole("button", { name: "BO1" }).click();
  await page.getByRole("button", { name: /开始 AI 对局/ }).click();

  await expect(page.locator(".match-page")).toBeVisible();
  await expect(page.getByText("AI 单人对战")).toBeVisible();
  await expect(page.locator(".handoff-screen")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "秘密分配点数" }),
  ).toBeVisible();
  await expect(page.getByText("对手已锁定")).toBeVisible();

  await page.getByRole("button", { name: "按项目顺序分配" }).click();
  await page.getByRole("button", { name: /锁定本阶段/ }).click();
  await expect(
    page.getByRole("heading", { name: "选择进攻项目" }),
  ).toBeVisible();
  await page.locator(".attack-option:not(:disabled)").first().click();
  await expect(page.locator(".battle-feedback")).toBeVisible();
  await page
    .locator(".feedback-skip")
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(
    page.locator(".match-live-feed .live-feed-comparison").first(),
  ).toContainText(/攻击.*加点/);
  expect(matchApiRequests).toEqual([]);
});
