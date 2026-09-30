import { resolve } from "node:path";
import { loadCatalog } from "@paddle-tactics/game-data";
import type { GameRulesCatalog } from "@paddle-tactics/game-core";
import {
  CARRY_CDE_MATCHES_PER_PLAN,
  CARRY_CDE_SEED,
  runCarryFocusedExperiment,
} from "./carry-focused.js";

const seedIndex = process.argv.indexOf("--seed");
const seed =
  seedIndex >= 0 ? Number(process.argv[seedIndex + 1]) : CARRY_CDE_SEED;
if (!Number.isSafeInteger(seed))
  throw new Error("--seed must be a safe integer");
if (process.argv.some((value) => value === "--matches" || value === "--preset"))
  throw new Error(
    "Carry C/D/E run size is fixed at 20,000 matches per plan; no preset or matches override is accepted.",
  );

const projectRoot = resolve(import.meta.dirname, "../../..");
const output = await runCarryFocusedExperiment(
  loadCatalog() as GameRulesCatalog,
  seed,
  resolve(projectRoot, "reports", "carry-c-d-e"),
);
process.stdout.write(
  `Plans C/D/E: ${CARRY_CDE_MATCHES_PER_PLAN.toLocaleString()} each; seed ${seed}.\n`,
);
process.stdout.write(`Reports: ${output}\n`);
