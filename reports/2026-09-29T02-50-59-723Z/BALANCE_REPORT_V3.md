# Candidate V3 Balance Report

Generated 2026-09-29T02:50:59.723Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: full; seed: 20260928; V3 baseline matches: 100,000; runtime: 1255.73s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 95,018; censored deuce matches: 4,982 (4.98%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 1852495 | 1013849 (54.73%) | 838646 (45.27%) |
| receive | 838646 | 326327 (38.91%) | 512319 (61.09%) |
| rally | 836384 | 477777 (57.12%) | 358607 (42.88%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 8.364; per Rally entry: 1.633.
- Rally fifth-comparison share: 7.62%; tie-break share: 6.74%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 386178/512319 points (75.38%; Wilson 95% 75.3–75.5%). The denominator is points reaching Rally.
- First-server match wins: 47349/95018 completed matches (49.83%).
- Rally tie-break starter wins: 26342/34542 (76.26%; Wilson 95% 75.8–76.7%).
- Top option/off-top-K attack picks: top1 2232881, rank2–K 682156, off Top-K 612488. Defender allocations put 16681119 points on publicly visible Top-K options and 8946561 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 1000 | 48.10% | 45.0–51.2% | 42 |
| attackBonus | 5 | 1000 | 46.70% | 43.6–49.8% | 80 |
| defensePool | 6 | 1000 | 47.50% | 44.4–50.6% | 52 |
| defensePool | 7 | 1000 | 46.80% | 43.7–49.9% | 60 |
| defensePool | 9 | 1000 | 46.70% | 43.6–49.8% | 34 |
| defensePool | 10 | 1000 | 48.20% | 45.1–51.3% | 37 |
| defenderVisibleTopK | 2 | 1000 | 48.70% | 45.6–51.8% | 62 |
| defenderVisibleTopK | 4 | 1000 | 48.10% | 45.0–51.2% | 42 |
| serviceThreshold | 4 | 1000 | 43.50% | 40.5–46.6% | 104 |
| serviceThreshold | 6 | 1000 | 44.40% | 41.3–47.5% | 24 |
| counterThreshold | 4 | 1000 | 47.20% | 44.1–50.3% | 26 |
| counterThreshold | 6 | 1000 | 43.80% | 40.8–46.9% | 85 |
| rallyThreshold | 3 | 1000 | 45.00% | 41.9–48.1% | 57 |
| rallyThreshold | 5 | 1000 | 47.20% | 44.1–50.3% | 40 |
| rallyMaxComparisons | 4 | 1000 | 49.00% | 45.9–52.1% | 41 |
| rallyMaxComparisons | 6 | 1000 | 47.70% | 44.6–50.8% | 52 |

Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| V3 focused candidate 1 | {"attackBonus":3,"defensePool":8,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 47.35% | 46.4–48.3% | 391 |
| V3 focused candidate 2 | {"attackBonus":4,"defensePool":10,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 46.23% | 45.3–47.2% | 447 |
| V3 focused candidate 3 | {"attackBonus":4,"defensePool":8,"defenderVisibleTopK":2,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 46.58% | 45.6–47.6% | 504 |

The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.
