import { describe, expect, it } from "vitest";
import { loadCatalog } from "@paddle-tactics/game-data";
import {
  allocationSkillKey,
  applyCommand,
  calculateLoadoutStats,
  calculateProjectBattleValues,
  createMatch,
  DEFAULT_CANDIDATE_V3_SETTINGS,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
  getAllocationSkillKeys,
  getServerForNextPoint,
  isDeuceScore,
  resolveCandidateV3Comparison,
  resolveCandidateV4RallyTieBreak,
} from "./index.js";
import type {
  Allocation,
  CreateMatchInput,
  GameCommand,
  MatchState,
  Stage,
} from "./types.js";

const catalog = loadCatalog();
const playerA = catalog.players[0]!;
const playerB = catalog.players[1]!;
const blade = catalog.blades[0]!;
const rubber = catalog.rubbers[0]!;
const loadout = (id: string) => ({
  playerId: id,
  bladeId: blade.id,
  forehandRubberId: rubber.id,
  backhandRubberId: rubber.id,
});

describe("Candidate V3 rules", () => {
  const v3Input = () => input({ candidateV3: DEFAULT_CANDIDATE_V3_SETTINGS });
  it("uses a one-way threshold: defense can hold but cannot score", () => {
    expect(resolveCandidateV3Comparison(10, 100, 5)).toEqual({
      delta: -90,
      outcome: "continue",
    });
    expect(resolveCandidateV3Comparison(15, 10, 5).outcome).toBe(
      "attacker_wins",
    );
  });
  it("locks the V3 attacker automatically and exposes only the stable top three to the defender", () => {
    const state = createMatch(v3Input());
    const server = state.currentPoint.serverPlayerId;
    const defender = server === "A" ? "B" : "A";
    expect(state.currentPoint.lockedByPlayerIds).toEqual([server]);
    expect(derivePublicView(state, server).visibleAttackTop).toBeNull();
    const visible = derivePublicView(state, defender).visibleAttackTop;
    expect(visible).toHaveLength(3);
    expect(visible?.map((item) => item.base)).toEqual(
      [...(visible?.map((item) => item.base) ?? [])].sort((a, b) => b - a),
    );
    expect(JSON.stringify(derivePublicView(state, defender))).not.toContain(
      "temporary",
    );
  });
  it("accepts uncapped V3 defense points and reveals the attack bonus only at comparison", () => {
    let state = createMatch(v3Input());
    const attacker = state.currentPoint.attackerPlayerId;
    const defender = attacker === "A" ? "B" : "A";
    const pairId = state.rules.stages.service.pairs[0]!.id;
    state = command(state, defender, {
      type: "ALLOCATE",
      stage: "service",
      allocations: { [allocationSkillKey(pairId, "defense")]: 8 },
    });
    state = command(state, defender, {
      type: "LOCK_ALLOCATION",
      stage: "service",
    });
    state = command(state, attacker, { type: "CHOOSE_ATTACK", pairId });
    const reveal = state.history.find(
      (event) => event.type === "COMPARISON_REVEALED",
    );
    expect(reveal?.type === "COMPARISON_REVEALED" && reveal.attack.bonus).toBe(
      4,
    );
    expect(
      reveal?.type === "COMPARISON_REVEALED" && reveal.defense.temporary,
    ).toBe(8);
  });
});

describe("Candidate V4 resource carry", () => {
  const v4Input = () => input({ candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS });
  it("carries unspent serve points with the player when roles swap", () => {
    let state = createMatch(v4Input());
    const server = state.currentPoint.serverPlayerId;
    const receiver = server === "A" ? "B" : "A";
    const pair = state.rules.stages.service.pairs[0]!;
    state.players[server]!.projectBattleValues[pair.id]!.attack = 10;
    state.players[receiver]!.projectBattleValues[pair.id]!.defense = 10;
    for (const playerId of [server, receiver]) {
      const isAttacker = playerId === server;
      const key = allocationSkillKey(
        pair.id,
        isAttacker ? "attack" : "defense",
      );
      state = command(state, playerId, {
        type: "ALLOCATE",
        stage: "service",
        allocations: { [key]: isAttacker ? 2 : 0 },
      });
      state = command(state, playerId, {
        type: "LOCK_ALLOCATION",
        stage: "service",
      });
    }
    state = command(state, server, { type: "CHOOSE_ATTACK", pairId: pair.id });
    expect(state.currentPoint.stage).toBe("receive");
    expect(state.reservePoints[server]).toBe(2);
    expect(state.reservePoints[receiver]).toBe(10);
    expect(derivePublicView(state, server).availableBudget).toBe(12);
    expect(derivePublicView(state, server).opponent).not.toHaveProperty(
      "reservePoints",
    );
  });

  it("allows defense over four per item, but caps one attack at four", () => {
    let state = createMatch(v4Input());
    const server = state.currentPoint.serverPlayerId;
    const receiver = server === "A" ? "B" : "A";
    state.reservePoints[server] = 20;
    const pairs = state.rules.stages.service.pairs;
    const defense = Object.fromEntries(
      pairs.map((pair, index) => [
        allocationSkillKey(pair.id, "defense"),
        index === 0 ? 8 : 0,
      ]),
    );
    state = command(state, receiver, {
      type: "ALLOCATE",
      stage: "service",
      allocations: defense,
    });
    expect(() =>
      command(state, server, {
        type: "ALLOCATE",
        stage: "service",
        allocations: { [allocationSkillKey(pairs[0]!.id, "attack")]: 5 },
      }),
    ).toThrow(/cap|exceeds/i);
    expect(
      state.currentPoint.allocations[receiver]?.[
        allocationSkillKey(pairs[0]!.id, "defense")
      ],
    ).toBe(8);
  });

  it("carries a counter defender's unspent reserve into Rally", () => {
    let state = createMatch(v4Input());
    const attacker = state.currentPoint.receiverPlayerId;
    const defender = state.currentPoint.serverPlayerId;
    const pair = state.rules.stages.receive.pairs[0]!;
    state.currentPoint.stage = "receive";
    state.phase = "RECEIVE_ALLOCATING";
    state.currentPoint.attackerPlayerId = attacker;
    state.currentPoint.allocations = { A: null, B: null };
    state.currentPoint.lockedByPlayerIds = [];
    state.reservePoints[defender] = 2;
    state.players[attacker]!.projectBattleValues[pair.id]!.attack = 10;
    state.players[defender]!.projectBattleValues[pair.id]!.defense = 10;
    state = command(state, attacker, {
      type: "ALLOCATE",
      stage: "receive",
      allocations: { [allocationSkillKey(pair.id, "attack")]: 0 },
    });
    state = command(state, attacker, {
      type: "LOCK_ALLOCATION",
      stage: "receive",
    });
    state = command(state, defender, {
      type: "ALLOCATE",
      stage: "receive",
      allocations: { [allocationSkillKey(pair.id, "defense")]: 8 },
    });
    state = command(state, defender, {
      type: "LOCK_ALLOCATION",
      stage: "receive",
    });
    state = command(state, attacker, {
      type: "CHOOSE_ATTACK",
      pairId: pair.id,
    });
    expect(state.currentPoint.stage).toBe("rally");
    expect(state.reservePoints[defender]).toBe(4);
    expect(derivePublicView(state, defender).availableBudget).toBe(24);
  });

  it("allows exactly four V4 Rally comparisons and no reallocation after locking", () => {
    let state = createMatch(v4Input());
    const pairs = state.rules.stages.rally.pairs;
    state.phase = "RALLY_SELECTING";
    state.currentPoint.stage = "rally";
    state.currentPoint.attackerPlayerId = "A";
    state.currentPoint.allocations = { A: {}, B: {} };
    state.currentPoint.lockedByPlayerIds = ["A", "B"];
    state.currentPoint.rallyAdvantagesFromA = [];
    state.currentPoint.rallyRound = 1;
    for (const player of Object.values(state.players))
      for (const pair of pairs)
        player.projectBattleValues[pair.id] = { attack: 10, defense: 10 };
    for (let index = 0; index < 4; index += 1) {
      const attacker = state.currentPoint.attackerPlayerId;
      state = command(state, attacker, {
        type: "CHOOSE_ATTACK",
        pairId: pairs[index % pairs.length]!.id,
      });
    }
    expect(state.phase).toBe("POINT_END");
    expect(
      state.history.filter(
        (event) =>
          event.type === "COMPARISON_REVEALED" && event.stage === "rally",
      ),
    ).toHaveLength(4);
    expect(state.reservePoints).toEqual({ A: 0, B: 0 });
  });

  it("validates the one-time Rally mixed pool with separate attack caps", () => {
    let state = createMatch(v4Input());
    state.phase = "RALLY_ALLOCATING";
    state.currentPoint.stage = "rally";
    state.currentPoint.allocations = { A: null, B: null };
    state.currentPoint.lockedByPlayerIds = [];
    state.reservePoints.A = 3;
    const pairs = state.rules.stages.rally.pairs;
    const legal = Object.fromEntries([
      ...pairs.map((pair) => [allocationSkillKey(pair.id, "attack"), 4]),
      ...pairs.map((pair, index) => [
        allocationSkillKey(pair.id, "defense"),
        index === 0 ? 3 : 0,
      ]),
    ]);
    state = command(state, "A", {
      type: "ALLOCATE",
      stage: "rally",
      allocations: legal,
    });
    expect(
      Object.values(state.currentPoint.allocations.A!).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(23);
    state = command(state, "A", { type: "LOCK_ALLOCATION", stage: "rally" });
    expect(() =>
      command(state, "B", {
        type: "ALLOCATE",
        stage: "rally",
        allocations: {
          ...legal,
          [allocationSkillKey(pairs[0]!.id, "defense")]: 4,
        },
      }),
    ).toThrow(/available budget/);
    expect(() =>
      command(state, "A", {
        type: "ALLOCATE",
        stage: "rally",
        allocations: legal,
      }),
    ).toThrow(/locked|already/i);
  });

  it("resolves exact four-round ties with an alternating point fallback", () => {
    expect(resolveCandidateV4RallyTieBreak([0, 0, 0, 0], ["A", "B"], 1)).toBe(
      "B",
    );
    expect(resolveCandidateV4RallyTieBreak([0, 0, 0, 0], ["A", "B"], 2)).toBe(
      "A",
    );
    expect(resolveCandidateV4RallyTieBreak([2, -1, 1, -1], ["A", "B"], 1)).toBe(
      "A",
    );
  });
});

function input(overrides: Partial<CreateMatchInput> = {}): CreateMatchInput {
  return {
    id: "test-match",
    bestOf: 1,
    firstServerPlayerId: "A",
    playerA: { id: "A", loadout: loadout(playerA.id) },
    playerB: { id: "B", loadout: loadout(playerB.id) },
    catalog,
    ...overrides,
  };
}

function allocation(
  state: MatchState,
  stage: Stage,
  playerId: string,
): Allocation {
  const keys = getAllocationSkillKeys(state, stage, playerId);
  const rule = state.rules.stages[stage];
  let remaining = rule.budget;
  const values: Allocation = {};
  for (const key of keys) {
    const points = Math.min(rule.perItemCap ?? remaining, remaining);
    values[key] = points;
    remaining -= points;
    if (remaining === 0) break;
  }
  if (remaining !== 0) throw new Error("Test allocation cannot spend budget");
  return values;
}

type CommandInput = {
  [T in GameCommand as T["type"]]: Omit<T, "expectedVersion">;
}[GameCommand["type"]];

function command(
  state: MatchState,
  actor: string,
  data: CommandInput,
): MatchState {
  return applyCommand(state, actor, {
    ...data,
    expectedVersion: state.version,
  } as GameCommand).state;
}

function lockBoth(state: MatchState, stage: Stage): MatchState {
  for (const id of state.playerOrder) {
    state = command(state, id, {
      type: "ALLOCATE",
      stage,
      allocations: allocation(state, stage, id),
    });
    state = command(state, id, { type: "LOCK_ALLOCATION", stage });
  }
  return state;
}

describe("approved data and loadout math", () => {
  it("loads the validated catalog and matching rule versions", () => {
    expect(catalog.players).toHaveLength(8);
    expect(catalog.skills.version).toBe(catalog.balance.version);
  });
  it("averages forehand and backhand and retains half points", () => {
    expect(
      calculateProjectBattleValues({
        pair: {
          attack: { forehand: 12, backhand: 13 },
          defense: { forehand: 8, backhand: 9 },
        },
      }),
    ).toEqual({ pair: { attack: 12.5, defense: 8.5 } });
  });
  it("evaluates every configured loadout combination and clamps all constants to 1..15", () => {
    let combinations = 0;
    for (const p of catalog.players)
      for (const b of catalog.blades)
        for (const fh of catalog.rubbers)
          for (const bh of catalog.rubbers) {
            const stats = calculateLoadoutStats(
              {
                playerId: p.id,
                bladeId: b.id,
                forehandRubberId: fh.id,
                backhandRubberId: bh.id,
              },
              catalog,
            );
            combinations += 1;
            for (const pair of Object.values(stats))
              for (const role of Object.values(pair))
                for (const value of Object.values(role)) {
                  expect(value).toBeGreaterThanOrEqual(1);
                  expect(value).toBeLessThanOrEqual(15);
                }
          }
    expect(combinations).toBe(
      catalog.players.length *
        catalog.blades.length *
        catalog.rubbers.length ** 2,
    );
  });
  it.each([
    "playerId",
    "bladeId",
    "forehandRubberId",
    "backhandRubberId",
  ] as const)("rejects an unknown %s", (field) => {
    expect(() =>
      calculateLoadoutStats(
        { ...loadout(playerA.id), [field]: "not-found" },
        catalog,
      ),
    ).toThrow();
  });
  it.each(catalog.players.map((p) => [p.name, p.baseTotal] as const))(
    "preserves confirmed base total for %s",
    (name, total) => {
      expect(catalog.players.find((p) => p.name === name)?.baseTotal).toBe(
        total,
      );
    },
  );
});

describe("serve rotation and scoring boundaries", () => {
  it.each(Array.from({ length: 20 }, (_, i) => i))(
    "uses two-point service blocks before deuce at point index %i",
    (i) => {
      const game = {
        number: 1,
        initialServerPlayerId: "A",
        score: { A: 0, B: 0 },
        pointsPlayed: i,
        isDeuce: false,
      };
      expect(
        getServerForNextPoint(game, catalog.balance.scoring, ["A", "B"]),
      ).toBe(Math.floor(i / 2) % 2 === 0 ? "A" : "B");
    },
  );
  it.each([
    ["A", 20, 10, 10],
    ["B", 21, 10, 11],
    ["A", 22, 11, 11],
    ["B", 23, 11, 12],
    ["A", 24, 12, 12],
    ["B", 25, 12, 13],
    ["A", 26, 13, 13],
    ["B", 27, 13, 14],
  ] as const)(
    "uses one-point rotation at deuce (%s, point %i)",
    (expected, pointsPlayed, a, b) => {
      expect(
        getServerForNextPoint(
          { initialServerPlayerId: "A", score: { A: a, B: b }, pointsPlayed },
          catalog.balance.scoring,
          ["A", "B"],
        ),
      ).toBe(expected);
    },
  );
  it.each([
    [9, 9, false],
    [10, 9, false],
    [10, 10, true],
    [11, 10, true],
    [11, 12, true],
  ] as const)("detects deuce at %i:%i", (a, b, expected) => {
    expect(isDeuceScore({ A: a, B: b }, 11)).toBe(expected);
  });
});

describe("match reducer and hidden state", () => {
  it("starts in service allocation and records a sequence-numbered event", () => {
    const state = createMatch(input());
    expect(state.phase).toBe("SERVICE_ALLOCATING");
    expect(state.history[0]).toMatchObject({ type: "MATCH_STARTED", seq: 1 });
  });
  it.each([1, 3, 5] as const)("supports best-of %i", (bestOf) =>
    expect(createMatch(input({ bestOf })).bestOf).toBe(bestOf),
  );
  it.each([0, 2, 4, 6] as const)("rejects best-of %i", (bestOf) =>
    expect(() => createMatch(input({ bestOf }))).toThrow(),
  );
  it("rejects empty IDs, duplicate participants and an outsider server", () => {
    expect(() => createMatch(input({ id: "" }))).toThrow();
    expect(() =>
      createMatch(
        input({ playerB: { id: "A", loadout: loadout(playerB.id) } }),
      ),
    ).toThrow();
    expect(() => createMatch(input({ firstServerPlayerId: "C" }))).toThrow();
  });
  it("rejects missing gear referenced by a loadout", () => {
    expect(() =>
      createMatch(
        input({
          playerA: {
            id: "A",
            loadout: { ...loadout(playerA.id), bladeId: "missing" },
          },
        }),
      ),
    ).toThrow();
  });
  it.each(["A", "B"])(
    "keeps unannounced allocations private from the opponent (%s)",
    (owner) => {
      let state = createMatch(input());
      const own = allocation(state, "service", owner);
      state = command(state, owner, {
        type: "ALLOCATE",
        stage: "service",
        allocations: own,
      });
      const view = derivePublicView(state, owner === "A" ? "B" : "A");
      expect(view.self.allocation).toBeNull();
      expect(view.opponent).not.toHaveProperty("allocation");
      expect(JSON.stringify(view)).not.toContain("temporary");
      expect(
        view.events.every((event) => event.type !== "ALLOCATION_LOCKED"),
      ).toBe(true);
    },
  );
  it("shows an allocation only to its owner and returns detached data", () => {
    let state = createMatch(input());
    const own = allocation(state, "service", "A");
    state = command(state, "A", {
      type: "ALLOCATE",
      stage: "service",
      allocations: own,
    });
    const view = derivePublicView(state, "A");
    expect(view.self.allocation).toEqual(own);
    expect(view.self.allocation).not.toBe(own);
    view.currentGame.score.A = 99;
    expect(state.currentGame.score.A).toBe(0);
  });
  it("rejects a public view for a nonparticipant", () =>
    expect(() => derivePublicView(createMatch(input()), "outsider")).toThrow());
  it.each(["A", "B"])("rejects stale command versions (%s)", (actor) => {
    expect(() =>
      applyCommand(createMatch(input()), actor, {
        type: "ADVANCE",
        expectedVersion: 3,
      }),
    ).toThrow(/Expected version/);
  });
  it.each(["unknown", ""])("rejects nonparticipant actor %s", (actor) => {
    expect(() =>
      applyCommand(createMatch(input()), actor, {
        type: "ADVANCE",
        expectedVersion: 0,
      }),
    ).toThrow();
  });
  it("requires exact allocation budget and enforces cap", () => {
    const state = createMatch(input());
    const pairId = state.rules.stages.service.pairs[0]!.id;
    expect(() =>
      applyCommand(state, "A", {
        type: "ALLOCATE",
        stage: "service",
        allocations: { [allocationSkillKey(pairId, "attack")]: 4 },
        expectedVersion: 0,
      }),
    ).toThrow(/exactly 10/);
    const overCap = allocation(state, "service", "A");
    overCap[Object.keys(overCap)[0]!] = 5;
    expect(() =>
      applyCommand(state, "A", {
        type: "ALLOCATE",
        stage: "service",
        allocations: overCap,
        expectedVersion: 0,
      }),
    ).toThrow(/integer from 0 to 4/);
  });
  it("rejects incorrect role and stage allocation keys", () => {
    const state = createMatch(input());
    const pairId = state.rules.stages.service.pairs[0]!.id;
    const wrong = allocation(state, "service", "A");
    delete wrong[allocationSkillKey(pairId, "attack")];
    wrong[allocationSkillKey(pairId, "defense")] = 4;
    expect(() =>
      applyCommand(state, "A", {
        type: "ALLOCATE",
        stage: "service",
        allocations: wrong,
        expectedVersion: 0,
      }),
    ).toThrow(/not available/);
    expect(() =>
      applyCommand(state, "A", {
        type: "ALLOCATE",
        stage: "receive",
        allocations: {},
        expectedVersion: 0,
      }),
    ).toThrow(/Cannot allocate/);
  });
  it("prevents edits after locking and double locks", () => {
    let state = createMatch(input());
    state = command(state, "A", {
      type: "ALLOCATE",
      stage: "service",
      allocations: allocation(state, "service", "A"),
    });
    state = command(state, "A", { type: "LOCK_ALLOCATION", stage: "service" });
    expect(() =>
      command(state, "A", {
        type: "ALLOCATE",
        stage: "service",
        allocations: allocation(state, "service", "A"),
      }),
    ).toThrow(/locked/);
    expect(() =>
      command(state, "A", { type: "LOCK_ALLOCATION", stage: "service" }),
    ).toThrow(/already locked/);
  });
  it("requires both locked allocations and only the current attacker can choose", () => {
    let state = createMatch(input());
    expect(() =>
      command(state, "A", { type: "CHOOSE_ATTACK", pairId: "service-1" }),
    ).toThrow();
    state = command(state, "A", {
      type: "ALLOCATE",
      stage: "service",
      allocations: allocation(state, "service", "A"),
    });
    state = command(state, "A", { type: "LOCK_ALLOCATION", stage: "service" });
    expect(() =>
      command(state, "B", { type: "CHOOSE_ATTACK", pairId: "service-1" }),
    ).toThrow();
  });
  it("rejects unknown pair IDs after both players lock", () => {
    const state = lockBoth(createMatch(input()), "service");
    expect(() =>
      command(state, state.currentPoint.attackerPlayerId, {
        type: "CHOOSE_ATTACK",
        pairId: "fake",
      }),
    ).toThrow();
  });
  it("reveals both final values only after the comparison happens", () => {
    let state = lockBoth(createMatch(input()), "service");
    const pairId = state.rules.stages.service.pairs[0]!.id;
    state = command(state, state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId,
    });
    const reveal = state.history.find(
      (event) => event.type === "COMPARISON_REVEALED",
    );
    expect(reveal).toMatchObject({ stage: "service", pairId });
    if (reveal?.type === "COMPARISON_REVEALED") {
      expect(reveal.attack.actual).toBe(
        reveal.attack.base + reveal.attack.temporary,
      );
      expect(reveal.defense.actual).toBe(
        reveal.defense.base + reveal.defense.temporary,
      );
    }
  });
  it("allows a revealed temporary final value to exceed the constant-stat cap", () => {
    let state = createMatch(input());
    const pairId = state.rules.stages.service.pairs[0]!.id;
    state.players.A!.projectBattleValues[pairId]!.attack = 15;
    state.players.B!.projectBattleValues[pairId]!.defense = 10;
    state = lockBoth(state, "service");
    state = command(state, "A", { type: "CHOOSE_ATTACK", pairId });
    const reveal = state.history.find(
      (event) =>
        event.type === "COMPARISON_REVEALED" && event.pairId === pairId,
    );
    expect(reveal?.type === "COMPARISON_REVEALED" && reveal.attack.actual).toBe(
      19,
    );
  });
  it("does not mutate the input state if a command fails validation", () => {
    const state = createMatch(input());
    const before = structuredClone(state);
    expect(() =>
      applyCommand(state, "A", {
        type: "ADVANCE",
        expectedVersion: state.version,
      }),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("transitions from undecided service to receive then rally", () => {
    let state = lockBoth(createMatch(input()), "service");
    state = command(state, state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId: state.rules.stages.service.pairs[0]!.id,
    });
    expect(state.currentPoint.stage).toBe("receive");
    state = lockBoth(state, "receive");
    state = command(state, state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId: state.rules.stages.receive.pairs[0]!.id,
    });
    expect(state.currentPoint.stage).toBe("rally");
  });
  it("advances to another rally round and alternates attacker", () => {
    let state = lockBoth(createMatch(input()), "service");
    state = command(state, state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId: state.rules.stages.service.pairs[0]!.id,
    });
    state = lockBoth(state, "receive");
    state = command(state, state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId: state.rules.stages.receive.pairs[0]!.id,
    });
    const attacker = state.currentPoint.attackerPlayerId;
    state = lockBoth(state, "rally");
    state = command(state, attacker, {
      type: "CHOOSE_ATTACK",
      pairId: state.rules.stages.rally.pairs[0]!.id,
    });
    if (state.phase === "RALLY_SELECTING") {
      expect(state.currentPoint.rallyRound).toBe(2);
      expect(state.currentPoint.attackerPlayerId).not.toBe(attacker);
    }
  });
  it("ends the rally after five rounds and resolves a full tie for the fifth-round defender", () => {
    let state = createMatch(input());
    const rallyPairs = state.rules.stages.rally.pairs;
    for (const player of Object.values(state.players)) {
      for (const pair of rallyPairs)
        player.projectBattleValues[pair.id] = { attack: 10, defense: 10 };
    }
    state.phase = "RALLY_SELECTING";
    state.currentPoint.stage = "rally";
    state.currentPoint.attackerPlayerId = "A";
    state.currentPoint.allocations = { A: {}, B: {} };
    state.currentPoint.lockedByPlayerIds = ["A", "B"];
    state.currentPoint.rallyAdvantagesFromA = [2, -2, 1, -1];
    state.currentPoint.rallyRound = 5;
    state = command(state, "A", {
      type: "CHOOSE_ATTACK",
      pairId: rallyPairs[0]!.id,
    });
    expect(state.phase).toBe("POINT_END");
    expect(state.history.at(-1)).toMatchObject({
      type: "POINT_ENDED",
      winnerPlayerId: "B",
      reason: "rally_tie_break",
    });
  });
  it.each([
    [[2, -1, 1, -1], "A"],
    [[1, 1, 1, -3], "A"],
    [[3, -2, 1, -2], "A"],
    [[2, -2, 1, -1], "B"],
  ] as const)(
    "uses the rally tie-break for %s (%s)",
    (prior, expectedWinner) => {
      let state = createMatch(input());
      const rallyPairs = state.rules.stages.rally.pairs;
      for (const player of Object.values(state.players)) {
        for (const pair of rallyPairs)
          player.projectBattleValues[pair.id] = { attack: 10, defense: 10 };
      }
      state.phase = "RALLY_SELECTING";
      state.currentPoint.stage = "rally";
      state.currentPoint.attackerPlayerId = "A";
      state.currentPoint.allocations = { A: {}, B: {} };
      state.currentPoint.lockedByPlayerIds = ["A", "B"];
      state.currentPoint.rallyAdvantagesFromA = [...prior];
      state.currentPoint.rallyRound = 5;
      state = command(state, "A", {
        type: "CHOOSE_ATTACK",
        pairId: rallyPairs[0]!.id,
      });
      expect(state.history.at(-1)).toMatchObject({
        type: "POINT_ENDED",
        winnerPlayerId: expectedWinner,
        reason: "rally_tie_break",
      });
    },
  );
  it("requires point or game end before advancing", () => {
    expect(() =>
      command(createMatch(input()), "A", { type: "ADVANCE" }),
    ).toThrow(/Cannot advance/);
  });
  it("finishes a game and match at 11:9 when a service comparison is decisive", () => {
    let state = createMatch(input());
    const pairId = state.rules.stages.service.pairs[0]!.id;
    state.currentGame.score = { A: 10, B: 9 };
    state.currentGame.pointsPlayed = 19;
    state.phase = "SERVICE_SELECTING";
    state.currentPoint.allocations = { A: {}, B: {} };
    state.currentPoint.lockedByPlayerIds = ["A", "B"];
    state.players.A!.projectBattleValues[pairId]!.attack = 15;
    state.players.B!.projectBattleValues[pairId]!.defense = 1;
    state = command(state, "A", { type: "CHOOSE_ATTACK", pairId });
    expect(state.currentGame.score).toEqual({ A: 11, B: 9 });
    expect(state.status).toBe("COMPLETED");
    expect(state.winnerPlayerId).toBe("A");
    expect(state.history.map((event) => event.type)).toEqual(
      expect.arrayContaining(["GAME_ENDED", "MATCH_ENDED"]),
    );
  });
  it("starts the next game with the opposite initial server in a best-of-3", () => {
    let state = createMatch(input({ bestOf: 3 }));
    const pairId = state.rules.stages.service.pairs[0]!.id;
    state.currentGame.score = { A: 10, B: 9 };
    state.currentGame.pointsPlayed = 19;
    state.phase = "SERVICE_SELECTING";
    state.currentPoint.allocations = { A: {}, B: {} };
    state.currentPoint.lockedByPlayerIds = ["A", "B"];
    state.players.A!.projectBattleValues[pairId]!.attack = 15;
    state.players.B!.projectBattleValues[pairId]!.defense = 1;
    state = command(state, "A", { type: "CHOOSE_ATTACK", pairId });
    expect(state.phase).toBe("GAME_END");
    state = command(state, "B", { type: "ADVANCE" });
    expect(state.currentGame).toMatchObject({
      number: 2,
      initialServerPlayerId: "B",
      score: { A: 0, B: 0 },
    });
    expect(state.currentPoint.serverPlayerId).toBe("B");
  });
});
