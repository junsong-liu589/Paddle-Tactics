import { describe, it } from "vitest";

describe.skipIf(
  process.env.BALANCE_EXPERIMENT_MODE !== "legal-targeted-screening",
)("World Cup balance experiment runner", () => {
  it("runs and saves the legal, total-preserving screening candidates", async () => {
    await import("../../scripts/world-cup-balance-experiment.ts");
  }, 900_000);
});
