# World Cup balance strategy and player-stat screening

Seed: 20260930; repetitions per player pairing and strategy: 4; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). Same-tier matchups should stay close to 50/50, while aggregate tier win rates must preserve 480 > 460 > 440. The mid-30 profile candidate preserves each player's total and strongest/weakest three stat cells. The floor-six candidate also preserves player totals but may change signature cells.

| Rank | Player data    | AI strategy     | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score |   4–0 | 4–1/4–2 |   4–3 | Same-tier bias | Tier order | Screening score |
| ---: | -------------- | --------------- | ------: | ----: | --------: | ---------------: | ------------------: | ----: | ------: | ----: | -------------: | ---------- | --------------: |
|    1 | profile-mid-30 | balanced-varied |     448 |  2160 |     76.6% |             9.7% |                6.14 | 56.3% |   31.3% | 12.5% |          34.8% | yes        |           0.518 |
|    2 | baseline       | balanced-varied |     448 |  2100 |     70.7% |            13.4% |                5.83 | 64.7% |   24.6% | 10.7% |          33.9% | yes        |           0.461 |
|    3 | profile-mid-30 | balanced        |     448 |  2075 |     63.6% |            21.6% |                5.91 | 65.0% |   26.1% |  8.9% |          32.1% | yes        |           0.440 |
|    4 | floor-six      | balanced-varied |     448 |  2050 |     68.2% |            13.9% |                5.59 | 68.8% |   22.8% |  8.5% |          46.4% | yes        |           0.414 |
|    5 | baseline       | balanced        |     448 |  2022 |     62.7% |            24.9% |                6.14 | 70.5% |   23.0% |  6.5% |          33.0% | no         |           0.316 |
|    6 | baseline       | aggressive      |     448 |  2013 |     61.0% |            25.5% |                5.91 | 71.9% |   21.7% |  6.5% |          33.0% | no         |           0.302 |
|    7 | floor-six      | balanced        |     448 |  1988 |     56.9% |            28.5% |                5.69 | 73.9% |   21.0% |  5.1% |          39.3% | no         |           0.268 |
|    8 | baseline       | current         |     448 |  1851 |     27.4% |            57.9% |                2.86 | 92.0% |    7.1% |  0.9% |          50.0% | no         |           0.051 |

See `screening-results.json` for per-player and per-pair outcomes. This is a screening sample; any selected configuration requires a larger confirmation run before active data changes.
