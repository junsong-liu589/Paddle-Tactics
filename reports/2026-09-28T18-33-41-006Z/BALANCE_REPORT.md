# Balance Report

Generated 2026-09-28T18:33:41.006Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: quick
- Seed: 20260928
- Baseline matches per mode: 1,000
- Candidate one-variable experiment matches: 480
- Runtime: 9.12 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 1000 | 1000 |
| Completed wins | 971 | 874 |
| Deuce-censored draws | 29 | 126 |
| Average points per match | 16.20 | 20.26 |
| Rally rounds per match | 0.00 | 8.72 |
| Fifth rally round rate | 0.00% | 25.90% |
| Rally tie-break rate | 0.00% | 23.50% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 16202 | 0.00% | 20259 | 52.77% |
| receive | 11991 | 0.00% | 9569 | 34.82% |
| rally | 28671 | 0.00% | 8720 | 68.83% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## Candidate parameter experiments

| Parameter | Value | Matches | A-seat win rate (Wilson 95%) | Censored draws |
|---|---:|---:|---:|---:|
| attackBonus | 3 | 30 | 36.67% (21.9–54.5%) | 5 |
| attackBonus | 5 | 30 | 50.00% (33.2–66.8%) | 4 |
| defensePool | 8 | 30 | 33.33% (19.2–51.2%) | 5 |
| defensePool | 9 | 30 | 40.00% (24.6–57.7%) | 4 |
| defensePool | 11 | 30 | 50.00% (33.2–66.8%) | 5 |
| defensePool | 12 | 30 | 36.67% (21.9–54.5%) | 3 |
| defenseCap | 3 | 30 | 46.67% (30.2–63.9%) | 2 |
| defenseCap | 5 | 30 | 36.67% (21.9–54.5%) | 3 |
| serveThreshold | 4 | 30 | 33.33% (19.2–51.2%) | 7 |
| serveThreshold | 6 | 30 | 53.33% (36.1–69.8%) | 2 |
| counterThreshold | 4 | 30 | 43.33% (27.4–60.8%) | 1 |
| counterThreshold | 6 | 30 | 36.67% (21.9–54.5%) | 4 |
| rallyThreshold | 3 | 30 | 30.00% (16.7–47.9%) | 5 |
| rallyThreshold | 5 | 30 | 43.33% (27.4–60.8%) | 5 |
| rallyMaxRounds | 4 | 30 | 46.67% (30.2–63.9%) | 4 |
| rallyMaxRounds | 6 | 30 | 43.33% (27.4–60.8%) | 6 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
