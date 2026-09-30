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

test("AI single-player setup, hidden turn flow, and BO1 report work end to end", async ({
  page,
}) => {
  test.setTimeout(120_000);
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

  // Play the initial serve turn through the actual controls before exercising a full BO1.
  await page.getByRole("button", { name: "按项目顺序分配" }).click();
  await page.getByRole("button", { name: /锁定本阶段/ }).click();
  await expect(
    page.getByRole("heading", { name: "选择进攻项目" }),
  ).toBeVisible();
  await page.locator(".attack-option:not(:disabled)").first().click();
  await expect(page.locator(".battle-feedback")).toBeVisible();
  await expect(page.getByRole("button", { name: "跳过动画" })).toBeVisible();
  await page
    .locator(".feedback-skip")
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(
    page.locator(".match-live-feed .live-feed-comparison").first(),
  ).toContainText(/攻击.*加点/);

  const matchId = page.url().match(/\/match\/([0-9a-f-]+)\/ai/i)?.[1];
  expect(matchId).toBeTruthy();
  const result = await page.evaluate(async (id) => {
    type MatchView = {
      status: "ACTIVE" | "COMPLETED";
      phase: string;
      version: number;
      point: {
        stage: "service" | "receive" | "rally";
        attackerPlayerId: "A" | "B";
      };
      currentGame: { score: Record<string, number> };
    };
    const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
      const body = (await response.json()) as T;
      if (!response.ok)
        throw new Error(`AI match request failed: ${response.status}`);
      return body;
    };
    const read = async () =>
      (
        await request<{ view: MatchView }>(
          `/api/sandbox/matches/${id}?viewerId=A`,
        )
      ).view;
    const send = (command: Record<string, unknown>) =>
      request<{ view: MatchView }>(`/api/sandbox/matches/${id}/commands`, {
        method: "POST",
        body: JSON.stringify({ actorId: "A", command }),
      });
    const catalog = await request<{
      skills: { stages: Record<string, { pairs: Array<{ id: string }> }> };
    }>("/api/catalog");

    for (let step = 0; step < 400; step += 1) {
      const view = await read();
      if (view.status === "COMPLETED") return { completed: true, steps: step };
      if (view.phase.endsWith("_ALLOCATING")) {
        const role =
          view.point.stage === "rally"
            ? null
            : view.point.attackerPlayerId === "A"
              ? "attack"
              : "defense";
        const keys = catalog.skills.stages[view.point.stage]!.pairs.flatMap(
          (pair) =>
            role === null
              ? [`${pair.id}.attack`, `${pair.id}.defense`]
              : [`${pair.id}.${role}`],
        );
        const allocated = await send({
          type: "ALLOCATE",
          expectedVersion: view.version,
          stage: view.point.stage,
          allocations: Object.fromEntries(keys.map((key) => [key, 0])),
        });
        await send({
          type: "LOCK_ALLOCATION",
          expectedVersion: allocated.view.version,
          stage: view.point.stage,
        });
      } else if (view.phase.endsWith("_SELECTING")) {
        if (view.point.attackerPlayerId !== "A")
          throw new Error(
            "AI left an opponent attack pending for the human client",
          );
        const pair = catalog.skills.stages[view.point.stage]!.pairs[0]!;
        await send({
          type: "CHOOSE_ATTACK",
          expectedVersion: view.version,
          pairId: pair.id,
        });
      } else {
        await send({ type: "ADVANCE", expectedVersion: view.version });
      }
    }
    return { completed: false, steps: 400 };
  }, matchId!);

  expect(result.completed).toBe(true);
  await page.goto(`/result/${matchId}/ai`);
  await expect(page.getByRole("heading", { name: /获胜/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "逐分记录" })).toBeVisible();
  await expect(page.locator(".point-comparisons").first()).toContainText(
    "基础",
  );
  await expect(page.locator(".point-comparisons").first()).toContainText(
    "加点",
  );
});
