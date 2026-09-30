import { useEffect, useMemo, useState } from "react";
import type { Loadout } from "@paddle-tactics/game-core";
import { fetchCatalog } from "../lib/api.js";
import type { PublicCatalog, SandboxSetup } from "../lib/api.js";
import { createLocalAiMatch, createLocalMatch } from "../lib/local-game.js";
import { PlayerAvatar } from "../components/PlayerAvatar.js";
import { PlayerShowcase } from "../components/PlayerShowcase.js";

type Seat = "A" | "B";
type GearChoice = Omit<Loadout, "playerId">;
type SetupState = Record<Seat, { playerId: string } & GearChoice>;
type Props = { navigate: (path: string) => void; isAi: boolean };

function PlayerSetupCard({
  seat,
  setup,
  catalog,
  onChange,
  title,
}: {
  seat: Seat;
  setup: SetupState[Seat];
  catalog: PublicCatalog;
  onChange: (seat: Seat, key: keyof SetupState[Seat], value: string) => void;
  title: string;
}) {
  const player = catalog.players.find((item) => item.id === setup.playerId)!;
  const blade = catalog.blades.find((item) => item.id === setup.bladeId)!;
  const rubbers = {
    forehand: catalog.rubbers.find(
      (item) => item.id === setup.forehandRubberId,
    )!,
    backhand: catalog.rubbers.find(
      (item) => item.id === setup.backhandRubberId,
    )!,
  };
  const statBreakdown = (pairId: string, role: "attack" | "defense") => {
    const sideValue = (side: "forehand" | "backhand") => {
      const base = player.stats[pairId]![role][side];
      const bladeModifier = blade.modifiers
        .filter((item) => item.pairId === pairId && item.role === role)
        .reduce((sum, item) => sum + item.value, 0);
      const rubberModifier = rubbers[side].modifiers
        .filter((item) => item.pairId === pairId && item.role === role)
        .reduce((sum, item) => sum + item.value, 0);
      const value = Math.min(
        catalog.balance.constantStatMax,
        Math.max(
          catalog.balance.constantStatMin,
          base + bladeModifier + rubberModifier,
        ),
      );
      return { base, bladeModifier, rubberModifier, value };
    };
    return { forehand: sideValue("forehand"), backhand: sideValue("backhand") };
  };
  const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

  return (
    <section className="setup-card" aria-labelledby={`seat-${seat}`}>
      <div className="seat-heading">
        <PlayerAvatar
          className="setup-player-avatar"
          playerId={player.id}
          name={player.name}
        />
        <div>
          <span className="eyebrow">{title}</span>
          <h2 id={`seat-${seat}`}>{player.name}</h2>
          <p>{player.style}</p>
        </div>
      </div>
      <PlayerShowcase loadout={setup} catalog={catalog} compact />
      <div className="select-grid">
        <label className="field field-wide">
          球员
          <select
            value={setup.playerId}
            onChange={(event) => onChange(seat, "playerId", event.target.value)}
          >
            {catalog.players.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
      <details className="stats-details" open>
        <summary>球员 + 球拍 + 胶皮 · 15 组攻防能力明细</summary>
        <div className="stats-table-wrap">
          {Object.entries(catalog.skills.stages).map(([stageId, stage]) => (
            <section className="stats-stage" key={stageId}>
              <h3>{stage.label}</h3>
              {stage.pairs.map((pair) => (
                <div className="setup-stat-pair" key={pair.id}>
                  {(["attack", "defense"] as const).map((role) => {
                    const breakdown = statBreakdown(pair.id, role);
                    const ability =
                      role === "attack" ? pair.attackName : pair.defenseName;
                    return (
                      <div className="setup-stat-row" key={role}>
                        <strong>{ability}</strong>
                        <span>
                          正手 {breakdown.forehand.base}
                          {signed(breakdown.forehand.bladeModifier)}
                          {signed(breakdown.forehand.rubberModifier)} ={" "}
                          <b>{breakdown.forehand.value}</b>
                        </span>
                        <span>
                          反手 {breakdown.backhand.base}
                          {signed(breakdown.backhand.bladeModifier)}
                          {signed(breakdown.backhand.rubberModifier)} ={" "}
                          <b>{breakdown.backhand.value}</b>
                        </span>
                        <small>
                          项目战斗值{" "}
                          {(
                            (breakdown.forehand.value +
                              breakdown.backhand.value) /
                            2
                          ).toFixed(1)}
                        </small>
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="stat-formula-note">
          单侧常驻值 = 球员 + 底板 + 对应侧胶皮（范围{" "}
          {catalog.balance.constantStatMin}–{catalog.balance.constantStatMax}
          ）；项目战斗值为正手与反手的平均值。
        </p>
      </details>
    </section>
  );
}

export function SetupPage({ navigate, isAi }: Props) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [setups, setSetups] = useState<SetupState | null>(null);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [firstServerPlayerId, setFirstServer] = useState<Seat>("A");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal",
  );
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
      const result = isAi
        ? createLocalAiMatch({ ...setup, difficulty })
        : createLocalMatch(setup);
      navigate(`/match/${result.matchId}${isAi ? "/ai" : ""}`);
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
          <h1 className="page-title">
            {isAi ? "配置 AI 对局" : "配置本地对局"}
          </h1>
          <p className="page-lede">
            {isAi
              ? "选择你和 AI 的球员与装备，再设定 AI 难度。难度只影响策略，不会改变规则或数值。"
              : "每位选手选择球员、底板与两面胶皮。数值会根据当前配装即时更新。"}
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
                title={
                  isAi
                    ? seat === "A"
                      ? "YOU"
                      : "AI OPPONENT"
                    : `PLAYER ${seat}`
                }
              />
            ))}
          </div>
          <section className="match-options">
            <div>
              <span className="eyebrow">MATCH FORMAT</span>
              <h2>比赛设置</h2>
            </div>
            {isAi && (
              <div className="option-group">
                <span>AI 难度</span>
                <div className="segmented-control">
                  {(["easy", "normal", "hard"] as const).map((value) => (
                    <button
                      key={value}
                      className={difficulty === value ? "is-selected" : ""}
                      onClick={() => setDifficulty(value)}
                    >
                      {value === "easy"
                        ? "简单"
                        : value === "normal"
                          ? "普通"
                          : "困难"}
                    </button>
                  ))}
                </div>
                <small>纯本地策略计算，不调用付费 AI API。</small>
              </div>
            )}
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
              {loading
                ? "正在开赛…"
                : isAi
                  ? "开始 AI 对局　↗"
                  : "确认配装并开始比赛　↗"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
