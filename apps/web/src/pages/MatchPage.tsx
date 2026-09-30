import { useCallback, useEffect, useState } from "react";
import { allocationSkillKey } from "@paddle-tactics/game-core";
import type {
  Allocation,
  DomainEvent,
  GameCommand,
  MatchPublicView,
  Stage,
} from "@paddle-tactics/game-core";
import { fetchCatalog } from "../lib/api.js";
import type { PublicCatalog } from "../lib/api.js";
import { getLocalMatchView, sendLocalMatchCommand } from "../lib/local-game.js";
import { BATTLE_FEEDBACK_TIMING_MS } from "../lib/animation-timing.js";
import { PlayerAvatar } from "../components/PlayerAvatar.js";

type Seat = "A" | "B";
type Props = {
  matchId: string;
  navigate: (path: string) => void;
  isAi: boolean;
};
type ComparisonEvent = Extract<DomainEvent, { type: "COMPARISON_REVEALED" }>;
type FeedbackState = {
  event: ComparisonEvent;
  queuedEvents: ComparisonEvent[];
  step: "announce" | "comparison" | "outcome";
  actor: Seat;
  nextView: MatchPublicView;
};

function playerName(catalog: PublicCatalog, playerId: string): string {
  return (
    catalog.players.find((player) => player.id === playerId)?.name ?? playerId
  );
}

function battleStateLabel(state: string): string {
  switch (state) {
    case "attacking":
      return "Attacking · 进攻";
    case "defending":
      return "Defending · 防守";
    case "success":
      return "Success · 防守成功";
    case "broken":
      return "Miss · 防线被突破";
    case "celebrate":
      return "Celebrate · 得分";
    default:
      return "Ready · 准备";
  }
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
  cap: number | ((key: string) => number),
): Allocation {
  const allocation: Allocation = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  let remaining = budget;
  while (remaining > 0) {
    let placed = false;
    for (const key of keys) {
      if (remaining === 0) break;
      if (allocation[key]! < (typeof cap === "number" ? cap : cap(key))) {
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
  cap: number | ((key: string) => number),
): Allocation {
  const allocation: Allocation = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  let remaining = budget;
  for (const key of keys) {
    const points = Math.min(
      typeof cap === "number" ? cap : cap(key),
      remaining,
    );
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

export function MatchPage({ matchId, navigate, isAi }: Props) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [viewerId, setViewerId] = useState<Seat>("A");
  const [view, setView] = useState<MatchPublicView | null>(null);
  const [handoffTo, setHandoffTo] = useState<Seat | null>(null);
  const [draft, setDraft] = useState<Allocation>({});
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [fastFeedback, setFastFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCatalog(), getLocalMatchView(matchId, "A")])
      .then(([loadedCatalog, match]) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        setViewerId("A");
        setView(match.view);
        setDraft(match.view.self.allocation ?? {});
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
  const budget = view?.availableBudget ?? 0;
  const isV4 = view?.rulesetId === "candidate_v4";
  const attackSpent = keys
    .filter((key) => key.endsWith(".attack"))
    .reduce((sum, key) => sum + (draft[key] ?? 0), 0);
  const selfName =
    catalog && view ? playerName(catalog, view.self.loadout.playerId) : "选手";
  const opponentName =
    catalog && view
      ? playerName(catalog, view.opponent.loadout.playerId)
      : "对手";

  useEffect(() => {
    if (view && view.self.id === viewerId) setDraft(view.self.allocation ?? {});
  }, [view?.version, view?.point.number, view?.point.stage, viewerId]);

  const showNextActor = useCallback(
    (nextView: MatchPublicView, actor: Seat) => {
      if (isAi) {
        setView(nextView);
        setViewerId("A");
        setHandoffTo(null);
        setDraft(nextView.self.allocation ?? {});
        return;
      }
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
    },
    [isAi],
  );

  const executeCommand = async (command: GameCommand) => {
    if (!view) throw new Error("比赛视图尚未载入");
    return sendLocalMatchCommand(matchId, view.self.id, command);
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(
      () => {
        if (feedback.step === "announce") {
          setFeedback({ ...feedback, step: "comparison" });
        } else if (feedback.step === "comparison") {
          setFeedback({ ...feedback, step: "outcome" });
        } else {
          const [nextEvent, ...queuedEvents] = feedback.queuedEvents;
          if (nextEvent) {
            setFeedback({
              ...feedback,
              event: nextEvent,
              queuedEvents,
              step: "announce",
            });
          } else {
            setFeedback(null);
            showNextActor(feedback.nextView, feedback.actor);
          }
        }
      },
      fastFeedback
        ? BATTLE_FEEDBACK_TIMING_MS.quick
        : BATTLE_FEEDBACK_TIMING_MS[feedback.step],
    );
    return () => window.clearTimeout(timer);
  }, [feedback, fastFeedback, showNextActor]);

  const sendCommand = async (command: GameCommand) => {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const nextView = await executeCommand(command);
      if (command.type === "CHOOSE_ATTACK") {
        const previousSeq = view.events.at(-1)?.seq ?? 0;
        const comparisons = nextView.events.filter(
          (event): event is ComparisonEvent =>
            event.type === "COMPARISON_REVEALED" && event.seq > previousSeq,
        );
        const comparison = comparisons[0];
        if (comparison) {
          setView(nextView);
          setViewerId(view.self.id as Seat);
          setHandoffTo(null);
          setFeedback({
            event: comparison,
            queuedEvents: comparisons.slice(1),
            step: "announce",
            actor: view.self.id as Seat,
            nextView,
          });
        } else showNextActor(nextView, view.self.id as Seat);
      } else showNextActor(nextView, view.self.id as Seat);
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
      const allocated = await executeCommand({
        type: "ALLOCATE",
        expectedVersion: view.version,
        stage: view.point.stage,
        allocations: Object.fromEntries(
          keys.map((key) => [key, draft[key] ?? 0]),
        ),
      });
      const locked = await executeCommand({
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
      setView((await getLocalMatchView(matchId, handoffTo)).view);
      setHandoffTo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法载入当前回合");
    } finally {
      setLoading(false);
    }
  };

  const adjustDraft = (key: string, amount: number) => {
    if (!stageRules || !view || view.self.allocationLocked || feedback) return;
    setDraft((current) => {
      const nextValue = (current[key] ?? 0) + amount;
      const total = keys.reduce(
        (sum, activeKey) => sum + (current[activeKey] ?? 0),
        0,
      );
      if (nextValue < 0) return current;
      const v4Cap = isV4 && key.endsWith(".attack") ? 4 : budget;
      if (nextValue > (isV4 ? v4Cap : (stageRules.perItemCap ?? budget)))
        return current;
      if (amount > 0 && total >= budget) return current;
      if (
        amount > 0 &&
        isV4 &&
        view.point.stage !== "rally" &&
        key.endsWith(".attack") &&
        attackSpent >= 4
      )
        return current;
      return { ...current, [key]: nextValue };
    });
  };

  const setEvenDraft = () => {
    if (!stageRules || !view) return;
    try {
      const isLimitedAttack =
        isV4 &&
        view.point.stage !== "rally" &&
        view.point.attackerPlayerId === view.self.id;
      const limit = isLimitedAttack
        ? Math.min(budget, 4)
        : isV4
          ? budget
          : stageRules.budget;
      const perKeyCap = (key: string) =>
        isV4
          ? key.endsWith(".attack")
            ? 4
            : budget
          : (stageRules.perItemCap ?? budget);
      setDraft(distributeEvenly(keys, limit, perKeyCap));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "自动分配失败");
    }
  };

  const setOrderedDraft = () => {
    if (!stageRules || !view) return;
    try {
      const isLimitedAttack =
        isV4 &&
        view.point.stage !== "rally" &&
        view.point.attackerPlayerId === view.self.id;
      const limit = isLimitedAttack
        ? Math.min(budget, 4)
        : isV4
          ? budget
          : stageRules.budget;
      const perKeyCap = (key: string) =>
        isV4
          ? key.endsWith(".attack")
            ? 4
            : budget
          : (stageRules.perItemCap ?? budget);
      setDraft(distributeInOrder(keys, limit, perKeyCap));
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
  const selectedPair = feedback
    ? catalog.skills.stages[feedback.event.stage].pairs.find(
        (pair) => pair.id === feedback.event.pairId,
      )
    : undefined;
  const seatPlayer = (seat: Seat) => {
    const playerId = view.playerOrder[seat === "A" ? 0 : 1]!;
    const isSelf = view.self.id === playerId;
    const loadout = isSelf ? view.self.loadout : view.opponent.loadout;
    const player = catalog.players.find(
      (candidate) => candidate.id === loadout.playerId,
    );
    const event = feedback?.event;
    const state = event
      ? feedback.step !== "outcome"
        ? event.attackerPlayerId === playerId
          ? "attacking"
          : "defending"
        : event.outcome === "attacker_wins"
          ? event.attackerPlayerId === playerId
            ? "celebrate"
            : "broken"
          : event.defenderPlayerId === playerId
            ? "success"
            : "ready"
      : view.phase.endsWith("_SELECTING")
        ? view.point.attackerPlayerId === playerId
          ? "attacking"
          : "defending"
        : "ready";
    return {
      playerId: loadout.playerId,
      name: player?.name ?? playerId,
      bladeName:
        catalog.blades.find((gear) => gear.id === loadout.bladeId)?.name ?? "",
      state,
    };
  };
  const playerAView = seatPlayer("A");
  const playerBView = seatPlayer("B");
  const feedbackAttackerName = feedback
    ? seatPlayer(feedback.event.attackerPlayerId as Seat).name
    : "";
  const feedbackDefenderName = feedback
    ? seatPlayer(feedback.event.defenderPlayerId as Seat).name
    : "";

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
          {isAi ? "← 退出 AI 对局" : "← 退出本地对局"}
        </button>
        <span className="version-badge">
          BO{view.bestOf} ·{" "}
          {view.rulesetId === "candidate_v4" ? "Candidate V4" : catalog.version}
        </span>
        <span className="local-status">
          <i /> {isAi ? "AI 单人对战" : "本地双人对战"}
        </span>
        <button
          className={`feedback-speed ${fastFeedback ? "is-fast" : ""}`}
          aria-pressed={fastFeedback}
          onClick={() => setFastFeedback((value) => !value)}
        >
          {fastFeedback ? "快速反馈已开" : "快速反馈"}
        </button>
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
        <div className={`context-player ${playerAView.state}`}>
          <PlayerAvatar
            className="battle-avatar"
            playerId={playerAView.playerId}
            name={playerAView.name}
          />
          <div>
            <small>PLAYER A</small>
            <strong>{playerAView.name}</strong>
            <span>{playerAView.bladeName}</span>
            <em>{battleStateLabel(playerAView.state)}</em>
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
        <div
          className={`context-player context-player-right ${playerBView.state}`}
        >
          <PlayerAvatar
            className="battle-avatar"
            playerId={playerBView.playerId}
            name={playerBView.name}
          />
          <div>
            <small>PLAYER B</small>
            <strong>{playerBView.name}</strong>
            <span>{playerBView.bladeName}</span>
            <em>{battleStateLabel(playerBView.state)}</em>
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
                <small> / {budget}</small>
              </strong>
              <span>
                {isV4 ? `可用点数 · Carry ${view.reservePoints}` : "已分配点数"}
              </span>
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
          {isV4 && view.visibleAttackTop && (
            <p className="form-hint">
              对手基础攻击 Top 3：
              {view.visibleAttackTop
                .map((item) => {
                  const pair = stageRules.pairs.find(
                    (candidate) => candidate.id === item.pairId,
                  );
                  return pair
                    ? `${pair.attackName} ${item.base.toFixed(1)}`
                    : "";
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div
            className={`allocation-grid ${view.point.stage === "rally" ? "allocation-grid-rally" : ""}`}
          >
            {keys.map((key) => {
              const value = draft[key] ?? 0;
              const pairId = key.split(".")[0]!;
              const pair = stageRules.pairs.find((item) => item.id === pairId)!;
              const role = key.split(".")[1];
              const isAttack = role === "attack";
              const perItemLimit = isV4
                ? isAttack
                  ? 4
                  : budget
                : (stageRules.perItemCap ?? budget);
              const rallyMixedAttack = view.point.stage === "rally" && isAttack;
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
                        value >= perItemLimit ||
                        spent >= budget ||
                        (isV4 &&
                          view.point.stage !== "rally" &&
                          isAttack &&
                          attackSpent >= 4) ||
                        Boolean(feedback) ||
                        busy
                      }
                      onClick={() => adjustDraft(key, 1)}
                    >
                      ＋
                    </button>
                  </div>
                  <small className="cap-note">
                    {rallyMixedAttack
                      ? "单项最多 +4"
                      : isV4 && role === "attack"
                        ? "单项最多 +4"
                        : isV4
                          ? "单项不限 · 共用预算"
                          : `单项最多 +${stageRules.perItemCap}`}
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
                (!isV4 && spent !== stageRules.budget)
              }
              onClick={() => void lockAllocation()}
            >
              {view.self.allocationLocked
                ? "已锁定"
                : busy
                  ? "正在锁定…"
                  : isV4
                    ? `${isAi ? "锁定本阶段" : "锁定并交接"}（花费 ${spent} / ${budget}）`
                    : `锁定 ${stageRules.budget} 点并交接`}
            </button>
          </div>
          {!isV4 && spent !== stageRules.budget && (
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
                  : isAi
                    ? "AI 正在选择…"
                    : `等待选手 ${view.point.attackerPlayerId} 选择…`}
              </h1>
              <p>基础战斗值公开；尚未比较的加点仍保持隐藏。</p>
            </div>
            <div className="budget-counter">
              <strong>
                {view.point.rallyRound}
                <small>
                  {` / ${view.point.stage === "rally" ? view.rallyMaxComparisons : 1}`}
                </small>
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
              {stageRules.pairs.map((pair) => {
                const spentOnPair = Object.entries(view.self.allocation ?? {})
                  .filter(
                    ([key, points]) => key.endsWith(".attack") && points > 0,
                  )
                  .map(([key]) => key.split(".")[0]);
                const unavailable =
                  isV4 &&
                  view.point.stage !== "rally" &&
                  spentOnPair.length > 0 &&
                  !spentOnPair.includes(pair.id);
                return (
                  <button
                    key={pair.id}
                    className="attack-option"
                    aria-label={`选择：${pair.attackName}`}
                    disabled={busy || Boolean(feedback) || unavailable}
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
                );
              })}
            </div>
          ) : (
            <div className="waiting-panel">
              <span className="waiting-pulse" />
              等待选手 {view.point.attackerPlayerId} 选择进攻项目…
            </div>
          )}
        </section>
      )}

      {feedback && selectedPair && (
        <section
          className={`battle-feedback feedback-${feedback.step} ${feedback.event.outcome === "attacker_wins" ? "feedback-score" : "feedback-hold"}`}
          role="status"
          aria-live="polite"
        >
          <span className="eyebrow">
            {feedback.event.stage === "rally"
              ? `相持第 ${feedback.event.round} 轮`
              : catalog.skills.stages[feedback.event.stage].label}
          </span>
          <h2>
            {feedback.step === "announce"
              ? `${selectedPair.attackName}！`
              : feedback.step === "comparison"
                ? "攻防对决"
                : feedback.event.outcome === "attacker_wins"
                  ? `突破！${feedbackAttackerName} 得分`
                  : `防守成功！${feedbackDefenderName} 守住了`}
          </h2>
          {feedback.step !== "announce" && (
            <div className="battle-feedback-values">
              <div>
                <small>
                  {feedbackAttackerName} · {selectedPair.attackName}
                </small>
                <strong>
                  攻击 {feedback.event.attack.actual.toFixed(1)}
                  <i> +{feedback.event.attack.temporary}</i>
                </strong>
              </div>
              <span>VS</span>
              <div>
                <small>
                  {feedbackDefenderName} · {selectedPair.defenseName}
                </small>
                <strong>
                  抗{selectedPair.attackName}{" "}
                  {feedback.event.defense.actual.toFixed(1)}
                  <i> +{feedback.event.defense.temporary}</i>
                </strong>
              </div>
            </div>
          )}
          {feedback.step === "outcome" && (
            <p>
              {feedback.event.outcome === "attacker_wins"
                ? "进攻超过决胜阈值，本分立即结束。"
                : feedback.event.stage === "rally"
                  ? "未达到决胜阈值，双方交换攻守。"
                  : "未达到决胜阈值，比赛进入下一阶段。"}
              {feedback.event.stage === "rally" && (
                <span> 本阶段最多 {view.rallyMaxComparisons} 次比较。</span>
              )}
            </p>
          )}
          <button
            className="feedback-skip"
            onClick={() => {
              setFeedback(null);
              showNextActor(feedback.nextView, feedback.actor);
            }}
          >
            跳过动画 →
          </button>
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
          <p>"所有比分和已揭晓的攻防对比已记录在本地比赛战报中。"</p>
          <button
            className="button button-primary"
            onClick={() => navigate(`/result/${matchId}${isAi ? "/ai" : ""}`)}
          >
            查看赛果与逐分记录 ↗
          </button>
        </section>
      )}

      <section className="match-live-feed" aria-labelledby="live-feed-heading">
        <div className="live-feed-heading">
          <div>
            <span className="eyebrow">PUBLIC MATCH LOG</span>
            <h2 id="live-feed-heading">比赛信息</h2>
          </div>
          <span>双方同步可见 · 未揭晓的加点不会显示</span>
        </div>
        <ol aria-live="polite">
          {view.events.map((event) => {
            if (event.type === "POINT_STARTED")
              return (
                <li key={event.seq}>
                  <span>第 {event.pointNumber} 分开始</span>
                  <small>
                    {playerName(catalog, event.serverPlayerId)} 发球
                  </small>
                </li>
              );
            if (event.type === "STAGE_CHANGED")
              return (
                <li key={event.seq}>
                  <span>
                    进入
                    {event.stage === "service"
                      ? "发球"
                      : event.stage === "receive"
                        ? "反制"
                        : "相持"}
                    阶段
                  </span>
                  <small>
                    {playerName(catalog, event.attackerPlayerId)} 获得进攻选择权
                  </small>
                </li>
              );
            if (event.type === "COMPARISON_REVEALED") {
              const pair = catalog.skills.stages[event.stage].pairs.find(
                (item) => item.id === event.pairId,
              );
              const threshold =
                event.stage === "rally"
                  ? catalog.balance.rally.threshold
                  : event.stage === "receive"
                    ? catalog.balance.receive.threshold
                    : catalog.balance.service.threshold;
              const resultText =
                event.outcome === "attacker_wins"
                  ? `${playerName(catalog, event.attackerPlayerId)} 突破得分`
                  : event.outcome === "defender_wins"
                    ? `${playerName(catalog, event.defenderPlayerId)} 防守得分`
                    : `差值未达 ${threshold} 点阈值，继续比赛`;
              return (
                <li className="live-feed-comparison" key={event.seq}>
                  <span>
                    {event.stage === "rally"
                      ? `相持第 ${event.round} 轮`
                      : catalog.skills.stages[event.stage].label}
                    {" · "}
                    {pair?.attackName ?? event.pairId}
                  </span>
                  <small>
                    {playerName(catalog, event.attackerPlayerId)} 攻击{" "}
                    {event.attack.actual.toFixed(1)} （基础{" "}
                    {event.attack.base.toFixed(1)} + 加点{" "}
                    {event.attack.temporary}）{"　vs　"}
                    {playerName(catalog, event.defenderPlayerId)} 防守{" "}
                    {event.defense.actual.toFixed(1)} （基础{" "}
                    {event.defense.base.toFixed(1)} + 加点{" "}
                    {event.defense.temporary}）
                  </small>
                  <b>{resultText}</b>
                </li>
              );
            }
            if (event.type === "RALLY_ROUND_CONTINUES")
              return (
                <li key={event.seq}>
                  <span>相持第 {event.round} 轮结束，攻守交换</span>
                  <small>
                    本轮优势：
                    {event.advantageFromA > 0
                      ? `选手 A +${event.advantageFromA}`
                      : event.advantageFromA < 0
                        ? `选手 B +${Math.abs(event.advantageFromA)}`
                        : "双方相同"}
                  </small>
                </li>
              );
            if (event.type === "POINT_ENDED")
              return (
                <li className="live-feed-point" key={event.seq}>
                  <span>
                    {playerName(catalog, event.winnerPlayerId)} 赢下这一分
                  </span>
                  <small>
                    比分 {event.score.A ?? 0}:{event.score.B ?? 0} ·{" "}
                    {reasonLabel(event.reason)}
                  </small>
                </li>
              );
            if (event.type === "GAME_ENDED")
              return (
                <li key={event.seq}>
                  <span>
                    {playerName(catalog, event.winnerPlayerId)} 赢下第{" "}
                    {event.gameNumber} 局
                  </span>
                </li>
              );
            if (event.type === "MATCH_ENDED")
              return (
                <li className="live-feed-point" key={event.seq}>
                  <span>
                    {playerName(catalog, event.winnerPlayerId)} 赢得本场比赛
                  </span>
                </li>
              );
            return null;
          })}
        </ol>
        {view.events.length === 0 && (
          <p>比赛开始后，公开的攻防比较与比分会显示在这里。</p>
        )}
      </section>

      <footer className="match-footnote">
        {isAi
          ? "单人 AI 对战 · AI 根据公开比赛信息和自身状态决策，不读取你的隐藏加点"
          : "同屏本地双人 · 双方轮流分配并交接设备"}
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
    rally_tie_break: "六轮相持后按累计优势决胜",
  };
  return labels[reason] ?? reason;
}
