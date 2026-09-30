# World Cup balance strategy and player-stat targeted-screening

Seed: 20260930; mode: targeted-screening; repetitions per player pairing and strategy: 4; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). Same-tier matchups should stay close to 50/50, while aggregate tier win rates must preserve 480 > 460 > 440. The mid-30 profile candidate preserves each player's total and strongest/weakest three stat cells. The floor-six candidate also preserves player totals but may change signature cells.

| Rank | Player data | AI strategy | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score | 4–0 | 4–1/4–2 | 4–3 | Same-tier bias | Tier order | Screening score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | signature-plus-one | balanced-varied | 448 | 2161 | 80.0% | 6.3% | 6.37 | 54.7% | 33.9% | 11.4% | 25.0% | yes | 0.564 |
| 2 | harimoto-plus-two-zhang-attack-plus-one | balanced-varied | 448 | 2143 | 80.2% | 5.7% | 6.30 | 57.1% | 31.3% | 11.6% | 25.9% | yes | 0.550 |
| 3 | baseline | balanced-varied | 448 | 2100 | 70.7% | 13.4% | 5.83 | 64.7% | 24.6% | 10.7% | 33.9% | yes | 0.461 |

See `targeted-screening-results.json` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.
