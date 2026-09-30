import { expect, test, type Page } from "@playwright/test";

async function waitForMatchIdle(page: Page) {
  await page.waitForFunction(
    () => {
      const match = document.querySelector(".match-page");
      return !match || match.getAttribute("data-busy") === "false";
    },
    undefined,
    { timeout: 5_000 },
  );
}

test("local two-player BO1 completes from setup through match report", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.on("console", (message) => console.log(`[browser] ${message.text()}`));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /每一分/ })).toBeVisible();
  await page.getByRole("button", { name: /开始一场对决/ }).click();
  await page.getByRole("button", { name: /本地双人沙盒/ }).click();
  await expect(
    page.getByRole("heading", { name: "配置本地对局" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "BO1" }).click();
  await page.getByRole("button", { name: /确认配装并开始比赛/ }).click();
  await expect(
    page.getByRole("heading", { name: "秘密分配点数" }),
  ).toBeVisible();

  // Exercise the actual hot-seat boundary and both player's first lock in UI.
  await page.getByRole("button", { name: "按项目顺序分配" }).click();
  await page.getByRole("button", { name: /锁定并交接/ }).click();
  await waitForMatchIdle(page);
  await expect(page.locator(".handoff-screen")).toBeVisible();
  await expect(page.locator(".allocation-grid")).toHaveCount(0);
  await page.getByRole("button", { name: /显示选手/ }).click();
  await expect(page.locator(".allocation-panel")).toBeVisible();
  await page.getByRole("button", { name: "按项目顺序分配" }).click();
  await page.getByRole("button", { name: /锁定并交接/ }).click();
  await waitForMatchIdle(page);

  const matchId = page.url().match(/\/match\/([0-9a-f-]+)/i)?.[1];
  expect(matchId).toBeTruthy();
  const simulation = await page.evaluate(async (id) => {
    const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
      const body = (await response.json()) as T;
      if (!response.ok)
        throw new Error(
          `Sandbox request failed: ${response.status} ${JSON.stringify(body)}`,
        );
      return body;
    };
    const catalog = await request<{
      skills: {
        stages: Record<
          string,
          { budget: number; perItemCap: number; pairs: { id: string }[] }
        >;
      };
    }>("/api/catalog");
    type SimulationView = {
      version: number;
      status: "ACTIVE" | "COMPLETED";
      phase: string;
      rulesetId: "legacy_v1" | "candidate_v4";
      availableBudget: number;
      bestOf: number;
      playerOrder: ["A" | "B", "A" | "B"];
      point: {
        number: number;
        rallyRound: number;
        stage: string;
        attackerPlayerId: "A" | "B";
      };
      self: { allocation: Record<string, number> | null };
    };
    const readView = async (viewerId: "A" | "B") => {
      const result = await request<{ view: SimulationView }>(
        `/api/sandbox/matches/${id}?viewerId=${viewerId}`,
      );
      return result.view;
    };
    const send = async (actorId: "A" | "B", command: Record<string, unknown>) =>
      request(`/api/sandbox/matches/${id}/commands`, {
        method: "POST",
        body: JSON.stringify({ actorId, command }),
      });

    let commands = 0;
    for (; commands < 1_000; commands += 1) {
      if (commands > 0 && commands % 25 === 0)
        console.log(`Simulating sandbox command ${commands}`);
      const view = await readView("A");
      if (view.status === "COMPLETED") break;
      if (view.phase.endsWith("_ALLOCATING")) {
        const stage = view.point.stage;
        const rules = catalog.skills.stages[stage]!;
        for (const actorId of ["A", "B"] as const) {
          const actorView = await readView(actorId);
          const role =
            actorId === actorView.point.attackerPlayerId ? "attack" : "defense";
          const keys =
            stage === "rally"
              ? rules.pairs.flatMap((pair) => [
                  `${pair.id}.attack`,
                  `${pair.id}.defense`,
                ])
              : rules.pairs.map((pair) => `${pair.id}.${role}`);
          const allocations: Record<string, number> = Object.fromEntries(
            keys.map((key) => [key, 0]),
          );
          const selectedPair =
            rules.pairs[
              (actorView.point.number + actorView.point.rallyRound - 1) %
                rules.pairs.length
            ]!;
          if (actorView.rulesetId === "candidate_v4") {
            let remaining = actorView.availableBudget;
            if (role === "attack" && stage !== "rally") {
              allocations[`${selectedPair.id}.attack`] = Math.min(4, remaining);
            } else if (stage === "rally") {
              allocations[`${selectedPair.id}.attack`] = 4;
              remaining -= 4;
              for (const key of keys.filter((item) =>
                item.endsWith(".defense"),
              )) {
                const amount = Math.min(remaining, 20);
                allocations[key] = amount;
                remaining -= amount;
                if (remaining === 0) break;
              }
            } else {
              for (const key of keys) {
                const amount = Math.min(remaining, 20);
                allocations[key] = amount;
                remaining -= amount;
                if (remaining === 0) break;
              }
            }
          } else {
            let remaining = rules.budget;
            for (const key of keys) {
              const amount = Math.min(remaining, rules.perItemCap);
              allocations[key] = amount;
              remaining -= amount;
              if (remaining === 0) break;
            }
          }
          const allocated = (await send(actorId, {
            type: "ALLOCATE",
            expectedVersion: actorView.version,
            stage,
            allocations,
          })) as { view: { version: number } };
          await send(actorId, {
            type: "LOCK_ALLOCATION",
            expectedVersion: allocated.view.version,
            stage,
          });
        }
      } else if (view.phase.endsWith("_SELECTING")) {
        const choices = catalog.skills.stages[view.point.stage]!.pairs;
        const actorView = await readView(view.point.attackerPlayerId);
        const fundedPairId = Object.entries(actorView.self.allocation ?? {})
          .find(([key, points]) => key.endsWith(".attack") && points > 0)?.[0]
          .split(".")[0];
        const pair =
          choices.find((candidate) => candidate.id === fundedPairId) ??
          choices[
            (view.point.number + view.point.rallyRound - 1) % choices.length
          ]!;
        await send(view.point.attackerPlayerId, {
          type: "CHOOSE_ATTACK",
          expectedVersion: actorView.version,
          pairId: pair.id,
        });
      } else {
        await send("A", { type: "ADVANCE", expectedVersion: view.version });
      }
    }
    const finalView = await readView("A");
    return { completed: finalView.status === "COMPLETED", commands };
  }, matchId!);

  expect(simulation.completed).toBe(true);
  await page.goto(`/result/${matchId}`);
  await expect(page.getByRole("heading", { name: /获胜/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "逐分记录" })).toBeVisible();
  await expect(page.locator(".point-row").first()).toBeVisible();
});
