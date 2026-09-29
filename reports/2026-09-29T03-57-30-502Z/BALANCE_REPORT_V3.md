# Candidate V3 Balance Report

Generated 2026-09-29T03:57:30.502Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: full; seed: 20260928; V3 baseline matches: 100,000; runtime: 1351.97s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 89,756; censored deuce matches: 10,244 (10.24%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 1959253 | 1145288 (58.46%) | 813965 (41.54%) |
| receive | 813965 | 320013 (39.32%) | 493952 (60.68%) |
| rally | 705199 | 476595 (67.58%) | 228604 (32.42%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 7.052; per Rally entry: 1.428.
- Rally fifth-comparison share: 4.15%; tie-break share: 3.51%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 395892/493952 points (80.15%; Wilson 95% 80.0–80.3%). The denominator is points reaching Rally.
- First-server match wins: 44762/89756 completed matches (49.87%).
- Rally tie-break starter wins: 14478/17357 (83.41%; Wilson 95% 82.9–84.0%).
- Top option/off-top-K attack picks: top1 2403336, rank2–K 577610, off Top-K 497471. Defender allocations put 17022460 points on publicly visible Top-K options and 9114900 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 1000 | 45.50% | 42.4–48.6% | 81 |
| attackBonus | 5 | 1000 | 41.60% | 38.6–44.7% | 163 |
| defensePool | 6 | 1000 | 44.20% | 41.1–47.3% | 126 |
| defensePool | 7 | 1000 | 45.70% | 42.6–48.8% | 112 |
| defensePool | 9 | 1000 | 43.70% | 40.7–46.8% | 83 |
| defensePool | 10 | 1000 | 44.10% | 41.1–47.2% | 94 |
| defenderVisibleTopK | 2 | 1000 | 47.60% | 44.5–50.7% | 108 |
| defenderVisibleTopK | 4 | 1000 | 44.80% | 41.7–47.9% | 93 |
| serviceThreshold | 4 | 1000 | 39.80% | 36.8–42.9% | 184 |
| serviceThreshold | 6 | 1000 | 45.10% | 42.0–48.2% | 52 |
| counterThreshold | 4 | 1000 | 45.70% | 42.6–48.8% | 74 |
| counterThreshold | 6 | 1000 | 41.90% | 38.9–45.0% | 147 |
| rallyThreshold | 3 | 1000 | 43.90% | 40.9–47.0% | 113 |
| rallyThreshold | 5 | 1000 | 44.20% | 41.1–47.3% | 98 |
| rallyMaxComparisons | 4 | 1000 | 46.20% | 43.1–49.3% | 87 |
| rallyMaxComparisons | 6 | 1000 | 44.90% | 41.8–48.0% | 93 |

Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| V3 focused candidate 1 | {"attackBonus":3,"defensePool":8,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 45.00% | 44.0–46.0% | 750 |
| V3 focused candidate 2 | {"attackBonus":4,"defensePool":7,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 43.18% | 42.2–44.2% | 1071 |
| V3 focused candidate 3 | {"attackBonus":4,"defensePool":8,"defenderVisibleTopK":2,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 43.61% | 42.6–44.6% | 1064 |

The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.


## V1 comparison and explicit mechanic recommendation

| Ruleset | Matches | Censored deuce rate | Points per match | Rally comparisons per match |
|---|---:|---:|---:|---:|
| Legacy V1 | 100000 | 2.71 | 16.37 | 27.93 |
| Candidate V1 | 100000 | 11.16 | 19.76 | 9.30 |
| Candidate V3 | 100000 | 10.24 | 19.59 | 7.05 |

## Visible Top-K attack and defense outcomes

| Attacker base rank | Choices | Conversions | Conversion rate | Hold rate |
|---|---:|---:|---:|---:|
| top1 | 2403336 | 1608816 | 66.94% | 33.06% |
| top2 | 347738 | 169051 | 48.61% | 51.39% |
| top3 | 229872 | 62986 | 27.40% | 72.60% |
| offTopK | 497471 | 101043 | 20.31% | 79.69% |

## FortressBot defense allocation patterns

| Allocation shape | Count | Share |
|---|---:|---:|
| FortressBot:service:4/2/1/1/0 | 43552 | 16.75% |
| FortressBot:service:4/4/0/0/0 | 43433 | 16.70% |
| FortressBot:service:8/0/0/0/0 | 43392 | 16.69% |
| FortressBot:service:6/2/0/0/0 | 43336 | 16.67% |
| FortressBot:service:2/2/2/1/1 | 43185 | 16.61% |
| FortressBot:service:5/3/0/0/0 | 43133 | 16.59% |
| FortressBot:receive:6/2/0/0/0 | 14297 | 16.99% |
| FortressBot:receive:4/4/0/0/0 | 14089 | 16.74% |
| FortressBot:receive:8/0/0/0/0 | 14043 | 16.69% |
| FortressBot:receive:4/2/1/1/0 | 13997 | 16.63% |
| FortressBot:receive:5/3/0/0/0 | 13895 | 16.51% |
| FortressBot:receive:2/2/2/1/1 | 13830 | 16.43% |
| FortressBot:rally:6/2/0/0/0 | 8503 | 16.81% |
| FortressBot:rally:4/4/0/0/0 | 8462 | 16.73% |
| FortressBot:rally:8/0/0/0/0 | 8455 | 16.72% |
| FortressBot:rally:4/2/1/1/0 | 8391 | 16.59% |
| FortressBot:rally:2/2/2/1/1 | 8388 | 16.59% |
| FortressBot:rally:5/3/0/0/0 | 8374 | 16.56% |

A single pattern above 50% is treated as a dominance warning; the strategy CSV marks it. FortressBot outcome rate is listed separately and should be reviewed with allocation shape frequency.

## Mechanic recommendation

| Mechanic | Baseline | Tested alternatives | Recommendation |
|---|---:|---|---|
| attackBonus | 4 | 3, 5 | Retain +4 as the reference; do not infer a change from A-seat parity alone. |
| defensePool | 8 | 6, 7, 9, 10 | Retain 8 provisionally; review Fortress allocation concentration before removing the cap formally. |
| defenderVisibleTopK | 3 | 2, 4 | Retain Top 3 provisionally; compare Top 2 and Top 4 with attack-rank and defense-hold metrics. |
| serviceThreshold | 5 | 4, 6 | Retain 5 provisionally; evaluate Serve conversion and deuce censoring together. |
| counterThreshold | 5 | 4, 6 | Retain 5 provisionally; Counter currently feeds Rally often, so check rally length and point duration. |
| rallyThreshold | 4 | 3, 5 | Retain 4 provisionally; inspect direct conversion and initiative together. |
| rallyMaxComparisons | 5 | 4, 6 | Do not retain odd 5 as a final choice until the 75% first-Rally-attacker bias is resolved; test even 4/6 and attacker-sequence alternatives. |

Tie Break: keep the cumulative-advantage rule only as the comparison baseline while investigating the measured first-attacker and tie-break-starter win shares. Do not select a tie-break rule from aggregate win rate alone; compare tied margin patterns, first/last attacker, and even/odd maximum comparisons.

Candidate V3 is not ready to become the next formal ruleset. Its first Rally attacker has a 80.15% point-win share (95% CI 80.0–80.3%), while the first server wins 49.87% of completed matches. This localizes the concern to Rally initiative rather than the overall first-server seat. Keep V3 experimental; investigate alternating initiative and even comparison counts, then rerun focused and Full simulations.

Ability marginal-value columns are descriptive counterfactual counts: defense points whose removal would cross the direct-win threshold, and attack conversions that would fail without the +4 bonus. They are not causal estimates across matchups. Gear player-standardized rates average within-player performance for each item and are supplied beside raw rates; confidence intervals on raw rates are not transferred to the standardized statistic.

## Resolution frequency and concentration alerts

| Stage | Attack-ending points per 100 played points |
|---|---:|
| service | 58.46 |
| receive | 16.33 |
| rally | 24.33 |

The attack-rank table above supplies hold rate for Top 1/2/3 and off Top-K choices. The parameter sweep compares Top 2/3/4 directly.

Dominant attack options (50% or more of a stage’s choices):

| Stage and ability | Choices | Share | Alert |
|---|---:|---:|---|
| None | 0 | 0% | none |

Dominant FortressBot allocation shapes are compared within each stage: none exceeded 50% in this sample. Deuce-censored matches remain separate from wins and ordinary completed-match rates.

## Deuce / unresolved match details

- Matches reaching deuce: 17043/100000 (17.04%).
- Stable deuce-cycle truncations: 10244.
- 250-point unresolved truncations: 0.
- Total unresolved/censored matches: 10244; these are excluded from completed win rates and are never recorded as ordinary draws.

## Full-run decision

Do not promote V3. Its first-Rally-attacker point-win rate is 80.15%, tie-break starter win rate is 83.41%, and deuce censoring is 10.24%. The first-server win rate is 49.87%, which points to Rally initiative and tie-break resolution—not service seating—as the main concern. Keep +4 / pool 8 / Top 3 / thresholds 5-5-4 as the measured reference only; do not formalize the unbounded defense pool until initiative and censoring behavior are corrected. Test even Rally limits 4 and 6 plus alternating initiative, then repeat focused validation and Full.