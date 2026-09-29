# Balance Report

Generated 2026-09-29T03:57:30.502Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: full
- Seed: 20260928
- Baseline matches per mode: 100,000
- Candidate one-variable experiment matches: 16,000
- Runtime: 1351.97 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, Top3AwareDefenseBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 100000 | 100000 |
| Completed wins | 97286 | 88842 |
| Deuce-censored draws | 2714 | 11158 |
| Deuce reached at least once | 0.085 | 0.171 |
| Stable deuce cycle censored | 2714 | 11158 |
| Average points per match | 16.37 | 19.76 |
| Rally rounds per match | 27.93 | 9.30 |
| Fifth rally round rate per rally | 35.26% | 7.29% |
| Rally tie-break rate per rally | 34.11% | 6.39% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 1637352 | 26.37% | 1975670 | 54.85% |
| receive | 1205601 | 14.59% | 891941 | 35.49% |
| rally | 2792716 | 24.29% | 930096 | 57.91% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 1933 | 71.65% (69.6–73.6%) | 27191 | 100.00% (100.0–100.0%) |
| receive | 1965 | 78.17% (76.3–79.9%) | 11712 | 100.00% (100.0–100.0%) |
| rally | 5412 | 44.57% (43.2–45.9%) | 29844 | 100.00% (100.0–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 1000 | 920 | 45.50% (42.4–48.6%) | 80 |
| attackBonus | 5 | 1000 | 855 | 41.30% (38.3–44.4%) | 145 |
| defensePool | 8 | 1000 | 881 | 42.50% (39.5–45.6%) | 119 |
| defensePool | 9 | 1000 | 896 | 42.30% (39.3–45.4%) | 104 |
| defensePool | 11 | 1000 | 913 | 47.00% (43.9–50.1%) | 87 |
| defensePool | 12 | 1000 | 890 | 45.30% (42.2–48.4%) | 110 |
| defenseCap | 3 | 1000 | 857 | 43.00% (40.0–46.1%) | 143 |
| defenseCap | 5 | 1000 | 910 | 46.30% (43.2–49.4%) | 90 |
| serveThreshold | 4 | 1000 | 821 | 41.30% (38.3–44.4%) | 179 |
| serveThreshold | 6 | 1000 | 940 | 43.50% (40.5–46.6%) | 60 |
| counterThreshold | 4 | 1000 | 900 | 44.40% (41.3–47.5%) | 100 |
| counterThreshold | 6 | 1000 | 861 | 41.40% (38.4–44.5%) | 139 |
| rallyThreshold | 3 | 1000 | 886 | 42.30% (39.3–45.4%) | 114 |
| rallyThreshold | 5 | 1000 | 884 | 39.60% (36.6–42.7%) | 116 |
| rallyMaxRounds | 4 | 1000 | 887 | 43.90% (40.9–47.0%) | 113 |
| rallyMaxRounds | 6 | 1000 | 900 | 44.50% (41.4–47.6%) | 100 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
