import { useEffect, useState } from "react";
import { playerAssets } from "../lib/player-assets.js";

export function PlayerAvatar({
  playerId,
  name,
  className = "",
}: {
  playerId: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = playerAssets[playerId];

  useEffect(() => setFailed(false), [playerId, src]);

  return (
    <div
      className={`player-avatar ${className}${failed || !src ? " is-fallback" : ""}`}
      role="img"
      aria-label={`${name}头像`}
      data-testid="player-avatar"
      data-avatar-fallback={failed || !src ? "true" : "false"}
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1)}</span>
      )}
    </div>
  );
}
