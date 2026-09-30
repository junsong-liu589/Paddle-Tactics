import type { Loadout } from "@paddle-tactics/game-core";
import type { PublicCatalog } from "../lib/api.js";
import {
  getShowcaseDimensions,
  radarFillRatio,
} from "../lib/player-showcase.js";
import { CharacterPortrait } from "./CharacterPortrait.js";

export function PlayerShowcase({
  loadout,
  catalog,
  compact = false,
}: {
  loadout: Loadout;
  catalog: PublicCatalog;
  compact?: boolean;
}) {
  const player = catalog.players.find((item) => item.id === loadout.playerId);
  if (!player) return null;
  const dimensions = getShowcaseDimensions(loadout, catalog);
  const cx = 125;
  const cy = 120;
  const radius = 76;
  const points = dimensions.map((item, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    const scaledRadius = radius * radarFillRatio(item.score);
    return [
      cx + Math.cos(angle) * scaledRadius,
      cy + Math.sin(angle) * scaledRadius,
    ] as const;
  });
  const polygon = (ratio: number) =>
    dimensions
      .map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        const r = radius * ratio;
        return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
      })
      .join(" ");

  return (
    <section className={`player-showcase${compact ? " is-compact" : ""}`}>
      <div className="showcase-character-wrap">
        <CharacterPortrait
          playerId={player.id}
          name={player.name}
          className="showcase-character"
        />
        <span className="showcase-character-glow" aria-hidden="true" />
      </div>
      <div className="showcase-copy">
        <span className="eyebrow">PLAYER INTRODUCTION</span>
        <h3>{player.name}</h3>
        <p>{player.style}</p>
        <div className="showcase-loadout" aria-label="当前配装">
          <span>
            {catalog.blades.find((item) => item.id === loadout.bladeId)?.name}
          </span>
          <span>
            正手：
            {
              catalog.rubbers.find(
                (item) => item.id === loadout.forehandRubberId,
              )?.name
            }
          </span>
          <span>
            反手：
            {
              catalog.rubbers.find(
                (item) => item.id === loadout.backhandRubberId,
              )?.name
            }
          </span>
        </div>
      </div>
      <div className="showcase-radar-wrap">
        <svg
          className="showcase-radar"
          viewBox="0 0 250 240"
          role="img"
          aria-label="六维能力概览，3分在中心，13分为满格，10分显示为70%半径"
        >
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <polygon
              key={ratio}
              points={polygon(ratio)}
              className="radar-grid"
            />
          ))}
          {dimensions.map((item, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI) / 3;
            return (
              <g key={item.id}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(angle) * radius}
                  y2={cy + Math.sin(angle) * radius}
                  className="radar-axis"
                />
                <text
                  x={cx + Math.cos(angle) * 113}
                  y={cy + Math.sin(angle) * 105 + 4}
                  textAnchor="middle"
                  className="radar-label"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
          <polygon
            points={points.map((point) => point.join(",")).join(" ")}
            className="radar-value"
          />
          {points.map((point, index) => (
            <g key={dimensions[index]!.id}>
              <circle cx={point[0]} cy={point[1]} r="3" className="radar-dot" />
              <text
                x={point[0]}
                y={point[1] - 8}
                textAnchor="middle"
                className="radar-score"
              >
                {dimensions[index]!.score.toFixed(0)}
              </text>
            </g>
          ))}
        </svg>
        <small>六维概览 · 图示范围 3–13 · 仅用于展示</small>
      </div>
    </section>
  );
}
