# World Cup balance strategy and player-stat confirmation

Seed: 20260930; mode: confirmation; repetitions per player pairing and strategy: 12; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). For the current eight-player roster, player totals and the 480 > 460 > 440 tiers are held fixed. Targeted variants redistribute stats while conserving each affected player's stat total, and compare two ranked-choice exploration levels. Track per-player and per-pair outcomes before considering any roster data change.

| Rank | Player data | AI strategy | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score | 4–0 | 4–1/4–2 | 4–3 | Same-tier bias | Tier order | Score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | signature-plus-one | balanced-varied | 1344 | 6549 | 79.1% | 6.8% | 6.39 | 52.5% | 35.0% | 12.6% | 28.0% | yes | 0.561 |
| 2 | harimoto-plus-one-only | balanced-varied | 1344 | 6486 | 79.4% | 6.8% | 6.46 | 55.0% | 33.0% | 12.1% | 26.8% | yes | 0.554 |
| 3 | harimoto-plus-one-zhang-defense-plus-one | balanced-varied | 1344 | 6256 | 75.2% | 7.8% | 6.34 | 62.0% | 29.6% | 8.4% | 36.3% | yes | 0.496 |
| 4 | baseline | balanced-varied | 1344 | 6325 | 70.4% | 13.5% | 5.83 | 62.4% | 27.0% | 10.6% | 31.5% | yes | 0.476 |

See `confirmation-results.json` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.
