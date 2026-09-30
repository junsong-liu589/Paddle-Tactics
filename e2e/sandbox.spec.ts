import { expect, test } from "@playwright/test";

test("local two-player match hands the device to the second player", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: /同屏本地双人/ }).click();
  await expect(
    page.getByRole("heading", { name: "配置本地对局" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "BO1" }).click();
  await page.getByRole("button", { name: /确认配装并开始比赛/ }).click();
  await expect(
    page.getByRole("heading", { name: "秘密分配点数" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "按项目顺序分配" }).click();
  await page.getByRole("button", { name: /锁定并交接/ }).click();
  await expect(page.locator(".handoff-screen")).toBeVisible();
  await expect(page.locator(".allocation-grid")).toHaveCount(0);
  await page.getByRole("button", { name: /显示选手 B/ }).click();
  await expect(
    page.getByRole("heading", { name: "秘密分配点数" }),
  ).toBeVisible();
});
