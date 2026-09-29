# Candidate V3 Balance Report

Generated 2026-09-29T06:00:34.237Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: standard; seed: 20260928; V3 baseline matches: 10,000; runtime: 300.15s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 8,962; censored deuce matches: 1,038 (10.38%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 196184 | 114716 (58.47%) | 81468 (41.53%) |
| receive | 81468 | 32200 (39.52%) | 49268 (60.48%) |
| rally | 70049 | 47576 (67.92%) | 22473 (32.08%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 7.005; per Rally entry: 1.422.
- Rally fifth-comparison share: 4.04%; tie-break share: 3.43%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 39444/49268 points (80.06%; Wilson 95% 79.7–80.4%). The denominator is points reaching Rally.
- First-server match wins: 4490/8962 completed matches (50.10%).
- Rally tie-break starter wins: 1423/1692 (84.10%; Wilson 95% 82.3–85.8%).
- Top option/off-top-K attack picks: top1 240131, rank2–K 58263, off Top-K 49307. Defender allocations put 1706423 points on publicly visible Top-K options and 908937 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 200 | 46.50% | 39.7–53.4% | 15 |
| attackBonus | 5 | 200 | 41.00% | 34.4–47.9% | 27 |
| defensePool | 6 | 200 | 46.50% | 39.7–53.4% | 22 |
| defensePool | 7 | 200 | 40.50% | 33.9–47.4% | 22 |
| defensePool | 9 | 200 | 45.00% | 38.3–51.9% | 22 |
| defensePool | 10 | 200 | 46.00% | 39.2–52.9% | 19 |
| defenderVisibleTopK | 2 | 200 | 48.00% | 41.2–54.9% | 20 |
| defenderVisibleTopK | 4 | 200 | 48.50% | 41.7–55.4% | 18 |
| serviceThreshold | 4 | 200 | 37.50% | 31.1–44.4% | 35 |
| serviceThreshold | 6 | 200 | 47.00% | 40.2–53.9% | 12 |
| counterThreshold | 4 | 200 | 48.50% | 41.7–55.4% | 11 |
| counterThreshold | 6 | 200 | 43.50% | 36.8–50.4% | 34 |
| rallyThreshold | 3 | 200 | 41.50% | 34.9–48.4% | 27 |
| rallyThreshold | 5 | 200 | 45.00% | 38.3–51.9% | 13 |
| rallyMaxComparisons | 4 | 200 | 47.00% | 40.2–53.9% | 15 |
| rallyMaxComparisons | 6 | 200 | 50.50% | 43.6–57.4% | 18 |

Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| V3 focused candidate 1 | {"attackBonus":3,"defensePool":8,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 45.00% | 44.0–46.0% | 750 |
| V3 focused candidate 2 | {"attackBonus":4,"defensePool":6,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 42.42% | 41.5–43.4% | 1235 |
| V3 focused candidate 3 | {"attackBonus":4,"defensePool":8,"defenderVisibleTopK":4,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 43.67% | 42.7–44.6% | 978 |

The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.


## V1 comparison and explicit mechanic recommendation

| Ruleset | Matches | Censored deuce rate | Points per match | Rally comparisons per match |
|---|---:|---:|---:|---:|
| Legacy V1 | 10000 | 3.00 | 16.42 | 27.76 |
| Candidate V1 | 10000 | 11.34 | 19.73 | 9.35 |
| Candidate V3 | 10000 | 10.38 | 19.62 | 7.00 |

## Visible Top-K attack and defense outcomes

| Attacker base rank | Choices | Conversions | Conversion rate | Hold rate |
|---|---:|---:|---:|---:|
| top1 | 240131 | 161162 | 67.11% | 32.89% |
| top2 | 35263 | 17072 | 48.41% | 51.59% |
| top3 | 23000 | 6208 | 26.99% | 73.01% |
| offTopK | 49307 | 10050 | 20.38% | 79.62% |

## FortressBot defense allocation patterns

| Allocation shape | Count | Share |
|---|---:|---:|
| FortressBot:service:4/4/0/0/0 | 4321 | 16.81% |
| FortressBot:service:4/2/1/1/0 | 4306 | 16.75% |
| FortressBot:service:2/2/2/1/1 | 4288 | 16.68% |
| FortressBot:service:5/3/0/0/0 | 4276 | 16.63% |
| FortressBot:service:8/0/0/0/0 | 4274 | 16.63% |
| FortressBot:service:6/2/0/0/0 | 4240 | 16.49% |
| FortressBot:receive:6/2/0/0/0 | 1410 | 17.33% |
| FortressBot:receive:4/4/0/0/0 | 1383 | 16.99% |
| FortressBot:receive:4/2/1/1/0 | 1363 | 16.75% |
| FortressBot:receive:8/0/0/0/0 | 1339 | 16.45% |
| FortressBot:receive:5/3/0/0/0 | 1332 | 16.37% |
| FortressBot:receive:2/2/2/1/1 | 1311 | 16.11% |
| FortressBot:rally:4/4/0/0/0 | 865 | 17.64% |
| FortressBot:rally:2/2/2/1/1 | 844 | 17.21% |
| FortressBot:rally:8/0/0/0/0 | 810 | 16.52% |
| FortressBot:rally:5/3/0/0/0 | 806 | 16.44% |
| FortressBot:rally:6/2/0/0/0 | 799 | 16.30% |
| FortressBot:rally:4/2/1/1/0 | 779 | 15.89% |

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

Candidate V3 is not ready to become the next formal ruleset. Its first Rally attacker has a 80.06% point-win share (95% CI 79.7–80.4%), while the first server wins 50.10% of completed matches. This localizes the concern to Rally initiative rather than the overall first-server seat. Keep V3 experimental; investigate alternating initiative and even comparison counts, then rerun focused and Full simulations.

Ability marginal-value columns are descriptive counterfactual counts: defense points whose removal would cross the direct-win threshold, and attack conversions that would fail without the +4 bonus. They are not causal estimates across matchups. Gear player-standardized rates average within-player performance for each item and are supplied beside raw rates; confidence intervals on raw rates are not transferred to the standardized statistic.

## Resolution frequency and concentration alerts

| Stage | Attack-ending points per 100 played points |
|---|---:|
| service | 58.47 |
| receive | 16.41 |
| rally | 24.25 |

The attack-rank table above supplies hold rate for Top 1/2/3 and off Top-K choices. The parameter sweep compares Top 2/3/4 directly.

Dominant attack options (50% or more of a stage’s choices):

| Stage and ability | Choices | Share | Alert |
|---|---:|---:|---|
| None | 0 | 0% | none |

Dominant FortressBot allocation shapes are compared within each stage: none exceeded 50% in this sample. Deuce-censored matches remain separate from wins and ordinary completed-match rates.

## Deuce / unresolved match details

- Matches reaching deuce: 1739/10000 (17.39%).
- Stable deuce-cycle truncations: 1038.
- 250-point unresolved truncations: 0.
- Total unresolved/censored matches: 1038; these are excluded from completed win rates and are never recorded as ordinary draws.