import type { BalanceConfig } from "@paddle-tactics/game-data";
import type { CurrentGame, PlayerId } from "./types.js";

export function isDeuceScore(
  score: Record<PlayerId, number>,
  pointsToWinGame = 11,
): boolean {
  const deuceAt = pointsToWinGame - 1;
  return (
    Object.values(score).length === 2 &&
    Object.values(score).every((points) => points >= deuceAt)
  );
}

export function getServerForNextPoint(
  game: Pick<CurrentGame, "initialServerPlayerId" | "pointsPlayed" | "score">,
  rules: BalanceConfig["scoring"],
  playerOrder: [PlayerId, PlayerId],
): PlayerId {
  const firstDeucePoint = 2 * (rules.pointsToWinGame - 1);
  const rotations = isDeuceScore(game.score, rules.pointsToWinGame)
    ? Math.floor(
        (game.pointsPlayed - firstDeucePoint) / rules.serveRotationAtDeuce,
      )
    : Math.floor(game.pointsPlayed / rules.serveRotationBeforeDeuce);
  return rotations % 2 === 0
    ? game.initialServerPlayerId
    : playerOrder.find((id) => id !== game.initialServerPlayerId)!;
}
