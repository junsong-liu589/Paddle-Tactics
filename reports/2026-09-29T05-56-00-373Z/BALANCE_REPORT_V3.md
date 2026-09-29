# Candidate V3 Balance Report

Generated 2026-09-29T05:56:00.373Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: quick; seed: 20260928; V3 baseline matches: 1,000; runtime: 115.02s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 896; censored deuce matches: 104 (10.40%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 19845 | 11888 (59.90%) | 7957 (40.10%) |
| receive | 7957 | 3223 (40.51%) | 4734 (59.49%) |
| rally | 6708 | 4584 (68.34%) | 2124 (31.66%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 6.708; per Rally entry: 1.417.
- Rally fifth-comparison share: 3.74%; tie-break share: 3.17%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 3783/4734 points (79.91%; Wilson 95% 78.7–81.0%). The denominator is points reaching Rally.
- First-server match wins: 436/896 completed matches (48.66%).
- Rally tie-break starter wins: 131/150 (87.33%; Wilson 95% 81.1–91.7%).
- Top option/off-top-K attack picks: top1 23785, rank2–K 5657, off Top-K 5068. Defender allocations put 169126 points on publicly visible Top-K options and 91162 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 30 | 46.67% | 30.2–63.9% | 5 |
| attackBonus | 5 | 30 | 43.33% | 27.4–60.8% | 3 |
| defensePool | 6 | 30 | 36.67% | 21.9–54.5% | 3 |
| defensePool | 7 | 30 | 53.33% | 36.1–69.8% | 5 |
| defensePool | 9 | 30 | 43.33% | 27.4–60.8% | 2 |
| defensePool | 10 | 30 | 50.00% | 33.2–66.8% | 4 |
| defenderVisibleTopK | 2 | 30 | 40.00% | 24.6–57.7% | 4 |
| defenderVisibleTopK | 4 | 30 | 50.00% | 33.2–66.8% | 1 |
| serviceThreshold | 4 | 30 | 40.00% | 24.6–57.7% | 6 |
| serviceThreshold | 6 | 30 | 36.67% | 21.9–54.5% | 0 |
| counterThreshold | 4 | 30 | 50.00% | 33.2–66.8% | 3 |
| counterThreshold | 6 | 30 | 43.33% | 27.4–60.8% | 5 |
| rallyThreshold | 3 | 30 | 43.33% | 27.4–60.8% | 4 |
| rallyThreshold | 5 | 30 | 43.33% | 27.4–60.8% | 2 |
| rallyMaxComparisons | 4 | 30 | 40.00% | 24.6–57.7% | 4 |
| rallyMaxComparisons | 6 | 30 | 40.00% | 24.6–57.7% | 3 |

Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| V3 focused candidate 1 | {"attackBonus":3,"defensePool":8,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 45.00% | 44.0–46.0% | 750 |
| V3 focused candidate 2 | {"attackBonus":4,"defensePool":10,"defenderVisibleTopK":3,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 43.89% | 42.9–44.9% | 952 |
| V3 focused candidate 3 | {"attackBonus":4,"defensePool":8,"defenderVisibleTopK":4,"serviceThreshold":5,"counterThreshold":5,"rallyThreshold":4,"rallyMaxComparisons":5,"explorationEpsilon":0.05} | 10000 | 43.67% | 42.7–44.6% | 978 |

The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.


## V1 comparison and explicit mechanic recommendation

| Ruleset | Matches | Censored deuce rate | Points per match | Rally comparisons per match |
|---|---:|---:|---:|---:|
| Legacy V1 | 1000 | 3.10 | 16.48 | 27.67 |
| Candidate V1 | 1000 | 11.90 | 19.89 | 8.97 |
| Candidate V3 | 1000 | 10.40 | 19.84 | 6.71 |

## Visible Top-K attack and defense outcomes

| Attacker base rank | Choices | Conversions | Conversion rate | Hold rate |
|---|---:|---:|---:|---:|
| top1 | 23785 | 16184 | 68.04% | 31.96% |
| top2 | 3525 | 1757 | 49.84% | 50.16% |
| top3 | 2132 | 574 | 26.92% | 73.08% |
| offTopK | 5068 | 1180 | 23.28% | 76.72% |

## FortressBot defense allocation patterns

| Allocation shape | Count | Share |
|---|---:|---:|
| FortressBot:service:2/2/2/1/1 | 465 | 17.87% |
| FortressBot:service:5/3/0/0/0 | 453 | 17.41% |
| FortressBot:service:4/4/0/0/0 | 437 | 16.79% |
| FortressBot:service:4/2/1/1/0 | 424 | 16.30% |
| FortressBot:service:8/0/0/0/0 | 414 | 15.91% |
| FortressBot:service:6/2/0/0/0 | 409 | 15.72% |
| FortressBot:receive:5/3/0/0/0 | 149 | 18.86% |
| FortressBot:receive:6/2/0/0/0 | 138 | 17.47% |
| FortressBot:receive:2/2/2/1/1 | 133 | 16.84% |
| FortressBot:receive:4/2/1/1/0 | 128 | 16.20% |
| FortressBot:receive:4/4/0/0/0 | 121 | 15.32% |
| FortressBot:receive:8/0/0/0/0 | 121 | 15.32% |
| FortressBot:rally:2/2/2/1/1 | 94 | 18.91% |
| FortressBot:rally:4/4/0/0/0 | 87 | 17.51% |
| FortressBot:rally:6/2/0/0/0 | 87 | 17.51% |
| FortressBot:rally:8/0/0/0/0 | 81 | 16.30% |
| FortressBot:rally:5/3/0/0/0 | 75 | 15.09% |
| FortressBot:rally:4/2/1/1/0 | 73 | 14.69% |

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

Candidate V3 is not ready to become the next formal ruleset. Its first Rally attacker has a 79.91% point-win share (95% CI 78.7–81.0%), while the first server wins 48.66% of completed matches. This localizes the concern to Rally initiative rather than the overall first-server seat. Keep V3 experimental; investigate alternating initiative and even comparison counts, then rerun focused and Full simulations.

Ability marginal-value columns are descriptive counterfactual counts: defense points whose removal would cross the direct-win threshold, and attack conversions that would fail without the +4 bonus. They are not causal estimates across matchups. Gear player-standardized rates average within-player performance for each item and are supplied beside raw rates; confidence intervals on raw rates are not transferred to the standardized statistic.

## Resolution frequency and concentration alerts

| Stage | Attack-ending points per 100 played points |
|---|---:|
| service | 59.90 |
| receive | 16.24 |
| rally | 23.10 |

The attack-rank table above supplies hold rate for Top 1/2/3 and off Top-K choices. The parameter sweep compares Top 2/3/4 directly.

Dominant attack options (50% or more of a stage’s choices):

| Stage and ability | Choices | Share | Alert |
|---|---:|---:|---|
| None | 0 | 0% | none |

Dominant FortressBot allocation shapes are compared within each stage: none exceeded 50% in this sample. Deuce-censored matches remain separate from wins and ordinary completed-match rates.

## Deuce / unresolved match details

- Matches reaching deuce: 178/1000 (17.80%).
- Stable deuce-cycle truncations: 104.
- 250-point unresolved truncations: 0.
- Total unresolved/censored matches: 104; these are excluded from completed win rates and are never recorded as ordinary draws.