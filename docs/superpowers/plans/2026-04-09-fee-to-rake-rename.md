# Fee → Rake Rename + Semantic Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `fee` → `rake` throughout the codebase (DB, types, business logic, UI, i18n) and change the prize pool calculation so rake is deducted from the buy-in amount rather than charged on top.

**Architecture:** DB columns renamed via migration; `calculatePrizePool` gains rake parameters and deducts them from amounts; i18n keys renamed; form field names and loader calls updated to match.

**Tech Stack:** SvelteKit, Svelte 5 runes, Supabase, Paraglide JS (i18n), Vitest

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/0015_rename_fee_to_rake.sql` | **Create** — rename 3 columns |
| `src/lib/types.ts` | **Modify** — fee → rake in Row/Insert/Update |
| `src/lib/tournaments.ts` | **Modify** — new `calculatePrizePool` signature; rename `calculateTotalFees` → `calculateTotalRake` |
| `tests/unit/tournaments.test.ts` | **Modify** — update imports, tests, add rake deduction tests |
| `messages/en.json` | **Modify** — rename fee → rake in keys and values |
| `messages/de.json` | **Modify** — rename fee → rake in keys and values |
| `src/routes/[club]/admin/tournaments/new/+page.svelte` | **Modify** — field names, labels, validation, DB insert |
| `src/routes/[club]/admin/tournaments/[id]/+page.ts` | **Modify** — update function calls and field references |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | **Modify** — pass net amounts to `formatPrizePoolBreakdown` |
| `src/routes/[club]/admin/tournaments/[id]/clock/+page.ts` | **Modify** — update `calculatePrizePool` call |

---

## Task 1: DB migration — rename fee columns to rake

**Files:**
- Create: `supabase/migrations/0015_rename_fee_to_rake.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Rename fee columns to rake on the tournaments table
ALTER TABLE tournaments RENAME COLUMN buy_in_fee TO buy_in_rake;
ALTER TABLE tournaments RENAME COLUMN rebuy_fee TO rebuy_rake;
ALTER TABLE tournaments RENAME COLUMN addon_fee TO addon_rake;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0015_rename_fee_to_rake.sql
git commit -m "feat: rename fee columns to rake in tournaments table"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts:238-241` (Row), `259-261` (Insert), `280-282` (Update)

- [ ] **Step 1: Update Row type** — replace lines 238-240:

Old:
```ts
          buy_in_fee: number | null
          rebuy_fee: number | null
          addon_fee: number | null
```
New:
```ts
          buy_in_rake: number | null
          rebuy_rake: number | null
          addon_rake: number | null
```

- [ ] **Step 2: Update Insert type** — replace lines 259-261:

Old:
```ts
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
```
New:
```ts
          buy_in_rake?: number | null
          rebuy_rake?: number | null
          addon_rake?: number | null
```

- [ ] **Step 3: Update Update type** — replace lines 280-282:

Old:
```ts
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
```
New:
```ts
          buy_in_rake?: number | null
          rebuy_rake?: number | null
          addon_rake?: number | null
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: rename fee → rake in TypeScript database types"
```

---

## Task 3: TDD — update `calculatePrizePool` with rake deduction

**Files:**
- Modify: `tests/unit/tournaments.test.ts`
- Modify: `src/lib/tournaments.ts`

The new `calculatePrizePool` signature takes 9 parameters:
```ts
calculatePrizePool(
  playerCount: number,
  buyInAmount: number, buyInRake: number,
  totalRebuys: number, rebuyAmount: number, rebuyRake: number,
  addonCount: number, addonAmount: number, addonRake: number
): number
```
Returns `playerCount * (buyInAmount - buyInRake) + totalRebuys * (rebuyAmount - rebuyRake) + addonCount * (addonAmount - addonRake)`.

- [ ] **Step 1: Update tests** — replace the entire `describe('calculatePrizePool', ...)` block (lines 50–77) with:

```ts
describe('calculatePrizePool', () => {
  it('freezeout: player_count × buy_in only, no rake', () => {
    expect(calculatePrizePool(4, 2000, 0, 0, 0, 0, 0, 0, 0)).toBe(8000);
  });

  it('freezeout: deducts buy-in rake from prize pool', () => {
    // 4 players × (€20 - €2 rake) = 4 × 1800 = 7200
    expect(calculatePrizePool(4, 2000, 200, 0, 0, 0, 0, 0, 0)).toBe(7200);
  });

  it('rebuy: adds rebuys and add-ons, no rake', () => {
    expect(calculatePrizePool(3, 2000, 0, 2, 2000, 0, 1, 1000, 0)).toBe(
      3 * 2000 + 2 * 2000 + 1 * 1000,
    );
  });

  it('rebuy: deducts rake from all entry types', () => {
    // 3 × (2000-200) + 2 × (2000-300) + 1 × (1000-100) = 5400+3400+900 = 9700
    expect(calculatePrizePool(3, 2000, 200, 2, 2000, 300, 1, 1000, 100)).toBe(9700);
  });

  it('zero players returns 0', () => {
    expect(calculatePrizePool(0, 2000, 0, 0, 0, 0, 0, 0, 0)).toBe(0);
  });

  it('all amounts in cents in, cents out', () => {
    expect(calculatePrizePool(1, 5000, 0, 0, 0, 0, 0, 0, 0)).toBe(5000);
  });

  it('returns correct prize pool for basic arithmetic case', () => {
    // 10 players * 100 buy-in + 3 rebuys * 100 + 2 add-ons * 50, no rake
    expect(calculatePrizePool(10, 100, 0, 3, 100, 0, 2, 50, 0)).toBe(1400);
  });

  it('handles no rebuys and no add-ons', () => {
    expect(calculatePrizePool(5, 200, 0, 0, 0, 0, 0, 0, 0)).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/tournaments.test.ts
```
Expected: FAIL — argument count mismatch errors in the `calculatePrizePool` describe block.

- [ ] **Step 3: Update `calculatePrizePool` in `src/lib/tournaments.ts`**

Replace lines 13–22:
```ts
export function calculatePrizePool(
  playerCount: number,
  buyInAmount: number,
  buyInRake: number,
  totalRebuys: number,
  rebuyAmount: number,
  rebuyRake: number,
  addonCount: number,
  addonAmount: number,
  addonRake: number
): number {
  return (
    playerCount * (buyInAmount - buyInRake) +
    totalRebuys * (rebuyAmount - rebuyRake) +
    addonCount * (addonAmount - addonRake)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/tournaments.test.ts
```
Expected: PASS for all `calculatePrizePool` tests. Other tests may still fail if `calculateTotalFees` import is stale — that's fine, fix in Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournaments.ts tests/unit/tournaments.test.ts
git commit -m "feat: calculatePrizePool now deducts rake from each entry amount"
```

---

## Task 4: TDD — rename `calculateTotalFees` → `calculateTotalRake`

**Files:**
- Modify: `tests/unit/tournaments.test.ts`
- Modify: `src/lib/tournaments.ts`

- [ ] **Step 1: Update the import line in the test file** (line 2):

Old:
```ts
import { validatePayouts, calculatePrizePool, calculatePayouts, formatPrizePoolBreakdown, calculateTotalFees, calculateAverageStack } from '$lib/tournaments';
```
New:
```ts
import { validatePayouts, calculatePrizePool, calculatePayouts, formatPrizePoolBreakdown, calculateTotalRake, calculateAverageStack } from '$lib/tournaments';
```

- [ ] **Step 2: Replace the `calculateTotalFees` describe block** (lines 181–202) with:

```ts
describe('calculateTotalRake', () => {
  it('calculates rake for buy-in only (freezeout)', () => {
    expect(calculateTotalRake(4, 500, 0, 0, 0, 0)).toBe(2000);
  });

  it('calculates rake for all entry types', () => {
    // 3 players * 500 buy-in rake + 2 rebuys * 300 rebuy rake + 1 addon * 200 addon rake
    expect(calculateTotalRake(3, 500, 2, 300, 1, 200)).toBe(2300);
  });

  it('returns 0 when all rakes are 0', () => {
    expect(calculateTotalRake(5, 0, 3, 0, 2, 0)).toBe(0);
  });

  it('returns 0 with zero players', () => {
    expect(calculateTotalRake(0, 500, 0, 300, 0, 200)).toBe(0);
  });

  it('handles rake on buy-in only with rebuys and addons having no rake', () => {
    expect(calculateTotalRake(4, 500, 3, 0, 2, 0)).toBe(2000);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/unit/tournaments.test.ts
```
Expected: FAIL — `calculateTotalRake` not found.

- [ ] **Step 4: Rename the function in `src/lib/tournaments.ts`** (line 62):

Old:
```ts
export function calculateTotalFees(
```
New:
```ts
export function calculateTotalRake(
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
npx vitest run tests/unit/tournaments.test.ts
```
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tournaments.ts tests/unit/tournaments.test.ts
git commit -m "feat: rename calculateTotalFees to calculateTotalRake"
```

---

## Task 5: Update i18n message keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Update `messages/en.json`** — replace lines 59–62:

Old:
```json
  "tournament_buy_in_fee_label": "Buy-in fee",
  "tournament_rebuy_fee_label": "Rebuy fee",
  "tournament_addon_fee_label": "Add-on fee",
  "tournament_fees_label": "Fees",
```
New:
```json
  "tournament_buy_in_rake_label": "Buy-in rake",
  "tournament_rebuy_rake_label": "Rebuy rake",
  "tournament_addon_rake_label": "Add-on rake",
  "tournament_rake_label": "Rake",
```

- [ ] **Step 2: Update `messages/de.json`** — find and replace the equivalent lines:

Old:
```json
  "tournament_buy_in_fee_label": "Buy-in-Gebühr",
  "tournament_rebuy_fee_label": "Rebuy-Gebühr",
  "tournament_addon_fee_label": "Add-on-Gebühr",
  "tournament_fees_label": "Gebühren",
```
New:
```json
  "tournament_buy_in_rake_label": "Buy-in Rake",
  "tournament_rebuy_rake_label": "Rebuy Rake",
  "tournament_addon_rake_label": "Add-on Rake",
  "tournament_rake_label": "Rake",
```

- [ ] **Step 3: Regenerate Paraglide output**

```bash
npm run build
```
This regenerates `src/lib/paraglide/messages/en.js` and `src/lib/paraglide/messages/de.js` with the new key names.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json src/lib/paraglide/
git commit -m "feat: rename fee → rake in i18n message keys and values"
```

---

## Task 6: Update tournament creation form

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/new/+page.svelte`

Four areas change: (a) form data extraction, (b) validation logic, (c) DB insert, (d) HTML labels + inputs.

- [ ] **Step 1: Update form data extraction** — replace lines 159–161:

Old:
```ts
      const buyInFeeRaw = formData.get('buy_in_fee')?.toString() ?? '';
      const rebuyFeeRaw = formData.get('rebuy_fee')?.toString() ?? '';
      const addonFeeRaw = formData.get('addon_fee')?.toString() ?? '';
```
New:
```ts
      const buyInRakeRaw = formData.get('buy_in_rake')?.toString() ?? '';
      const rebuyRakeRaw = formData.get('rebuy_rake')?.toString() ?? '';
      const addonRakeRaw = formData.get('addon_rake')?.toString() ?? '';
```

- [ ] **Step 2: Update validation and variable declarations** — replace lines 200–210:

Old:
```ts
      const buyInFee = buyInFeeRaw ? Math.round(parseFloat(buyInFeeRaw) * 100) : null;
      if (buyInFee !== null && buyInFee < 0) errors.buy_in_fee = true;

      let rebuyFee: number | null = null;
      let addonFee: number | null = null;
      if (formatVal === 'rebuy') {
        rebuyFee = rebuyFeeRaw ? Math.round(parseFloat(rebuyFeeRaw) * 100) : null;
        if (rebuyFee !== null && rebuyFee < 0) errors.rebuy_fee = true;
        addonFee = addonFeeRaw ? Math.round(parseFloat(addonFeeRaw) * 100) : null;
        if (addonFee !== null && addonFee < 0) errors.addon_fee = true;
      }
```
New:
```ts
      const buyInRake = buyInRakeRaw ? Math.round(parseFloat(buyInRakeRaw) * 100) : null;
      if (buyInRake !== null && buyInRake < 0) errors.buy_in_rake = true;
      if (buyInRake !== null && buyInRake >= buyIn) errors.buy_in_rake = true;

      let rebuyRake: number | null = null;
      let addonRake: number | null = null;
      if (formatVal === 'rebuy') {
        rebuyRake = rebuyRakeRaw ? Math.round(parseFloat(rebuyRakeRaw) * 100) : null;
        if (rebuyRake !== null && rebuyRake < 0) errors.rebuy_rake = true;
        if (rebuyRake !== null && rebuyAmount !== null && rebuyRake >= rebuyAmount) errors.rebuy_rake = true;
        addonRake = addonRakeRaw ? Math.round(parseFloat(addonRakeRaw) * 100) : null;
        if (addonRake !== null && addonRake < 0) errors.addon_rake = true;
        if (addonRake !== null && addonAmount !== null && addonRake >= addonAmount) errors.addon_rake = true;
      }
```

- [ ] **Step 3: Update DB insert** — replace lines 239–241:

Old:
```ts
          buy_in_fee: buyInFee,
          rebuy_fee: rebuyFee,
          addon_fee: addonFee,
```
New:
```ts
          buy_in_rake: buyInRake,
          rebuy_rake: rebuyRake,
          addon_rake: addonRake,
```

- [ ] **Step 4: Update buy-in rake HTML** — replace the buy-in fee `<div>` block (lines 311–321):

Old:
```svelte
        <div>
          <label for="t-buyin-fee" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buy_in_fee_label()}
          </label>
          <input
            id="t-buyin-fee" type="number" name="buy_in_fee" min="0" step="0.01"
            oninput={() => clearFieldError('buy_in_fee')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_fee ? 'ring-2 ring-accent' : ''}"
          />
        </div>
```
New:
```svelte
        <div>
          <label for="t-buyin-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buy_in_rake_label()}
          </label>
          <input
            id="t-buyin-rake" type="number" name="buy_in_rake" min="0" step="0.01"
            oninput={() => clearFieldError('buy_in_rake')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_rake ? 'ring-2 ring-accent' : ''}"
          />
        </div>
```

- [ ] **Step 5: Update rebuy rake HTML** — replace the rebuy fee `<div>` block (around line 393–401):

Old:
```svelte
            <div>
              <label for="t-rebuy-fee" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_rebuy_fee_label()}
              </label>
              <input
                id="t-rebuy-fee" type="number" name="rebuy_fee" min="0" step="0.01"
                oninput={() => clearFieldError('rebuy_fee')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.rebuy_fee ? 'ring-2 ring-accent' : ''}"
              />
            </div>
```
New:
```svelte
            <div>
              <label for="t-rebuy-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_rebuy_rake_label()}
              </label>
              <input
                id="t-rebuy-rake" type="number" name="rebuy_rake" min="0" step="0.01"
                oninput={() => clearFieldError('rebuy_rake')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.rebuy_rake ? 'ring-2 ring-accent' : ''}"
              />
            </div>
```

- [ ] **Step 6: Update addon rake HTML** — replace the addon fee `<div>` block (around line 425–434):

Old:
```svelte
            <div>
              <label for="t-addon-fee" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_addon_fee_label()}
              </label>
              <input
                id="t-addon-fee" type="number" name="addon_fee" min="0" step="0.01"
                oninput={() => clearFieldError('addon_fee')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.addon_fee ? 'ring-2 ring-accent' : ''}"
              />
            </div>
```
New:
```svelte
            <div>
              <label for="t-addon-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_addon_rake_label()}
              </label>
              <input
                id="t-addon-rake" type="number" name="addon_rake" min="0" step="0.01"
                oninput={() => clearFieldError('addon_rake')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.addon_rake ? 'ring-2 ring-accent' : ''}"
              />
            </div>
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/[club]/admin/tournaments/new/+page.svelte
git commit -m "feat: update tournament creation form — fee → rake fields + rake < amount validation"
```

---

## Task 7: Update tournament detail page loader

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`

- [ ] **Step 1: Update the import** (line 2):

Old:
```ts
import { calculatePrizePool, calculateTotalFees } from '$lib/tournaments';
```
New:
```ts
import { calculatePrizePool, calculateTotalRake } from '$lib/tournaments';
```

- [ ] **Step 2: Update the `calculatePrizePool` call** (lines 42–49):

Old:
```ts
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );
```
New:
```ts
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    tournament.buy_in_rake ?? 0,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    tournament.rebuy_rake ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
    tournament.addon_rake ?? 0,
  );
```

- [ ] **Step 3: Update the `calculateTotalFees` call** (lines 51–58):

Old:
```ts
  const totalFees = calculateTotalFees(
    allPlayers.length,
    tournament.buy_in_fee ?? 0,
    totalRebuys,
    tournament.rebuy_fee ?? 0,
    addonCount,
    tournament.addon_fee ?? 0,
  );
```
New:
```ts
  const totalRake = calculateTotalRake(
    allPlayers.length,
    tournament.buy_in_rake ?? 0,
    totalRebuys,
    tournament.rebuy_rake ?? 0,
    addonCount,
    tournament.addon_rake ?? 0,
  );
```

- [ ] **Step 4: Update the return value** (line 64):

Old:
```ts
  return { tournament, players: allPlayers, availableMembers, prizePool, totalFees, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
```
New:
```ts
  return { tournament, players: allPlayers, availableMembers, prizePool, totalRake, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
```

- [ ] **Step 5: Run type check to confirm no errors**

```bash
npm run check
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.ts
git commit -m "feat: update tournament detail loader — use rake fields and calculateTotalRake"
```

---

## Task 8: Update tournament detail page — prize pool breakdown

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

The `formatPrizePoolBreakdown` call at line 761 currently passes raw amounts. After the semantic change, it should pass net amounts (amount − rake) so the breakdown shows what actually goes into the prize pool.

- [ ] **Step 1: Update the `formatPrizePoolBreakdown` call** (line 761):

Old:
```svelte
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in_amount, totalRebuys, t.rebuy_amount ?? 0, addonCount, t.addon_amount ?? 0) as part}
```
New:
```svelte
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in_amount - (t.buy_in_rake ?? 0), totalRebuys, (t.rebuy_amount ?? 0) - (t.rebuy_rake ?? 0), addonCount, (t.addon_amount ?? 0) - (t.addon_rake ?? 0)) as part}
```

- [ ] **Step 2: Run type check**

```bash
npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: show net (amount − rake) in prize pool breakdown"
```

---

## Task 9: Update clock page loader

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/clock/+page.ts`

- [ ] **Step 1: Update the `calculatePrizePool` call** (lines 31–38):

Old:
```ts
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );
```
New:
```ts
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    tournament.buy_in_rake ?? 0,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    tournament.rebuy_rake ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
    tournament.addon_rake ?? 0,
  );
```

- [ ] **Step 2: Run type check and all unit tests**

```bash
npm run check && npm test
```
Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/clock/+page.ts
git commit -m "feat: update clock page loader — pass rake to calculatePrizePool"
```
