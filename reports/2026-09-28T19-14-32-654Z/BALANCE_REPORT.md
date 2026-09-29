# Balance Report

Generated 2026-09-28T19:14:32.654Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: full
- Seed: 20260928
- Baseline matches per mode: 100,000
- Candidate one-variable experiment matches: 16,000
- Runtime: 731.80 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 100000 | 100000 |
| Completed wins | 97112 | 88935 |
| Deuce-censored draws | 2888 | 11065 |
| Deuce reached at least once | 0.082 | 0.170 |
| Stable deuce cycle censored | 2888 | 11065 |
| Average points per match | 16.25 | 19.71 |
| Rally rounds per match | 29.81 | 10.04 |
| Fifth rally round rate per rally | 37.98% | 7.57% |
| Rally tie-break rate per rally | 36.69% | 6.57% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 1624780 | 24.86% | 1970851 | 53.06% |
| receive | 1220792 | 13.70% | 925199 | 34.12% |
| rally | 2980893 | 22.38% | 1003682 | 56.74% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 1992 | 70.98% (69.0–72.9%) | 30771 | 100.00% (100.0–100.0%) |
| receive | 2008 | 73.56% (71.6–75.4%) | 13038 | 100.00% (100.0–100.0%) |
| rally | 5710 | 34.26% (33.0–35.5%) | 34175 | 100.00% (100.0–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 1000 | 929 | 47.60% (44.5–50.7%) | 71 |
| attackBonus | 5 | 1000 | 871 | 41.40% (38.4–44.5%) | 129 |
| defensePool | 8 | 1000 | 882 | 42.40% (39.4–45.5%) | 118 |
| defensePool | 9 | 1000 | 905 | 44.80% (41.7–47.9%) | 95 |
| defensePool | 11 | 1000 | 914 | 46.40% (43.3–49.5%) | 86 |
| defensePool | 12 | 1000 | 901 | 44.20% (41.1–47.3%) | 99 |
| defenseCap | 3 | 1000 | 868 | 43.00% (40.0–46.1%) | 132 |
| defenseCap | 5 | 1000 | 916 | 44.40% (41.3–47.5%) | 84 |
| serveThreshold | 4 | 1000 | 831 | 40.50% (37.5–43.6%) | 169 |
| serveThreshold | 6 | 1000 | 933 | 44.60% (41.5–47.7%) | 67 |
| counterThreshold | 4 | 1000 | 893 | 44.20% (41.1–47.3%) | 107 |
| counterThreshold | 6 | 1000 | 870 | 43.50% (40.5–46.6%) | 130 |
| rallyThreshold | 3 | 1000 | 892 | 42.50% (39.5–45.6%) | 108 |
| rallyThreshold | 5 | 1000 | 888 | 41.30% (38.3–44.4%) | 112 |
| rallyMaxRounds | 4 | 1000 | 884 | 44.00% (41.0–47.1%) | 116 |
| rallyMaxRounds | 6 | 1000 | 896 | 46.70% (43.6–49.8%) | 104 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
