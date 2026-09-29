import { loadCatalog } from "./index.js";

const catalog = loadCatalog();
console.log(
  `Validated ${catalog.players.length} players, ${catalog.blades.length} blades, ${catalog.rubbers.length} rubbers, and ${Object.values(catalog.skills.stages).flatMap((stage) => stage.pairs).length} skill pairs (${catalog.balance.version}).`,
);
