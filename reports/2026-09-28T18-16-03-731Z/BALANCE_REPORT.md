# Balance Report

Generated 2026-09-28T18:16:03.731Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: quick
- Seed: 20260928
- Baseline matches per mode: 1
- Candidate one-variable experiment matches: 0
- Runtime: 0.03 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 1 | 1 |
| Completed wins | 1 | 0 |
| Deuce-censored draws | 0 | 1 |
| Average points per match | 18.00 | 48.00 |
| Rally rounds per match | 0.00 | 58.00 |
| Fifth rally round rate | 0.00% | 1000.00% |
| Rally tie-break rate | 0.00% | 1000.00% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 18 | 0.00% | 48 | 62.50% |
| receive | 18 | 0.00% | 18 | 0.00% |
| rally | 90 | 0.00% | 58 | 13.79% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## Candidate parameter experiments

| Parameter | Value | Matches | A-seat win rate (Wilson 95%) | Censored draws |
|---|---:|---:|---:|---:|


These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
