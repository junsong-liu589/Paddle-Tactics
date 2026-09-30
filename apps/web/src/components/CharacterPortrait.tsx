import { useState } from "react";
import { characterAssets } from "../lib/player-assets.js";
import { PlayerAvatar } from "./PlayerAvatar.js";

export function CharacterPortrait({
  playerId,
  name,
  className = "",
}: {
  playerId: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    characterAssets[playerId] ??
    (playerId ? `/assets/characters/${playerId}.webp` : undefined);
  if (failed || !src)
    return (
      <PlayerAvatar playerId={playerId} name={name} className={className} />
    );
  return (
    <img
      className={`character-portrait ${className}`}
      src={src}
      alt={`${name}的卡通造型`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
