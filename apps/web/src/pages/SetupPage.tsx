import { useEffect, useMemo, useState } from "react";
import {
  calculateLoadoutStats,
  calculateProjectBattleValues,
} from "@paddle-tactics/game-core";
import type { Loadout } from "@paddle-tactics/game-core";
import { createSandboxMatch, fetchCatalog } from "../lib/api.js";
import type { PublicCatalog, SandboxSetup } from "../lib/api.js";

type Seat = "A" | "B";
type GearChoice = Omit<Loadout, "playerId">;
type SetupState = Record<Seat, { playerId: string } & GearChoice>;
type Props = { navigate: (path: string) => void };

function PlayerSetupCard({
  seat,
  setup,
  catalog,
  onChange,
}: {
  seat: Seat;
  setup: SetupState[Seat];
  catalog: PublicCatalog;
  onChange: (seat: Seat, key: keyof SetupState[Seat], value: string) => void;
}) {
  const player = catalog.players.find((item) => item.id === setup.playerId)!;
  const loadout: Loadout = { ...setup };
  const stats = calculateLoadoutStats(loadout, catalog);
  const projectValues = calculateProjectBattleValues(stats);
  const baseline = calculateLoadoutStats(
    {
      playerId: setup.playerId,
      bladeId: catalog.blades[0]!.id,
      forehandRubberId: catalog.rubbers[0]!.id,
      backhandRubberId: catalog.rubbers[0]!.id,
    },
    catalog,
  );
  const changedValues = Object.entries(stats).flatMap(([pairId, roles]) =>
    (Object.keys(roles) as (keyof typeof roles)[]).flatMap((role) =>
      (Object.keys(roles[role]) as (keyof (typeof roles)[typeof role])[])
        .map((side) => ({
          pairId,
          role,
          side,
          before: baseline[pairId]![role][side],
          after: roles[role][side],
        }))
        .filter((row) => row.before !== row.after),
    ),
  );

  return (
    <section className="setup-card" aria-labelledby={`seat-${seat}`}>
      <div className="seat-heading">
        <div
          className={`avatar avatar-${seat.toLowerCase()}`}
          aria-hidden="true"
        >
          <span />
        </div>
        <div>
          <span className="eyebrow">PLAYER {seat}</span>
          <h2 id={`seat-${seat}`}>{player.name}</h2>
          <p>{player.style}</p>
        </div>
        <span className="total-pill">基础 {player.baseTotal}</span>
      </div>
      <div className="select-grid">
        <label className="field field-wide">
          球员
          <select
            value={setup.playerId}
            onChange={(event) => onChange(seat, "playerId", event.target.value)}
          >
            {catalog.players.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.baseTotal}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-wide">
          底板
          <select
            value={setup.bladeId}
            onChange={(event) => onChange(seat, "bladeId", event.target.value)}
          >
            {catalog.blades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.style}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          正手胶皮
          <select
            value={setup.forehandRubberId}
            onChange={(event) =>
              onChange(seat, "forehandRubberId", event.target.value)
            }
          >
            {catalog.rubbers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          反手胶皮
          <select
            value={setup.backhandRubberId}
            onChange={(event) =>
              onChange(seat, "backhandRubberId", event.target.value)
            }
          >
            {catalog.rubbers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="preview-summary">
        <div>
          <span className="preview-label">配置变化</span>
          <strong>
            {changedValues.length
              ? `${changedValues.length} 项能力变化`
              : "默认配置"}
          </strong>
        </div>
        <span className="preview-note">相对首个底板与胶皮的常驻值</span>
      </div>
      {changedValues.length > 0 && (
        <details className="change-details">
          <summary>查看器材带来的数值变化</summary>
          <div className="change-list">
            {changedValues.slice(0, 8).map((row) => {
              const pair = Object.values(catalog.skills.stages)
                .flatMap((stage) => stage.pairs)
                .find((item) => item.id === row.pairId)!;
              const ability =
                row.role === "attack" ? pair.attackName : pair.defenseName;
              return (
                <span key={`${row.pairId}-${row.role}-${row.side}`}>
                  {row.side === "forehand" ? "正手" : "反手"}·{ability}{" "}
                  <b>
                    {row.before} → {row.after} (
                    {row.after > row.before ? "+" : ""}
                    {row.after - row.before})
                  </b>
                </span>
              );
            })}
            {changedValues.length > 8 && (
              <small>另有 {changedValues.length - 8} 项变化</small>
            )}
          </div>
        </details>
      )}
      <details className="stats-details">
        <summary>查看 15 项平均战斗值</summary>
        <div className="stats-table-wrap">
          {Object.entries(catalog.skills.stages).map(([stageId, stage]) => (
            <section className="stats-stage" key={stageId}>
              <h3>{stage.label}</h3>
              {stage.pairs.map((pair) => (
                <div className="stats-row" key={pair.id}>
                  <span>
                    {pair.attackName}
                    <small> ↔ {pair.defenseName}</small>
                  </span>
                  <b>
                    {projectValues[pair.id]?.attack.toFixed(1)} /{" "}
                    {projectValues[pair.id]?.defense.toFixed(1)}
                  </b>
                </div>
              ))}
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}

export function SetupPage({ navigate }: Props) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [setups, setSetups] = useState<SetupState | null>(null);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [firstServerPlayerId, setFirstServer] = useState<Seat>("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCatalog()
      .then((result) => {
        setCatalog(result);
        const firstGear = {
          bladeId: result.blades[0]!.id,
          forehandRubberId: result.rubbers[0]!.id,
          backhandRubberId: result.rubbers[0]!.id,
        };
        setSetups({
          A: { playerId: result.players[0]!.id, ...firstGear },
          B: { playerId: result.players[1]!.id, ...firstGear },
        });
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "无法读取游戏数据"),
      );
  }, []);

  const updateSetup = (
    seat: Seat,
    key: keyof SetupState[Seat],
    value: string,
  ) => {
    setSetups((current) =>
      current
        ? { ...current, [seat]: { ...current[seat], [key]: value } }
        : current,
    );
  };

  const canStart = useMemo(() => Boolean(catalog && setups), [catalog, setups]);

  const startMatch = async () => {
    if (!catalog || !setups) return;
    setLoading(true);
    setError(null);
    try {
      const setup: SandboxSetup = {
        bestOf,
        firstServerPlayerId,
        playerA: { id: "A", loadout: { ...setups.A } },
        playerB: { id: "B", loadout: { ...setups.B } },
      };
      const result = await createSandboxMatch(setup);
      navigate(`/match/${result.matchId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法创建比赛");
      setLoading(false);
    }
  };

  return (
    <main className="content-page setup-page">
      <button className="back-link" onClick={() => navigate("/play")}>
        ← 返回对局方式
      </button>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">BUILD YOUR RACKET</span>
          <h1 className="page-title">配置本地对局</h1>
          <p className="page-lede">
            每位选手选择球员、底板与两面胶皮。数值会根据当前配装即时更新。
          </p>
        </div>
        <span className="version-badge">
          {catalog?.version ?? "balance_v1.1"}
        </span>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {!catalog || !setups ? (
        <div className="loading-panel">正在加载球员与器材数据…</div>
      ) : (
        <>
          <div className="setup-grid">
            {(["A", "B"] as const).map((seat) => (
              <PlayerSetupCard
                key={seat}
                seat={seat}
                setup={setups[seat]}
                catalog={catalog}
                onChange={updateSetup}
              />
            ))}
          </div>
          <section className="match-options">
            <div>
              <span className="eyebrow">MATCH FORMAT</span>
              <h2>比赛设置</h2>
            </div>
            <div className="option-group">
              <span>赛制</span>
              <div className="segmented-control">
                {([1, 3, 5] as const).map((value) => (
                  <button
                    key={value}
                    className={bestOf === value ? "is-selected" : ""}
                    onClick={() => setBestOf(value)}
                  >
                    BO{value}
                  </button>
                ))}
              </div>
            </div>
            <div className="option-group">
              <span>首局发球</span>
              <div className="segmented-control">
                {(["A", "B"] as const).map((seat) => (
                  <button
                    key={seat}
                    className={
                      firstServerPlayerId === seat ? "is-selected" : ""
                    }
                    onClick={() => setFirstServer(seat)}
                  >
                    选手 {seat}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="button button-primary start-match-button"
              disabled={!canStart || loading}
              onClick={() => void startMatch()}
            >
              {loading ? "正在开赛…" : "确认配装并开始比赛　↗"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
