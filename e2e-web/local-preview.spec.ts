import { expect, test } from "@playwright/test";

type MusicTestWindow = Window & {
  __musicContexts?: Array<{
    state: string;
    finishResume: () => void;
  }>;
};

test("turning music off wins a race with browser audio unlock", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class DeferredAudioContext {
      static instances: DeferredAudioContext[] = [];
      state = "suspended";
      finishResume = () => {};

      constructor() {
        DeferredAudioContext.instances.push(this);
      }

      resume() {
        return new Promise<void>((resolve) => {
          this.finishResume = () => {
            if (this.state !== "closed") this.state = "running";
            resolve();
          };
        });
      }

      close() {
        this.state = "closed";
        return Promise.resolve();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext =
      DeferredAudioContext;
    (window as MusicTestWindow).__musicContexts =
      DeferredAudioContext.instances;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  const toggle = page.getByRole("checkbox", { name: "背景音乐" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as MusicTestWindow).__musicContexts?.[0]?.state,
      ),
    )
    .toBe("closed");

  await page.evaluate(() =>
    (window as MusicTestWindow).__musicContexts?.[0]?.finishResume(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as MusicTestWindow).__musicContexts?.[0]?.state,
      ),
    )
    .toBe("closed");
});

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

test("the static web edition draws and locally plays a supported World Cup run", async ({
  page,
}) => {
  const gameServerRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/|\/socket\.io\//.test(request.url()))
      gameServerRequests.push(request.url());
  });

  await page.goto("/play");
  await page.getByRole("button", { name: /乒乓世界杯/ }).click();
  await expect(page.getByRole("heading", { name: "乒乓世界杯" })).toBeVisible();
  await page.getByRole("button", { name: /纯观战/ }).click();
  await expect(page.getByLabel("支持球员")).toBeVisible();
  await page.getByRole("button", { name: /确认并完全随机抽签/ }).click();

  await expect(page.locator(".cup-bracket .bracket-match")).toHaveCount(7);
  await expect(page.locator(".cup-favorite-badge")).toBeVisible();
  await expect(page.locator(".cup-live-match")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".cup-live-match .action-replay")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".action-replay-result b")).toHaveText(/\d+ : \d+/);
  await expect(page.locator(".action-replay .animated-athlete")).toHaveCount(2);
  await expect(page.locator(".action-replay .athlete-arm-racket")).toHaveCount(
    2,
  );
  await expect(page.locator(".action-replay .athlete-leg-front")).toHaveCount(
    2,
  );
  expect(gameServerRequests).toEqual([]);
});

test("Olympics has one entry and uses the correct 32-player round labels", async ({
  page,
}) => {
  await page.goto("/play");
  const olympicsEntry = page.getByRole("button", { name: /乒乓奥运会/ });
  await expect(olympicsEntry).toHaveCount(1);
  await olympicsEntry.click();
  await page.getByRole("button", { name: /纯观战/ }).click();
  await expect(page.getByText(/支持对象只用于签表高亮/)).toBeVisible();
  await page.getByLabel("支持球员").selectOption("tomokazu-harimoto");
  await page.getByRole("button", { name: /确认并分档随机抽签/ }).click();

  await expect(page.locator(".cup-favorite-badge")).toContainText("张本智和");

  await expect(page.locator(".cup-bracket h3")).toHaveText([
    "十六分之一决赛",
    "八分之一决赛",
    "四分之一决赛",
    "半决赛",
    "决赛",
  ]);
  await expect(page.locator(".cup-next-match h2")).toContainText(
    "十六分之一决赛",
  );
});

test("World Cup player selection previews the illustrated character and six dimensions before drawing", async ({
  page,
}) => {
  await page.goto("/world-cup");
  await page.getByRole("button", { name: /我来参赛/ }).click();
  await expect(
    page.getByRole("heading", { name: "选择球员并配置球拍" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /的卡通造型/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /六维能力概览/ })).toBeVisible();
  await expect(page.getByLabel("正手胶皮")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /确认并完全随机抽签/ }),
  ).toBeVisible();
});
