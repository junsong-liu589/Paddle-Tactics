# Candidate V4 Balance Report

Candidate V4 was run as an experimental reducer ruleset. Legacy V1 and Candidate V3 remain unchanged comparison series; formal data and default rules were not modified.

## Run and recommendation

- Seed: 20260928; Candidate V4 baseline: 1,000 matches; total runtime: 115.02 s.
- Parameters: service/counter attack 4, defense 10; Rally 20; attack cap 4; carry 100%; Top 3; Rally maximum 4.
- Completed: 990; censored: 10 (1.00%); deuce-cycle censored: 10.
- Recommendation status: EXPERIMENTAL. Evaluate the full criteria below before promoting.

## V1 / V3 / V4 comparison

| Ruleset | Matches | Completed | Points/match | Rally comparisons/match | Rally tie-break share | Deuce/censored | First Rally attacker point win |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy V1 | 1000 | 969 | 16.479 | 27.668 | 33.75% | 3.10% | 65.43% |
| Candidate V3 | 1000 | 896 | 19.845 | 6.708 | 3.17% | 10.40% | 79.91% |
| Candidate V4 | 1000 | 990 | 16.761 | 20.416 | 45.53% | 1.00% | 51.04% (Wilson 95% 49.93–52.14%) |

## Resource economy

- Mean attack spend: Serve 2.13; Counter 2.24 (spend range 0–4). The per-value distribution is in resource-economy.csv.
- Mean defense spend: Serve 8.61; Counter 9.80. Average unused points: Serve 1.39; Counter 2.28.
- Rally-entry reserve median/P75/P90/P95/max: 2 / 2 / 6 / 14 / 14. Corresponding Rally budget percentiles: 22 / 22 / 26 / 34 / 34.
- Rally budget groups 20 / 21–24 / 25–29 / 30+: 41.30% / 42.66% / 10.47% / 5.57%.
- Carry margin: among Rally entries, first attacker wins 51.04%; V4's even 4-comparison sequence gives each player two attack opportunities on points that reach all comparisons.
- Defense concentration Herfindahl: mean 0.282, maximum 1.000. Rally attack project allocation totals are in resource-economy.csv; inspect usage rates alongside the 4-comparison cap.
- Policies: see strategies.csv and policy head-to-head rows in resource-economy.csv. Pair samples below 1,000 are descriptive and should not be called dominant.

- Carry-value association: observed Rally-entry reserve buckets imply an endpoint slope of 0.93 percentage points per reserve point across the observed range; this is descriptive, non-causal.

## Resource-policy head-to-head

| Policy | Opponent | Matches | Win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| SaveForRallyBot | AllInEarlyBot | 250 | 1.20% | 0.41–3.48% | 1 |
| SaveForRallyBot | MinimumNeededBot | 250 | 4.05% | 2.21–7.29% | 3 |
| SaveForRallyBot | BalancedReserveBot | 250 | 16.80% | 12.63–22.00% | 6 |
| AllInEarlyBot | MinimumNeededBot | 250 | 94.38% | 90.78–96.62% | 1 |
| AllInEarlyBot | BalancedReserveBot | 250 | 90.61% | 86.31–93.66% | 5 |
| MinimumNeededBot | BalancedReserveBot | 250 | 48.80% | 42.67–54.97% | 0 |
| FortressBot | BalancedReserveBot | 250 | 57.03% | 50.82–63.02% | 1 |
| SpendAllBot | SaveForRallyBot | 250 | 98.80% | 96.53–99.59% | 0 |
| SpendAllBot | MinimumNeededBot | 250 | 93.98% | 90.30–96.32% | 1 |
| SaveForRallyBot | FortressBot | 250 | 12.24% | 8.71–16.94% | 5 |

## Parameter experiments

One-variable screen (seeded):

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 30 | 43.33% | 27.38–60.80% | 0 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 30 | 36.67% | 21.87–54.49% | 0 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":16,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 30 | 53.33% | 36.14–69.77% | 0 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 30 | 43.33% | 27.38–60.80% | 0 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":22,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 30 | 50.00% | 33.15–66.85% | 0 |

Focused validation:

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 1000 | 48.80% | 45.71–51.90% | 5 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 1000 | 48.30% | 45.22–51.40% | 12 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 1000 | 46.40% | 43.33–49.50% | 9 |

## Interpretation checklist

- Rally first-attacker parity vs V3: 51.04% V4 vs 79.91% V3.
- Rally comparison count is capped at 4; exact tie-break uses symmetric cumulative signed attack margin, positive-margin count, largest margin, then a point-number alternating fallback.
- Carry strategy dominance is not inferred from overall policy frequency alone; use paired head-to-head outcomes, policy samples, carry distribution, and censor rate together.
- Serve / Counter continued to Rally: 61.39% / 85.24% (stage ends count direct finishes).
- Player, blade, rubber, loadout and ability observations remain descriptive and player-unadjusted where noted; official data was not modified.
- 100% carry, 20 Rally points, attack cap 4 and unlimited defense remain experimental parameters pending human review.
