# Balance Report

Generated 2026-09-29T03:38:55.565Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: quick
- Seed: 20260928
- Baseline matches per mode: 1,000
- Candidate one-variable experiment matches: 480
- Runtime: 87.35 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, Top3AwareDefenseBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 1000 | 1000 |
| Completed wins | 969 | 881 |
| Deuce-censored draws | 31 | 119 |
| Deuce reached at least once | 0.091 | 0.182 |
| Stable deuce cycle censored | 31 | 119 |
| Average points per match | 16.48 | 19.89 |
| Rally rounds per match | 27.67 | 8.97 |
| Fifth rally round rate per rally | 34.73% | 6.39% |
| Rally tie-break rate per rally | 33.75% | 5.64% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 16479 | 26.28% | 19891 | 54.77% |
| receive | 12148 | 14.71% | 8997 | 36.72% |
| rally | 27668 | 24.81% | 8973 | 59.87% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 21 | 71.43% (50.0–86.2%) | 229 | 100.00% (98.4–100.0%) |
| receive | 12 | 66.67% (39.1–86.2%) | 101 | 100.00% (96.3–100.0%) |
| rally | 52 | 30.77% (19.9–44.3%) | 311 | 100.00% (98.8–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 30 | 25 | 36.67% (21.9–54.5%) | 5 |
| attackBonus | 5 | 30 | 30 | 56.67% (39.2–72.6%) | 0 |
| defensePool | 8 | 30 | 27 | 36.67% (21.9–54.5%) | 3 |
| defensePool | 9 | 30 | 27 | 46.67% (30.2–63.9%) | 3 |
| defensePool | 11 | 30 | 26 | 50.00% (33.2–66.8%) | 4 |
| defensePool | 12 | 30 | 27 | 40.00% (24.6–57.7%) | 3 |
| defenseCap | 3 | 30 | 26 | 46.67% (30.2–63.9%) | 4 |
| defenseCap | 5 | 30 | 26 | 33.33% (19.2–51.2%) | 4 |
| serveThreshold | 4 | 30 | 25 | 46.67% (30.2–63.9%) | 5 |
| serveThreshold | 6 | 30 | 27 | 60.00% (42.3–75.4%) | 3 |
| counterThreshold | 4 | 30 | 29 | 50.00% (33.2–66.8%) | 1 |
| counterThreshold | 6 | 30 | 28 | 40.00% (24.6–57.7%) | 2 |
| rallyThreshold | 3 | 30 | 27 | 40.00% (24.6–57.7%) | 3 |
| rallyThreshold | 5 | 30 | 27 | 40.00% (24.6–57.7%) | 3 |
| rallyMaxRounds | 4 | 30 | 28 | 50.00% (33.2–66.8%) | 2 |
| rallyMaxRounds | 6 | 30 | 24 | 50.00% (33.2–66.8%) | 6 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
