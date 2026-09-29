import { resolve } from "node:path";
import { loadCatalog } from "@paddle-tactics/game-data";
import type { GameRulesCatalog } from "@paddle-tactics/game-core";
import { runSimulation, type Preset, type RunOptions } from "./runner.js";
import { writeReports } from "./reports.js";

function parseArgs(args: string[]): RunOptions {
  let preset: Preset = "standard";
  let seed = 20260928;
  let matches: number | undefined;
  let experimentMatches: number | undefined;
  let mode: RunOptions["mode"] = "all";
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (value === "--preset") {
      const next = args[++index];
      if (next !== "quick" && next !== "standard" && next !== "full")
        throw new Error("--preset must be quick, standard, or full");
      preset = next;
    } else if (value === "--seed") {
      seed = Number(args[++index]);
      if (!Number.isSafeInteger(seed))
        throw new Error("--seed must be a safe integer");
    } else if (value === "--matches") {
      matches = Number(args[++index]);
      if (!Number.isInteger(matches) || matches < 1)
        throw new Error("--matches must be a positive integer");
    } else if (value === "--experiment-matches") {
      experimentMatches = Number(args[++index]);
      if (!Number.isInteger(experimentMatches) || experimentMatches < 0)
        throw new Error("--experiment-matches must be a non-negative integer");
    } else if (value === "--mode") {
      const next = args[++index];
      if (next !== "all" && next !== "rules" && next !== "equipment")
        throw new Error("--mode must be all, rules, or equipment");
      mode = next;
    } else if (value === "--help" || value === "-h") {
      process.stdout.write(
        "Balance Simulator\n  --preset quick|standard|full (default standard)\n  --seed <integer> (default 20260928)\n  --matches <count>\n  --experiment-matches <count>\n  --mode all|rules|equipment\n",
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  return {
    preset,
    seed,
    mode,
    ...(matches === undefined ? {} : { matches }),
    ...(experimentMatches === undefined ? {} : { experimentMatches }),
  };
}

const options = parseArgs(process.argv.slice(2));
const projectRoot = resolve(import.meta.dirname, "../../..");
const catalog = loadCatalog() as GameRulesCatalog;
const result = runSimulation(catalog, options);
const directory = await writeReports(
  result,
  catalog,
  resolve(projectRoot, "reports"),
);
process.stdout.write(
  `Balance Simulator completed ${result.requestedMatchesPerMode.toLocaleString()} baseline matches per mechanic.\n`,
);
process.stdout.write(
  `Seed: ${result.seed}; runtime: ${(result.elapsedMs / 1000).toFixed(2)} s\n`,
);
process.stdout.write(`Reports: ${directory}\n`);
