# Balance experiment decision and next steps

## What was tested

- Candidate V4 rules, resource budgets, Carry, and data tiers were unchanged in every simulation.
- Compared the current AI with balanced, aggressive, and varied allocation policies.
- Compared current player data with two total-preserving candidates: compressing non-signature stat spread by 30%, and raising non-signature 5-point cells to 6 while taking the points from middle values.
- Used the actual World Cup BO7 simulator, style loadouts, all 28 player pairings, seat/server swaps, and deterministic seeds.
- The screening sample ran 448 matches per configuration. Confirmation ran 1,344 matches per finalist with 12 repeats per pairing and four seat/server combinations.

## Result

The strongest score-margin result was **profile-mid-30 + balanced-varied**:

- 76.1% of games ended within a 7-point margin.
- 9.9% were shutouts or one-point losses.
- 31.5% of matches ended 4–1 or 4–2, 11.4% ended 4–3, and 57.1% were sweeps.
- Aggregate tier ordering remained 480 > 460 > 440.

The current player data + balanced-varied AI was less close but kept the individual outcomes less skewed:

- 70.4% of games were within a 7-point margin.
- 13.5% were shutouts or one-point losses.
- 27.0% of matches ended 4–1 or 4–2, 10.6% ended 4–3, and 62.4% were sweeps.
- Aggregate tier ordering remained 480 > 460 > 440.

## Decision

Use **balanced-varied AI** for CPU-controlled World Cup games and Normal local AI matches. The original Normal policy spent too little on rally attacks, spread most resources across defense, and could select an attack different from the strongest funded option. The new policy funds multiple attacks, varies its selection among strong options, and still uses only the public match view.

Do **not** promote either player-stat candidate to active data yet. Although 30% compression improved score margins, it did not resolve the serious individual skew: confirmation win rates ranged from 4% (Tomokazu Harimoto) to 79% (Ma Long), against 0% to 72% with current stats. The tier totals and signature cells survived compression, but the resulting roster-level fairness is not acceptable as the new 32/64-player data-generation standard. The floor-six candidate scored worse than current stats. Active player, equipment, and balance data remain unchanged.

This keeps the three tier totals and player signatures intact while avoiding a data change that the experiment does not justify. The remaining sweep rate shows the entertainment target is improved but not fully met; do not describe balance as solved.

## For the next balance iteration

1. Keep the deterministic multi-seed experiment and per-player/per-pair reporting as acceptance gates.
2. Inspect why Harimoto loses nearly every simulated pairing before editing individual cells; distinguish a stat-profile issue from a loadout-search or AI-policy issue.
3. For future 32/64-player rosters, add per-player minimum/maximum win-rate and same-tier pair thresholds; aggregate tier order alone is insufficient.
4. Try local, identity-preserving redistribution only after the cause is established. Preserve each player's tier total and named strengths, then rerun both the score-margin and per-player fairness checks.
5. Test the policy against human matches separately. These CPU-vs-CPU simulations are repeatable diagnostics, not a prediction of human outcomes.
