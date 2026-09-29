# Balance Report

Generated 2026-09-29T02:50:59.723Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: full
- Seed: 20260928
- Baseline matches per mode: 100,000
- Candidate one-variable experiment matches: 16,000
- Runtime: 1255.73 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, Top3AwareDefenseBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 100000 | 100000 |
| Completed wins | 97281 | 88875 |
| Deuce-censored draws | 2719 | 11125 |
| Deuce reached at least once | 0.085 | 0.171 |
| Stable deuce cycle censored | 2719 | 11125 |
| Average points per match | 16.38 | 19.75 |
| Rally rounds per match | 27.93 | 9.31 |
| Fifth rally round rate per rally | 35.26% | 7.29% |
| Rally tie-break rate per rally | 34.11% | 6.39% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 1637799 | 26.38% | 1974897 | 54.79% |
| receive | 1205704 | 14.60% | 892809 | 35.50% |
| rally | 2792590 | 24.29% | 930791 | 57.92% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 1918 | 70.65% (68.6–72.6%) | 26344 | 100.00% (100.0–100.0%) |
| receive | 1955 | 78.01% (76.1–79.8%) | 11696 | 100.00% (100.0–100.0%) |
| rally | 5411 | 44.58% (43.3–45.9%) | 29859 | 100.00% (100.0–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 1000 | 920 | 45.60% (42.5–48.7%) | 80 |
| attackBonus | 5 | 1000 | 854 | 41.10% (38.1–44.2%) | 146 |
| defensePool | 8 | 1000 | 881 | 42.30% (39.3–45.4%) | 119 |
| defensePool | 9 | 1000 | 896 | 42.30% (39.3–45.4%) | 104 |
| defensePool | 11 | 1000 | 913 | 46.90% (43.8–50.0%) | 87 |
| defensePool | 12 | 1000 | 891 | 45.20% (42.1–48.3%) | 109 |
| defenseCap | 3 | 1000 | 857 | 43.00% (40.0–46.1%) | 143 |
| defenseCap | 5 | 1000 | 910 | 46.30% (43.2–49.4%) | 90 |
| serveThreshold | 4 | 1000 | 821 | 41.00% (38.0–44.1%) | 179 |
| serveThreshold | 6 | 1000 | 940 | 43.50% (40.5–46.6%) | 60 |
| counterThreshold | 4 | 1000 | 899 | 44.40% (41.3–47.5%) | 101 |
| counterThreshold | 6 | 1000 | 861 | 41.30% (38.3–44.4%) | 139 |
| rallyThreshold | 3 | 1000 | 886 | 42.30% (39.3–45.4%) | 114 |
| rallyThreshold | 5 | 1000 | 884 | 39.70% (36.7–42.8%) | 116 |
| rallyMaxRounds | 4 | 1000 | 887 | 43.90% (40.9–47.0%) | 113 |
| rallyMaxRounds | 6 | 1000 | 898 | 44.10% (41.1–47.2%) | 102 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
