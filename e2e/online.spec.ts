import { expect, test } from "@playwright/test";

test("two browser sessions complete an online BO1 with private allocations", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  pageA.on("console", (message) => {
    if (message.type() === "error")
      console.log(`browser A error: ${message.text()}`);
  });
  pageB.on("console", (message) => {
    if (message.type() === "error")
      console.log(`browser B error: ${message.text()}`);
  });
  try {
    await pageA.goto("/play");
    await pageA.getByRole("button", { name: /创建或加入/ }).click();
    await pageA.getByLabel("比赛长度").selectOption("1");
    await pageA.getByRole("button", { name: "创建房间" }).click();
    await expect(pageA.locator(".online-room-code strong")).toBeVisible();
    const roomCode = (await pageA
      .locator(".online-room-code strong")
      .textContent())!.trim();

    await pageB.goto(`/online/${roomCode}`);
    await pageB.getByRole("button", { name: "加入这个房间" }).click();
    await expect(pageB.getByText("选手 A", { exact: true })).toBeVisible();
    await pageA.getByRole("button", { name: "准备开始" }).click();
    await pageB.getByRole("button", { name: "准备开始" }).click();
    await expect(pageA).toHaveURL(new RegExp(`/online/${roomCode}/match`));
    await expect(pageB).toHaveURL(new RegExp(`/online/${roomCode}/match`));
    await pageA.getByRole("button", { name: "快速反馈" }).click();
    await pageB.getByRole("button", { name: "快速反馈" }).click();

    for (let step = 0; step < 700; step += 1) {
      if (
        await pageA
          .getByText("MATCH COMPLETE", { exact: true })
          .isVisible()
          .catch(() => false)
      )
        break;

      if (step % 100 === 0) {
        const statusA = await pageA
          .locator(".phase-pill")
          .innerText()
          .catch(() => "not-ready");
        const statusB = await pageB
          .locator(".phase-pill")
          .innerText()
          .catch(() => "not-ready");
        console.log(
          `online BO1 step=${step} A=${statusA.replaceAll("\n", "/")} B=${statusB.replaceAll("\n", "/")}`,
        );
      }
      const lockA = pageA.locator(".allocation-footer .button-primary");
      const lockB = pageB.locator(".allocation-footer .button-primary");
      const stageA = await lockA.count();
      const stageB = await lockB.count();
      if (stageA || stageB) {
        const enabledA = stageA > 0 && (await lockA.isEnabled());
        const enabledB = stageB > 0 && (await lockB.isEnabled());
        if (enabledA) {
          await pageA.getByRole("button", { name: "按项目顺序分配" }).click();
        }
        if (enabledB) {
          await pageB.getByRole("button", { name: "按项目顺序分配" }).click();
        }
        if (enabledA) await lockA.click({ timeout: 5000 });
        if (enabledB) await lockB.click({ timeout: 5000 });
      } else {
        const attackA = pageA.locator(".attack-options button").first();
        const attackB = pageB.locator(".attack-options button").first();
        if ((await attackA.count()) && (await attackA.isEnabled()))
          await attackA.click({ timeout: 5000 });
        else if ((await attackB.count()) && (await attackB.isEnabled()))
          await attackB.click({ timeout: 5000 });
        else if (
          await pageA.locator(".point-result-panel .button-primary").count()
        )
          await pageA.locator(".point-result-panel .button-primary").click();
      }
      await pageA.waitForTimeout(30);
    }

    await expect(
      pageA.getByText("MATCH COMPLETE", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      pageB.getByText("MATCH COMPLETE", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(pageA.locator(".scoreboard")).toContainText("11:0");
    await expect(pageB.locator(".scoreboard")).toContainText("11:0");
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
