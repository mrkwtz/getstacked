# Tournament Fee Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to split each tournament entry amount (buy-in, rebuy, addon) into a prize pool portion and an optional host fee, with payouts calculated only from the pool.

**Architecture:** Add fee columns to the `tournaments` table alongside existing pool-amount columns. Rename `buy_in` → `buy_in_amount` for consistency. Add a `calculateTotalFees` helper. Update the creation form with fee inputs and the detail page with a "Fees" summary line.

**Tech Stack:** SvelteKit, Svelte 5 (runes), Supabase (Postgres), Vitest, Paraglide JS (i18n)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0010_tournament_fees.sql` | Create | Rename `buy_in` → `buy_in_amount`, add fee columns |
| `src/lib/types.ts` | Modify | Update generated types + `Tournament` interface |
| `src/lib/tournaments.ts` | Modify | Add `calculateTotalFees` function |
| `tests/unit/tournaments.test.ts` | Modify | Add `calculateTotalFees` tests |
| `messages/en.json` | Modify | Add fee label message keys |
| `messages/de.json` | Modify | Add fee label message keys (German) |
| `src/routes/[club]/admin/tournaments/new/+page.svelte` | Modify | Add fee input fields, update insert payload |
| `src/routes/[club]/admin/tournaments/[id]/+page.ts` | Modify | Rename `buy_in` refs, compute totalFees |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Modify | Rename `buy_in` refs, show "Fees" line |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0010_tournament_fees.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Rename buy_in to buy_in_amount for consistency with rebuy_amount / addon_amount
-- Postgres automatically updates inline check constraints to reference the new column name
ALTER TABLE tournaments RENAME COLUMN buy_in TO buy_in_amount;

-- Fee columns (cents, nullable, optional)
ALTER TABLE tournaments ADD COLUMN buy_in_fee integer CHECK (buy_in_fee >= 0);
ALTER TABLE tournaments ADD COLUMN rebuy_fee integer CHECK (rebuy_fee >= 0);
ALTER TABLE tournaments ADD COLUMN addon_fee integer CHECK (addon_fee >= 0);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` or apply via Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_tournament_fees.sql
git commit -m "feat: add tournament fee columns and rename buy_in to buy_in_amount"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update the generated database types**

In the `tournaments` table type definitions, rename `buy_in` → `buy_in_amount` and add fee columns in all three sections (Row, Insert, Update):

In the `Row` type (around line 232):
```typescript
          buy_in_amount: number
          rebuy_amount: number | null
          addon_amount: number | null
          buy_in_fee: number | null
          rebuy_fee: number | null
          addon_fee: number | null
```

In the `Insert` type (around line 246):
```typescript
          buy_in_amount: number
          rebuy_amount?: number | null
          addon_amount?: number | null
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
```

In the `Update` type (around line 260):
```typescript
          buy_in_amount?: number
          rebuy_amount?: number | null
          addon_amount?: number | null
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
```

- [ ] **Step 2: Update the `Tournament` convenience interface**

In the `Tournament` interface (around line 576):
```typescript
export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  date: string;
  format: 'freezeout' | 'rebuy';
  buy_in_amount: number;
  rebuy_amount: number | null;
  addon_amount: number | null;
  buy_in_fee: number | null;
  rebuy_fee: number | null;
  addon_fee: number | null;
  blind_structure_id: string | null;
  prize_structure_id: string | null;
  status: 'registration' | 'running' | 'finished';
  created_at: string;
  blind_structures?: { name: string } | null;
  prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;
}
```

- [ ] **Step 3: Run type check to identify remaining `buy_in` references**

Run: `npm run check 2>&1 | grep -i buy_in`

This will surface every file that still uses `buy_in` instead of `buy_in_amount`. Use these errors to guide the remaining tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: update TypeScript types for fee columns and buy_in_amount rename"
```

---

## Task 3: Add `calculateTotalFees` (TDD)

**Files:**
- Modify: `tests/unit/tournaments.test.ts`
- Modify: `src/lib/tournaments.ts`

- [ ] **Step 1: Write failing tests**

Add this test block at the end of `tests/unit/tournaments.test.ts`:

```typescript
describe('calculateTotalFees', () => {
  it('calculates fees for buy-in only (freezeout)', () => {
    expect(calculateTotalFees(4, 500, 0, 0, 0, 0)).toBe(2000);
  });

  it('calculates fees for all entry types', () => {
    // 3 players * 500 buy-in fee + 2 rebuys * 300 rebuy fee + 1 addon * 200 addon fee
    expect(calculateTotalFees(3, 500, 2, 300, 1, 200)).toBe(2300);
  });

  it('returns 0 when all fees are 0', () => {
    expect(calculateTotalFees(5, 0, 3, 0, 2, 0)).toBe(0);
  });

  it('returns 0 with zero players', () => {
    expect(calculateTotalFees(0, 500, 0, 300, 0, 200)).toBe(0);
  });

  it('handles fee on buy-in only with rebuys and addons having no fee', () => {
    expect(calculateTotalFees(4, 500, 3, 0, 2, 0)).toBe(2000);
  });
});
```

Also update the import at line 2 to include `calculateTotalFees`:

```typescript
import { validatePayouts, calculatePrizePool, calculatePayouts, formatPrizePoolBreakdown, calculateTotalFees } from '$lib/tournaments';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/tournaments.test.ts`

Expected: 5 failures — `calculateTotalFees` is not exported.

- [ ] **Step 3: Implement `calculateTotalFees`**

Add to the end of `src/lib/tournaments.ts`:

```typescript
export function calculateTotalFees(
  playerCount: number,
  buyInFee: number,
  totalRebuys: number,
  rebuyFee: number,
  addonCount: number,
  addonFee: number
): number {
  return playerCount * buyInFee + totalRebuys * rebuyFee + addonCount * addonFee;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/tournaments.test.ts`

Expected: All tests pass (including existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournaments.ts tests/unit/tournaments.test.ts
git commit -m "feat: add calculateTotalFees with TDD tests"
```

---

## Task 4: Add i18n Message Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add English message keys**

Add after the `tournament_format_options_title` line in `messages/en.json`:

```json
  "tournament_buy_in_fee_label": "Buy-in fee",
  "tournament_rebuy_fee_label": "Rebuy fee",
  "tournament_addon_fee_label": "Add-on fee",
  "tournament_fees_label": "Fees",
```

- [ ] **Step 2: Add German message keys**

Add after the `tournament_format_options_title` line in `messages/de.json`:

```json
  "tournament_buy_in_fee_label": "Buy-in-Gebühr",
  "tournament_rebuy_fee_label": "Rebuy-Gebühr",
  "tournament_addon_fee_label": "Add-on-Gebühr",
  "tournament_fees_label": "Gebühren",
```

- [ ] **Step 3: Rebuild Paraglide output**

Run: `npm run build`

Verify: `grep 'fees_label' src/lib/paraglide/messages/en.js` should show the new export.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat: add i18n keys for tournament fee labels"
```

---

## Task 5: Update Tournament Creation Form

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/new/+page.svelte`

- [ ] **Step 1: Rename `buy_in` references in the form**

In `handleCreate` (around line 156), rename the form field:

Old:
```typescript
      const buyInRaw = formData.get('buy_in')?.toString() ?? '';
```
New:
```typescript
      const buyInRaw = formData.get('buy_in_amount')?.toString() ?? '';
```

In the errors object (around line 166):

Old:
```typescript
      if (!buyInRaw || buyIn <= 0) errors.buy_in = true;
```
New:
```typescript
      if (!buyInRaw || buyIn <= 0) errors.buy_in_amount = true;
```

In the insert payload (around line 203):

Old:
```typescript
          buy_in: buyIn,
```
New:
```typescript
          buy_in_amount: buyIn,
```

- [ ] **Step 2: Add fee parsing and insert fields to `handleCreate`**

After the line `const addonRaw = formData.get('addon_amount')?.toString() ?? '';` (around line 158), add:

```typescript
      const buyInFeeRaw = formData.get('buy_in_fee')?.toString() ?? '';
      const rebuyFeeRaw = formData.get('rebuy_fee')?.toString() ?? '';
      const addonFeeRaw = formData.get('addon_fee')?.toString() ?? '';
```

After the existing `addonAmount` variable block (around line 178), add fee parsing:

```typescript
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

Add the fee fields to the insert payload (after `addon_amount: addonAmount,`):

```typescript
          buy_in_fee: buyInFee,
          rebuy_fee: rebuyFee,
          addon_fee: addonFee,
```

- [ ] **Step 3: Update the buy-in input field HTML name and error key**

In the buy-in `<input>` element (around line 267):

Old:
```svelte
          id="t-buyin" type="number" name="buy_in" min="0" step="0.01"
          oninput={() => clearFieldError('buy_in')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in ? 'ring-2 ring-accent' : ''}"
```
New:
```svelte
          id="t-buyin" type="number" name="buy_in_amount" min="0" step="0.01"
          oninput={() => clearFieldError('buy_in_amount')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_amount ? 'ring-2 ring-accent' : ''}"
```

- [ ] **Step 4: Add the buy-in fee field after the buy-in amount field**

After the closing `</div>` of the buy-in amount field (around line 271), add:

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

- [ ] **Step 5: Add rebuy fee and addon fee fields inside the rebuy format options section**

Inside the `{#if format === 'rebuy'}` red-bordered section, after the rebuy amount field `</div>`, add:

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

After the addon amount field `</div>`, add:

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

- [ ] **Step 6: Run type check**

Run: `npm run check 2>&1 | tail -10`

Expected: No errors from this file (there may still be errors in the tournament detail page, fixed in Task 6).

- [ ] **Step 7: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/new/+page.svelte"
git commit -m "feat: add fee fields to tournament creation form"
```

---

## Task 6: Update Tournament Detail Page

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Update the page loader**

In `src/routes/[club]/admin/tournaments/[id]/+page.ts`, import `calculateTotalFees`:

Old (line 2):
```typescript
import { calculatePrizePool } from '$lib/tournaments';
```
New:
```typescript
import { calculatePrizePool, calculateTotalFees } from '$lib/tournaments';
```

Rename `tournament.buy_in` → `tournament.buy_in_amount` in the `calculatePrizePool` call (around line 44):

Old:
```typescript
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );
```
New:
```typescript
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );

  const totalFees = calculateTotalFees(
    allPlayers.length,
    tournament.buy_in_fee ?? 0,
    totalRebuys,
    tournament.rebuy_fee ?? 0,
    addonCount,
    tournament.addon_fee ?? 0,
  );
```

Add `totalFees` to the return object (line 55):

Old:
```typescript
  return { tournament, players: allPlayers, availablePlayers, prizePool, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
```
New:
```typescript
  return { tournament, players: allPlayers, availablePlayers, prizePool, totalFees, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
```

- [ ] **Step 2: Update the meta line in the detail page**

In `src/routes/[club]/admin/tournaments/[id]/+page.svelte`, rename `t.buy_in` → `t.buy_in_amount` in the `metaLine` derived (around line 48):

Old:
```typescript
    `€${(t.buy_in / 100).toFixed(2)} buy-in`,
```
New:
```typescript
    `€${(t.buy_in_amount / 100).toFixed(2)} buy-in`,
```

- [ ] **Step 3: Update the prize pool breakdown call**

In the prize pool callout section (around line 620):

Old:
```svelte
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in, totalRebuys, t.rebuy_amount ?? 0, addonCount, t.addon_amount ?? 0) as part}
```
New:
```svelte
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in_amount, totalRebuys, t.rebuy_amount ?? 0, addonCount, t.addon_amount ?? 0) as part}
```

- [ ] **Step 4: Add the "Fees" summary line**

After the `{/each}` that closes the breakdown loop (around line 627), add:

```svelte
      {#if data.totalFees > 0}
        <span class="text-xs text-muted-foreground">
          {m.tournament_fees_label()}: €{(data.totalFees / 100).toFixed(0)}
        </span>
      {/if}
```

- [ ] **Step 5: Run type check and build**

Run: `npm run check 2>&1 | tail -10`

Expected: 0 errors.

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 6: Run all tests**

Run: `npm test`

Expected: All tests pass (59 existing + 5 new = 64 tests).

- [ ] **Step 7: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/[id]/+page.ts" "src/routes/[club]/admin/tournaments/[id]/+page.svelte"
git commit -m "feat: display fees in tournament detail and rename buy_in to buy_in_amount"
```
