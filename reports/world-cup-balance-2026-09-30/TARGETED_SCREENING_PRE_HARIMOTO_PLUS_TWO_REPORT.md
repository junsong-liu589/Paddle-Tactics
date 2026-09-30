# World Cup balance strategy and player-stat targeted-screening

Seed: 20260930; mode: targeted-screening; repetitions per player pairing and strategy: 4; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.

The score target is a losing set score of at least 4 (margin <= 7). For the current eight-player roster, player totals and the 480 > 460 > 440 tiers are held fixed. Targeted variants redistribute stats while conserving each affected player's stat total, and compare two ranked-choice exploration levels. Track per-player and per-pair outcomes before considering any roster data change.

| Rank | Player data | AI strategy | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score | 4–0 | 4–1/4–2 | 4–3 | Same-tier bias | Tier order | Screening score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | profile-mid-30-plus-signature | wide-varied | 448 | 2229 | 87.6% | 2.2% | 7.09 | 47.3% | 39.1% | 13.6% | 30.4% | yes | 0.612 |
| 2 | harimoto-plus-two-zhang-attack-plus-one | wide-varied | 448 | 2160 | 84.9% | 3.7% | 6.66 | 53.6% | 35.9% | 10.5% | 39.3% | yes | 0.564 |
| 3 | signature-plus-one | balanced-varied | 448 | 2161 | 80.0% | 6.3% | 6.37 | 54.7% | 33.9% | 11.4% | 25.0% | yes | 0.564 |
| 4 | harimoto-plus-two-zhang-attack-plus-one | balanced-varied | 448 | 2143 | 80.2% | 5.7% | 6.30 | 57.1% | 31.3% | 11.6% | 25.9% | yes | 0.550 |
| 5 | signature-plus-one | wide-varied | 448 | 2098 | 81.9% | 4.4% | 6.40 | 58.5% | 34.8% | 6.7% | 35.7% | yes | 0.548 |
| 6 | harimoto-plus-one-only | balanced-varied | 448 | 2161 | 80.3% | 6.3% | 6.47 | 56.9% | 30.1% | 12.9% | 26.8% | yes | 0.545 |
| 7 | harimoto-plus-one-only | wide-varied | 448 | 2108 | 82.7% | 4.4% | 6.47 | 58.7% | 33.9% | 7.4% | 41.1% | yes | 0.538 |
| 8 | harimoto-plus-one-zhang-defense-plus-one | balanced-varied | 448 | 2077 | 75.8% | 7.2% | 6.35 | 63.4% | 28.1% | 8.5% | 32.1% | yes | 0.500 |
| 9 | harimoto-plus-one-zhang-defense-plus-one | wide-varied | 448 | 2047 | 80.7% | 4.8% | 6.34 | 66.3% | 27.7% | 6.0% | 42.0% | yes | 0.496 |
| 10 | profile-mid-30-plus-signature | balanced-varied | 448 | 2234 | 84.2% | 4.1% | 6.69 | 46.7% | 37.7% | 15.6% | 35.7% | no | 0.484 |
| 11 | baseline | wide-varied | 448 | 2078 | 73.5% | 12.3% | 5.82 | 64.1% | 28.6% | 7.4% | 41.1% | yes | 0.473 |
| 12 | baseline | balanced-varied | 448 | 2100 | 70.7% | 13.4% | 5.83 | 64.7% | 24.6% | 10.7% | 33.9% | yes | 0.461 |

See `targeted-screening-results.json` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.
