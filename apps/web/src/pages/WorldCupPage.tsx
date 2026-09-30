import { useEffect, useMemo, useState } from "react";
import type { Loadout } from "@paddle-tactics/game-core";
import { CharacterPortrait } from "../components/CharacterPortrait.js";
import { ActionReplay, actionMotionFor } from "../components/ActionReplay.js";
import { PlayerShowcase } from "../components/PlayerShowcase.js";
import { createLocalAiMatch, getLocalMatchView } from "../lib/local-game.js";
import { fetchCatalog, fetchOlympicsCatalog } from "../lib/api.js";
import { createOlympics } from "../lib/olympics.js";
import { olympicTierLabel } from "../lib/olympics-catalog.js";
import type { PublicCatalog } from "../lib/api.js";
import {
  completedMatchGames,
  continueAsSpectator,
  createWorldCup,
  exitWorldCup,
  loadWorldCup,
  markHumanGameStarted,
  nextReadyMatch,
  recoverHumanMatch,
  recordHumanMatch,
  revealNextCupGame,
  roundName,
  saveWorldCup,
  startCpuPlayback,
} from "../lib/world-cup.js";
import type { CupMatch, CupRound, WorldCup } from "../lib/world-cup.js";

type Props = {
  navigate: (path: string) => void;
  mode?: "world-cup" | "olympics";
};
type CupSetup = {
  humanPlayerId: string;
  loadout: Loadout;
  favoritePlayerId: string;
};

function initialLoadout(playerId: string, catalog: PublicCatalog): Loadout {
  return {
    playerId,
    bladeId: catalog.blades[0]!.id,
    forehandRubberId: catalog.rubbers[0]!.id,
    backhandRubberId: catalog.rubbers[0]!.id,
  };
}

export function WorldCupPage({ navigate, mode = "world-cup" }: Props) {
  const isOlympics = mode === "olympics";
  const eventType = isOlympics ? "olympics" : "world-cup";
  const pagePath = isOlympics ? "/olympics" : "/world-cup";
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [cup, setCup] = useState<WorldCup | null>(null);
  const [participate, setParticipate] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<CupSetup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (isOlympics ? fetchOlympicsCatalog() : fetchCatalog())
      .then((value) => {
        setCatalog(value);
        setSetup({
          humanPlayerId: value.players[0]!.id,
          loadout: initialLoadout(value.players[0]!.id, value),
          favoritePlayerId: value.players[0]!.id,
        });
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "无法读取球员和装备数据",
        ),
      );
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setCup(loadWorldCup(id, eventType));
  }, [eventType, isOlympics]);

  useEffect(() => {
    if (
      !cup ||
      cup.phase !== "human-match" ||
      !cup.activeGameId ||
      !cup.activeMatchId
    )
      return;
    try {
      const active = getLocalMatchView(cup.activeGameId, "A").view;
      if (active.status === "COMPLETED") {
        const updated = recordHumanMatch(cup, cup.activeMatchId, active);
        saveWorldCup(updated);
        setCup(updated);
      }
    } catch {
      const updated = recoverHumanMatch(cup, cup.activeMatchId);
      saveWorldCup(updated);
      setCup(updated);
    }
  }, [cup]);

  useEffect(() => {
    if (!cup || cup.phase !== "cpu-playback") return;
    const timer = window.setTimeout(() => {
      const updated = revealNextCupGame(cup);
      saveWorldCup(updated);
      setCup(updated);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [cup]);

  useEffect(() => {
    if (!cup || cup.phase !== "ready") return;
    const match = nextReadyMatch(cup);
    if (
      !match ||
      (cup.humanPlayerId && match.playerIds.includes(cup.humanPlayerId))
    )
      return;
    const timer = window.setTimeout(() => {
      try {
        const updated = startCpuPlayback(
          cup,
          "wide-varied",
          catalog ?? undefined,
        );
        saveWorldCup(updated);
        setCup(updated);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "电脑对局模拟失败");
      }
    }, 3900);
    return () => window.clearTimeout(timer);
  }, [cup]);

  const players = useMemo(() => catalog?.players ?? [], [catalog]);
  const updateLoadout = (key: keyof Loadout, value: string) => {
    setSetup((current) => {
      if (!current) return current;
      const loadout = { ...current.loadout, [key]: value };
      if (key === "playerId") {
        loadout.bladeId = catalog!.blades[0]!.id;
        loadout.forehandRubberId = catalog!.rubbers[0]!.id;
        loadout.backhandRubberId = catalog!.rubbers[0]!.id;
        return {
          ...current,
          humanPlayerId: value,
          favoritePlayerId: value,
          loadout,
        };
      }
      return { ...current, loadout };
    });
  };

  const drawCup = () => {
    if (!catalog || !setup || participate === null) return;
    try {
      const createOptions = {
        catalog,
        ...(participate
          ? { humanPlayerId: setup.humanPlayerId, humanLoadout: setup.loadout }
          : { favoritePlayerId: setup.favoritePlayerId }),
      };
      const next = isOlympics
        ? createOlympics(createOptions)
        : createWorldCup(createOptions);
      saveWorldCup(next);
      setCup(next);
      window.history.replaceState(
        {},
        "",
        `${pagePath}?id=${encodeURIComponent(next.id)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建签表失败");
    }
  };

  const beginNextMatch = () => {
    if (!cup || !catalog || busy) return;
    const match = nextReadyMatch(cup);
    if (!match) return;
    if (cup.humanPlayerId && match.playerIds.includes(cup.humanPlayerId)) {
      setBusy(true);
      setError(null);
      try {
        const opponentId = match.playerIds.find(
          (playerId) => playerId !== cup.humanPlayerId,
        )!;
        const opponent = cup.participants[opponentId]!;
        const result = createLocalAiMatch({
          bestOf: 3,
          firstServerPlayerId:
            ((cup.seed ^ match.index ^ match.round) & 1) === 0 ? "A" : "B",
          playerA: {
            id: "A",
            loadout: cup.participants[cup.humanPlayerId]!.loadout,
          },
          playerB: { id: "B", loadout: opponent.loadout },
          difficulty: "normal",
          catalog,
          ...(!isOlympics
            ? {
                worldCupV43: {
                  harimotoSeat:
                    cup.humanPlayerId === "tomokazu-harimoto"
                      ? "A"
                      : opponentId === "tomokazu-harimoto"
                        ? "B"
                        : null,
                  seed:
                    (cup.seed ^
                      (match.round * 7919) ^
                      (match.index * 104729)) >>>
                    0,
                },
              }
            : {}),
        });
        const updated = markHumanGameStarted(cup, match.id, result.matchId);
        saveWorldCup(updated);
        setCup(updated);
        navigate(
          `/match/${result.matchId}/ai?cup=${encodeURIComponent(cup.id)}${isOlympics ? "&event=olympics" : ""}`,
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法开始参赛对局");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      try {
        const updated = startCpuPlayback(cup, "wide-varied", catalog);
        saveWorldCup(updated);
        setCup(updated);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "电脑对局模拟失败");
      } finally {
        setBusy(false);
      }
    }, 25);
  };

  const revealAllRemaining = () => {
    if (!cup) return;
    let updated = cup;
    const active = updated.matches.find(
      (match) => match.id === updated.activeMatchId,
    );
    if (active?.status === "playback") {
      for (
        let count = active.visibleGameCount;
        count < active.games.length;
        count += 1
      ) {
        updated = revealNextCupGame(updated);
      }
    }
    saveWorldCup(updated);
    setCup(updated);
  };

  const exitAfterLoss = () => {
    if (cup) saveWorldCup(exitWorldCup(cup));
    navigate("/play");
  };

  const continueAfterLoss = () => {
    if (!cup) return;
    const updated = continueAsSpectator(cup);
    saveWorldCup(updated);
    setCup(updated);
  };

  const playerName = (id: string | null) =>
    catalog?.players.find((player) => player.id === id)?.name ??
    (id ? "待定" : "—");

  if (!catalog || !setup)
    return (
      <main className="content-page">
        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : (
          <div className="loading-panel">
            正在准备{isOlympics ? "奥运会" : "世界杯"}赛场…
          </div>
        )}
      </main>
    );

  if (cup && !cup.participants) {
    return (
      <main className="content-page">
        <div className="notice notice-error" role="alert">
          这届{isOlympics ? "奥运会" : "世界杯"}记录无法读取，请重新开始。
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            setCup(null);
            setParticipate(null);
          }}
        >
          重新开始
        </button>
      </main>
    );
  }

  const activeMatch =
    cup?.matches.find((match) => match.id === cup.activeMatchId) ?? null;
  const visibleGames = activeMatch ? completedMatchGames(activeMatch) : [];
  const latestVisibleGame = visibleGames.at(-1);
  const replayLoserId = latestVisibleGame
    ? (activeMatch?.playerIds.find(
        (id) => id !== latestVisibleGame.winnerPlayerId,
      ) ??
      activeMatch?.playerIds[1] ??
      "")
    : "";
  const replayEndingAction = latestVisibleGame?.endingAction;
  const replayPair = replayEndingAction
    ? catalog?.skills.stages[replayEndingAction.stage].pairs.find(
        (pair) => pair.id === replayEndingAction.pairId,
      )
    : undefined;
  const canPlayActiveHuman = cup?.phase === "human-match" && cup.activeGameId;

  return (
    <main className="content-page world-cup-page">
      <button className="back-link" onClick={() => navigate("/play")}>
        ← 返回对局方式
      </button>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">
            {isOlympics
              ? "32-PLAYER SEEDED DRAW"
              : "EIGHT-PLAYER SINGLE ELIMINATION"}
          </span>
          <h1 className="page-title">乒乓{isOlympics ? "奥运会" : "世界杯"}</h1>
          <p className="page-lede">
            {isOlympics
              ? "32位球员按四档抽签，每个八分之一半区各含四档一人；电脑对决 BO7，真人对 AI BO3。"
              : "八位球员、完全随机抽签；电脑对决 BO7，真人对 AI BO3。V4.3 加入张本智和追分与落后局数的临时能力奖励。"}
            无需账号，全部在当前浏览器进行。
          </p>
        </div>
        <span className="version-badge">V4.3 · 本地 AI · 零服务器费用</span>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {!cup && (
        <>
          {participate === null ? (
            <section className="cup-choice-grid">
              <button
                className="cup-choice-card"
                onClick={() => setParticipate(true)}
              >
                <span>01</span>
                <strong>我来参赛</strong>
                <small>
                  选择一名球员并配置球拍，亲自打完该球员的比赛。真人对 AI 为
                  BO3。
                </small>
              </button>
              <button
                className="cup-choice-card"
                onClick={() => setParticipate(false)}
              >
                <span>02</span>
                <strong>纯观战</strong>
                <small>
                  {isOlympics ? "三十二" : "八"}
                  名球员全部由电脑操控。可选一名支持球员，高亮其晋级路线。
                </small>
              </button>
            </section>
          ) : (
            <section className="cup-entry-panel">
              <button
                className="text-button"
                onClick={() => setParticipate(null)}
              >
                ← 返回选择
              </button>
              {participate ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">PLAYER ENTRY</span>
                      <h2>选择球员并配置球拍</h2>
                      <p>确认配装后抽签；抽签完成后本届比赛中配装固定。</p>
                    </div>
                  </div>
                  <div className="cup-select-grid">
                    <label className="field">
                      参赛球员
                      <select
                        value={setup.humanPlayerId}
                        onChange={(event) =>
                          updateLoadout("playerId", event.target.value)
                        }
                      >
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name} · {player.style}
                            {isOlympics
                              ? ` · ${olympicTierLabel(player.id)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      底板
                      <select
                        value={setup.loadout.bladeId}
                        onChange={(event) =>
                          updateLoadout("bladeId", event.target.value)
                        }
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
                        value={setup.loadout.forehandRubberId}
                        onChange={(event) =>
                          updateLoadout("forehandRubberId", event.target.value)
                        }
                      >
                        {catalog.rubbers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.style}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      反手胶皮
                      <select
                        value={setup.loadout.backhandRubberId}
                        onChange={(event) =>
                          updateLoadout("backhandRubberId", event.target.value)
                        }
                      >
                        {catalog.rubbers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.style}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <PlayerShowcase loadout={setup.loadout} catalog={catalog} />
                </>
              ) : (
                <>
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">SUPPORT A PLAYER</span>
                      <h2>选择你支持的球员</h2>
                      <p>
                        可以不选。支持对象只用于签表高亮，不影响抽签、配装和比赛结果。
                      </p>
                    </div>
                  </div>
                  <label className="field cup-support-select">
                    支持球员
                    <select
                      value={setup.favoritePlayerId}
                      onChange={(event) =>
                        setSetup({
                          ...setup,
                          favoritePlayerId: event.target.value,
                        })
                      }
                    >
                      <option value="">不指定支持对象</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name} · {player.style}
                          {isOlympics
                            ? ` · ${olympicTierLabel(player.id)}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {setup.favoritePlayerId && (
                    <PlayerShowcase
                      loadout={initialLoadout(setup.favoritePlayerId, catalog)}
                      catalog={catalog}
                    />
                  )}
                </>
              )}
              <button
                className="button button-primary cup-draw-button"
                onClick={drawCup}
              >
                {isOlympics ? "确认并分档随机抽签 ↗" : "确认并完全随机抽签 ↗"}
              </button>
            </section>
          )}
        </>
      )}

      {cup && (
        <>
          <section className="cup-draw-banner">
            <div>
              <span className="eyebrow">RANDOM DRAW · TOP / BOTTOM HALF</span>
              <h2>
                {cup.phase === "complete"
                  ? `本届${isOlympics ? "奥运会" : "世界杯"}冠军`
                  : cup.phase === "cpu-playback"
                    ? "赛事进行中"
                    : cup.phase === "awaiting-choice"
                      ? "你的球员止步于此"
                      : "签表已确定"}
              </h2>
              <p>
                {cup.phase === "complete"
                  ? `${playerName(cup.championId)} 夺得冠军`
                  : cup.humanPlayerId
                    ? `你操控 ${playerName(cup.humanPlayerId)} · 真人对 AI BO3 · 其余对决 BO7`
                    : `${isOlympics ? "三十二" : "八"}名球员全部由本地 AI 操控 · 全部比赛 BO7`}
              </p>
            </div>
            {cup.favoritePlayerId && (
              <div className="cup-favorite-badge">
                <CharacterPortrait
                  playerId={cup.favoritePlayerId}
                  name={playerName(cup.favoritePlayerId)}
                />
                <span>
                  支持 <b>{playerName(cup.favoritePlayerId)}</b>
                </span>
              </div>
            )}
          </section>

          {cup.phase === "awaiting-choice" && (
            <section
              className="cup-loss-choice"
              role="dialog"
              aria-labelledby="cup-loss-title"
            >
              <div>
                <span className="eyebrow">TOURNAMENT CONTINUES</span>
                <h2 id="cup-loss-title">
                  {playerName(cup.humanPlayerId)} 已被淘汰
                </h2>
                <p>
                  你可以继续观看剩余比赛，或退出
                  {isOlympics ? "奥运会" : "世界杯"}。
                </p>
              </div>
              <button
                className="button button-primary"
                onClick={continueAfterLoss}
              >
                继续观战
              </button>
              <button
                className="button button-secondary"
                onClick={exitAfterLoss}
              >
                退出{isOlympics ? "奥运会" : "世界杯"}
              </button>
            </section>
          )}

          <section
            className="cup-bracket"
            aria-label={`${isOlympics ? "奥运会" : "世界杯"}淘汰赛签表`}
          >
            {(isOlympics ? [0, 1, 2, 3, 4] : [0, 1, 2]).map((roundValue) => {
              const round = roundValue as CupRound;
              const matches = cup.matches.filter(
                (match) => match.round === round,
              );
              return (
                <div className={`cup-round cup-round-${round}`} key={round}>
                  <h3>{roundName(round, cup.eventType)}</h3>
                  {matches.map((match) => (
                    <BracketMatch
                      key={match.id}
                      match={match}
                      cup={cup}
                      catalog={catalog}
                    />
                  ))}
                </div>
              );
            })}
          </section>

          {activeMatch && activeMatch.status === "playback" && (
            <section className="cup-live-match" aria-live="polite">
              <span className="eyebrow">
                {roundName(activeMatch.round, cup.eventType)} · BO7
              </span>
              <CupMatchSpotlight
                playerIds={activeMatch.playerIds}
                cup={cup}
                catalog={catalog}
              />
              <div className="cup-live-versus">
                <strong>{playerName(activeMatch.playerIds[0])}</strong>
                <b>
                  {
                    visibleGames.filter(
                      (game) =>
                        game.winnerPlayerId === activeMatch.playerIds[0],
                    ).length
                  }{" "}
                  :{" "}
                  {
                    visibleGames.filter(
                      (game) =>
                        game.winnerPlayerId === activeMatch.playerIds[1],
                    ).length
                  }
                </b>
                <strong>{playerName(activeMatch.playerIds[1])}</strong>
              </div>
              {latestVisibleGame && (
                <ActionReplay
                  key={`${activeMatch.id}-game-${visibleGames.length}`}
                  winnerId={latestVisibleGame.winnerPlayerId}
                  winnerName={playerName(latestVisibleGame.winnerPlayerId)}
                  loserId={replayLoserId}
                  loserName={playerName(replayLoserId)}
                  winnerRole={replayEndingAction?.winnerRole ?? "attack"}
                  actionName={
                    replayPair
                      ? replayEndingAction?.winnerRole === "defense"
                        ? replayPair.defenseName
                        : replayPair.attackName
                      : "决胜一拍"
                  }
                  score={`${latestVisibleGame.a} : ${latestVisibleGame.b}`}
                  stageName={
                    replayEndingAction
                      ? catalog.skills.stages[replayEndingAction.stage].label
                      : "决胜时刻"
                  }
                  motion={
                    replayEndingAction
                      ? actionMotionFor(replayEndingAction.pairId)
                      : "power"
                  }
                />
              )}
              <ol className="cup-game-scores">
                {visibleGames.map((game, index) => (
                  <li key={index}>
                    <span>第 {index + 1} 局</span>
                    <b
                      className={
                        game.winnerPlayerId === activeMatch.playerIds[0]
                          ? "is-leading"
                          : ""
                      }
                    >
                      {game.a}
                    </b>
                    <i>:</i>
                    <b
                      className={
                        game.winnerPlayerId === activeMatch.playerIds[1]
                          ? "is-leading"
                          : ""
                      }
                    >
                      {game.b}
                    </b>
                  </li>
                ))}
              </ol>
              <div className="cup-playback-actions">
                <span>每局结果自动揭晓 · 约 4 秒</span>
                <button className="text-button" onClick={revealAllRemaining}>
                  跳过本场播放 ↗
                </button>
              </div>
            </section>
          )}

          {cup.phase === "human-match" && canPlayActiveHuman && (
            <section className="cup-live-match">
              <span className="eyebrow">YOUR MATCH · BO3</span>
              <h2>正在进行你的比赛</h2>
              <p>比赛结束后返回这里继续{isOlympics ? "奥运会" : "世界杯"}。</p>
              <button
                className="button button-primary"
                onClick={() =>
                  navigate(
                    `/match/${cup.activeGameId}/ai?cup=${encodeURIComponent(cup.id)}`,
                  )
                }
              >
                继续比赛 ↗
              </button>
            </section>
          )}

          {cup.phase === "ready" && (
            <section className="cup-next-match">
              <div>
                <span className="eyebrow">NEXT MATCH</span>
                <h2>
                  {nextReadyMatch(cup)
                    ? `${roundName(nextReadyMatch(cup)!.round, cup.eventType)} · ${playerName(nextReadyMatch(cup)!.playerIds[0])} vs ${playerName(nextReadyMatch(cup)!.playerIds[1])}`
                    : "赛事正在收尾"}
                </h2>
                <p>
                  {nextReadyMatch(cup) &&
                  cup.humanPlayerId &&
                  nextReadyMatch(cup)!.playerIds.includes(cup.humanPlayerId)
                    ? "这一场由你亲自操作，BO3。"
                    : "电脑对决 BO7，逐局揭晓比分。"}
                </p>
              </div>
              <button
                className="button button-primary"
                disabled={busy || !nextReadyMatch(cup)}
                onClick={beginNextMatch}
              >
                {busy
                  ? "正在准备对局…"
                  : nextReadyMatch(cup)?.playerIds.includes(
                        cup.humanPlayerId ?? "",
                      )
                    ? "进入比赛 ↗"
                    : "开始下一场模拟 ↗"}
              </button>
            </section>
          )}

          {cup.phase === "complete" && (
            <section className="cup-champion-panel">
              <span className="cup-trophy" aria-hidden="true">
                ✦
              </span>
              <span className="eyebrow">
                {isOlympics ? "OLYMPIC CHAMPION" : "WORLD CUP CHAMPION"}
              </span>
              <h2>{playerName(cup.championId)}</h2>
              <p>
                {cup.favoritePlayerId && cup.championId === cup.favoritePlayerId
                  ? "你支持的球员夺得冠军！"
                  : "本届赛事全部结束。"}
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  setCup(null);
                  setParticipate(null);
                  setError(null);
                  window.history.replaceState({}, "", pagePath);
                }}
              >
                再开一届{isOlympics ? "奥运会" : "世界杯"} ↗
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function BracketMatch({
  match,
  cup,
  catalog,
}: {
  match: CupMatch;
  cup: WorldCup;
  catalog: PublicCatalog;
}) {
  const isFavorite = (id: string | null) =>
    Boolean(id && id === cup.favoritePlayerId);
  const games = completedMatchGames(match);
  const aWins = games.filter(
    (game) => game.winnerPlayerId === match.playerIds[0],
  ).length;
  const bWins = games.filter(
    (game) => game.winnerPlayerId === match.playerIds[1],
  ).length;
  const name = (id: string | null) =>
    catalog.players.find((player) => player.id === id)?.name ?? "待定";
  const side = (playerId: string | null, wins: number) => (
    <div
      className={`bracket-player${isFavorite(playerId) ? " is-favorite" : ""}${match.winnerId === playerId ? " is-winner" : ""}`}
    >
      <span>{name(playerId)}</span>
      {match.status === "complete" && <b>{wins}</b>}
    </div>
  );
  const gameScores =
    match.status === "complete" || match.status === "playback"
      ? games.map((game) => `${game.a}-${game.b}`).join(" · ")
      : "";
  return (
    <article
      className={`bracket-match${match.status === "playback" ? " is-live" : ""}`}
      aria-label={`${name(match.playerIds[0])} 对阵 ${name(match.playerIds[1])}`}
    >
      {side(match.playerIds[0], aWins)}
      <div className="bracket-match-meta">
        <span>
          {match.status === "playback"
            ? "LIVE"
            : match.status === "complete"
              ? `BO${cup.humanPlayerId && match.playerIds.includes(cup.humanPlayerId) ? 3 : 7}`
              : "VS"}
        </span>
        {gameScores && <small>{gameScores}</small>}
      </div>
      {side(match.playerIds[1], bWins)}
    </article>
  );
}

function CupMatchSpotlight({
  playerIds,
  cup,
  catalog,
}: {
  playerIds: [string | null, string | null];
  cup: WorldCup;
  catalog: PublicCatalog;
}) {
  const getPlayer = (id: string | null) =>
    catalog.players.find((item) => item.id === id);
  const players = playerIds.map(getPlayer);
  const gearName = (playerId: string | null) => {
    const loadout = playerId ? cup.participants[playerId]?.loadout : null;
    if (!loadout) return "配装待定";
    const blade =
      catalog.blades.find((item) => item.id === loadout.bladeId)?.name ??
      "球拍";
    const forehand =
      catalog.rubbers.find((item) => item.id === loadout.forehandRubberId)
        ?.name ?? "正手胶皮";
    const backhand =
      catalog.rubbers.find((item) => item.id === loadout.backhandRubberId)
        ?.name ?? "反手胶皮";
    return `${blade} · ${forehand} / ${backhand}`;
  };
  return (
    <div className="cup-match-spotlight" aria-label="参赛球员入场介绍">
      {players.map((player, index) => (
        <div
          className={`cup-entrant cup-entrant-${index}`}
          key={playerIds[index]}
        >
          <CharacterPortrait
            playerId={player?.id ?? ""}
            name={player?.name ?? "待定"}
            className="cup-entrant-character"
          />
          <strong>{player?.name ?? "待定"}</strong>
          <span>{player?.style ?? "等待晋级"}</span>
          <small>{gearName(playerIds[index]!)}</small>
        </div>
      ))}
      <div className="cup-entrance-vs" aria-hidden="true">
        <span>WORLD CUP</span>
        <b>VS</b>
      </div>
    </div>
  );
}
