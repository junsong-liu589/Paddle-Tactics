import { z } from "zod";

export const SideSchema = z.enum(["forehand", "backhand"]);
export const RoleSchema = z.enum(["attack", "defense"]);
export const StageSchema = z.enum(["service", "receive", "rally"]);

const PositiveIntegerSchema = z.number().int().positive();
const SkillPairSchema = z.object({
  id: z.string().min(1),
  attackName: z.string().min(1),
  defenseName: z.string().min(1),
});

const StageCatalogSchema = z.object({
  label: z.string().min(1),
  budget: z.number().int().positive(),
  perItemCap: z.number().int().positive(),
  directWinThreshold: PositiveIntegerSchema,
  maxRounds: PositiveIntegerSchema.optional(),
  pairs: z.array(SkillPairSchema).min(1),
});

export const SkillCatalogSchema = z.object({
  version: z.string().min(1),
  stages: z.object({
    service: StageCatalogSchema,
    receive: StageCatalogSchema,
    rally: StageCatalogSchema,
  }),
});

const SideBaseSchema = z.object({
  forehand: z.number().int().min(1).max(10),
  backhand: z.number().int().min(1).max(10),
});

const RoleStatsSchema = z.object({
  attack: SideBaseSchema,
  defense: SideBaseSchema,
});

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().min(1),
  baseTotal: PositiveIntegerSchema,
  stats: z.record(z.string(), RoleStatsSchema),
});

const GearModifierSchema = z.object({
  pairId: z.string().min(1),
  role: RoleSchema,
  skillName: z.string().min(1),
  value: z.number().int().min(-4).max(4),
});

export const BladeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().min(1),
  scope: z.literal("both_sides"),
  modifiers: z.array(GearModifierSchema),
});

export const RubberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().min(1),
  scope: z.literal("installed_side"),
  modifiers: z.array(GearModifierSchema),
});

export const BalanceStageSchema = z.object({
  budget: PositiveIntegerSchema,
  perItemCap: PositiveIntegerSchema,
  threshold: PositiveIntegerSchema,
  maxRounds: PositiveIntegerSchema.optional(),
});

export const BalanceConfigSchema = z.object({
  version: z.string().min(1),
  constantStatMin: z.number().int().positive(),
  constantStatMax: PositiveIntegerSchema,
  temporaryStatsMayExceedConstantCap: z.boolean(),
  projectBattleValueFormula: z.string().min(1),
  actualComparisonFormula: z.string().min(1),
  service: BalanceStageSchema,
  receive: BalanceStageSchema,
  rally: BalanceStageSchema,
  scoring: z.object({
    pointsToWinGame: PositiveIntegerSchema,
    winBy: PositiveIntegerSchema,
    serveRotationBeforeDeuce: PositiveIntegerSchema,
    serveRotationAtDeuce: PositiveIntegerSchema,
    defaultBestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    allowedBestOf: z
      .array(z.union([z.literal(1), z.literal(3), z.literal(5)]))
      .min(1),
  }),
  rallyTieBreak: z.array(
    z.enum([
      "cumulativeAdvantage",
      "positiveAdvantageRoundCount",
      "largestSingleRoundAdvantage",
      "fifthRoundDefenderWins",
    ]),
  ),
  playerTiers: z.record(z.string(), z.array(z.string().min(1))),
});

export const ValidationReportEntrySchema = z.object({
  player: z.string().min(1),
  declaredTotal: PositiveIntegerSchema,
  computedTotal: PositiveIntegerSchema,
  ok: z.boolean(),
});

export const ValidationReportSchema = z
  .array(ValidationReportEntrySchema)
  .min(1);

export type Side = z.infer<typeof SideSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type SkillPair = z.infer<typeof SkillPairSchema>;
export type SkillCatalog = z.infer<typeof SkillCatalogSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Blade = z.infer<typeof BladeSchema>;
export type Rubber = z.infer<typeof RubberSchema>;
export type BalanceConfig = z.infer<typeof BalanceConfigSchema>;
export type ValidationReportEntry = z.infer<typeof ValidationReportEntrySchema>;
