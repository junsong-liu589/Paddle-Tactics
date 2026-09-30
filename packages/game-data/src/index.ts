import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BalanceConfigSchema,
  BladeSchema,
  PlayerSchema,
  RubberSchema,
  SkillCatalogSchema,
  ValidationReportSchema,
  type BalanceConfig,
  type Blade,
  type Player,
  type Rubber,
  type SkillCatalog,
  type ValidationReportEntry,
} from "./schema.js";

export * from "./schema.js";

export type GameCatalog = {
  players: Player[];
  blades: Blade[];
  rubbers: Rubber[];
  skills: SkillCatalog;
  balance: BalanceConfig;
  validationReport: ValidationReportEntry[];
};

export class CatalogValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Invalid game catalog:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
    this.name = "CatalogValidationError";
  }
}

function readJsonFile<T>(
  directory: string,
  filename: string,
  schema: { parse(input: unknown): T },
): T {
  const filePath = resolve(directory, filename);
  try {
    const source = readFileSync(filePath, "utf8");
    const input: unknown = JSON.parse(source);
    return schema.parse(input);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CatalogValidationError([
        `${filename}: invalid JSON (${error.message})`,
      ]);
    }
    if (error instanceof Error && "issues" in error) {
      const details = Array.isArray(error.issues)
        ? error.issues.map(
            (issue: { path: PropertyKey[]; message: string }) =>
              `${filename}${issue.path.length > 0 ? `.${issue.path.join(".")}` : ""}: ${issue.message}`,
          )
        : [error.message];
      throw new CatalogValidationError(details);
    }
    throw error;
  }
}

function uniqueIds(ids: string[], label: string, issues: string[]): void {
  if (new Set(ids).size !== ids.length)
    issues.push(`${label} contain duplicate IDs`);
}

function sumPlayerBaseStats(player: Player): number {
  return Object.values(player.stats).reduce((total, pair) => {
    return (
      total +
      pair.attack.forehand +
      pair.attack.backhand +
      pair.defense.forehand +
      pair.defense.backhand
    );
  }, 0);
}

function assertCatalogConsistency(catalog: GameCatalog): void {
  const issues: string[] = [];
  const stageEntries = Object.entries(catalog.skills.stages) as [
    keyof SkillCatalog["stages"],
    SkillCatalog["stages"][keyof SkillCatalog["stages"]],
  ][];
  const pairs = stageEntries.flatMap(([, stage]) => stage.pairs);
  const pairIds = pairs.map((pair) => pair.id);
  uniqueIds(
    catalog.players.map((item) => item.id),
    "players",
    issues,
  );
  uniqueIds(
    catalog.players.map((item) => item.style),
    "player styles",
    issues,
  );
  uniqueIds(
    catalog.blades.map((item) => item.id),
    "blades",
    issues,
  );
  uniqueIds(
    catalog.rubbers.map((item) => item.id),
    "rubbers",
    issues,
  );
  uniqueIds(pairIds, "skill pairs", issues);

  if (catalog.skills.version !== catalog.balance.version) {
    issues.push(
      `balance version ${catalog.balance.version} does not match skills version ${catalog.skills.version}`,
    );
  }

  const pairById = new Map(pairs.map((pair) => [pair.id, pair]));
  const pairIdSet = new Set(pairById.keys());
  const pairCountByStage = stageEntries.map(
    ([stageId, stage]) => [stageId, stage.pairs.length] as const,
  );
  for (const [stageId, count] of pairCountByStage) {
    if (count !== 5)
      issues.push(`skills.stages.${stageId} must contain exactly 5 pairs`);
  }

  const balanceStages = {
    service: catalog.balance.service,
    receive: catalog.balance.receive,
    rally: catalog.balance.rally,
  };
  for (const stageId of ["service", "receive", "rally"] as const) {
    const skillStage = catalog.skills.stages[stageId];
    const balanceStage = balanceStages[stageId];
    if (
      skillStage.budget !== balanceStage.budget ||
      skillStage.perItemCap !== balanceStage.perItemCap ||
      skillStage.directWinThreshold !== balanceStage.threshold ||
      (skillStage.maxRounds ?? null) !== (balanceStage.maxRounds ?? null)
    ) {
      issues.push(`skills and balance-config rules disagree for ${stageId}`);
    }
  }

  if (catalog.skills.stages.rally.maxRounds !== 5) {
    issues.push("rally maxRounds must remain 5 for balance_v1.1");
  }
  if (
    catalog.balance.constantStatMin !== 1 ||
    catalog.balance.constantStatMax !== 15
  ) {
    issues.push("constant stat clamp must remain 1..15 for balance_v1.1");
  }
  if (catalog.balance.temporaryStatsMayExceedConstantCap !== true) {
    issues.push(
      "temporary stats must be allowed to exceed the constant stat cap",
    );
  }
  if (
    catalog.balance.projectBattleValueFormula !==
      "(forehandConstant + backhandConstant) / 2" ||
    catalog.balance.actualComparisonFormula !==
      "projectBattleValue + stageTemporaryPoints"
  ) {
    issues.push("balance formulas differ from the approved game rules");
  }
  if (
    JSON.stringify(catalog.balance.rallyTieBreak) !==
    JSON.stringify([
      "cumulativeAdvantage",
      "positiveAdvantageRoundCount",
      "largestSingleRoundAdvantage",
      "fifthRoundDefenderWins",
    ])
  ) {
    issues.push("rally tie-break order differs from the approved game rules");
  }
  if (
    catalog.balance.scoring.pointsToWinGame !== 11 ||
    catalog.balance.scoring.winBy !== 2 ||
    catalog.balance.scoring.serveRotationBeforeDeuce !== 2 ||
    catalog.balance.scoring.serveRotationAtDeuce !== 1
  ) {
    issues.push("scoring and serve rotation rules differ from balance_v1.1");
  }
  if (
    !catalog.balance.scoring.allowedBestOf.includes(
      catalog.balance.scoring.defaultBestOf,
    )
  ) {
    issues.push("default bestOf must be present in allowedBestOf");
  }

  for (const player of catalog.players) {
    const statIds = Object.keys(player.stats);
    if (
      statIds.length !== pairIds.length ||
      statIds.some((id) => !pairIdSet.has(id))
    ) {
      issues.push(
        `player ${player.id} stats must contain exactly the 15 configured skill pairs`,
      );
    }
    const computedTotal = sumPlayerBaseStats(player);
    if (computedTotal !== player.baseTotal) {
      issues.push(
        `player ${player.id} baseTotal is ${player.baseTotal}, but stats sum to ${computedTotal}`,
      );
    }
    for (const [stageId, stage] of stageEntries) {
      for (const side of ["forehand", "backhand"] as const) {
        const values = stage.pairs.flatMap((pair) => [
          player.stats[pair.id]!.attack[side],
          player.stats[pair.id]!.defense[side],
        ]);
        if (
          values.filter((value) => value === 10).length > 1 ||
          values.filter((value) => value === 9).length > 1 ||
          values.some((value) => value > 8 && value !== 9 && value !== 10)
        ) {
          issues.push(
            `player ${player.id} ${stageId}/${side} exceeds the Candidate V4 peak profile (at most one 10 and one 9; all others at most 8)`,
          );
        }
      }
    }
  }

  for (const gear of [...catalog.blades, ...catalog.rubbers]) {
    for (const modifier of gear.modifiers) {
      const pair = pairById.get(modifier.pairId);
      if (!pair) {
        issues.push(
          `${gear.id} modifier references unknown pair ${modifier.pairId}`,
        );
      } else {
        const expectedName =
          modifier.role === "attack" ? pair.attackName : pair.defenseName;
        if (modifier.skillName !== expectedName) {
          issues.push(
            `${gear.id} modifier ${modifier.pairId}/${modifier.role} must be named ${expectedName}`,
          );
        }
      }
    }
  }

  const reportByName = new Map(
    catalog.validationReport.map((entry) => [entry.player, entry]),
  );
  if (catalog.validationReport.length !== catalog.players.length) {
    issues.push("validation-report must have one entry per player");
  }
  for (const player of catalog.players) {
    const report = reportByName.get(player.name);
    const computedTotal = sumPlayerBaseStats(player);
    if (
      !report ||
      report.declaredTotal !== player.baseTotal ||
      report.computedTotal !== computedTotal ||
      report.ok !== true
    ) {
      issues.push(
        `validation-report is inconsistent for player ${player.name}`,
      );
    }
  }

  const tierIds = Object.entries(catalog.balance.playerTiers).flatMap(
    ([total, ids]) => ids.map((id) => ({ total: Number(total), id })),
  );
  uniqueIds(
    tierIds.map(({ id }) => id),
    "balance-config.playerTiers",
    issues,
  );
  if (tierIds.length !== catalog.players.length) {
    issues.push(
      "balance-config.playerTiers must list every player exactly once",
    );
  }
  for (const { total, id } of tierIds) {
    const player = catalog.players.find((candidate) => candidate.id === id);
    if (!player || player.baseTotal !== total) {
      issues.push(
        `player tier ${total} contains missing player or incorrect total for ${id}`,
      );
    }
  }

  if (issues.length > 0) throw new CatalogValidationError(issues);
}

export function validateCatalog(input: unknown): GameCatalog {
  const catalogSchema = {
    players: PlayerSchema.array(),
    blades: BladeSchema.array(),
    rubbers: RubberSchema.array(),
    skills: SkillCatalogSchema,
    balance: BalanceConfigSchema,
    validationReport: ValidationReportSchema,
  };
  const catalog = {
    players: catalogSchema.players.parse(
      (input as { players?: unknown } | null)?.players,
    ),
    blades: catalogSchema.blades.parse(
      (input as { blades?: unknown } | null)?.blades,
    ),
    rubbers: catalogSchema.rubbers.parse(
      (input as { rubbers?: unknown } | null)?.rubbers,
    ),
    skills: catalogSchema.skills.parse(
      (input as { skills?: unknown } | null)?.skills,
    ),
    balance: catalogSchema.balance.parse(
      (input as { balance?: unknown } | null)?.balance,
    ),
    validationReport: catalogSchema.validationReport.parse(
      (input as { validationReport?: unknown } | null)?.validationReport,
    ),
  };
  assertCatalogConsistency(catalog);
  return catalog;
}

export function loadCatalog(
  dataDirectory = resolve(import.meta.dirname, "../../../data"),
): GameCatalog {
  return validateCatalog({
    players: readJsonFile(dataDirectory, "players.json", PlayerSchema.array()),
    blades: readJsonFile(dataDirectory, "blades.json", BladeSchema.array()),
    rubbers: readJsonFile(dataDirectory, "rubbers.json", RubberSchema.array()),
    skills: readJsonFile(dataDirectory, "skills.json", SkillCatalogSchema),
    balance: readJsonFile(
      dataDirectory,
      "balance-config.json",
      BalanceConfigSchema,
    ),
    validationReport: readJsonFile(
      dataDirectory,
      "validation-report.json",
      ValidationReportSchema,
    ),
  });
}
