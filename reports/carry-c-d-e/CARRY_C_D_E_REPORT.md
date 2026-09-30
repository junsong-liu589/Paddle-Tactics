# V4 Carry Economy Focused Experiment: C / D / E

## Scope and method

This is one isolated Carry-reward experiment. Candidate V4 attack bonuses, thresholds, base budgets, Rally pool, player data, blade data, rubber data, and formal rules were not changed. The experiment applies stage-specific Carry multipliers inside the balance simulator after the existing V4 deterministic floor conversion.

- Seed: 20260928; exactly 20,000 matches per plan; 60,000 total.
- Sampling: the same ten pairwise combinations of the five requested resource bots; 1,000 mirrored pairs per matchup and plan (2,000 games per matchup). All three plans reuse each scenario's loadouts, server orientation, policy pairing and PRNG seed (common random numbers).
- Integer rule: floor after multiplier, e.g. C/D/E Carry is Math.floor(unspent × stage multiplier). Existing integer unspent points and default V4 100% floor are preserved.
- Match mode is BO1 as in the current simulator. For the efficiency table, “game win” equals match win; censored matches are excluded from completed-game and completed-match denominators. Point win is counted when that observed point ended.
- Resource-inflation screening: for interpretation only, Rally budgets ≥35 above 10% are flagged. The request did not specify a numeric cutoff; this threshold is not a formal rule.
- Tier sanity matchups pool mixed gear observations only to check the fixed player tiers; no equipment ranking or balance inference is intended.

## C / D / E comparison

| Plan | Serve→Counter / Counter→Rally | Any >65% pair | SpendAll win | SaveForRally win | MinimumNeeded win | BalancedReserve win | Rally first attacker win | Censored | Rally budget ≥35 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| C | 1.50 / 1.25 | 有 | 82.8% | 5.7% | 39.3% | 39.7% | 53.33% | 1.40% | 12.53% |
| D | 1.50 / 1.50 | 有 | 82.6% | 6.1% | 39.1% | 39.9% | 52.75% | 1.49% | 13.39% |
| E | 1.75 / 1.25 | 有 | 82.8% | 5.8% | 39.4% | 39.6% | 52.51% | 1.52% | 12.74% |

## Resource strategy total win rates

Rates use completed strategy appearances across the four opponents; each bot has 8,000 scheduled appearances per plan. Paired matchup detail and Wilson intervals are in resource-strategy-matchups.csv. A pair gets DOMINANT_RESOURCE_STRATEGY_WARNING if a side's observed win rate exceeds 65%; CI is shown to distinguish screening signal from strength of evidence.

## Plan C

Serve→Counter ×1.50; Counter→Rally ×1.25. Matches: 20,000 (fixed seed 20260928, 1,000 mirrored pairs per matchup).

### Resource strategy results

| Bot | Matches | Completed | Wins | Win rate | Wilson 95% CI |
|---|---:|---:|---:|---:|---:|
| SaveForRallyBot | 8000 | 7908 | 447 | 5.65% | 5.16–6.18% |
| AllInEarlyBot | 8000 | 7864 | 6525 | 82.97% | 82.13–83.79% |
| MinimumNeededBot | 8000 | 7965 | 3132 | 39.32% | 38.25–40.40% |
| BalancedReserveBot | 8000 | 7842 | 3111 | 39.67% | 38.59–40.76% |
| SpendAllBot | 8000 | 7861 | 6505 | 82.75% | 81.90–83.57% |

### Actual resource use

| Stage | Measure | Observations | Mean | Median | P25 | P75 |
|---|---|---:|---:|---:|---:|---:|
| Serve | attack | 310113 | 2.37 | 2 | 1 | 4 |
| Serve | defense | 310113 | 6.68 | 7 | 6 | 10 |
| Counter | attack | 149237 | 2.96 | 4 | 2 | 4 |
| Counter | defense | 149237 | 6.07 | 7 | 0 | 10 |
| Rally | total budget | 152436 | 26.66 | 26 | 20 | 30 |
| Rally | attack allocation | 76218 | 19.94 | 18 | 18 | 21 |
| Rally | defense allocation | 76218 | 25.79 | 24 | 23 | 28 |

### Resource economy and match health

- Serve direct: 51.88%; Counter direct: 48.93%; Rally entries: 24.58% of Serve comparisons.
- Rally direct: 56.24%; tie-break: 43.76%; average Rally comparisons: 2.554.
- First Rally attacker wins 53.33% (Wilson 95% CI 52.98–53.68%).
- Completed 19720/20000; deuce 7.30%; censored/truncated 1.40%.
- Reserve entering Counter: mean 3.26, median/P75/P90/P95/max 3/6/6/6/15.
- Reserve entering Rally: mean 6.66, median/P75/P90/P95/max 6/10/20/20/23.
- Rally total budget distribution: ≤20: 29.27%; 21–24: 6.43%; 25–29: 35.00%; 30–34: 16.76%; ≥35: 12.53%.

### Screening flags

- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|MinimumNeededBot (92.3% / 7.7%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|BalancedReserveBot (89.0% / 11.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SpendAllBot|SaveForRallyBot (99.0% / 1.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SaveForRallyBot|BalancedReserveBot (18.5% / 81.5%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|SaveForRallyBot (98.9% / 1.1%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SaveForRallyBot (97.7% / 2.3%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SpendAllBot (7.0% / 93.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: BalancedReserveBot|SpendAllBot (11.4% / 88.6%)
- SpendAllBot overall completion win rate 82.8%
- Rally total budgets >=35: 12.5%
- MONOTONIC_RESOURCE_EFFICIENCY_WARNING: receive: savings decrease monotonically with win rate (range 45.4pp)

---

## Plan D

Serve→Counter ×1.50; Counter→Rally ×1.50. Matches: 20,000 (fixed seed 20260928, 1,000 mirrored pairs per matchup).

### Resource strategy results

| Bot | Matches | Completed | Wins | Win rate | Wilson 95% CI |
|---|---:|---:|---:|---:|---:|
| SaveForRallyBot | 8000 | 7892 | 484 | 6.13% | 5.62–6.68% |
| AllInEarlyBot | 8000 | 7857 | 6489 | 82.59% | 81.73–83.41% |
| MinimumNeededBot | 8000 | 7970 | 3113 | 39.06% | 37.99–40.14% |
| BalancedReserveBot | 8000 | 7833 | 3129 | 39.95% | 38.87–41.04% |
| SpendAllBot | 8000 | 7852 | 6487 | 82.62% | 81.76–83.44% |

### Actual resource use

| Stage | Measure | Observations | Mean | Median | P25 | P75 |
|---|---|---:|---:|---:|---:|---:|
| Serve | attack | 311629 | 2.36 | 2 | 1 | 4 |
| Serve | defense | 311629 | 6.67 | 7 | 6 | 10 |
| Counter | attack | 149961 | 2.96 | 4 | 2 | 4 |
| Counter | defense | 149961 | 6.07 | 7 | 0 | 10 |
| Rally | total budget | 153374 | 28.16 | 27 | 20 | 32 |
| Rally | attack allocation | 76687 | 20.76 | 19 | 18 | 23 |
| Rally | defense allocation | 76687 | 27.62 | 25 | 24 | 30 |

### Resource economy and match health

- Serve direct: 51.88%; Counter direct: 48.86%; Rally entries: 24.61% of Serve comparisons.
- Rally direct: 54.88%; tie-break: 45.12%; average Rally comparisons: 2.592.
- First Rally attacker wins 52.75% (Wilson 95% CI 52.40–53.10%).
- Completed 19702/20000; deuce 7.36%; censored/truncated 1.49%.
- Reserve entering Counter: mean 3.26, median/P75/P90/P95/max 3/6/6/6/15.
- Reserve entering Rally: mean 8.16, median/P75/P90/P95/max 7/12/24/24/28.
- Rally total budget distribution: ≤20: 29.28%; 21–24: 6.24%; 25–29: 32.52%; 30–34: 18.57%; ≥35: 13.39%.

### Screening flags

- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|MinimumNeededBot (92.0% / 8.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|BalancedReserveBot (88.0% / 12.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SpendAllBot|SaveForRallyBot (98.7% / 1.3%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SaveForRallyBot|BalancedReserveBot (19.5% / 80.5%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|SaveForRallyBot (98.7% / 1.3%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SaveForRallyBot (97.3% / 2.7%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SpendAllBot (7.2% / 92.8%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: BalancedReserveBot|SpendAllBot (11.4% / 88.6%)
- SpendAllBot overall completion win rate 82.6%
- Rally total budgets >=35: 13.4%


---

## Plan E

Serve→Counter ×1.75; Counter→Rally ×1.25. Matches: 20,000 (fixed seed 20260928, 1,000 mirrored pairs per matchup).

### Resource strategy results

| Bot | Matches | Completed | Wins | Win rate | Wilson 95% CI |
|---|---:|---:|---:|---:|---:|
| SaveForRallyBot | 8000 | 7905 | 459 | 5.81% | 5.31–6.34% |
| AllInEarlyBot | 8000 | 7844 | 6506 | 82.94% | 82.09–83.76% |
| MinimumNeededBot | 8000 | 7967 | 3136 | 39.36% | 38.29–40.44% |
| BalancedReserveBot | 8000 | 7833 | 3100 | 39.58% | 38.50–40.66% |
| SpendAllBot | 8000 | 7841 | 6494 | 82.82% | 81.97–83.64% |

### Actual resource use

| Stage | Measure | Observations | Mean | Median | P25 | P75 |
|---|---|---:|---:|---:|---:|---:|
| Serve | attack | 310880 | 2.37 | 2 | 1 | 4 |
| Serve | defense | 310880 | 6.68 | 7 | 6 | 10 |
| Counter | attack | 149228 | 2.96 | 4 | 2 | 4 |
| Counter | defense | 149228 | 6.15 | 7 | 0 | 10 |
| Rally | total budget | 153240 | 27.19 | 26 | 20 | 31 |
| Rally | attack allocation | 76620 | 20.40 | 19 | 18 | 22 |
| Rally | defense allocation | 76620 | 26.33 | 24 | 23 | 28 |

### Resource economy and match health

- Serve direct: 52.00%; Counter direct: 48.66%; Rally entries: 24.65% of Serve comparisons.
- Rally direct: 56.32%; tie-break: 43.68%; average Rally comparisons: 2.556.
- First Rally attacker wins 52.51% (Wilson 95% CI 52.15–52.86%).
- Completed 19695/20000; deuce 7.20%; censored/truncated 1.52%.
- Reserve entering Counter: mean 3.75, median/P75/P90/P95/max 3/7/7/7/17.
- Reserve entering Rally: mean 7.19, median/P75/P90/P95/max 6/11/21/21/26.
- Rally total budget distribution: ≤20: 29.38%; 21–24: 6.39%; 25–29: 33.08%; 30–34: 18.41%; ≥35: 12.74%.

### Screening flags

- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|MinimumNeededBot (92.0% / 8.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|BalancedReserveBot (89.0% / 11.0%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SpendAllBot|SaveForRallyBot (99.2% / 0.8%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: SaveForRallyBot|BalancedReserveBot (19.1% / 80.9%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: AllInEarlyBot|SaveForRallyBot (98.8% / 1.2%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SaveForRallyBot (97.6% / 2.4%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: MinimumNeededBot|SpendAllBot (7.3% / 92.7%)
- DOMINANT_RESOURCE_STRATEGY_WARNING: BalancedReserveBot|SpendAllBot (10.9% / 89.1%)
- SpendAllBot overall completion win rate 82.8%
- Rally total budgets >=35: 12.7%
- MONOTONIC_RESOURCE_EFFICIENCY_WARNING: receive: savings decrease monotonically with win rate (range 43.7pp)

## Resource efficiency curve

See resource-efficiency.csv. It groups each player's unused points at the end of Serve or Counter and reports point, game and match outcomes. MONOTONIC_RESOURCE_EFFICIENCY_WARNING is raised when the completed-match win rate moves only one direction across at least three sufficiently sampled buckets with a range of 5 percentage points or more. Each point in a BO1 match is a repeated observation for eventual match win, so match-rate bucket intervals are descriptive and not independent-sample confidence intervals.

Serve’s attack curve is not strictly monotonic: keeping 0 points corresponds to about 76% match wins, keeping 1–3 points about 41–43%, and keeping 4 points about 16–17% across C/D/E. That is a strong descriptive association between spending early and winning, but not a causal estimate because reserve size also reflects Bot policy and point state. Counter has a broad pattern where the largest reserves tend to have lower eventual win rates, with intermediate buckets moving up and down; C and E trigger the monotonic screen for one curve, while D does not. These curves do not show a robust intermediate optimum, and should be interpreted alongside the direct head-to-head strategy results.

## Tier sanity check

See player-sanity.csv for each named player under C/D/E and pooled fixed tier matchups: 480 vs 480, 480 vs 460, 480 vs 440, 460 vs 460, 460 vs 440 and 440 vs 440. Player or equipment changes are out of scope.

## Recommendation

NONE_OF_C_D_E_IS_HEALTHY

Carry reward 偏高：C/D/E 的 ≥35 Rally 预算占比均为 12.5%–13.4%，超过本报告采用的 10% 资源膨胀筛查线；该筛查线是本次分析阈值，并非既有正式规则。D 的膨胀最高。Carry 机制本身结构也存在问题：三套方案都保留资源策略统治对局，SpendAll 对 SaveForRally 的胜率为 98.7%–99.2%，单独改变这两个 Carry 倍率没有让保存策略获得稳定竞争力。

- Plan C: AllInEarlyBot|MinimumNeededBot (92.3% / 7.7%); AllInEarlyBot|BalancedReserveBot (89.0% / 11.0%); SpendAllBot|SaveForRallyBot (99.0% / 1.0%); SaveForRallyBot|BalancedReserveBot (18.5% / 81.5%); AllInEarlyBot|SaveForRallyBot (98.9% / 1.1%); MinimumNeededBot|SaveForRallyBot (97.7% / 2.3%); MinimumNeededBot|SpendAllBot (7.0% / 93.0%); BalancedReserveBot|SpendAllBot (11.4% / 88.6%); SpendAllBot overall completion win rate 82.8%; Rally total budgets >=35: 12.5%; receive: savings decrease monotonically with win rate (range 45.4pp)
- Plan D: AllInEarlyBot|MinimumNeededBot (92.0% / 8.0%); AllInEarlyBot|BalancedReserveBot (88.0% / 12.0%); SpendAllBot|SaveForRallyBot (98.7% / 1.3%); SaveForRallyBot|BalancedReserveBot (19.5% / 80.5%); AllInEarlyBot|SaveForRallyBot (98.7% / 1.3%); MinimumNeededBot|SaveForRallyBot (97.3% / 2.7%); MinimumNeededBot|SpendAllBot (7.2% / 92.8%); BalancedReserveBot|SpendAllBot (11.4% / 88.6%); SpendAllBot overall completion win rate 82.6%; Rally total budgets >=35: 13.4%
- Plan E: AllInEarlyBot|MinimumNeededBot (92.0% / 8.0%); AllInEarlyBot|BalancedReserveBot (89.0% / 11.0%); SpendAllBot|SaveForRallyBot (99.2% / 0.8%); SaveForRallyBot|BalancedReserveBot (19.1% / 80.9%); AllInEarlyBot|SaveForRallyBot (98.8% / 1.2%); MinimumNeededBot|SaveForRallyBot (97.6% / 2.4%); MinimumNeededBot|SpendAllBot (7.3% / 92.7%); BalancedReserveBot|SpendAllBot (10.9% / 89.1%); SpendAllBot overall completion win rate 82.8%; Rally total budgets >=35: 12.7%; receive: savings decrease monotonically with win rate (range 43.7pp)

No Carry plan was installed as a formal ruleset. This report answers only the C/D/E Carry Economy question; it does not trigger additional Attack Bonus, Threshold, Rally budget, player or equipment experiments.
