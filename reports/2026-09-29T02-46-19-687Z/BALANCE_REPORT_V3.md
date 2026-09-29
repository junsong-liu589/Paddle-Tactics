# Candidate V3 Balance Report

Generated 2026-09-29T02:46:19.687Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: standard; seed: 20260928; V3 baseline matches: 10,000; runtime: 234.98s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 9,501; censored deuce matches: 499 (4.99%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 184945 | 101078 (54.65%) | 83867 (45.35%) |
| receive | 83867 | 32810 (39.12%) | 51057 (60.88%) |
| rally | 83332 | 47703 (57.24%) | 35629 (42.76%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 8.333; per Rally entry: 1.632.
- Rally fifth-comparison share: 7.41%; tie-break share: 6.57%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 38115/51057 points (74.65%; Wilson 95% 74.3–75.0%). The denominator is points reaching Rally.
- First-server match wins: 4708/9501 completed matches (49.55%).
- Rally tie-break starter wins: 2607/3354 (77.73%; Wilson 95% 76.3–79.1%).
- Top option/off-top-K attack picks: top1 222485, rank2–K 68680, off Top-K 60979. Defender allocations put 1669065 points on publicly visible Top-K options and 889887 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 200 | 50.00% | 43.1–56.9% | 8 |
| attackBonus | 5 | 200 | 45.50% | 38.7–52.4% | 12 |
| defensePool | 6 | 200 | 47.50% | 40.7–54.4% | 11 |
| defensePool | 7 | 200 | 46.50% | 39.7–53.4% | 8 |
| defensePool | 9 | 200 | 47.50% | 40.7–54.4% | 10 |
| defensePool | 10 | 200 | 49.00% | 42.2–55.9% | 11 |
| defenderVisibleTopK | 2 | 200 | 47.00% | 40.2–53.9% | 16 |
| defenderVisibleTopK | 4 | 200 | 52.00% | 45.1–58.8% | 8 |
| serviceThreshold | 4 | 200 | 42.50% | 35.9–49.4% | 21 |
| serviceThreshold | 6 | 200 | 48.50% | 41.7–55.4% | 7 |
| counterThreshold | 4 | 200 | 50.00% | 43.1–56.9% | 5 |
| counterThreshold | 6 | 200 | 46.00% | 39.2–52.9% | 18 |
| rallyThreshold | 3 | 200 | 43.50% | 36.8–50.4% | 16 |
| rallyThreshold | 5 | 200 | 47.50% | 40.7–54.4% | 7 |
| rallyMaxComparisons | 4 | 200 | 48.50% | 41.7–55.4% | 7 |
| rallyMaxComparisons | 6 | 200 | 53.50% | 46.6–60.3% | 5 |

Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| V3 focused candidate 1 | {"attackBonus":3,"defensePool":8,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 47.35% | 46.4–48.3% | 391 |
| V3 focused candidate 2 | {"attackBonus":4,"defensePool":10,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 46.23% | 45.3–47.2% | 447 |
| V3 focused candidate 3 | {"attackBonus":4,"defensePool":8,"defenderVisibleTopK":4,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 46.31% | 45.3–47.3% | 478 |

The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.
