import { expect, test } from "@playwright/test";

test("the home-page rules action stays inside the game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /查看比赛规则/ }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByRole("heading", { name: "比赛规则" })).toBeVisible();
  await expect(page.getByText(/最多六次攻防比较/)).toBeVisible();
});

test("player selection lists all abilities as player and equipment formulas", async ({
  page,
}) => {
  await page.goto("/setup/ai");
  const details = page.locator(".stats-details");
  await expect(details).toHaveCount(2);
  await expect(details.first()).toHaveAttribute("open", "");
  await expect(page.locator(".setup-stat-row")).toHaveCount(60);
  await expect(page.locator(".setup-stat-row").first()).toContainText("正手");
  await expect(page.locator(".setup-stat-row").first()).toContainText("反手");
  await expect(page.locator(".total-pill")).toHaveCount(0);
});

test("music settings persist and provide a mute switch", async ({ page }) => {
  await page.goto("/settings");
  const musicSwitch = page.getByRole("checkbox", { name: "背景音乐" });
  await expect(musicSwitch).toBeChecked();
  await expect(page.getByText("赛前热身")).toBeVisible();
  const tracks = await page
    .locator(".music-track-list p:not(.music-now-playing)")
    .allTextContents();
  expect(tracks.flatMap((scene) => scene.split("　·　"))).toHaveLength(6);
  await musicSwitch.uncheck();
  await expect(page.getByRole("slider", { name: "音乐音量" })).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "背景音乐" }),
  ).not.toBeChecked();
});
