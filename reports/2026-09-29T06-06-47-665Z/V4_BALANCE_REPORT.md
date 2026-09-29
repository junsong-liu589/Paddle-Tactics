# Candidate V4 Balance Report

Candidate V4 was run as an experimental reducer ruleset. Legacy V1 and Candidate V3 remain unchanged comparison series; formal data and default rules were not modified.

## Run and recommendation

- Seed: 20260928; Candidate V4 baseline: 100,000 matches; total runtime: 1848.02 s.
- Parameters: service/counter attack 4, defense 10; Rally 20; attack cap 4; carry 100%; Top 3; Rally maximum 4.
- Completed: 99,040; censored: 960 (0.96%); deuce-cycle censored: 960.
- Recommendation: Do not promote V4 yet: 8 paired policy results cross the 65% dominance screening threshold.

## V1 / V3 / V4 comparison

| Ruleset | Matches | Completed | Points/match | Rally comparisons/match | Rally tie-break share | Deuce/censored | First Rally attacker point win |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy V1 | 100000 | 97286 | 16.374 | 27.927 | 34.11% | 2.71% | 64.56% |
| Candidate V3 | 100000 | 89756 | 19.593 | 7.052 | 3.51% | 10.24% | 80.15% |
| Candidate V4 | 100000 | 99040 | 16.958 | 20.470 | 44.59% | 0.96% | 52.13% (Wilson 95% 52.02–52.24%) |

## Resource economy

- Mean attack spend: Serve 2.13; Counter 2.26 (spend range 0–4). The per-value distribution is in resource-economy.csv.
- Mean defense spend: Serve 8.60; Counter 9.86. Average unused points: Serve 1.40; Counter 2.23.
- Mean reserve: Counter 1.51; Rally entry 2.27.
- Rally-entry reserve median/P75/P90/P95/max: 2 / 2 / 6 / 12 / 14. Corresponding Rally budget percentiles: 22 / 22 / 26 / 32 / 34.
- Rally budget groups 20 / 21–24 / 25–29 / 30+: 42.08% / 42.60% / 9.96% / 5.36%.
- Carry margin: among Rally entries, first attacker wins 52.13%; V4's even 4-comparison sequence gives each player two attack opportunities on points that reach all comparisons.
- Rally tie-break starter win rate: 53.26% (Wilson 95% 53.10–53.43%).
- Defense concentration Herfindahl: mean 0.281, maximum 1.000. Rally attack project allocation totals are in resource-economy.csv; inspect usage rates alongside the 4-comparison cap.
- Policies: see strategies.csv and policy head-to-head rows in resource-economy.csv. Pair samples below 1,000 are descriptive and should not be called dominant.

- Carry-value association: observed Rally-entry reserve buckets imply an endpoint slope of 1.10 percentage points per reserve point across the observed range; this is descriptive, non-causal.

## Resource-policy head-to-head

| Policy | Opponent | Matches | Win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| SaveForRallyBot | AllInEarlyBot | 5000 | 0.74% | 0.54–1.02% | 31 |
| SaveForRallyBot | MinimumNeededBot | 5000 | 2.98% | 2.54–3.49% | 68 |
| SaveForRallyBot | BalancedReserveBot | 5000 | 16.71% | 15.68–17.79% | 158 |
| AllInEarlyBot | MinimumNeededBot | 5000 | 95.73% | 95.13–96.26% | 10 |
| AllInEarlyBot | BalancedReserveBot | 5000 | 90.54% | 89.69–91.34% | 135 |
| MinimumNeededBot | BalancedReserveBot | 5000 | 49.61% | 48.22–51.00% | 19 |
| FortressBot | BalancedReserveBot | 5000 | 53.98% | 52.59–55.37% | 76 |
| SpendAllBot | SaveForRallyBot | 5000 | 99.80% | 99.63–99.89% | 17 |
| SpendAllBot | MinimumNeededBot | 5000 | 95.29% | 94.67–95.85% | 7 |
| SaveForRallyBot | FortressBot | 5000 | 13.47% | 12.55–14.46% | 72 |

## Parameter experiments

One-variable screen (seeded):

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 1000 | 46.40% | 43.33–49.50% | 5 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 1000 | 45.40% | 42.34–48.50% | 4 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":16,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 1000 | 44.00% | 40.95–47.09% | 9 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 1000 | 47.00% | 43.92–50.10% | 8 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":22,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 1000 | 46.80% | 43.73–49.90% | 7 |

Focused validation:

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 20000 | 46.46% | 45.77–47.15% | 177 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 20000 | 46.98% | 46.29–47.68% | 201 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 20000 | 46.56% | 45.87–47.25% | 201 |

## Interpretation checklist

- Rally first-attacker parity vs V3: 52.13% V4 vs 80.15% V3.
- Rally comparison count is capped at 4; exact tie-break uses symmetric cumulative signed attack margin, positive-margin count, largest margin, then a point-number alternating fallback.
- Carry strategy dominance is not inferred from overall policy frequency alone; use paired head-to-head outcomes, policy samples, carry distribution, and censor rate together.
- Serve / Counter continued to Rally: 61.21% / 85.60% (stage ends count direct finishes).
- Player, blade, rubber, loadout and ability observations remain descriptive and player-unadjusted where noted; official data was not modified.
- 100% carry, 20 Rally points, attack cap 4 and unlimited defense remain experimental parameters pending human review.
