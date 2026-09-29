# Candidate V4 Balance Report

Candidate V4 was run as an experimental reducer ruleset. Legacy V1 and Candidate V3 remain unchanged comparison series; formal data and default rules were not modified.

## Run and recommendation

- Seed: 20260928; Candidate V4 baseline: 10 matches; total runtime: 0.21 s.
- Parameters: service/counter attack 4, defense 10; Rally 20; attack cap 4; carry 100%; Top 3; Rally maximum 4.
- Completed: 10; censored: 0 (0.00%); deuce-cycle censored: 0.
- Recommendation status: EXPERIMENTAL. Evaluate the full criteria below before promoting.

## V1 / V3 / V4 comparison

| Ruleset | Matches | Completed | Points/match | Rally comparisons/match | Rally tie-break share | Deuce/censored | First Rally attacker point win |
|---|---:|---:|---:|---:|---:|---:|---:|
| Legacy V1 | 10 | 10 | 15.600 | 40.400 | 61.47% | 0.00% | 63.30% |
| Candidate V3 | 10 | 10 | 16.000 | 9.200 | 1.67% | 0.00% | 70.00% |
| Candidate V4 | 10 | 10 | 14.600 | 24.000 | 44.09% | 0.00% | 50.54% (Wilson 95% 40.56–60.47%) |

## Resource economy

- Mean attack spend: Serve 1.96; Counter 2.00 (spend range 0–4). The per-value distribution is in resource-economy.csv.
- Mean defense spend: Serve 8.23; Counter 9.44. Average unused points: Serve 1.77; Counter 2.74.
- Rally-entry reserve median/P75/P90/P95/max: 2 / 4 / 14 / 14 / 14. Corresponding Rally budget percentiles: 22 / 24 / 34 / 34 / 34.
- Rally budget groups 20 / 21–24 / 25–29 / 30+: 45.16% / 31.72% / 4.30% / 18.82%.
- Carry margin: among Rally entries, first attacker wins 50.54%; V4's even 4-comparison sequence gives each player two attack opportunities on points that reach all comparisons.
- Defense concentration Herfindahl: mean 0.255, maximum 0.722. Rally attack project allocation totals are in resource-economy.csv; inspect usage rates alongside the 4-comparison cap.
- Policies: see strategies.csv and policy head-to-head rows in resource-economy.csv. Pair samples below 1,000 are descriptive and should not be called dominant.

## Parameter experiments

One-variable screen (seeded):

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| no parameter runs | 0 | n/a | n/a | 0 |

Focused validation:

| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |
|---|---:|---:|---:|---:|
| no focused runs | 0 | n/a | n/a | 0 |

## Interpretation checklist

- Rally first-attacker parity vs V3: 50.54% V4 vs 70.00% V3.
- Rally comparison count is capped at 4; exact tie-break uses symmetric cumulative signed attack margin, positive-margin count, largest margin, then a point-number alternating fallback.
- Carry strategy dominance is not inferred from overall policy frequency alone; use paired head-to-head outcomes, policy samples, carry distribution, and censor rate together.
- Serve / Counter continued to Rally: 80.14% / 83.56% (stage ends count direct finishes).
- Player, blade, rubber, loadout and ability observations remain descriptive and player-unadjusted where noted; official data was not modified.
- 100% carry, 20 Rally points, attack cap 4 and unlimited defense remain experimental parameters pending human review.
