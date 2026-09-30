import { AnimatedAthlete } from "./AnimatedAthlete.js";

export type ActionReplayProps = {
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerRole: "attack" | "defense";
  actionName: string;
  score: string;
  stageName: string;
  motion: string;
};

const ACTION_MOTIONS: Record<string, string> = {
  service_placement: "placement",
  service_speed: "power",
  service_spin: "spin",
  service_variation: "feint",
  service_deception: "feint",
  short_push: "short",
  deep_push: "push",
  flick: "flick",
  flip: "flick",
  receive_variation: "feint",
  loop_drive: "loop",
  rally_exchange: "exchange",
  line_change: "placement",
  counterattack: "counter",
  continuous_attack: "power",
};

export function actionMotionFor(pairId: string): string {
  return ACTION_MOTIONS[pairId] ?? "exchange";
}

export function ActionReplay({
  winnerId,
  winnerName,
  loserId,
  loserName,
  winnerRole,
  actionName,
  score,
  stageName,
  motion,
}: ActionReplayProps) {
  return (
    <section
      className={`action-replay is-${winnerRole} motion-${motion}`}
      role="status"
      aria-live="polite"
      aria-label={`${winnerName} ${winnerRole === "attack" ? "进攻成功" : "防守成功"}，比分 ${score}`}
    >
      <div className="action-replay-player replay-winner replay-winner-left">
        <AnimatedAthlete
          playerId={winnerId}
          name={winnerName}
          motion={motion}
          role={winnerRole}
          outcome="winner"
        />
        <strong>{winnerName}</strong>
        <small>{winnerRole === "attack" ? "进攻成功" : "防守成功"}</small>
      </div>
      <div className="action-replay-result">
        <span className="replay-ball" aria-hidden="true" />
        <small>
          {stageName} · {actionName}
        </small>
        <strong>{winnerRole === "attack" ? "突破得分" : "成功防守"}</strong>
        <b>{score}</b>
      </div>
      <div className="action-replay-player replay-loser replay-loser-right">
        <AnimatedAthlete
          playerId={loserId}
          name={loserName}
          motion={motion}
          role={winnerRole === "attack" ? "defense" : "attack"}
          outcome="loser"
        />
        <strong>{loserName}</strong>
        <small>{winnerRole === "attack" ? "防线被突破" : "进攻被化解"}</small>
      </div>
      <span className="replay-speedline" aria-hidden="true" />
      <span className="replay-impact" aria-hidden="true" />
    </section>
  );
}
