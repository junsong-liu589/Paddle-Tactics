import { describe, expect, it } from "vitest";
import { loadCatalog } from "@paddle-tactics/game-data";
import {
  GuestSessionService,
  OnlineRoomError,
  OnlineRoomService,
  hashToken,
  type OnlineGameCommand,
  type SessionRecord,
} from "./online.js";

const catalog = loadCatalog();
const loadout = {
  playerId: catalog.players[0]!.id,
  bladeId: catalog.blades[0]!.id,
  forehandRubberId: catalog.rubbers[0]!.id,
  backhandRubberId: catalog.rubbers[0]!.id,
};

describe("guest sessions", () => {
  it("stores only a token hash and authenticates a live token", async () => {
    const stored: { current: SessionRecord | null } = { current: null };
    const sessions = new GuestSessionService({
      async create(record) {
        stored.current = record;
      },
      async findByTokenHash(tokenHash) {
        return stored.current?.tokenHash === tokenHash ? stored.current : null;
      },
    });
    const identity = await sessions.create();
    expect(stored.current?.tokenHash).toBe(hashToken(identity.token));
    expect(stored.current?.tokenHash).not.toBe(identity.token);
    expect(await sessions.authenticate(identity.token)).toMatchObject({
      id: identity.id,
    });
    expect(await sessions.authenticate("bad-token")).toBeNull();
  });
});

describe("online authoritative rooms", () => {
  it("creates a six-character invite code, starts after both ready, and hides private allocations", () => {
    const service = new OnlineRoomService(catalog, 60);
    const room = service.createRoom("guest-a", 3, loadout);
    expect(room.roomCode).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    service.joinRoom("guest-b", room.roomCode, {
      ...loadout,
      playerId: catalog.players[1]!.id,
    });
    service.attach("guest-a", "socket-a");
    service.attach("guest-b", "socket-b");
    service.setReady("guest-a", room.roomCode, true);
    expect(service.snapshotByCode(room.roomCode).status).toBe("WAITING");
    service.setReady("guest-b", room.roomCode, true);
    expect(service.snapshotByCode(room.roomCode).status).toBe("ACTIVE");

    const viewA = service.getView("guest-a", room.roomCode);
    const keys = catalog.skills.stages.service.pairs.map(
      (pair) =>
        `${pair.id}.${viewA.point.attackerPlayerId === "A" ? "attack" : "defense"}`,
    );
    const allocation = Object.fromEntries(keys.map((key) => [key, 0]));
    const updated = service.command(
      "guest-a",
      room.roomCode,
      "alloc-command-001",
      viewA.version,
      {
        type: "ALLOCATE",
        stage: "service",
        allocations: allocation,
      } as OnlineGameCommand,
    );
    const hiddenView = service.getView("guest-b", room.roomCode);
    expect(hiddenView.opponent).not.toHaveProperty("allocation");
    expect(JSON.stringify(hiddenView)).not.toContain("alloc-command-001");
    expect(updated.version).toBeGreaterThan(viewA.version);
  });

  it("returns cached results for duplicate commands and rejects stale versions", () => {
    const service = new OnlineRoomService(catalog, 60);
    const room = service.createRoom("guest-a", 1, loadout);
    service.joinRoom("guest-b", room.roomCode, {
      ...loadout,
      playerId: catalog.players[1]!.id,
    });
    service.setReady("guest-a", room.roomCode, true);
    service.setReady("guest-b", room.roomCode, true);
    const view = service.getView("guest-a", room.roomCode);
    const role =
      view.point.attackerPlayerId === view.self.id ? "attack" : "defense";
    const keys = catalog.skills.stages.service.pairs.map(
      (pair) => `${pair.id}.${role}`,
    );
    const allocation = Object.fromEntries(keys.map((key) => [key, 0]));
    const payload = {
      type: "ALLOCATE" as const,
      stage: "service" as const,
      allocations: allocation,
    } as OnlineGameCommand;
    const first = service.command(
      "guest-a",
      room.roomCode,
      "duplicate-alloc-01",
      view.version,
      payload,
    );
    const retry = service.command(
      "guest-a",
      room.roomCode,
      "duplicate-alloc-01",
      view.version,
      payload,
    );
    expect(retry.version).toBe(first.version);
    expect(() =>
      service.command(
        "guest-a",
        room.roomCode,
        "stale-attack-01",
        view.version,
        {
          type: "CHOOSE_ATTACK",
          pairId: catalog.skills.stages.service.pairs[0]!.id,
        },
      ),
    ).toThrowError(OnlineRoomError);
  });

  it("accepts both hidden allocations when they race on the same phase version", () => {
    const service = new OnlineRoomService(catalog, 60);
    const room = service.createRoom("guest-a", 1, loadout);
    service.joinRoom("guest-b", room.roomCode, {
      ...loadout,
      playerId: catalog.players[1]!.id,
    });
    service.setReady("guest-a", room.roomCode, true);
    service.setReady("guest-b", room.roomCode, true);
    const viewA = service.getView("guest-a", room.roomCode);
    const viewB = service.getView("guest-b", room.roomCode);
    const allocations = (role: "attack" | "defense") =>
      Object.fromEntries(
        catalog.skills.stages.service.pairs.map((pair) => [
          `${pair.id}.${role}`,
          0,
        ]),
      );
    const allocationFor = (view: typeof viewA) =>
      allocations(
        view.point.attackerPlayerId === view.self.id ? "attack" : "defense",
      );
    const first = service.command(
      "guest-a",
      room.roomCode,
      "parallel-alloc-a01",
      viewA.version,
      {
        type: "ALLOCATE",
        stage: "service",
        allocations: allocationFor(viewA),
      } as OnlineGameCommand,
    );
    expect(() =>
      service.command(
        "guest-b",
        room.roomCode,
        "parallel-alloc-b01",
        viewB.version,
        {
          type: "ALLOCATE",
          stage: "service",
          allocations: allocationFor(viewB),
        } as OnlineGameCommand,
      ),
    ).not.toThrow();
    expect(service.getView("guest-a", room.roomCode).version).toBeGreaterThan(
      first.version,
    );
  });

  it("rejects non-members and invalid catalog loadouts", () => {
    const service = new OnlineRoomService(catalog);
    const room = service.createRoom("guest-a", 3, loadout);
    expect(() => service.getView("intruder", room.roomCode)).toThrowError(
      OnlineRoomError,
    );
    expect(() =>
      service.joinRoom("guest-b", room.roomCode, {
        ...loadout,
        bladeId: "unknown",
      }),
    ).toThrowError(OnlineRoomError);
  });
});
