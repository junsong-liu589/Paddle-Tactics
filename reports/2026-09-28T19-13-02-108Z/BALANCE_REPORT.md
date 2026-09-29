# Balance Report

Generated 2026-09-28T19:13:02.108Z. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: standard
- Seed: 20260928
- Baseline matches per mode: 10,000
- Candidate one-variable experiment matches: 3,200
- Runtime: 82.33 seconds
- Loadout space: 8 × 8 × 7 × 7 = 3136
- Bots: RandomBot, BalancedBot, FortressBot, GreedyAttackBot, WeaknessHunterBot, AdaptiveBot, BluffDefenseBot
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | 10000 | 10000 |
| Completed wins | 9689 | 8862 |
| Deuce-censored draws | 311 | 1138 |
| Deuce reached at least once | 0.083 | 0.171 |
| Stable deuce cycle censored | 311 | 1138 |
| Average points per match | 16.33 | 19.76 |
| Rally rounds per match | 29.68 | 9.95 |
| Fifth rally round rate per rally | 37.49% | 7.28% |
| Rally tie-break rate per rally | 36.19% | 6.34% |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
| service | 163262 | 25.08% | 197621 | 53.43% |
| receive | 122314 | 13.68% | 92023 | 34.00% |
| rally | 296786 | 22.70% | 99474 | 57.19% |

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
| service | 196 | 68.37% (61.6–74.5%) | 3165 | 100.00% (99.9–100.0%) |
| receive | 191 | 72.77% (66.1–78.6%) | 1239 | 100.00% (99.7–100.0%) |
| rally | 526 | 34.60% (30.7–38.8%) | 3438 | 100.00% (99.9–100.0%) |

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
| attackBonus | 3 | 200 | 183 | 46.50% (39.7–53.4%) | 17 |
| attackBonus | 5 | 200 | 168 | 36.50% (30.1–43.4%) | 32 |
| defensePool | 8 | 200 | 178 | 41.00% (34.4–47.9%) | 22 |
| defensePool | 9 | 200 | 182 | 42.00% (35.4–48.9%) | 18 |
| defensePool | 11 | 200 | 174 | 40.50% (33.9–47.4%) | 26 |
| defensePool | 12 | 200 | 184 | 50.50% (43.6–57.4%) | 16 |
| defenseCap | 3 | 200 | 164 | 45.00% (38.3–51.9%) | 36 |
| defenseCap | 5 | 200 | 186 | 44.50% (37.8–51.4%) | 14 |
| serveThreshold | 4 | 200 | 162 | 37.00% (30.6–43.9%) | 38 |
| serveThreshold | 6 | 200 | 188 | 44.00% (37.3–50.9%) | 12 |
| counterThreshold | 4 | 200 | 178 | 49.00% (42.2–55.9%) | 22 |
| counterThreshold | 6 | 200 | 170 | 42.50% (35.9–49.4%) | 30 |
| rallyThreshold | 3 | 200 | 174 | 43.00% (36.3–49.9%) | 26 |
| rallyThreshold | 5 | 200 | 180 | 38.50% (32.0–45.4%) | 20 |
| rallyMaxRounds | 4 | 200 | 182 | 45.00% (38.3–51.9%) | 18 |
| rallyMaxRounds | 6 | 200 | 177 | 43.00% (36.3–49.9%) | 23 |

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See `players.csv`, `blades.csv`, `rubbers.csv`, and `loadouts.csv`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry `INSUFFICIENT_SAMPLE`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See `abilities.csv`, `phases.csv`, `mechanics.csv`, and `strategies.csv`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. `dominant strategy` and `dominant loadout` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
