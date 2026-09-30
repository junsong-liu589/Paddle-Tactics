import { useEffect, useState } from "react";
import type { DomainEvent, MatchPublicView } from "@paddle-tactics/game-core";
import { fetchCatalog, fetchOlympicsCatalog } from "../lib/api.js";
import type { PublicCatalog } from "../lib/api.js";
import { getLocalMatchView } from "../lib/local-game.js";

type Props = {
  matchId: string;
  navigate: (path: string) => void;
  isAi: boolean;
  cupId?: string | undefined;
  isOlympics?: boolean;
};

export function ResultPage({
  matchId,
  navigate,
  isAi,
  cupId,
  isOlympics = false,
}: Props) {
  const [view, setView] = useState<MatchPublicView | null>(null);
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getLocalMatchView(matchId, "A"),
      isOlympics ? fetchOlympicsCatalog() : fetchCatalog(),
    ])
      .then(([match, nextCatalog]) => {
        if (!active) return;
        setView(match.view);
        setCatalog(nextCatalog);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "无法载入比赛记录"),
      );
    return () => {
      active = false;
    };
  }, [matchId, isOlympics]);

  if (error)
    return (
      <main className="content-page">
        <div className="notice notice-error" role="alert">
          {error}
        </div>
        <button
          className="button button-secondary"
          onClick={() => navigate("/play")}
        >
          返回
        </button>
      </main>
    );
  if (!view || !catalog)
    return (
      <main className="content-page">
        <div className="loading-panel">正在整理赛果…</div>
      </main>
    );

  const name = (id: string) =>
    catalog.players.find(
      (player) => player.id === view.self.loadout.playerId && id === "A",
    )?.name ??
    catalog.players.find(
      (player) =>
        player.id ===
        (id === view.self.id
          ? view.self.loadout.playerId
          : view.opponent.loadout.playerId),
    )?.name ??
    id;
  const points = view.events.filter(
    (event): event is Extract<DomainEvent, { type: "POINT_ENDED" }> =>
      event.type === "POINT_ENDED",
  );
  const reveals = view.events.filter(
    (event): event is Extract<DomainEvent, { type: "COMPARISON_REVEALED" }> =>
      event.type === "COMPARISON_REVEALED",
  );
  const winner = view.winnerPlayerId ? name(view.winnerPlayerId) : null;

  return (
    <main className="content-page result-page">
      <button
        className="back-link"
        onClick={() =>
          navigate(
            cupId
              ? `/${isOlympics ? "olympics" : "world-cup"}?id=${encodeURIComponent(cupId)}`
              : "/play",
          )
        }
      >
        {cupId ? `← 返回${isOlympics ? "奥运会" : "世界杯"}` : "← 返回对局方式"}
      </button>
      <section className="result-hero">
        <span className="eyebrow">
          MATCH REPORT ·{" "}
          {view.status === "COMPLETED" ? "COMPLETE" : "IN PROGRESS"}
        </span>
        <div className="result-trophy" aria-hidden="true">
          ✦
        </div>
        <h1>{winner ? `${winner} 获胜` : "比赛记录"}</h1>
        <p>
          {view.status === "COMPLETED"
            ? "一分一分打出的胜利。以下是本场已公开的攻防对决。"
            : "这场本地沙盒比赛尚未结束。"}
        </p>
        <div className="final-score">
          <span>
            {name("A")}
            <strong>{view.gamesWon.A ?? 0}</strong>
          </span>
          <i>:</i>
          <span>
            {name("B")}
            <strong>{view.gamesWon.B ?? 0}</strong>
          </span>
        </div>
        <button
          className="button button-primary"
          onClick={() =>
            navigate(
              cupId
                ? `/${isOlympics ? "olympics" : "world-cup"}?id=${encodeURIComponent(cupId)}`
                : isAi
                  ? "/setup/ai"
                  : "/setup",
            )
          }
        >
          {cupId
            ? `返回${isOlympics ? "奥运会" : "世界杯"}继续赛事 ↗`
            : "再开一场 ↗"}
        </button>
      </section>

      <section className="report-section">
        <div className="page-heading-row">
          <div>
            <span className="eyebrow">POINT BY POINT</span>
            <h2>逐分记录</h2>
          </div>
          <span className="version-badge">
            {points.length} 分 · BO{view.bestOf}
          </span>
        </div>
        {points.length === 0 ? (
          <div className="loading-panel">当前还没有已结束的分数。</div>
        ) : (
          <div className="point-list">
            {points.map((point, index) => {
              const pointReveals = reveals.filter(
                (event) =>
                  event.seq < point.seq &&
                  (index === 0 || event.seq > points[index - 1]!.seq),
              );
              const score = point.score;
              return (
                <article
                  className="point-row"
                  key={`${point.pointNumber}-${point.seq}`}
                >
                  <div className="point-index">
                    <small>POINT</small>
                    <strong>
                      {String(point.pointNumber).padStart(2, "0")}
                    </strong>
                  </div>
                  <div className="point-main">
                    <strong>{name(point.winnerPlayerId)} 赢下本分</strong>
                    <span>{reasonText(point.reason)}</span>
                    {pointReveals.length > 0 && (
                      <div className="point-comparisons">
                        {pointReveals.map((event) => {
                          const pair = catalog.skills.stages[
                            event.stage
                          ].pairs.find((item) => item.id === event.pairId);
                          return (
                            <span key={event.seq}>
                              {event.stage === "service"
                                ? "发球"
                                : event.stage === "receive"
                                  ? "反制"
                                  : `相持 R${event.round}`}{" "}
                              · {pair?.attackName}:{" "}
                              <b>
                                {name(event.attackerPlayerId)} 攻击：基础{" "}
                                {event.attack.base.toFixed(1)} + 加点{" "}
                                {event.attack.temporary} ={" "}
                                {event.attack.actual.toFixed(1)}
                              </b>{" "}
                              vs{" "}
                              <b>
                                {name(event.defenderPlayerId)} 防守：基础{" "}
                                {event.defense.base.toFixed(1)} + 加点{" "}
                                {event.defense.temporary} ={" "}
                                {event.defense.actual.toFixed(1)}
                              </b>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="point-score">
                    {score.A ?? 0}
                    <i>:</i>
                    {score.B ?? 0}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function reasonText(reason: string): string {
  const labels: Record<string, string> = {
    service_direct: "发球直接得分",
    receive_direct: "反制直接得分",
    rally_direct: "相持直接得分",
    rally_tie_break: "六轮相持累计优势决胜",
  };
  return labels[reason] ?? reason;
}
