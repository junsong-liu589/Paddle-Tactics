import { useEffect, useMemo, useState } from "react";
import { allocationSkillKey } from "@paddle-tactics/game-core";
import type {
  Allocation,
  GameCommand,
  MatchPublicView,
  Stage,
} from "@paddle-tactics/game-core";
import {
  fetchCatalog,
  getSandboxView,
  sendSandboxCommand,
} from "../lib/api.js";
import type { PublicCatalog } from "../lib/api.js";

type Seat = "A" | "B";
type Props = { matchId: string; navigate: (path: string) => void };

function playerName(catalog: PublicCatalog, playerId: string): string {
  return (
    catalog.players.find((player) => player.id === playerId)?.name ?? playerId
  );
}

function legalKeys(view: MatchPublicView, catalog: PublicCatalog): string[] {
  const stage = view.point.stage;
  const pairs = catalog.skills.stages[stage].pairs;
  if (stage === "rally") {
    return pairs.flatMap((pair) => [
      allocationSkillKey(pair.id, "attack"),
      allocationSkillKey(pair.id, "defense"),
    ]);
  }
  const role =
    view.self.id === view.point.attackerPlayerId ? "attack" : "defense";
  return pairs.map((pair) => allocationSkillKey(pair.id, role));
}

function skillLabel(key: string, stage: Stage, catalog: PublicCatalog): string {
  const [pairId, role] = key.split(".");
  const pair = catalog.skills.stages[stage].pairs.find(
    (item) => item.id === pairId,
  );
  if (!pair) return key;
  return role === "attack" ? pair.attackName : pair.defenseName;
}

function distributeEvenly(
  keys: string[],
  budget: number,
  cap: number,
): Allocation {
  const allocation: Allocation = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  let remaining = budget;
  while (remaining > 0) {
    let placed = false;
    for (const key of keys) {
      if (remaining === 0) break;
      if (allocation[key]! < cap) {
        allocation[key] = allocation[key]! + 1;
        remaining -= 1;
        placed = true;
      }
    }
    if (!placed) throw new Error("当前阶段无法分配全部点数");
  }
  return allocation;
}

function distributeInOrder(
  keys: string[],
  budget: number,
  cap: number,
): Allocation {
  const allocation: Allocation = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  let remaining = budget;
  for (const key of keys) {
    const points = Math.min(cap, remaining);
    allocation[key] = points;
    remaining -= points;
    if (remaining === 0) return allocation;
  }
  throw new Error("当前阶段无法分配全部点数");
}

function nextActor(view: MatchPublicView, actor: Seat): Seat {
  if (view.phase.endsWith("_ALLOCATING")) {
    if (view.self.allocationLocked && !view.opponent.allocationLocked) {
      return view.opponent.id as Seat;
    }
    return actor;
  }
  if (view.phase.endsWith("_SELECTING"))
    return view.point.attackerPlayerId as Seat;
  return actor;
}

export function MatchPage({ matchId, navigate }: Props) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [viewerId, setViewerId] = useState<Seat>("A");
  const [view, setView] = useState<MatchPublicView | null>(null);
  const [handoffTo, setHandoffTo] = useState<Seat | null>(null);
  const [draft, setDraft] = useState<Allocation>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCatalog(), getSandboxView(matchId, "A")])
      .then(([loadedCatalog, initialView]) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        setViewerId("A");
        setView(initialView);
        setDraft(initialView.self.allocation ?? {});
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "无法载入比赛"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [matchId]);

  const stageRules =
    catalog && view ? catalog.skills.stages[view.point.stage] : null;
  const keys = catalog && view ? legalKeys(view, catalog) : [];
  const spent = keys.reduce((sum, key) => sum + (draft[key] ?? 0), 0);
  const lastReveal = useMemo(
    () =>
      view?.events
        .filter((event) => event.type === "COMPARISON_REVEALED")
        .at(-1),
    [view?.events],
  );
  const selfName =
    catalog && view ? playerName(catalog, view.self.loadout.playerId) : "选手";
  const opponentName =
    catalog && view
      ? playerName(catalog, view.opponent.loadout.playerId)
      : "对手";

  useEffect(() => {
    if (view && view.self.id === viewerId) setDraft(view.self.allocation ?? {});
  }, [view?.version, view?.point.number, view?.point.stage, viewerId]);

  const showNextActor = (nextView: MatchPublicView, actor: Seat) => {
    const next = nextActor(nextView, actor);
    if (next !== actor) {
      setView(null);
      setHandoffTo(next);
      setViewerId(next);
      setDraft({});
    } else {
      setHandoffTo(null);
      setView(nextView);
    }
  };

  const sendCommand = async (command: GameCommand) => {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const nextView = await sendSandboxCommand(matchId, view.self.id, command);
      showNextActor(nextView, view.self.id as Seat);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "命令未能执行");
    } finally {
      setBusy(false);
    }
  };

  const lockAllocation = async () => {
    if (!view || !stageRules || !catalog) return;
    setBusy(true);
    setError(null);
    try {
      const allocated = await sendSandboxCommand(matchId, view.self.id, {
        type: "ALLOCATE",
        expectedVersion: view.version,
        stage: view.point.stage,
        allocations: Object.fromEntries(
          keys.map((key) => [key, draft[key] ?? 0]),
        ),
      });
      const locked = await sendSandboxCommand(matchId, view.self.id, {
        type: "LOCK_ALLOCATION",
        expectedVersion: allocated.version,
        stage: view.point.stage,
      });
      showNextActor(locked, view.self.id as Seat);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法锁定本阶段分配");
    } finally {
      setBusy(false);
    }
  };

  const resumeHandoff = async () => {
    if (!handoffTo) return;
    setLoading(true);
    setError(null);
    try {
      setView(await getSandboxView(matchId, handoffTo));
      setHandoffTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法载入当前回合");
    } finally {
      setLoading(false);
    }
  };

  const adjustDraft = (key: string, amount: number) => {
    if (!stageRules || !view || view.self.allocationLocked) return;
    setDraft((current) => {
      const nextValue = (current[key] ?? 0) + amount;
      const total = keys.reduce(
        (sum, activeKey) => sum + (current[activeKey] ?? 0),
        0,
      );
      if (nextValue < 0 || nextValue > stageRules.perItemCap) return current;
      if (amount > 0 && total >= stageRules.budget) return current;
      return { ...current, [key]: nextValue };
    });
  };

  const setEvenDraft = () => {
    if (!stageRules) return;
    try {
      setDraft(
        distributeEvenly(keys, stageRules.budget, stageRules.perItemCap),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "自动分配失败");
    }
  };

  const setOrderedDraft = () => {
    if (!stageRules) return;
    try {
      setDraft(
        distributeInOrder(keys, stageRules.budget, stageRules.perItemCap),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "默认分配失败");
    }
  };

  if (loading)
    return (
      <main className="content-page">
        <div className="loading-panel">正在载入比赛…</div>
      </main>
    );
  if (handoffTo) {
    return (
      <main className="handoff-screen">
        <span className="eyebrow">LOCAL TWO-PLAYER</span>
        <div
          className={`avatar avatar-${handoffTo.toLowerCase()}`}
          aria-hidden="true"
        >
          <span />
        </div>
        <h1>请交给选手 {handoffTo}</h1>
        <p>前一位选手的分配已收起。确认屏幕已交接后，再显示你的回合。</p>
        <button
          className="button button-primary"
          onClick={() => void resumeHandoff()}
        >
          显示选手 {handoffTo} 的回合
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  }
  if (error && !view)
    return (
      <main className="content-page">
        <div className="notice notice-error" role="alert">
          {error}
        </div>
        <button
          className="button button-secondary"
          onClick={() => navigate("/play")}
        >
          返回首页
        </button>
      </main>
    );
  if (!catalog || !view || !stageRules) return null;

  const currentGameScore = view.currentGame.score;
  const currentPointResult = view.events
    .filter((event) => event.type === "POINT_ENDED")
    .at(-1);
  const allocationPhase = view.phase.endsWith("_ALLOCATING");
  const selectingPhase = view.phase.endsWith("_SELECTING");
  const currentStageName = catalog.skills.stages[view.point.stage].label;
  const attackPlayerName =
    view.point.attackerPlayerId === view.self.id ? selfName : opponentName;
  const defensePlayerName =
    view.point.attackerPlayerId === view.self.id ? opponentName : selfName;
  const selectedPair =
    lastReveal?.type === "COMPARISON_REVEALED"
      ? catalog.skills.stages[lastReveal.stage].pairs.find(
          (pair) => pair.id === lastReveal.pairId,
        )
      : undefined;

  return (
    <main
      className="content-page match-page"
      data-match-version={view.version}
      data-busy={busy}
      data-point-number={view.point.number}
      data-rally-round={view.point.rallyRound}
    >
      <div className="match-topbar">
        <button className="back-link" onClick={() => navigate("/play")}>
          ← 退出本地对局
        </button>
        <span className="version-badge">
          BO{view.bestOf} · {catalog.version}
        </span>
        <span className="local-status">
          <i /> 本地沙盒
        </span>
      </div>
      <section className="scoreboard" aria-label="当前比分">
        <div className="score-player">
          <span>选手 A</span>
          <strong>{view.gamesWon.A ?? 0}</strong>
          <small>{playerName(catalog, view.playerOrder[0])}</small>
        </div>
        <div className="score-center">
          <span>局分</span>
          <b>
            {currentGameScore.A ?? 0}
            <i>:</i>
            {currentGameScore.B ?? 0}
          </b>
          <small>
            第 {view.currentGame.number} 局 · 第 {view.point.number} 分
          </small>
        </div>
        <div className="score-player score-player-right">
          <span>选手 B</span>
          <strong>{view.gamesWon.B ?? 0}</strong>
          <small>{playerName(catalog, view.playerOrder[1])}</small>
        </div>
      </section>

      <section className="match-context">
        <div className="context-player">
          <div className="avatar avatar-a">
            <span />
          </div>
          <div>
            <small>PLAYER A</small>
            <strong>{view.self.id === "A" ? selfName : opponentName}</strong>
            <span>
              {
                catalog.blades.find(
                  (gear) =>
                    gear.id ===
                    (view.self.id === "A"
                      ? view.self.loadout.bladeId
                      : view.opponent.loadout.bladeId),
                )?.name
              }
            </span>
          </div>
        </div>
        <div className="phase-pill">
          <span>当前阶段</span>
          <strong>
            {view.phase === "POINT_END"
              ? "本分结束"
              : view.phase === "GAME_END"
                ? "本局结束"
                : view.phase === "MATCH_END"
                  ? "比赛结束"
                  : currentStageName}
          </strong>
          <small>
            {view.phase.startsWith("RALLY")
              ? `相持第 ${view.point.rallyRound} 轮`
              : view.phase.endsWith("_ALLOCATING")
                ? "秘密分配"
                : view.phase.endsWith("_SELECTING")
                  ? "选择进攻项目"
                  : "比分更新"}
          </small>
        </div>
        <div className="context-player context-player-right">
          <div className="avatar avatar-b">
            <span />
          </div>
          <div>
            <small>PLAYER B</small>
            <strong>{view.self.id === "B" ? selfName : opponentName}</strong>
            <span>
              {
                catalog.blades.find(
                  (gear) =>
                    gear.id ===
                    (view.self.id === "B"
                      ? view.self.loadout.bladeId
                      : view.opponent.loadout.bladeId),
                )?.name
              }
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {allocationPhase && (
        <section className="match-panel allocation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PLAYER {viewerId} · YOUR TURN</span>
              <h1>秘密分配点数</h1>
              <p>对手只会看到你是否锁定，不会看到点数分布。</p>
            </div>
            <div className="budget-counter">
              <strong>
                {spent}
                <small> / {stageRules.budget}</small>
              </strong>
              <span>已分配点数</span>
            </div>
          </div>
          <div className="opponent-lock">
            <span
              className={
                view.opponent.allocationLocked
                  ? "lock-indicator locked"
                  : "lock-indicator"
              }
            />
            {view.opponent.allocationLocked ? "对手已锁定" : "等待对手锁定"}
            <span className="private-hint">你的分配仅自己可见</span>
          </div>
          <div
            className={`allocation-grid ${view.point.stage === "rally" ? "allocation-grid-rally" : ""}`}
          >
            {keys.map((key) => {
              const value = draft[key] ?? 0;
              const pairId = key.split(".")[0]!;
              const pair = stageRules.pairs.find((item) => item.id === pairId)!;
              const role = key.split(".")[1];
              const base =
                view.self.projectBattleValues[pairId]?.[
                  role as "attack" | "defense"
                ];
              return (
                <article className="allocation-card" key={key}>
                  <div>
                    <strong>
                      {skillLabel(key, view.point.stage, catalog)}
                    </strong>
                    <small>
                      {role === "attack" ? pair.attackName : pair.defenseName}
                    </small>
                  </div>
                  <span className="base-value">基础 {base?.toFixed(1)}</span>
                  <div className="allocation-control">
                    <button
                      aria-label={`减少${skillLabel(key, view.point.stage, catalog)}点数`}
                      disabled={
                        view.self.allocationLocked || value <= 0 || busy
                      }
                      onClick={() => adjustDraft(key, -1)}
                    >
                      −
                    </button>
                    <output
                      aria-label={`${skillLabel(key, view.point.stage, catalog)}加点`}
                    >
                      {value}
                    </output>
                    <button
                      aria-label={`增加${skillLabel(key, view.point.stage, catalog)}点数`}
                      disabled={
                        view.self.allocationLocked ||
                        value >= stageRules.perItemCap ||
                        spent >= stageRules.budget ||
                        busy
                      }
                      onClick={() => adjustDraft(key, 1)}
                    >
                      ＋
                    </button>
                  </div>
                  <small className="cap-note">
                    上限 +{stageRules.perItemCap}
                  </small>
                </article>
              );
            })}
          </div>
          <div className="allocation-footer">
            <button
              className="text-button"
              disabled={view.self.allocationLocked || busy}
              onClick={() => setDraft({})}
            >
              重置
            </button>
            <button
              className="button button-secondary"
              disabled={view.self.allocationLocked || busy}
              onClick={setEvenDraft}
            >
              均匀分配剩余点数
            </button>
            <button
              className="button button-secondary"
              disabled={view.self.allocationLocked || busy}
              onClick={setOrderedDraft}
            >
              按项目顺序分配
            </button>
            <button
              className="button button-primary"
              disabled={
                view.self.allocationLocked ||
                busy ||
                spent !== stageRules.budget
              }
              onClick={() => void lockAllocation()}
            >
              {view.self.allocationLocked
                ? "已锁定"
                : busy
                  ? "正在锁定…"
                  : `锁定 ${stageRules.budget} 点并交接`}
            </button>
          </div>
          {spent !== stageRules.budget && (
            <p className="form-hint">
              还需分配 {stageRules.budget - spent} 点才可以锁定。
            </p>
          )}
        </section>
      )}

      {selectingPhase && (
        <section className="match-panel selection-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                PLAYER {viewerId} · CHOOSE YOUR ATTACK
              </span>
              <h1>
                {view.point.attackerPlayerId === view.self.id
                  ? "选择进攻项目"
                  : "等待选择"}
              </h1>
              <p>基础战斗值公开；尚未比较的加点仍保持隐藏。</p>
            </div>
            <div className="budget-counter">
              <strong>
                {view.point.rallyRound}
                <small> / {view.point.stage === "rally" ? "5" : "1"}</small>
              </strong>
              <span>当前轮次</span>
            </div>
          </div>
          <div className="comparison-preview">
            <div>
              <small>{attackPlayerName} · 进攻</small>
              <strong>
                {baseFor(
                  view,
                  view.point.attackerPlayerId,
                  stageRules.pairs[0]!.id,
                  "attack",
                )?.toFixed(1) ?? "—"}
              </strong>
            </div>
            <span>VS</span>
            <div>
              <small>{defensePlayerName} · 防守</small>
              <strong>
                {baseFor(
                  view,
                  view.point.attackerPlayerId === view.self.id
                    ? view.opponent.id
                    : view.self.id,
                  stageRules.pairs[0]!.id,
                  "defense",
                )?.toFixed(1) ?? "—"}
              </strong>
            </div>
          </div>
          {view.point.attackerPlayerId === view.self.id ? (
            <div className="attack-options">
              {stageRules.pairs.map((pair) => (
                <button
                  key={pair.id}
                  className="attack-option"
                  aria-label={`选择：${pair.attackName}`}
                  disabled={busy}
                  onClick={() =>
                    void sendCommand({
                      type: "CHOOSE_ATTACK",
                      expectedVersion: view.version,
                      pairId: pair.id,
                    })
                  }
                >
                  <span>
                    <strong>{pair.attackName}</strong>
                    <small>对位防守：{pair.defenseName}</small>
                  </span>
                  <b>选择 ↗</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="waiting-panel">
              <span className="waiting-pulse" />
              等待选手 {view.point.attackerPlayerId} 选择进攻项目…
            </div>
          )}
        </section>
      )}

      {lastReveal?.type === "COMPARISON_REVEALED" && selectedPair && (
        <section className="reveal-panel" aria-live="polite">
          <span className="eyebrow">
            JUST REVEALED · {selectedPair.attackName} VS{" "}
            {selectedPair.defenseName}
          </span>
          <div className="reveal-values">
            <div>
              <small>
                {lastReveal.attackerPlayerId === view.self.id
                  ? selfName
                  : opponentName}{" "}
                · {selectedPair.attackName}
              </small>
              <strong>
                {lastReveal.attack.base.toFixed(1)}{" "}
                <i>+ {lastReveal.attack.temporary}</i> ={" "}
                {lastReveal.attack.actual.toFixed(1)}
              </strong>
            </div>
            <span className="versus-mark">VS</span>
            <div>
              <small>
                {lastReveal.defenderPlayerId === view.self.id
                  ? selfName
                  : opponentName}{" "}
                · {selectedPair.defenseName}
              </small>
              <strong>
                {lastReveal.defense.base.toFixed(1)}{" "}
                <i>+ {lastReveal.defense.temporary}</i> ={" "}
                {lastReveal.defense.actual.toFixed(1)}
              </strong>
            </div>
          </div>
          <div className="reveal-outcome">
            <span>
              差值 {lastReveal.delta > 0 ? "+" : ""}
              {lastReveal.delta.toFixed(1)}
            </span>
            <b>
              {lastReveal.outcome === "continue"
                ? "未达决胜阈值，继续下一阶段"
                : "直接得分"}
            </b>
          </div>
        </section>
      )}

      {(view.phase === "POINT_END" || view.phase === "GAME_END") && (
        <section className="match-panel point-result-panel">
          <span className="eyebrow">
            {view.phase === "GAME_END" ? "GAME COMPLETE" : "POINT COMPLETE"}
          </span>
          <h2>
            {currentPointResult?.type === "POINT_ENDED"
              ? `${currentPointResult.winnerPlayerId === "A" ? "选手 A" : "选手 B"} 赢下这一分`
              : "比分已更新"}
          </h2>
          <div className="result-scoreline">
            {currentGameScore.A ?? 0}
            <span>:</span>
            {currentGameScore.B ?? 0}
          </div>
          <p>
            {currentPointResult?.type === "POINT_ENDED"
              ? reasonLabel(currentPointResult.reason)
              : ""}
          </p>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() =>
              void sendCommand({
                type: "ADVANCE",
                expectedVersion: view.version,
              })
            }
          >
            {view.phase === "GAME_END" ? "开始下一局" : "继续下一分"} →
          </button>
        </section>
      )}

      {view.phase === "MATCH_END" && (
        <section className="match-panel point-result-panel final-result-panel">
          <span className="eyebrow">MATCH COMPLETE</span>
          <h2>
            {view.winnerPlayerId === "A" ? "选手 A" : "选手 B"} 赢得本场比赛
          </h2>
          <p>所有比分和已揭晓的攻防对比已记录在本地比赛战报中。</p>
          <button
            className="button button-primary"
            onClick={() => navigate(`/result/${matchId}`)}
          >
            查看赛果与逐分记录 ↗
          </button>
        </section>
      )}

      <footer className="match-footnote">
        本地双人沙盒 · 对手未揭晓的临时点数由本地服务端保管
      </footer>
    </main>
  );
}

function baseFor(
  view: MatchPublicView,
  playerId: string,
  pairId: string,
  role: "attack" | "defense",
): number | undefined {
  const player = playerId === view.self.id ? view.self : view.opponent;
  return player.projectBattleValues[pairId]?.[role];
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    service_direct: "发球阶段直接得分",
    receive_direct: "反制阶段直接得分",
    rally_direct: "相持阶段直接得分",
    rally_tie_break: "五轮相持后按累计优势决胜",
  };
  return labels[reason] ?? reason;
}
