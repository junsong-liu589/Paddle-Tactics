# Balance Report

Generated 2026-09-28T19:12:40.004Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: quick
- Seed: 20260928
- Baseline matches per mode: 1,000
- Candidate one-variable experiment matches: 480
- Runtime: 9.57 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 1000 | 1000 |
| Completed wins | 975 | 878 |
| Deuce-censored draws | 25 | 122 |
| Deuce reached at least once | 0.084 | 0.187 |
| Stable deuce cycle censored | 25 | 122 |
| Average points per match | 16.14 | 20.03 |
| Rally rounds per match | 29.19 | 9.90 |
| Fifth rally round rate per rally | 36.94% | 7.07% |
| Rally tie-break rate per rally | 35.54% | 6.12% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 16139 | 24.11% | 20033 | 52.70% |
| receive | 12248 | 14.37% | 9476 | 35.33% |
| rally | 29194 | 23.16% | 9905 | 58.08% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 18 | 66.67% (43.7–83.7%) | 314 | 100.00% (98.8–100.0%) |
| receive | 20 | 75.00% (53.1–88.8%) | 118 | 100.00% (96.8–100.0%) |
| rally | 72 | 23.61% (15.3–34.6%) | 345 | 100.00% (98.9–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 30 | 25 | 36.67% (21.9–54.5%) | 5 |
| attackBonus | 5 | 30 | 26 | 46.67% (30.2–63.9%) | 4 |
| defensePool | 8 | 30 | 26 | 30.00% (16.7–47.9%) | 4 |
| defensePool | 9 | 30 | 27 | 36.67% (21.9–54.5%) | 3 |
| defensePool | 11 | 30 | 26 | 50.00% (33.2–66.8%) | 4 |
| defensePool | 12 | 30 | 27 | 40.00% (24.6–57.7%) | 3 |
| defenseCap | 3 | 30 | 28 | 50.00% (33.2–66.8%) | 2 |
| defenseCap | 5 | 30 | 27 | 43.33% (27.4–60.8%) | 3 |
| serveThreshold | 4 | 30 | 23 | 30.00% (16.7–47.9%) | 7 |
| serveThreshold | 6 | 30 | 28 | 53.33% (36.1–69.8%) | 2 |
| counterThreshold | 4 | 30 | 29 | 40.00% (24.6–57.7%) | 1 |
| counterThreshold | 6 | 30 | 26 | 40.00% (24.6–57.7%) | 4 |
| rallyThreshold | 3 | 30 | 26 | 40.00% (24.6–57.7%) | 4 |
| rallyThreshold | 5 | 30 | 26 | 46.67% (30.2–63.9%) | 4 |
| rallyMaxRounds | 4 | 30 | 27 | 40.00% (24.6–57.7%) | 3 |
| rallyMaxRounds | 6 | 30 | 24 | 46.67% (30.2–63.9%) | 6 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
