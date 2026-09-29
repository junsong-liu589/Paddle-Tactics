# Candidate V3 Balance Report

Generated 2026-09-29T02:43:12.131Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: quick; seed: 20260928; V3 baseline matches: 1,000; runtime: 106.29s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 938; censored deuce matches: 62 (6.20%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 18987 | 10661 (56.15%) | 8326 (43.85%) |
| receive | 8326 | 3234 (38.84%) | 5092 (61.16%) |
| rally | 8396 | 4740 (56.46%) | 3656 (43.54%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 8.396; per Rally entry: 1.649.
- Rally fifth-comparison share: 7.80%; tie-break share: 6.91%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 3837/5092 points (75.35%; Wilson 95% 74.2–76.5%). The denominator is points reaching Rally.
- First-server match wins: 443/938 completed matches (47.23%).
- Rally tie-break starter wins: 295/352 (83.81%; Wilson 95% 79.6–87.3%).
- Top option/off-top-K attack picks: top1 22746, rank2–K 6669, off Top-K 6294. Defender allocations put 168327 points on publicly visible Top-K options and 90913 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 30 | 53.33% | 36.1–69.8% | 2 |
| attackBonus | 5 | 30 | 43.33% | 27.4–60.8% | 3 |
| defensePool | 6 | 30 | 43.33% | 27.4–60.8% | 0 |
| defensePool | 7 | 30 | 63.33% | 45.5–78.1% | 2 |
| defensePool | 9 | 30 | 43.33% | 27.4–60.8% | 1 |
| defensePool | 10 | 30 | 50.00% | 33.2–66.8% | 3 |
| defenderVisibleTopK | 2 | 30 | 50.00% | 33.2–66.8% | 2 |
| defenderVisibleTopK | 4 | 30 | 50.00% | 33.2–66.8% | 0 |
| serviceThreshold | 4 | 30 | 46.67% | 30.2–63.9% | 2 |
| serviceThreshold | 6 | 30 | 36.67% | 21.9–54.5% | 1 |
| counterThreshold | 4 | 30 | 53.33% | 36.1–69.8% | 0 |
| counterThreshold | 6 | 30 | 46.67% | 30.2–63.9% | 2 |
| rallyThreshold | 3 | 30 | 43.33% | 27.4–60.8% | 1 |
| rallyThreshold | 5 | 30 | 50.00% | 33.2–66.8% | 0 |
| rallyMaxComparisons | 4 | 30 | 43.33% | 27.4–60.8% | 2 |
| rallyMaxComparisons | 6 | 30 | 43.33% | 27.4–60.8% | 1 |

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
