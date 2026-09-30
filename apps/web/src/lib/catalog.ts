import playersData from "../../../../data/players.json";
import bladesData from "../../../../data/blades.json";
import rubbersData from "../../../../data/rubbers.json";
import skillsData from "../../../../data/skills.json";
import balanceData from "../../../../data/balance-config.json";
import {
  BalanceConfigSchema,
  BladeSchema,
  PlayerSchema,
  RubberSchema,
  SkillCatalogSchema,
  type BalanceConfig,
  type Blade,
  type Player,
  type Rubber,
  type SkillCatalog,
} from "@paddle-tactics/game-data/schema";

/** Public, build-time game data. This module never requests a game server. */
export type PublicCatalog = {
  version: string;
  players: Player[];
  blades: Blade[];
  rubbers: Rubber[];
  skills: SkillCatalog;
  balance: BalanceConfig;
};

export const browserCatalog: PublicCatalog = {
  version: BalanceConfigSchema.parse(balanceData).version,
  players: PlayerSchema.array().parse(playersData),
  blades: BladeSchema.array().parse(bladesData),
  rubbers: RubberSchema.array().parse(rubbersData),
  skills: SkillCatalogSchema.parse(skillsData),
  balance: BalanceConfigSchema.parse(balanceData),
};
