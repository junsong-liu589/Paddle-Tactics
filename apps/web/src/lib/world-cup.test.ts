import { describe, expect, it } from "vitest";
import {
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
} from "@paddle-tactics/game-core";
import { browserCatalog } from "./catalog.js";
import {
  olympicsCatalog,
  olympicsSeedTierByPlayer,
} from "./olympics-catalog.js";
import { createOlympics, drawOlympicBracket } from "./olympics.js";
import { getShowcaseDimensions, radarFillRatio } from "./player-showcase.js";
import {
  chooseStyleLoadout,
  createWorldCup,
  nextReadyMatch,
  roundName,
  revealNextCupGame,
  simulateCupMatch,
  startCpuPlayback,
  withWorldCupAssists,
  WORLD_CUP_V43_POLICY,
} from "./world-cup.js";

describe("world cup orchestration", () => {
  it("applies V4.3 World Cup gap and one-game series bonuses reversibly", () => {
    const harimoto = "tomokazu-harimoto";
    const other = browserCatalog.players[0]!.id;
    const state = createMatch({
      id: "v43-assist-test",
      bestOf: 7,
      allowBestOfSeven: true,
      firstServerPlayerId: "A",
      playerA: { id: "A", loadout: chooseStyleLoadout(harimoto) },
      playerB: { id: "B", loadout: chooseStyleLoadout(other) },
      catalog: browserCatalog,
      candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
    });
    const base = {
      A: structuredClone(state.players.A!.projectBattleValues),
      B: structuredClone(state.players.B!.projectBattleValues),
    };
    state.currentGame.score = { A: 0, B: 5 };
    const behind = withWorldCupAssists(
      state,
      base,
      WORLD_CUP_V43_POLICY,
      123,
      "A",
    );
    expect(behind.players.A!.projectBattleValues.flick!.attack).toBeCloseTo(
      base.A.flick!.attack + 0.93 + 2 + 0.12,
    );
    expect(state.players.A!.projectBattleValues.flick!.attack).toBe(
      base.A.flick!.attack,
    );
    state.currentGame.score = { A: 5, B: 5 };
    const caughtUp = withWorldCupAssists(
      state,
      base,
      WORLD_CUP_V43_POLICY,
      123,
      "A",
    );
    expect(caughtUp.players.A!.projectBattleValues.flick!.attack).toBeCloseTo(
      base.A.flick!.attack + 0.93 + 0.12,
    );
    state.currentGame.number = 3;
    state.currentGame.score = { A: 0, B: 0 };
    state.gamesWon = { A: 0, B: 2 };
    const twoBehind = withWorldCupAssists(
      state,
      base,
      WORLD_CUP_V43_POLICY,
      123,
      "A",
    );
    const boostedCells = Object.entries(
      twoBehind.players.A!.projectBattleValues,
    )
      .flatMap(([pairId, values]) =>
        (["attack", "defense"] as const).map(
          (role) =>
            values[role] -
            base.A[pairId]![role] -
            0.93 -
            (role === "attack" &&
            ["flick", "flip", "rally_exchange", "continuous_attack"].includes(
              pairId,
            )
              ? 0.12
              : 0),
        ),
      )
      .filter((bonus) => bonus > 1);
    expect(boostedCells).toHaveLength(10);
    expect(boostedCells.every((bonus) => Math.abs(bonus - 3) < 1e-8)).toBe(
      true,
    );
    state.currentGame.number = 4;
    state.gamesWon = { A: 0, B: 3 };
    const threeBehind = withWorldCupAssists(
      state,
      base,
      WORLD_CUP_V43_POLICY,
      123,
      "A",
    );
    const strongerCells = Object.entries(
      threeBehind.players.A!.projectBattleValues,
    )
      .flatMap(([pairId, values]) =>
        (["attack", "defense"] as const).map(
          (role) =>
            values[role] -
            base.A[pairId]![role] -
            0.93 -
            (role === "attack" &&
            ["flick", "flip", "rally_exchange", "continuous_attack"].includes(
              pairId,
            )
              ? 0.12
              : 0),
        ),
      )
      .filter((bonus) => bonus > 1);
    expect(strongerCells).toHaveLength(10);
    expect(strongerCells.every((bonus) => Math.abs(bonus - 6) < 1e-8)).toBe(
      true,
    );
    state.gamesWon = { A: 1, B: 3 };
    const restored = withWorldCupAssists(
      state,
      base,
      WORLD_CUP_V43_POLICY,
      123,
      "A",
    );
    expect(restored.players.A!.projectBattleValues.flick!.attack).toBeCloseTo(
      base.A.flick!.attack + 0.93 + 0.12,
    );
  });

  it("keeps Olympic spectator results unchanged when a supported player is selected", () => {
    const cup = createOlympics({ seed: 20261001 });
    const match = cup.matches[0]!;
    const plain = simulateCupMatch(
      cup,
      match,
      olympicsCatalog,
      "wide-varied",
      "A",
    );
    const supported = simulateCupMatch(
      { ...cup, favoritePlayerId: match.playerIds[0] },
      match,
      olympicsCatalog,
      "wide-varied",
      "A",
    );
    expect(supported).toEqual(plain);
  });
  it("names every Olympics knockout round and scales display ratings linearly", () => {
    expect(
      ([0, 1, 2, 3, 4] as const).map((round) => roundName(round, "olympics")),
    ).toEqual([
      "十六分之一决赛",
      "八分之一决赛",
      "四分之一决赛",
      "半决赛",
      "决赛",
    ]);
    expect(roundName(0, "world-cup")).toBe("四分之一决赛");
    expect(radarFillRatio(3)).toBe(0);
    expect(radarFillRatio(10)).toBeCloseTo(0.7);
    expect(radarFillRatio(13)).toBe(1);
    expect(radarFillRatio(15)).toBe(1);
  });

  it("draws eight unique players into four first-round matches", () => {
    const cup = createWorldCup();
    expect(cup.draw).toHaveLength(8);
    expect(new Set(cup.draw).size).toBe(8);
    expect(cup.matches.filter((match) => match.round === 0)).toHaveLength(4);
    expect(cup.matches.filter((match) => match.round === 1)).toHaveLength(2);
    expect(cup.matches.filter((match) => match.round === 2)).toHaveLength(1);
    expect(cup.matches.slice(0, 4).flatMap((match) => match.playerIds)).toEqual(
      cup.draw,
    );
  });

  it("builds a valid AI style loadout from the existing catalog", () => {
    for (const player of browserCatalog.players) {
      const loadout = chooseStyleLoadout(player.id);
      expect(loadout.playerId).toBe(player.id);
      expect(
        browserCatalog.blades.some((item) => item.id === loadout.bladeId),
      ).toBe(true);
      expect(
        browserCatalog.rubbers.some(
          (item) => item.id === loadout.forehandRubberId,
        ),
      ).toBe(true);
      expect(
        browserCatalog.rubbers.some(
          (item) => item.id === loadout.backhandRubberId,
        ),
      ).toBe(true);
    }
  });

  it("builds six presentation ratings from the selected loadout", () => {
    const player = browserCatalog.players[0]!;
    const loadout = {
      playerId: player.id,
      bladeId: browserCatalog.blades[0]!.id,
      forehandRubberId: browserCatalog.rubbers[0]!.id,
      backhandRubberId: browserCatalog.rubbers[0]!.id,
    };
    const dimensions = getShowcaseDimensions(loadout, browserCatalog);
    expect(dimensions.map((dimension) => dimension.label)).toEqual([
      "发球攻击",
      "发球防守",
      "反制攻击",
      "反制防守",
      "相持攻击",
      "相持防守",
    ]);
    expect(
      dimensions.every(
        (dimension) => dimension.score >= 0 && dimension.score <= 20,
      ),
    ).toBe(true);
  });

  it("simulates seven computer matches and advances to one champion", () => {
    let cup = createWorldCup();
    let completedMatches = 0;
    while (cup.phase !== "complete" && completedMatches < 7) {
      const match = nextReadyMatch(cup);
      expect(match).not.toBeNull();
      cup = startCpuPlayback(cup);
      const active = cup.matches.find((item) => item.id === cup.activeMatchId);
      expect(active?.games.length).toBeGreaterThanOrEqual(4);
      expect(active?.games.length).toBeLessThanOrEqual(7);
      expect(active?.games.every((game) => game.endingAction)).toBe(true);
      while (cup.phase === "cpu-playback") cup = revealNextCupGame(cup);
      completedMatches += 1;
    }
    expect(completedMatches).toBe(7);
    expect(cup.phase).toBe("complete");
    expect(cup.championId).toBeTruthy();
    expect(
      cup.matches.filter((match) => match.status === "complete"),
    ).toHaveLength(7);
  }, 120_000);

  it("draws eight players from every Olympics tier into eight protected pods", () => {
    const draw = drawOlympicBracket(20260930);
    expect(draw).toHaveLength(32);
    expect(new Set(draw).size).toBe(32);
    for (let pod = 0; pod < 8; pod += 1) {
      const ids = draw.slice(pod * 4, pod * 4 + 4);
      expect(ids.map((id) => olympicsSeedTierByPlayer[id]).sort()).toEqual([
        1, 2, 3, 4,
      ]);
      const openingPairs = [ids.slice(0, 2), ids.slice(2, 4)].map((pair) =>
        pair.map((id) => olympicsSeedTierByPlayer[id]).sort(),
      );
      expect(openingPairs).toEqual(
        expect.arrayContaining([
          [1, 4],
          [2, 3],
        ]),
      );
    }
    for (const tier of [1, 2, 3, 4]) {
      expect(
        olympicsCatalog.players.filter(
          (player) => olympicsSeedTierByPlayer[player.id] === tier,
        ),
      ).toHaveLength(8);
    }
  });

  it("keeps the Olympics roster additions out of the regular catalog", () => {
    expect(olympicsCatalog.players).toHaveLength(32);
    expect(browserCatalog.players).toHaveLength(8);
    for (const player of olympicsCatalog.players) {
      expect(
        Object.values(player.stats)
          .flatMap((pair) => [
            pair.attack.forehand,
            pair.attack.backhand,
            pair.defense.forehand,
            pair.defense.backhand,
          ])
          .every((value) => value >= 1 && value <= 10),
      ).toBe(true);
      for (const [stageId, stage] of Object.entries(
        olympicsCatalog.skills.stages,
      )) {
        for (const side of ["forehand", "backhand"] as const) {
          const values = stage.pairs.flatMap((pair) => [
            player.stats[pair.id]!.attack[side],
            player.stats[pair.id]!.defense[side],
          ]);
          expect(
            values.filter((value) => value === 10).length,
          ).toBeLessThanOrEqual(1);
          expect(
            values.filter((value) => value === 9).length,
          ).toBeLessThanOrEqual(1);
          expect(
            values.every((value) => value <= 8 || value === 9 || value === 10),
            `${player.id} ${stageId}/${side}`,
          ).toBe(true);
        }
      }
    }
    const cup = createOlympics({ seed: 20260930 });
    expect(cup.eventType).toBe("olympics");
    expect(cup.draw).toHaveLength(32);
    expect(cup.matches).toHaveLength(31);
    expect(Object.keys(cup.participants)).toHaveLength(32);
  });

  it("can complete all 31 computer matches and crown an Olympics champion", () => {
    let cup = createOlympics({ seed: 20260930 });
    let completedMatches = 0;
    while (cup.phase !== "complete" && completedMatches < 31) {
      const match = nextReadyMatch(cup);
      expect(match).not.toBeNull();
      cup = startCpuPlayback(cup, "wide-varied", olympicsCatalog);
      const active = cup.matches.find((item) => item.id === cup.activeMatchId);
      expect(active?.games.length).toBeGreaterThanOrEqual(4);
      expect(active?.games.length).toBeLessThanOrEqual(7);
      while (cup.phase === "cpu-playback") cup = revealNextCupGame(cup);
      completedMatches += 1;
    }
    expect(completedMatches).toBe(31);
    expect(cup.phase).toBe("complete");
    expect(cup.championId).toBeTruthy();
    expect(
      cup.matches.filter((match) => match.status === "complete"),
    ).toHaveLength(31);
  }, 120_000);
});
