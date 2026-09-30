# World Cup balance strategy and player-stat legal-targeted-screening

Seed: 20260930; mode: legal-targeted-screening; repetitions per player pairing and strategy: 4; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). For the current eight-player roster, player totals and the 480 > 460 > 440 tiers are held fixed. Targeted variants redistribute stats while conserving each affected player's stat total, and compare two ranked-choice exploration levels. Track per-player and per-pair outcomes before considering any roster data change.

| Rank | Player data | AI strategy | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score | 4–0 | 4–1/4–2 | 4–3 | Same-tier bias | Tier order | Screening score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | legal-zhang-jike-plus-one-only | wide-varied | 448 | 2093 | 74.4% | 10.5% | 5.89 | 62.1% | 30.1% | 7.8% | 42.0% | yes | 0.483 |
| 2 | legal-harimoto-and-zhang-jike-plus-one | wide-varied | 448 | 2093 | 74.2% | 10.1% | 5.91 | 62.3% | 29.9% | 7.8% | 42.0% | yes | 0.481 |
| 3 | legal-harimoto-plus-one-only | balanced-varied | 448 | 2104 | 73.5% | 10.3% | 6.00 | 64.1% | 25.2% | 10.7% | 33.9% | yes | 0.476 |
| 4 | baseline | wide-varied | 448 | 2078 | 73.5% | 12.3% | 5.82 | 64.1% | 28.6% | 7.4% | 41.1% | yes | 0.473 |
| 5 | legal-harimoto-plus-one-only | wide-varied | 448 | 2078 | 73.5% | 11.9% | 5.84 | 64.3% | 28.3% | 7.4% | 41.1% | yes | 0.472 |
| 6 | legal-harimoto-and-zhang-jike-plus-one | balanced-varied | 448 | 2094 | 72.2% | 10.4% | 5.86 | 64.3% | 25.4% | 10.3% | 36.6% | yes | 0.465 |
| 7 | baseline | balanced-varied | 448 | 2100 | 70.7% | 13.4% | 5.83 | 64.7% | 24.6% | 10.7% | 33.9% | yes | 0.461 |
| 8 | legal-zhang-jike-plus-one-only | balanced-varied | 448 | 2090 | 70.0% | 12.7% | 5.73 | 65.0% | 24.8% | 10.3% | 36.6% | yes | 0.453 |

See `targeted-screening-results.json` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.
