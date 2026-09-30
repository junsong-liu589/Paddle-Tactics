import { expect, test } from "@playwright/test";

test("static web edition plays local AI without contacting a game server", async ({
  page,
}) => {
  const gameServerRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/|\/socket\.io\//.test(request.url()))
      gameServerRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /开始一场对决/ }).click();
  await expect(
    page.getByRole("heading", { name: "选择对局方式" }),
  ).toBeVisible();
  await expect(page.getByText(/网页试玩版无需账号或服务器/)).toBeVisible();
  await expect(page.getByRole("button", { name: /在线双人/ })).toHaveCount(0);

  await page.getByRole("button", { name: /单人 AI 对战/ }).click();
  await expect(
    page.getByRole("heading", { name: "配置 AI 对局" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "BO1" }).click();
  await page.getByRole("button", { name: /开始 AI 对局/ }).click();

  await expect(page.locator(".match-page")).toBeVisible();
  await expect(page.getByText("AI 单人对战")).toBeVisible();
  await expect(page.getByText("对手已锁定")).toBeVisible();
  expect(gameServerRequests).toEqual([]);
});

test("the free web edition supports two people sharing one browser", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: /本地双人|同屏本地双人/ }).click();
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
  await page.getByRole("button", { name: /显示选手 B/ }).click();
  await expect(
    page.getByRole("heading", { name: "秘密分配点数" }),
  ).toBeVisible();
});
