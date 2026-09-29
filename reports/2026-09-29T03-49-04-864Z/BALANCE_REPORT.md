# Balance Report

Generated 2026-09-29T03:49:04.864Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: standard
- Seed: 20260928
- Baseline matches per mode: 10,000
- Candidate one-variable experiment matches: 3,200
- Runtime: 460.31 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, Top3AwareDefenseBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 10000 | 10000 |
| Completed wins | 9700 | 8866 |
| Deuce-censored draws | 300 | 1134 |
| Deuce reached at least once | 0.084 | 0.171 |
| Stable deuce cycle censored | 300 | 1134 |
| Average points per match | 16.42 | 19.73 |
| Rally rounds per match | 27.76 | 9.35 |
| Fifth rally round rate per rally | 34.63% | 7.24% |
| Rally tie-break rate per rally | 33.52% | 6.35% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 164243 | 26.42% | 197342 | 54.84% |
| receive | 120856 | 14.52% | 89117 | 35.19% |
| rally | 277604 | 24.74% | 93461 | 57.88% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 195 | 67.18% (60.3–73.4%) | 2556 | 100.00% (99.8–100.0%) |
| receive | 194 | 75.77% (69.3–81.3%) | 1120 | 100.00% (99.7–100.0%) |
| rally | 494 | 47.17% (42.8–51.6%) | 2901 | 100.00% (99.9–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 200 | 181 | 44.00% (37.3–50.9%) | 19 |
| attackBonus | 5 | 200 | 171 | 35.50% (29.2–42.3%) | 29 |
| defensePool | 8 | 200 | 175 | 41.50% (34.9–48.4%) | 25 |
| defensePool | 9 | 200 | 184 | 46.50% (39.7–53.4%) | 16 |
| defensePool | 11 | 200 | 169 | 39.50% (33.0–46.4%) | 31 |
| defensePool | 12 | 200 | 182 | 48.50% (41.7–55.4%) | 18 |
| defenseCap | 3 | 200 | 165 | 46.00% (39.2–52.9%) | 35 |
| defenseCap | 5 | 200 | 184 | 45.50% (38.7–52.4%) | 16 |
| serveThreshold | 4 | 200 | 163 | 39.00% (32.5–45.9%) | 37 |
| serveThreshold | 6 | 200 | 184 | 44.00% (37.3–50.9%) | 16 |
| counterThreshold | 4 | 200 | 176 | 46.00% (39.2–52.9%) | 24 |
| counterThreshold | 6 | 200 | 167 | 39.50% (33.0–46.4%) | 33 |
| rallyThreshold | 3 | 200 | 174 | 42.50% (35.9–49.4%) | 26 |
| rallyThreshold | 5 | 200 | 184 | 44.50% (37.8–51.4%) | 16 |
| rallyMaxRounds | 4 | 200 | 181 | 42.50% (35.9–49.4%) | 19 |
| rallyMaxRounds | 6 | 200 | 175 | 40.50% (33.9–47.4%) | 25 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
