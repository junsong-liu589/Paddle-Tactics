# World Cup balance strategy and player-stat confirmation

Seed: 20260930; mode: confirmation; repetitions per player pairing and strategy: 12; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). Same-tier matchups should stay close to 50/50, while aggregate tier win rates must preserve 480 > 460 > 440. The mid-30 profile candidate preserves each player's total and strongest/weakest three stat cells.

| Rank | Player data    | AI strategy     | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score |   4–0 | 4–1/4–2 |   4–3 | Same-tier bias | Tier order | Score |
| ---: | -------------- | --------------- | ------: | ----: | --------: | ---------------: | ------------------: | ----: | ------: | ----: | -------------: | ---------- | ----: |
|    1 | profile-mid-30 | balanced-varied |    1344 |  6449 |     76.1% |             9.9% |                6.08 | 57.1% |   31.5% | 11.4% |          36.0% | yes        | 0.514 |
|    2 | baseline       | balanced-varied |    1344 |  6325 |     70.4% |            13.5% |                5.83 | 62.4% |   27.0% | 10.6% |          31.5% | yes        | 0.476 |

See `confirmation-results.json` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.
