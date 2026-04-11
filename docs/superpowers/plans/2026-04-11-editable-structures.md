# Editable Blind & Prize Structures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow blind and prize structures to be edited at any time, and allow per-tournament structure copies to be adjusted independently while a tournament is running.

**Architecture:** Tournaments get their own `blind_levels` and `prize_payouts` JSONB columns; data is copied from the selected template at creation time. Global templates remain always-editable. Shared form components (`BlindStructureForm.svelte`, `PrizeStructureForm.svelte`) and a new `Dialog` component from bits-ui are reused across all three editing surfaces.

**Tech Stack:** SvelteKit, Svelte 5 runes, Supabase (browser client), bits-ui Dialog, Tailwind CSS v4, Paraglide JS (EN + DE i18n)

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/YYYYMMDDHHMMSS_tournament_structure_copies.sql` |
| Modify | `src/lib/types.ts` |
| Create | `src/lib/components/ui/dialog/index.ts` |
| Create | `src/lib/components/ui/dialog/dialog.svelte` |
| Create | `src/lib/components/ui/dialog/dialog-overlay.svelte` |
| Create | `src/lib/components/ui/dialog/dialog-content.svelte` |
| Create | `src/lib/components/BlindStructureForm.svelte` |
| Create | `src/lib/components/PrizeStructureForm.svelte` |
| Modify | `src/lib/paraglide/messages/en.js` |
| Modify | `src/lib/paraglide/messages/de.js` |
| Modify | `src/routes/[club]/admin/blind-structures/+page.svelte` |
| Modify | `src/routes/[club]/admin/prize-structures/+page.svelte` |
| Modify | `src/routes/[club]/admin/tournaments/new/+page.ts` |
| Modify | `src/routes/[club]/admin/tournaments/new/+page.svelte` |
| Modify | `src/routes/[club]/admin/tournaments/[id]/+page.ts` |
| Modify | `src/routes/[club]/admin/tournaments/[id]/+page.svelte` |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<timestamp>_tournament_structure_copies.sql`

- [ ] **Step 1: Generate migration file**

Run:
```bash
npx supabase migration new tournament_structure_copies
```
Expected: creates `supabase/migrations/<timestamp>_tournament_structure_copies.sql`

- [ ] **Step 2: Write the migration**

Open the generated file and write:

```sql
-- Add tournament-owned copies of blind levels and prize payouts
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS blind_levels  jsonb,
  ADD COLUMN IF NOT EXISTS prize_payouts jsonb;

-- Backfill from referenced structures
UPDATE tournaments t
SET blind_levels = bs.levels
FROM blind_structures bs
WHERE t.blind_structure_id = bs.id;

UPDATE tournaments t
SET prize_payouts = ps.payouts
FROM prize_structures ps
WHERE t.prize_structure_id = ps.id;

-- Ensure deleting a global template does not cascade-delete tournament data
-- (soft reference only — set FK to null, tournament keeps its copy)
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_blind_structure_id_fkey,
  ADD CONSTRAINT tournaments_blind_structure_id_fkey
    FOREIGN KEY (blind_structure_id)
    REFERENCES blind_structures(id)
    ON DELETE SET NULL;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_prize_structure_id_fkey,
  ADD CONSTRAINT tournaments_prize_structure_id_fkey
    FOREIGN KEY (prize_structure_id)
    REFERENCES prize_structures(id)
    ON DELETE SET NULL;
```

- [ ] **Step 3: Apply the migration locally**

Run:
```bash
npx supabase db push
```
Expected: migration applies without errors

- [ ] **Step 4: Update `src/lib/types.ts`**

In the `tournaments` table's `Row`, `Insert`, and `Update` type blocks, add the new columns. Find the `Row` block (currently around line 230) and add after `timer_state`:

```typescript
// Row block — add:
blind_levels: Json | null
prize_payouts: Json | null
```

```typescript
// Insert block — add:
blind_levels?: Json | null
prize_payouts?: Json | null
```

```typescript
// Update block — add:
blind_levels?: Json | null
prize_payouts?: Json | null
```

Also find the convenience type `Tournament` near line 626 and add:

```typescript
blind_levels: { type: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label: string }[] | null;
prize_payouts: { position: number; percentage: number }[] | null;
```

- [ ] **Step 5: Verify type-check passes**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/lib/types.ts
git commit -m "feat: add blind_levels and prize_payouts columns to tournaments"
```

---

## Task 2: Dialog component

**Files:**
- Create: `src/lib/components/ui/dialog/index.ts`
- Create: `src/lib/components/ui/dialog/dialog.svelte`
- Create: `src/lib/components/ui/dialog/dialog-overlay.svelte`
- Create: `src/lib/components/ui/dialog/dialog-content.svelte`

These wrap bits-ui's Dialog primitives in the same pattern as the other ui components (button, card, etc.).

- [ ] **Step 1: Create `src/lib/components/ui/dialog/index.ts`**

```typescript
export { default as Dialog } from './dialog.svelte';
export { default as DialogOverlay } from './dialog-overlay.svelte';
export { default as DialogContent } from './dialog-content.svelte';
```

- [ ] **Step 2: Create `src/lib/components/ui/dialog/dialog.svelte`**

```svelte
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    children,
  }: {
    open?: boolean;
    children?: Snippet;
  } = $props();
</script>

<DialogPrimitive.Root bind:open>
  {@render children?.()}
</DialogPrimitive.Root>
```

- [ ] **Step 3: Create `src/lib/components/ui/dialog/dialog-overlay.svelte`**

```svelte
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils.js';

  let { class: className, ...restProps } = $props();
</script>

<DialogPrimitive.Overlay
  class={cn('fixed inset-0 z-40 bg-black/60', className)}
  {...restProps}
/>
```

- [ ] **Step 4: Create `src/lib/components/ui/dialog/dialog-content.svelte`**

```svelte
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

  let {
    class: className,
    children,
    ...restProps
  }: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay class="fixed inset-0 z-40 bg-black/60" />
  <DialogPrimitive.Content
    class={cn(
      'fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-md mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
```

- [ ] **Step 5: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ui/dialog/
git commit -m "feat: add Dialog component using bits-ui"
```

---

## Task 3: BlindStructureForm component

**Files:**
- Create: `src/lib/components/BlindStructureForm.svelte`

This extracts the levels editing table that currently lives in `src/routes/[club]/admin/blind-structures/+page.svelte` lines 170–233.

- [ ] **Step 1: Create `src/lib/components/BlindStructureForm.svelte`**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  export type LevelRow =
    | { type: 'level'; small_blind: string; big_blind: string; ante: string; duration_minutes: string; label: string }
    | { type: 'break'; duration_minutes: string; label: string };

  let {
    levels = $bindable<LevelRow[]>([
      { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
    ]),
  }: { levels: LevelRow[] } = $props();

  function addLevel() {
    levels = [...levels, { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
  }

  function addBreak() {
    levels = [...levels, { type: 'break', duration_minutes: '', label: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-3">
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="text-muted-foreground">
          <th class="text-left font-medium pb-2 pr-2 w-10">#</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_duration_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_sb_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_bb_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_ante_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">Label</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each levels as level, i}
          <tr>
            <td class="pr-2 pb-2">
              {#if level.type === 'break'}
                <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-accent/15 text-accent">BRK</span>
              {:else}
                <span class="text-xs text-muted-foreground">{i + 1 - levels.slice(0, i).filter((l) => l.type === 'break').length}</span>
              {/if}
            </td>
            <td class="pr-2 pb-2">
              <input type="number" min="1" bind:value={level.duration_minutes}
                class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            </td>
            {#if level.type === 'level'}
              <td class="pr-2 pb-2">
                <input type="number" min="1" bind:value={level.small_blind}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="1" bind:value={level.big_blind}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="0" bind:value={level.ante}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
            {:else}
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
            {/if}
            <td class="pr-2 pb-2">
              {#if level.type === 'break'}
                <input type="text" bind:value={level.label}
                  placeholder={m.blind_structure_break_label_placeholder()}
                  class="w-36 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent" />
              {/if}
            </td>
            <td class="pb-2">
              {#if levels.length > 1}
                <button type="button" onclick={() => removeLevel(i)}
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex gap-4">
    <button type="button" onclick={addLevel}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.blind_structure_add_level()}
    </button>
    <button type="button" onclick={addBreak}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.blind_structure_add_break()}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BlindStructureForm.svelte
git commit -m "feat: extract BlindStructureForm component"
```

---

## Task 4: PrizeStructureForm component

**Files:**
- Create: `src/lib/components/PrizeStructureForm.svelte`

Extracts the payouts table from `src/routes/[club]/admin/prize-structures/+page.svelte` lines 146–176.

- [ ] **Step 1: Create `src/lib/components/PrizeStructureForm.svelte`**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let {
    payouts = $bindable<{ position: number; percentage: string }[]>([
      { position: 1, percentage: '' },
    ]),
  }: { payouts: { position: number; percentage: string }[] } = $props();

  function addPayout() {
    payouts = [...payouts, { position: payouts.length + 1, percentage: '' }];
  }

  function removePayout(i: number) {
    payouts = payouts.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-3">
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="text-muted-foreground">
          <th class="text-left font-medium pb-2">{m.prize_structure_position_label()}</th>
          <th class="text-left font-medium pb-2">{m.prize_structure_percentage_label()}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each payouts as payout, i}
          <tr>
            <td class="pr-2 pb-2">
              <span class="text-sm text-foreground">{i + 1}</span>
            </td>
            <td class="pr-2 pb-2">
              <input type="number" min="0" max="100" step="0.01" bind:value={payout.percentage}
                class="w-24 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            </td>
            <td class="pb-2">
              {#if payouts.length > 1}
                <button type="button" onclick={() => removePayout(i)}
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <button type="button" onclick={addPayout}
    class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
    + {m.prize_structure_add_payout()}
  </button>
</div>
```

- [ ] **Step 2: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/PrizeStructureForm.svelte
git commit -m "feat: extract PrizeStructureForm component"
```

---

## Task 5: i18n strings

**Files:**
- Modify: `src/lib/paraglide/messages/en.js`
- Modify: `src/lib/paraglide/messages/de.js`

New keys needed for edit mode on global structure pages and the tournament detail edit buttons.

- [ ] **Step 1: Add keys to `src/lib/paraglide/messages/en.js`**

Append after the last `blind_structure_*` entry:

```javascript
export const blind_structure_edit_title = () => `Edit blind structure`
export const blind_structure_save_button = () => `Save`
export const blind_structure_edit_button = () => `Edit`
```

Append after the last `prize_structure_*` entry:

```javascript
export const prize_structure_edit_title = () => `Edit prize structure`
export const prize_structure_save_button = () => `Save`
export const prize_structure_edit_button = () => `Edit`
```

Append after the last `tournament_*` entry:

```javascript
export const tournament_edit_blind_structure = () => `Edit blind structure`
export const tournament_edit_prize_structure = () => `Edit prize structure`
```

- [ ] **Step 2: Add keys to `src/lib/paraglide/messages/de.js`**

Find the equivalent sections in `de.js` (same key names, different function bodies) and add the same keys with German translations:

```javascript
export const blind_structure_edit_title = () => `Blind-Struktur bearbeiten`
export const blind_structure_save_button = () => `Speichern`
export const blind_structure_edit_button = () => `Bearbeiten`
```

```javascript
export const prize_structure_edit_title = () => `Preisstruktur bearbeiten`
export const prize_structure_save_button = () => `Speichern`
export const prize_structure_edit_button = () => `Bearbeiten`
```

```javascript
export const tournament_edit_blind_structure = () => `Blind-Struktur bearbeiten`
export const tournament_edit_prize_structure = () => `Preisstruktur bearbeiten`
```

- [ ] **Step 3: Regenerate Paraglide output**

Run:
```bash
npm run build
```
Expected: build succeeds, Paraglide output updated

- [ ] **Step 4: Commit**

```bash
git add src/lib/paraglide/messages/
git commit -m "feat: add i18n strings for structure editing"
```

---

## Task 6: Global blind structures page — edit mode

**Files:**
- Modify: `src/routes/[club]/admin/blind-structures/+page.svelte`

Replace the existing levels editing table with `BlindStructureForm`. Add `editingId` state and Edit/Cancel buttons.

- [ ] **Step 1: Replace the script section**

Replace the entire `<script>` block (lines 1–116) with:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import BlindStructureForm from '$lib/components/BlindStructureForm.svelte';
  import type { LevelRow } from '$lib/components/BlindStructureForm.svelte';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        levels: { type?: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label?: string }[];
        in_use: boolean;
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let levels = $state<LevelRow[]>([
    { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
  ]);

  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let editingId = $state<string | null>(null);

  function startEdit(s: typeof data.structures[number]) {
    editingId = s.id;
    name = s.name;
    levels = s.levels.map((l) =>
      (l.type === 'break')
        ? { type: 'break' as const, duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
        : { type: 'level' as const, small_blind: String(l.small_blind), big_blind: String(l.big_blind), ante: String(l.ante), duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
    );
    errorKey = null;
    document.getElementById('bs-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    name = '';
    levels = [{ type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
    errorKey = null;
  }

  function parseLevels() {
    return levels.map((l) =>
      l.type === 'break'
        ? { type: 'break' as const, small_blind: 0, big_blind: 0, ante: 0, duration_minutes: Number(l.duration_minutes), label: l.label.trim() || 'Break' }
        : { type: 'level' as const, small_blind: Number(l.small_blind), big_blind: Number(l.big_blind), ante: Number(l.ante), duration_minutes: Number(l.duration_minutes), label: l.label.trim() }
    );
  }

  function validateLevels(parsed: ReturnType<typeof parseLevels>): boolean {
    for (const level of parsed) {
      if (level.duration_minutes <= 0) return false;
      if (level.type === 'level') {
        if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0) return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    if (loading) return;
    errorKey = null;
    if (!name.trim()) { errorKey = 'error_required'; return; }
    if (levels.length === 0) { errorKey = 'error_required'; return; }
    const parsedLevels = parseLevels();
    if (!validateLevels(parsedLevels)) { errorKey = 'error_required'; return; }

    loading = true;
    try {
      const supabase = createClient();
      if (editingId) {
        const { error } = await supabase
          .from('blind_structures')
          .update({ name: name.trim(), levels: parsedLevels })
          .eq('id', editingId)
          .eq('club_id', data.club.id);
        if (error) { errorKey = 'server_error'; return; }
      } else {
        const { error } = await supabase
          .from('blind_structures')
          .insert({ club_id: data.club.id, name: name.trim(), levels: parsedLevels });
        if (error) { errorKey = 'server_error'; return; }
      }
      cancelEdit();
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('blind_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>
```

- [ ] **Step 2: Update the list table to add Edit button and remove "in use" gate**

Replace the `<tbody>` section (currently lines 134–150) with:

```svelte
<tbody>
  {#each data.structures as s}
    <tr class="border-b border-border last:border-0">
      <td class="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
      <td class="px-4 py-3 text-xs text-muted-foreground">{s.levels.length}</td>
      <td class="px-4 py-3 text-right flex justify-end gap-3">
        <button type="button" onclick={() => startEdit(s)}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.blind_structure_edit_button()}
        </button>
        <button type="button" onclick={() => handleDelete(s.id)}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.common_delete()}
        </button>
      </td>
    </tr>
  {/each}
</tbody>
```

- [ ] **Step 3: Update the create/edit form**

Replace the form section (currently lines 155–255) with:

```svelte
<div id="bs-form" class="bg-card border border-border rounded-lg p-5">
  <h2 class="text-sm font-semibold text-foreground mb-4">
    {editingId ? m.blind_structure_edit_title() : m.blind_structure_new_title()}
  </h2>
  <div class="flex flex-col gap-4 max-w-lg">
    <div>
      <label for="bs-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.blind_structure_name_label()}
      </label>
      <input
        id="bs-name" type="text"
        bind:value={name}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    <BlindStructureForm bind:levels />

    {#if errorKey}
      <p class="text-xs text-accent">{resolveError(errorKey)}</p>
    {/if}

    <div class="flex gap-3">
      <button type="button" onclick={handleSubmit}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {editingId ? m.blind_structure_save_button() : m.blind_structure_create_button()}
      </button>
      {#if editingId}
        <button type="button" onclick={cancelEdit}
          class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.tournament_cancel_review()}
        </button>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/[club]/admin/blind-structures/+page.svelte
git commit -m "feat: add edit mode to blind structures page"
```

---

## Task 7: Global prize structures page — edit mode

**Files:**
- Modify: `src/routes/[club]/admin/prize-structures/+page.svelte`

Same pattern as Task 6 but for prize structures.

- [ ] **Step 1: Replace the script section**

Replace the entire `<script>` block (lines 1–91) with:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import { validatePayouts } from '$lib/tournaments';
  import PrizeStructureForm from '$lib/components/PrizeStructureForm.svelte';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        payouts: { position: number; percentage: number }[];
        in_use: boolean;
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function payoutSummary(payouts: { position: number; percentage: number }[]): string {
    return payouts
      .sort((a, b) => a.position - b.position)
      .map((p) => `${p.position}. ${p.percentage}%`)
      .join(', ');
  }

  let payouts = $state<{ position: number; percentage: string }[]>([{ position: 1, percentage: '' }]);
  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let editingId = $state<string | null>(null);

  function startEdit(s: typeof data.structures[number]) {
    editingId = s.id;
    name = s.name;
    payouts = s.payouts
      .sort((a, b) => a.position - b.position)
      .map((p, i) => ({ position: i + 1, percentage: String(p.percentage) }));
    errorKey = null;
    document.getElementById('ps-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    name = '';
    payouts = [{ position: 1, percentage: '' }];
    errorKey = null;
  }

  async function handleSubmit() {
    if (loading) return;
    errorKey = null;
    if (!name.trim()) { errorKey = 'error_required'; return; }
    if (payouts.length === 0) { errorKey = 'error_required'; return; }

    const parsedPayouts = payouts.map((p, i) => ({
      position: i + 1,
      percentage: Number(p.percentage),
    }));
    const validationError = validatePayouts(parsedPayouts);
    if (validationError) { errorKey = validationError; return; }

    loading = true;
    try {
      const supabase = createClient();
      if (editingId) {
        const { error } = await supabase
          .from('prize_structures')
          .update({ name: name.trim(), payouts: parsedPayouts })
          .eq('id', editingId)
          .eq('club_id', data.club.id);
        if (error) { errorKey = 'server_error'; return; }
      } else {
        const { error } = await supabase
          .from('prize_structures')
          .insert({ club_id: data.club.id, name: name.trim(), payouts: parsedPayouts });
        if (error) { errorKey = 'server_error'; return; }
      }
      cancelEdit();
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('prize_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>
```

- [ ] **Step 2: Update the list table — add Edit, remove "in use" gate**

Replace the `<tbody>` section (lines 110–128) with:

```svelte
<tbody>
  {#each data.structures as s}
    <tr class="border-b border-border last:border-0">
      <td class="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
      <td class="px-4 py-3 text-xs text-muted-foreground">{payoutSummary(s.payouts)}</td>
      <td class="px-4 py-3 text-right flex justify-end gap-3">
        <button type="button" onclick={() => startEdit(s)}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.prize_structure_edit_button()}
        </button>
        <button type="button" onclick={() => handleDelete(s.id)}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.common_delete()}
        </button>
      </td>
    </tr>
  {/each}
</tbody>
```

- [ ] **Step 3: Update the create/edit form**

Replace the form section (lines 130–193) with:

```svelte
<div id="ps-form" class="bg-card border border-border rounded-lg p-5">
  <h2 class="text-sm font-semibold text-foreground mb-4">
    {editingId ? m.prize_structure_edit_title() : m.prize_structure_new_title()}
  </h2>
  <div class="flex flex-col gap-4 max-w-lg">
    <div>
      <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.prize_structure_name_label()}
      </label>
      <input
        id="ps-name" type="text"
        bind:value={name}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    <PrizeStructureForm bind:payouts />

    {#if errorKey}
      <p class="text-xs text-accent">{resolveError(errorKey)}</p>
    {/if}

    <div class="flex gap-3">
      <button type="button" onclick={handleSubmit}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {editingId ? m.prize_structure_save_button() : m.prize_structure_create_button()}
      </button>
      {#if editingId}
        <button type="button" onclick={cancelEdit}
          class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.tournament_cancel_review()}
        </button>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/[club]/admin/prize-structures/+page.svelte
git commit -m "feat: add edit mode to prize structures page"
```

---

## Task 8: Copy structure data at tournament creation

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/new/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/new/+page.svelte`

The loader already fetches `id, name` for structures. We need the levels/payouts too so we can copy them into the insert.

- [ ] **Step 1: Update the loader to also fetch levels/payouts**

Replace `src/routes/[club]/admin/tournaments/new/+page.ts` with:

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    supabase.from('blind_structures').select('id, name, levels').eq('club_id', club.id).order('name'),
    supabase.from('prize_structures').select('id, name, payouts').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: (blindStructures ?? []) as { id: string; name: string; levels: unknown }[],
    prizeStructures: (prizeStructures ?? []) as { id: string; name: string; payouts: unknown }[],
  };
};
```

- [ ] **Step 2: Update the `handleCreate` function in `+page.svelte` to copy levels/payouts**

In `src/routes/[club]/admin/tournaments/new/+page.svelte`, find the `handleCreate` function. The current validation block for blind/prize structures (lines 222–230) does an extra Supabase query to check the structure exists. Replace those two `if` blocks and the tournament insert (lines 222–253) with:

```typescript
const selectedBlind = blindStructureId
  ? data.blindStructures.find((bs) => bs.id === blindStructureId) ?? null
  : null;
const selectedPrize = prizeStructureId
  ? data.prizeStructures.find((ps) => ps.id === prizeStructureId) ?? null
  : null;

const supabase = createClient();
const { data: tournament, error } = await supabase
  .from('tournaments')
  .insert({
    club_id: data.club.id,
    name,
    date,
    format: formatVal,
    buy_in_amount: buyIn,
    rebuy_amount: rebuyAmount,
    addon_amount: addonAmount,
    buy_in_rake: buyInRake,
    rebuy_rake: rebuyRake,
    addon_rake: addonRake,
    buy_in_chips: buyInChips,
    rebuy_chips: rebuyChips,
    addon_chips: addonChips,
    blind_structure_id: blindStructureId || null,
    prize_structure_id: prizeStructureId || null,
    blind_levels: selectedBlind ? selectedBlind.levels : null,
    prize_payouts: selectedPrize ? selectedPrize.payouts : null,
    status: 'registration',
  })
  .select('id')
  .single();
```

Note: remove the old `const supabase = createClient();` line that was above the old validation blocks (it moves here).

- [ ] **Step 3: Also update the inline blind structure creation modal**

In the same file, `handleCreateBlind` currently does not return levels in the `select`. After inserting, we need to add the created structure's levels to the local `blindStructures` list so selecting it immediately copies correctly. Update the select in `handleCreateBlind` (line 74) from:

```typescript
.select('id, name')
```
to:
```typescript
.select('id, name, levels')
```

And update the type of `blindStructures` state accordingly — the elements now have `levels: unknown`. The existing push `blindStructures = [...blindStructures, created]` will carry the levels through.

Do the same for `handleCreatePrize` — change `.select('id, name')` to `.select('id, name, payouts')`.

- [ ] **Step 4: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/[club]/admin/tournaments/new/
git commit -m "feat: copy blind/prize structure data into tournament at creation"
```

---

## Task 9: Tournament detail — edit blind/prize structure via modal

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Update the tournament detail loader to include `blind_levels` and `prize_payouts`**

In `src/routes/[club]/admin/tournaments/[id]/+page.ts`, change the tournament select (line 9) from:

```typescript
.select('*, blind_structures(name, levels), prize_structures(name, payouts)')
```

to:

```typescript
.select('*, blind_structures(name, levels), prize_structures(name, payouts), blind_levels, prize_payouts')
```

Then update the `prizeStructure` derivation (line 63) to prefer the tournament's own copy:

```typescript
const prizeStructure = tournament.prize_payouts
  ? { payouts: tournament.prize_payouts as { position: number; percentage: number }[] }
  : tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;
```

And update the return to include both new fields:

```typescript
return {
  tournament,
  players: allPlayers,
  availableMembers,
  prizePool,
  totalRake,
  prizeStructure,
  tables: tables ?? [],
  prizeStructures: prizeStructures ?? [],
  blindStructures: blindStructures ?? [],
};
```

(No change needed to the return — `tournament` already contains the new fields since the select now includes them.)

- [ ] **Step 2: Add import and modal state to `+page.svelte`**

In `src/routes/[club]/admin/tournaments/[id]/+page.svelte`, add to the existing imports at the top of the `<script>` block:

```typescript
import BlindStructureForm from '$lib/components/BlindStructureForm.svelte';
import PrizeStructureForm from '$lib/components/PrizeStructureForm.svelte';
import { DialogContent } from '$lib/components/ui/dialog/index.js';
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { LevelRow } from '$lib/components/BlindStructureForm.svelte';
```

Add these state variables near the other modal state variables (`showReview`, `showEditModal`, etc.):

```typescript
// Structure edit modal state
let showBlindEditModal = $state(false);
let blindEditLevels = $state<LevelRow[]>([]);
let blindEditLoading = $state(false);
let blindEditError = $state<string | null>(null);

let showPrizeEditModal = $state(false);
let prizeEditPayouts = $state<{ position: number; percentage: string }[]>([]);
let prizeEditLoading = $state(false);
let prizeEditError = $state<string | null>(null);
```

- [ ] **Step 3: Add derived values and handlers**

Update the existing `blindLevels` derived (currently line 102) to prefer the tournament's own copy:

```typescript
const blindLevels = $derived(
  ((t.blind_levels ?? t.blind_structures?.levels ?? []) as unknown as BlindLevel[])
);
```

Add handler functions (add near the other handler functions in the script):

```typescript
function openBlindEditModal() {
  const raw = (t.blind_levels ?? t.blind_structures?.levels ?? []) as {
    type?: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label?: string
  }[];
  blindEditLevels = raw.map((l) =>
    (l.type === 'break')
      ? { type: 'break' as const, duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
      : { type: 'level' as const, small_blind: String(l.small_blind), big_blind: String(l.big_blind), ante: String(l.ante), duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
  );
  blindEditError = null;
  showBlindEditModal = true;
}

async function saveBlindLevels() {
  if (blindEditLoading) return;
  blindEditError = null;
  const parsed = blindEditLevels.map((l) =>
    l.type === 'break'
      ? { type: 'break' as const, small_blind: 0, big_blind: 0, ante: 0, duration_minutes: Number(l.duration_minutes), label: l.label.trim() || 'Break' }
      : { type: 'level' as const, small_blind: Number(l.small_blind), big_blind: Number(l.big_blind), ante: Number(l.ante), duration_minutes: Number(l.duration_minutes), label: l.label.trim() }
  );
  for (const level of parsed) {
    if (level.duration_minutes <= 0) { blindEditError = 'error_required'; return; }
    if (level.type === 'level' && (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0)) {
      blindEditError = 'error_required'; return;
    }
  }
  blindEditLoading = true;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ blind_levels: parsed })
      .eq('id', t.id);
    if (error) { blindEditError = 'server_error'; return; }
    showBlindEditModal = false;
    await invalidateAll();
  } finally {
    blindEditLoading = false;
  }
}

function openPrizeEditModal() {
  const raw = (t.prize_payouts ?? t.prize_structures?.payouts ?? []) as { position: number; percentage: number }[];
  prizeEditPayouts = raw
    .sort((a, b) => a.position - b.position)
    .map((p, i) => ({ position: i + 1, percentage: String(p.percentage) }));
  prizeEditError = null;
  showPrizeEditModal = true;
}

async function savePrizePayouts() {
  if (prizeEditLoading) return;
  prizeEditError = null;
  const parsed = prizeEditPayouts.map((p, i) => ({ position: i + 1, percentage: Number(p.percentage) }));
  const validationError = validatePayouts(parsed);
  if (validationError) { prizeEditError = validationError; return; }
  prizeEditLoading = true;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ prize_payouts: parsed })
      .eq('id', t.id);
    if (error) { prizeEditError = 'server_error'; return; }
    showPrizeEditModal = false;
    await invalidateAll();
  } finally {
    prizeEditLoading = false;
  }
}
```

Note: `validatePayouts` is already imported from `$lib/tournaments` in this file.

- [ ] **Step 4: Add edit buttons and modals to the template**

Find where the tournament's blind/prize structure names are displayed in the meta line area. Add edit buttons and dialog modals after the main tournament detail card. Insert this block somewhere visible in the tournament's settings/info section (search for `blind_structures` or `metaLine` in the template to find the right location):

```svelte
<!-- Blind structure edit -->
{#if t.blind_levels || t.blind_structures}
  <button type="button" onclick={openBlindEditModal}
    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
    {m.tournament_edit_blind_structure()}
  </button>
{/if}

<!-- Prize structure edit -->
{#if t.prize_payouts || t.prize_structures}
  <button type="button" onclick={openPrizeEditModal}
    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
    {m.tournament_edit_prize_structure()}
  </button>
{/if}

<!-- Blind structure edit modal -->
<DialogPrimitive.Root bind:open={showBlindEditModal}>
  <DialogContent>
    <h2 class="text-base font-semibold text-foreground">{m.blind_structure_edit_title()}</h2>
    <BlindStructureForm bind:levels={blindEditLevels} />
    {#if blindEditError}
      <p class="text-xs text-accent">{resolveError(blindEditError)}</p>
    {/if}
    <div class="flex gap-3">
      <button type="button" onclick={saveBlindLevels} disabled={blindEditLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.blind_structure_save_button()}
      </button>
      <button type="button" onclick={() => { showBlindEditModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </DialogContent>
</DialogPrimitive.Root>

<!-- Prize structure edit modal -->
<DialogPrimitive.Root bind:open={showPrizeEditModal}>
  <DialogContent>
    <h2 class="text-base font-semibold text-foreground">{m.prize_structure_edit_title()}</h2>
    <PrizeStructureForm bind:payouts={prizeEditPayouts} />
    {#if prizeEditError}
      <p class="text-xs text-accent">{resolveError(prizeEditError)}</p>
    {/if}
    <div class="flex gap-3">
      <button type="button" onclick={savePrizePayouts} disabled={prizeEditLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.prize_structure_save_button()}
      </button>
      <button type="button" onclick={() => { showPrizeEditModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </DialogContent>
</DialogPrimitive.Root>
```

- [ ] **Step 5: Verify build**

Run:
```bash
npm run check
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/
git commit -m "feat: add blind/prize structure edit modals to tournament detail page"
```

---

## Task 10: Manual smoke test

There are no pure-logic unit tests to write here (all changes are UI and DB). Manually verify:

- [ ] **Global blind structures page:**
  - Can create a new blind structure (create form still works)
  - Can edit an existing structure (edit mode pre-fills correctly, saves correctly)
  - Can delete any structure including previously "in use" ones
  - Cancel in edit mode resets form to create mode

- [ ] **Global prize structures page:**
  - Same checks as above for prize structures

- [ ] **New tournament:**
  - Create a tournament with a blind structure selected → confirm `blind_levels` is populated in Supabase
  - Create a tournament with no structure → confirm `blind_levels` is null

- [ ] **Tournament detail:**
  - Open "Edit blind structure" modal → levels pre-fill correctly
  - Edit a level value, save → `blind_levels` column updated in DB, global template unchanged
  - Open "Edit prize structure" modal → payouts pre-fill correctly
  - Edit and save → `prize_payouts` updated, global template unchanged
  - Works for `registration`, `running`, and `finished` status tournaments

- [ ] **Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: smoke test corrections"
```
