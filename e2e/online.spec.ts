import { expect, test } from "@playwright/test";

test("web preview explains that remote rooms are not available", async ({
  page,
}) => {
  const serverRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/|\/socket\.io\//.test(request.url()))
      serverRequests.push(request.url());
  });

  await page.goto("/online");
  await expect(
    page.getByRole("heading", { name: "选择对局方式" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "网页试玩版暂不提供在线房间",
  );
  await expect(
    page.getByRole("button", { name: /单人 AI 对战/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /同屏本地双人/ }),
  ).toBeVisible();
  expect(serverRequests).toEqual([]);
});
