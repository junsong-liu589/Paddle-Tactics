# Candidate V3 Balance Report

Generated 2026-09-29T05:42:52.678Z. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.

## Run and status

- Preset: quick; seed: 20260928; V3 baseline matches: 10; runtime: 0.21s.
- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.
- Completed matches: 10; censored deuce matches: 0 (0.00%). Censored matches are excluded from completed-match win rates.

## Attack conversion and defense hold

Only attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.

| Stage | Comparisons | Attack conversion | Defense hold |
|---|---:|---:|---:|
| service | 160 | 65 (40.63%) | 95 (59.38%) |
| receive | 95 | 35 (36.84%) | 60 (63.16%) |
| rally | 92 | 59 (64.13%) | 33 (35.87%) |

## Rally and initiative diagnostics

- Average Rally comparisons per match: 9.200; per Rally entry: 1.533.
- Rally fifth-comparison share: 1.67%; tie-break share: 1.67%.
- FIRST_RALLY_ATTACKER_ADVANTAGE: 42/60 points (70.00%; Wilson 95% 57.5–80.1%). The denominator is points reaching Rally.
- First-server match wins: 8/10 completed matches (80.00%).
- Rally tie-break starter wins: 1/1 (100.00%; Wilson 95% 20.7–100.0%).
- Top option/off-top-K attack picks: top1 215, rank2–K 58, off Top-K 74. Defender allocations put 1743 points on publicly visible Top-K options and 777 elsewhere.

## One-factor parameter experiments

| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|---:|


Second-stage focused validation (10,000+ matches each):

| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|


The focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.

## Player, gear, loadout, abilities, and strategies

See players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.

## Decision

Do not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.


## V1 comparison and explicit mechanic recommendation

| Ruleset | Matches | Censored deuce rate | Points per match | Rally comparisons per match |
|---|---:|---:|---:|---:|
| Legacy V1 | 10 | 0.00 | 15.60 | 40.40 |
| Candidate V1 | 10 | 10.00 | 20.70 | 19.40 |
| Candidate V3 | 10 | 0.00 | 16.00 | 9.20 |

## Visible Top-K attack and defense outcomes

| Attacker base rank | Choices | Conversions | Conversion rate | Hold rate |
|---|---:|---:|---:|---:|
| top1 | 215 | 126 | 58.60% | 41.40% |
| top2 | 30 | 17 | 56.67% | 43.33% |
| top3 | 28 | 0 | 0.00% | 100.00% |
| offTopK | 74 | 16 | 21.62% | 78.38% |

## FortressBot defense allocation patterns

| Allocation shape | Count | Share |
|---|---:|---:|
| FortressBot:service:4/4/0/0/0 | 8 | 36.36% |
| FortressBot:service:5/3/0/0/0 | 5 | 22.73% |
| FortressBot:receive:5/3/0/0/0 | 5 | 35.71% |
| FortressBot:service:6/2/0/0/0 | 4 | 18.18% |
| FortressBot:rally:4/4/0/0/0 | 3 | 37.50% |
| FortressBot:rally:2/2/2/1/1 | 3 | 37.50% |
| FortressBot:receive:4/4/0/0/0 | 3 | 21.43% |
| FortressBot:receive:4/2/1/1/0 | 2 | 14.29% |
| FortressBot:receive:6/2/0/0/0 | 2 | 14.29% |
| FortressBot:rally:6/2/0/0/0 | 2 | 25.00% |
| FortressBot:receive:2/2/2/1/1 | 2 | 14.29% |
| FortressBot:service:2/2/2/1/1 | 2 | 9.09% |
| FortressBot:service:4/2/1/1/0 | 2 | 9.09% |
| FortressBot:service:8/0/0/0/0 | 1 | 4.55% |

A single pattern above 50% is treated as a dominance warning; the strategy CSV marks it. FortressBot outcome rate is listed separately and should be reviewed with allocation shape frequency.

## Mechanic recommendation

| Mechanic | Baseline | Tested alternatives | Recommendation |
|---|---:|---|---|
| attackBonus | 4 | baseline only | Retain +4 as the reference; do not infer a change from A-seat parity alone. |
| defensePool | 8 | baseline only | Retain 8 provisionally; review Fortress allocation concentration before removing the cap formally. |
| defenderVisibleTopK | 3 | baseline only | Retain Top 3 provisionally; compare Top 2 and Top 4 with attack-rank and defense-hold metrics. |
| serviceThreshold | 5 | baseline only | Retain 5 provisionally; evaluate Serve conversion and deuce censoring together. |
| counterThreshold | 5 | baseline only | Retain 5 provisionally; Counter currently feeds Rally often, so check rally length and point duration. |
| rallyThreshold | 4 | baseline only | Retain 4 provisionally; inspect direct conversion and initiative together. |
| rallyMaxComparisons | 5 | baseline only | Do not retain odd 5 as a final choice until the 75% first-Rally-attacker bias is resolved; test even 4/6 and attacker-sequence alternatives. |

Tie Break: keep the cumulative-advantage rule only as the comparison baseline while investigating the measured first-attacker and tie-break-starter win shares. Do not select a tie-break rule from aggregate win rate alone; compare tied margin patterns, first/last attacker, and even/odd maximum comparisons.

Candidate V3 is not ready to become the next formal ruleset. Its first Rally attacker has a 70.00% point-win share (95% CI 57.5–80.1%), while the first server wins 80.00% of completed matches. This localizes the concern to Rally initiative rather than the overall first-server seat. Keep V3 experimental; investigate alternating initiative and even comparison counts, then rerun focused and Full simulations.

Ability marginal-value columns are descriptive counterfactual counts: defense points whose removal would cross the direct-win threshold, and attack conversions that would fail without the +4 bonus. They are not causal estimates across matchups. Gear player-standardized rates average within-player performance for each item and are supplied beside raw rates; confidence intervals on raw rates are not transferred to the standardized statistic.

## Resolution frequency and concentration alerts

| Stage | Attack-ending points per 100 played points |
|---|---:|
| service | 40.63 |
| receive | 21.88 |
| rally | 36.88 |

The attack-rank table above supplies hold rate for Top 1/2/3 and off Top-K choices. The parameter sweep compares Top 2/3/4 directly.

Dominant attack options (50% or more of a stage’s choices):

| Stage and ability | Choices | Share | Alert |
|---|---:|---:|---|
| None | 0 | 0% | none |

Dominant FortressBot allocation shapes are compared within each stage: none exceeded 50% in this sample. Deuce-censored matches remain separate from wins and ordinary completed-match rates.

## Deuce / unresolved match details

- Matches reaching deuce: 0/10 (0.00%).
- Stable deuce-cycle truncations: 0.
- 250-point unresolved truncations: 0.
- Total unresolved/censored matches: 0; these are excluded from completed win rates and are never recorded as ordinary draws.