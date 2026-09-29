# Balance Report

Generated 2026-09-29T05:42:52.678Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: quick
- Seed: 20260928
- Baseline matches per mode: 10
- Candidate one-variable experiment matches: 0
- Runtime: 0.21 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, Top3AwareDefenseBot, AdaptiveBot, BluffDefenseBot, SaveForRallyBot, AllInEarlyBot, MinimumNeededBot, BalancedReserveBot, SpendAllBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 10 | 10 |
| Completed wins | 10 | 9 |
| Deuce-censored draws | 0 | 1 |
| Deuce reached at least once | 0.000 | 0.100 |
| Stable deuce cycle censored | 0 | 1 |
| Average points per match | 15.60 | 20.70 |
| Rally rounds per match | 40.40 | 19.40 |
| Fifth rally round rate per rally | 61.47% | 21.35% |
| Rally tie-break rate per rally | 61.47% | 21.35% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 156 | 17.95% | 207 | 42.51% |
| receive | 128 | 14.84% | 119 | 25.21% |
| rally | 404 | 10.40% | 194 | 36.08% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 0 | 0.00% (0.0–100.0%) | 0 | 0.00% (0.0–100.0%) |
| receive | 0 | 0.00% (0.0–100.0%) | 0 | 0.00% (0.0–100.0%) |
| rally | 0 | 0.00% (0.0–100.0%) | 3 | 100.00% (43.9–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|


These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
