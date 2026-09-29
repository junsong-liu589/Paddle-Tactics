# Candidate V4 Balance Report

Candidate V4 was run as an experimental reducer ruleset. Legacy V1 and Candidate V3 remain unchanged comparison series; formal data and default rules were not modified.

## Run and recommendation

- Seed: 20260928; Candidate V4 baseline: 10,000 matches; total runtime: 300.15 s.
- Parameters: service/counter attack 4, defense 10; Rally 20; attack cap 4; carry 100%; Top 3; Rally maximum 4.
- Completed: 9,920; censored: 80 (0.80%); deuce-cycle censored: 80.
- Recommendation status: EXPERIMENTAL. Evaluate the full criteria below before promoting.

## V1 / V3 / V4 comparison

| Ruleset | Matches | Completed | Points/match | Rally comparisons/match | Rally tie-break share | Deuce/censored | First Rally attacker point win |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy V1 | 10000 | 9700 | 16.424 | 27.760 | 33.52% | 3.00% | 64.74% |
| Candidate V3 | 10000 | 8962 | 19.618 | 7.005 | 3.43% | 10.38% | 80.06% |
| Candidate V4 | 10000 | 9920 | 16.900 | 20.542 | 44.53% | 0.80% | 51.74% (Wilson 95% 51.39–52.09%) |

## Resource economy

- Mean attack spend: Serve 2.14; Counter 2.26 (spend range 0–4). The per-value distribution is in resource-economy.csv.
- Mean defense spend: Serve 8.59; Counter 9.85. Average unused points: Serve 1.41; Counter 2.22.
- Rally-entry reserve median/P75/P90/P95/max: 2 / 2 / 6 / 12 / 14. Corresponding Rally budget percentiles: 22 / 22 / 26 / 32 / 34.
- Rally budget groups 20 / 21–24 / 25–29 / 30+: 41.93% / 42.32% / 10.34% / 5.41%.
- Carry margin: among Rally entries, first attacker wins 51.74%; V4's even 4-comparison sequence gives each player two attack opportunities on points that reach all comparisons.
- Defense concentration Herfindahl: mean 0.282, maximum 1.000. Rally attack project allocation totals are in resource-economy.csv; inspect usage rates alongside the 4-comparison cap.
- Policies: see strategies.csv and policy head-to-head rows in resource-economy.csv. Pair samples below 1,000 are descriptive and should not be called dominant.

- Carry-value association: observed Rally-entry reserve buckets imply an endpoint slope of 1.19 percentage points per reserve point across the observed range; this is descriptive, non-causal.

## Resource-policy head-to-head

| Policy | Opponent | Matches | Win rate | Wilson 95% CI | Censored |
|---|---|---:|---:|---:|---:|
| SaveForRallyBot | AllInEarlyBot | 1000 | 1.00% | 0.55–1.84% | 4 |
| SaveForRallyBot | MinimumNeededBot | 1000 | 2.75% | 1.90–3.97% | 18 |
| SaveForRallyBot | BalancedReserveBot | 1000 | 16.48% | 14.27–18.95% | 35 |
| AllInEarlyBot | MinimumNeededBot | 1000 | 94.38% | 92.77–95.64% | 4 |
| AllInEarlyBot | BalancedReserveBot | 1000 | 91.29% | 89.36–92.90% | 24 |
| MinimumNeededBot | BalancedReserveBot | 1000 | 47.85% | 44.76–50.95% | 1 |
| FortressBot | BalancedReserveBot | 1000 | 56.33% | 53.22–59.40% | 13 |
| SpendAllBot | SaveForRallyBot | 1000 | 99.70% | 99.12–99.90% | 1 |
| SpendAllBot | MinimumNeededBot | 1000 | 94.09% | 92.46–95.39% | 1 |
| SaveForRallyBot | FortressBot | 1000 | 13.08% | 11.12–15.33% | 14 |

## Parameter experiments

One-variable screen (seeded):

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 200 | 43.00% | 36.33–49.93% | 2 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 200 | 44.50% | 37.78–51.43% | 2 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":16,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 200 | 47.50% | 40.69–54.40% | 0 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 200 | 41.50% | 34.89–48.43% | 4 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":22,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 200 | 47.50% | 40.69–54.40% | 1 |

Focused validation:

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":75,"explorationEpsilon":0.05} | 2000 | 48.40% | 46.21–50.59% | 17 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":20,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":50,"explorationEpsilon":0.05} | 2000 | 45.45% | 43.28–47.64% | 13 |
| {"serviceAttackBudget":4,"serviceDefenseBudget":10,"counterAttackBudget":4,"counterDefenseBudget":10,"rallyBudget":18,"attackCap":4,"serviceThreshold":5,"counterThreshold":5,"defenderVisibleTopK":3,"rallyThreshold":4,"rallyMaxComparisons":4,"carryRatePercent":100,"explorationEpsilon":0.05} | 2000 | 45.60% | 43.43–47.79% | 19 |

## Interpretation checklist

- Rally first-attacker parity vs V3: 51.74% V4 vs 80.06% V3.
- Rally comparison count is capped at 4; exact tie-break uses symmetric cumulative signed attack margin, positive-margin count, largest margin, then a point-number alternating fallback.
- Carry strategy dominance is not inferred from overall policy frequency alone; use paired head-to-head outcomes, policy samples, carry distribution, and censor rate together.
- Serve / Counter continued to Rally: 61.57% / 85.56% (stage ends count direct finishes).
- Player, blade, rubber, loadout and ability observations remain descriptive and player-unadjusted where noted; official data was not modified.
- 100% carry, 20 Rally points, attack cap 4 and unlimited defense remain experimental parameters pending human review.
