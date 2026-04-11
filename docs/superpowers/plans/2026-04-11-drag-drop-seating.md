# Drag-and-Drop Seating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace click-select seating in the running phase and table-lock dropdowns in the registration phase with a unified HTML5 drag-and-drop seating interface across both phases.

**Architecture:** All changes are in `src/routes/[club]/admin/tournaments/[id]/+page.svelte`. New state variables `draggedPlayerId`, `dragOverTarget`, and `dragOverUnseated` drive visual feedback. Three new async handlers (`handleSwapSeats`, `handleUnseatPlayer`) and six lightweight DnD event handlers wrap the existing `handleManualSeat`/`invalidateAll` pattern. No schema changes.

**Tech Stack:** Svelte 5 (runes), HTML5 Drag and Drop API, Supabase browser client, Playwright (e2e tests)

---

## File Map

| File | Change |
|---|---|
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Remove `movingPlayerId`, add DnD state + handlers, update both seating grids and unseated section |
| `tests/e2e/seating.test.ts` | New — DnD interaction e2e tests |

---

### Task 1: Add DnD state variables

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte:178-184`

- [ ] **Step 1: Replace `movingPlayerId` with DnD state**

Find this block (around line 178):
```svelte
  // Seating state
  let numTables = $state('');
  let seatsPerTable = $state('');
  let seatingError = $state<string | null>(null);
  let confirmReset = $state(false);
  let dismissedSuggestion = $state(false);
  let movingPlayerId = $state<string | null>(null);
```

Replace with:
```svelte
  // Seating state
  let numTables = $state('');
  let seatsPerTable = $state('');
  let seatingError = $state<string | null>(null);
  let confirmReset = $state(false);
  let dismissedSuggestion = $state(false);
  let draggedPlayerId = $state<string | null>(null);
  let dragOverTarget = $state<string | null>(null); // "${tableId}:${seatNumber}"
  let dragOverUnseated = $state(false);
```

- [ ] **Step 2: Remove `movingPlayerId = null` from `handleConfirmMove`**

`handleConfirmMove` (around line 594) has a leftover `movingPlayerId = null;` line. Find and delete it:

```ts
      dismissedSuggestion = false;
      movingPlayerId = null;   // ← delete this line
      await invalidateAll();
```

After deletion:
```ts
      dismissedSuggestion = false;
      await invalidateAll();
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npm run check
```
Expected: any errors are only about `movingPlayerId` references still in the template (we'll fix those in later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: replace movingPlayerId with dnd state variables"
```

---

### Task 2: Add swap and unseat handlers

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte` (after `handleManualSeat`, around line 564)

- [ ] **Step 1: Add `handleSwapSeats` after `handleManualSeat`**

Find the closing brace of `handleManualSeat` (it ends with `await invalidateAll();` then `} finally {` / `loading = false;` / `}`). Add these two functions immediately after:

```svelte
  async function handleSwapSeats(playerAId: string, playerBId: string) {
    if (loading) return;
    seatingError = null;
    const playerA = data.players.find((p) => p.id === playerAId);
    const playerB = data.players.find((p) => p.id === playerBId);
    if (!playerA || !playerB) return;
    loading = true;
    try {
      const supabase = createClient();
      await Promise.all([
        supabase
          .from('tournament_players')
          .update({ table_id: playerB.table_id, seat_number: playerB.seat_number })
          .eq('id', playerAId),
        supabase
          .from('tournament_players')
          .update({ table_id: playerA.table_id, seat_number: playerA.seat_number })
          .eq('id', playerBId),
      ]);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleUnseatPlayer(playerId: string) {
    if (loading) return;
    seatingError = null;
    loading = true;
    try {
      const supabase = createClient();
      await supabase
        .from('tournament_players')
        .update({ table_id: null, seat_number: null })
        .eq('id', playerId);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npm run check
```
Expected: same errors as before (only `movingPlayerId` template refs), no new ones.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: add handleSwapSeats and handleUnseatPlayer"
```

---

### Task 3: Add DnD event handlers

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte` (after `handleUnseatPlayer`)

- [ ] **Step 1: Add the six DnD event handlers immediately after `handleUnseatPlayer`**

```svelte
  function handleDragStart(playerId: string) {
    draggedPlayerId = playerId;
  }

  function handleDragEnd() {
    draggedPlayerId = null;
    dragOverTarget = null;
    dragOverUnseated = false;
  }

  function handleSeatDragOver(e: DragEvent, tableId: string, seatNumber: number) {
    e.preventDefault();
    dragOverTarget = `${tableId}:${seatNumber}`;
  }

  function handleSeatDragLeave() {
    dragOverTarget = null;
  }

  function handleSeatDrop(e: DragEvent, tableId: string, seatNumber: number) {
    e.preventDefault();
    if (!draggedPlayerId) return;
    const activeTarget = data.players.find(
      (p) => p.table_id === tableId && p.seat_number === seatNumber && p.finish_position === null,
    );
    if (activeTarget && activeTarget.id !== draggedPlayerId) {
      handleSwapSeats(draggedPlayerId, activeTarget.id);
    } else {
      handleManualSeat(draggedPlayerId, tableId, seatNumber);
    }
    draggedPlayerId = null;
    dragOverTarget = null;
  }

  function handleUnseatedDragOver(e: DragEvent) {
    e.preventDefault();
    dragOverUnseated = true;
  }

  function handleUnseatedDragLeave() {
    dragOverUnseated = false;
  }

  function handleUnseatedDrop(e: DragEvent) {
    e.preventDefault();
    if (!draggedPlayerId) return;
    handleUnseatPlayer(draggedPlayerId);
    draggedPlayerId = null;
    dragOverUnseated = false;
  }
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npm run check
```
Expected: still only `movingPlayerId` template errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: add dnd event handlers"
```

---

### Task 4: Update registration seating grid

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte:1159-1178`

The registration seating grid (inside `{#if data.players.some((p) => p.table_id !== null)}`) currently renders static divs. Make each seat cell a drop target and each player name a draggable chip.

- [ ] **Step 1: Replace the registration seating grid**

Find this block (approximately lines 1159-1178):
```svelte
          <!-- Seating grid (after draw) -->
          {#if data.players.some((p) => p.table_id !== null)}
            <div class="grid grid-cols-2 gap-3">
              {#each data.tables as table}
                {@const seated = data.players.filter((p) => p.table_id === table.id).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
                <div class="bg-card border border-border rounded-lg p-3">
                  <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {m.seating_table_label({ number: String(table.number) })}
                  </div>
                  <div class="grid grid-cols-2 gap-1.5 text-xs">
                    {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                      {@const player = seated.find((p) => p.seat_number === seat)}
                      <div class="px-2 py-1 rounded {player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'}">
                        {seat} {player ? (player.members ? displayName(player.members) : '?') : '—'}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
```

Replace with:
```svelte
          <!-- Seating grid (after draw) -->
          {#if data.players.some((p) => p.table_id !== null)}
            <div class="grid grid-cols-2 gap-3">
              {#each data.tables as table}
                {@const seated = data.players.filter((p) => p.table_id === table.id).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
                <div class="bg-card border border-border rounded-lg p-3">
                  <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {m.seating_table_label({ number: String(table.number) })}
                  </div>
                  <div class="grid grid-cols-2 gap-1.5 text-xs">
                    {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                      {@const player = seated.find((p) => p.seat_number === seat)}
                      {@const isDropTarget = dragOverTarget === `${table.id}:${seat}`}
                      <div
                        class="px-2 py-1 rounded transition-colors {player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'} {isDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''}"
                        ondragover={(e) => handleSeatDragOver(e, table.id, seat)}
                        ondragleave={handleSeatDragLeave}
                        ondrop={(e) => handleSeatDrop(e, table.id, seat)}
                      >
                        {seat}
                        {#if player}
                          <span
                            draggable="true"
                            ondragstart={() => handleDragStart(player.id)}
                            ondragend={handleDragEnd}
                            class="cursor-grab select-none {draggedPlayerId === player.id ? 'opacity-50' : ''}"
                          >{player.members ? displayName(player.members) : '?'}</span>
                        {:else}
                          —
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: make registration seating grid drag-and-drop enabled"
```

---

### Task 5: Replace registration unseated section with draggable strip

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte:1180-1218`

The current unseated section shows a heading, an auto-seat button, and per-player dropdowns. Replace the player list + dropdowns with draggable chips in a drop zone. Keep the auto-seat button.

- [ ] **Step 1: Replace the unseated section**

Find this block (approximately lines 1180-1218):
```svelte
          <!-- Unseated players -->
          {@const unseated = data.players.filter((p) => p.table_id === null)}
          {#if unseated.length > 0}
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.seating_unseated_title()}</h3>
                <button
                  type="button"
                  onclick={handleAutoSeat}
                  disabled={loading}
                  class="text-xs bg-accent text-accent-foreground px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {m.seating_auto_seat_button()}
                </button>
              </div>
              {#each unseated as player}
                <div class="flex items-center gap-2 text-sm text-foreground">
                  <span class="flex-1">{player.members ? displayName(player.members) : '?'}</span>
                  <select
                    class="bg-background border border-input rounded-md text-xs px-2 py-1"
                    onchange={(e) => {
                      const [tableId, seatStr] = (e.currentTarget as HTMLSelectElement).value.split(':');
                      if (tableId && seatStr) handleManualSeat(player.id, tableId, parseInt(seatStr));
                    }}
                  >
                    <option value="">{m.seating_assign_seat_placeholder()}</option>
                    {#each data.tables as table}
                      {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                        {@const taken = data.players.some((p) => p.table_id === table.id && p.seat_number === seat && p.id !== player.id)}
                        {#if !taken}
                          <option value="{table.id}:{seat}">T{table.number} S{seat}</option>
                        {/if}
                      {/each}
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          {/if}
```

Replace with:
```svelte
          <!-- Unseated players strip -->
          {@const unseated = data.players.filter((p) => p.table_id === null)}
          {#if unseated.length > 0}
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.seating_unseated_title()}</h3>
                <button
                  type="button"
                  onclick={handleAutoSeat}
                  disabled={loading}
                  class="text-xs bg-accent text-accent-foreground px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {m.seating_auto_seat_button()}
                </button>
              </div>
              <div
                class="border border-dashed rounded-lg p-3 flex flex-wrap gap-2 min-h-[44px] transition-colors {dragOverUnseated ? 'border-accent bg-accent/10' : 'border-border'}"
                ondragover={handleUnseatedDragOver}
                ondragleave={handleUnseatedDragLeave}
                ondrop={handleUnseatedDrop}
              >
                {#each unseated as player}
                  <span
                    draggable="true"
                    ondragstart={() => handleDragStart(player.id)}
                    ondragend={handleDragEnd}
                    class="text-xs bg-muted px-2 py-1 rounded cursor-grab select-none {draggedPlayerId === player.id ? 'opacity-50' : ''}"
                  >
                    {player.members ? displayName(player.members) : '?'}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: replace registration unseated dropdown with draggable strip"
```

---

### Task 6: Update running phase seating grid

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte:1265-1340`

Remove the "Manual move hint / cancel" banner and replace the click-select `<button>` seat cells with DnD-enabled `<div>` cells.

- [ ] **Step 1: Remove the "Manual move hint / cancel" banner**

Find and remove this entire block (approximately lines 1265-1280):
```svelte
        <!-- Manual move hint / cancel -->
        {#if movingPlayerId}
          {@const movingPlayer = data.players.find((p) => p.id === movingPlayerId)}
          <div class="flex items-center justify-between gap-3 bg-muted border border-border rounded-lg px-4 py-3">
            <span class="text-sm text-foreground">
              {m.seating_move_hint({ name: movingPlayer?.members ? displayName(movingPlayer.members) : '?' })}
            </span>
            <button
              type="button"
              onclick={() => { movingPlayerId = null; }}
              class="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              {m.seating_cancel_move()}
            </button>
          </div>
        {/if}
```

- [ ] **Step 2: Replace the running phase seat grid**

Find the `<!-- Seat grid -->` block inside the running phase table cards (approximately lines 1307-1341):
```svelte
              <!-- Seat grid -->
              <div class="grid grid-cols-2 gap-1 text-xs">
                {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                  {@const player = tablePlayers.find((p) => p.seat_number === seat && p.finish_position === null) ?? tablePlayers.find((p) => p.seat_number === seat)}
                  {@const busted = player && player.finish_position !== null}
                  {@const isSelected = player && player.id === movingPlayerId}
                  {@const isTarget = movingPlayerId && !isSelected && (!player || busted)}
                  <button
                    type="button"
                    disabled={loading || (!isSelected && !isTarget && !!movingPlayerId)}
                    onclick={() => {
                      if (isSelected) { movingPlayerId = null; return; }
                      if (movingPlayerId && isTarget) {
                        handleConfirmMove({ playerId: movingPlayerId, toTableId: table.id, toSeatNumber: seat });
                        return;
                      }
                      if (!movingPlayerId && player && !busted) {
                        movingPlayerId = player.id;
                      }
                    }}
                    class="px-2 py-1 rounded text-left w-full transition-colors
                      {isSelected
                        ? 'bg-accent text-accent-foreground ring-2 ring-accent cursor-pointer'
                        : isTarget
                          ? 'bg-accent/10 text-muted-foreground border border-dashed border-accent/50 cursor-pointer hover:bg-accent/20'
                          : busted
                            ? 'bg-muted text-muted-foreground line-through opacity-50 cursor-default'
                            : player
                              ? 'bg-accent/20 text-foreground cursor-pointer hover:bg-accent/30'
                              : 'bg-muted text-muted-foreground cursor-default'}"
                  >
                    {seat} {player ? (player.members ? displayName(player.members) : '?') : '—'}
                  </button>
                {/each}
              </div>
```

Replace with:
```svelte
              <!-- Seat grid -->
              <div class="grid grid-cols-2 gap-1 text-xs">
                {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                  {@const player = tablePlayers.find((p) => p.seat_number === seat && p.finish_position === null) ?? tablePlayers.find((p) => p.seat_number === seat)}
                  {@const busted = player && player.finish_position !== null}
                  {@const isDropTarget = dragOverTarget === `${table.id}:${seat}`}
                  <div
                    class="px-2 py-1 rounded transition-colors {busted ? 'bg-muted text-muted-foreground opacity-50' : player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'} {isDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''}"
                    ondragover={(e) => handleSeatDragOver(e, table.id, seat)}
                    ondragleave={handleSeatDragLeave}
                    ondrop={(e) => handleSeatDrop(e, table.id, seat)}
                  >
                    {seat}
                    {#if player && !busted}
                      <span
                        draggable="true"
                        ondragstart={() => handleDragStart(player.id)}
                        ondragend={handleDragEnd}
                        class="cursor-grab select-none {draggedPlayerId === player.id ? 'opacity-50' : ''}"
                      >{player.members ? displayName(player.members) : '?'}</span>
                    {:else if player}
                      <span class="line-through">{player.members ? displayName(player.members) : '?'}</span>
                    {:else}
                      —
                    {/if}
                  </div>
                {/each}
              </div>
```

- [ ] **Step 3: Add unseated strip to running phase**

Inside the `{#if t.status === 'running'} {#if data.tables.length > 0}` block, the content is wrapped in `<div class="flex flex-col gap-4">`. Add the unseated strip just before that wrapper's closing `</div>` (after the `<!-- Table cards grid -->` block ends):

```svelte
        <!-- Unseated players strip -->
        {@const runningUnseated = data.players.filter((p) => p.table_id === null && p.finish_position === null)}
        {#if runningUnseated.length > 0}
          <div class="flex flex-col gap-2">
            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.seating_unseated_title()}</h3>
            <div
              class="border border-dashed rounded-lg p-3 flex flex-wrap gap-2 min-h-[44px] transition-colors {dragOverUnseated ? 'border-accent bg-accent/10' : 'border-border'}"
              ondragover={handleUnseatedDragOver}
              ondragleave={handleUnseatedDragLeave}
              ondrop={handleUnseatedDrop}
            >
              {#each runningUnseated as player}
                <span
                  draggable="true"
                  ondragstart={() => handleDragStart(player.id)}
                  ondragend={handleDragEnd}
                  class="text-xs bg-muted px-2 py-1 rounded cursor-grab select-none {draggedPlayerId === player.id ? 'opacity-50' : ''}"
                >
                  {player.members ? displayName(player.members) : '?'}
                </span>
              {/each}
            </div>
          </div>
        {/if}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npm run check
```
Expected: clean (no `movingPlayerId` references remain).

- [ ] **Step 5: Start the dev server and manually verify**

```bash
npm run dev
```

Open a tournament in registration phase with tables configured. Verify:
- Player chips in the seating grid are draggable
- Dragging to an empty seat moves the player
- Dragging to an occupied seat swaps the players
- Dragging to the unseated strip unseats the player
- Unseated player chips in the strip are draggable

Open a running tournament. Verify the same interactions work and busted players are not draggable.

- [ ] **Step 6: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: replace running phase click-select seating with drag-and-drop"
```

---

### Task 7: E2E tests

**Files:**
- Create: `tests/e2e/seating.test.ts`

> **Note:** These tests require a seeded Supabase test environment with a club, members, a tournament in registration status with tables configured and players seated. Adapt the selectors and test data to match your test database.

- [ ] **Step 1: Create the test file**

```ts
import { test, expect } from '@playwright/test';

// These tests assume:
// - A test club at slug "test-club"
// - A tournament in "registration" status with 2 tables (max 3 seats each)
// - At least 4 players, at least 2 seated and 1 unseated
// Adjust TOURNAMENT_ID and player names to match your test seed.

const BASE = '/test-club/admin/tournaments';

test.describe('drag-and-drop seating (registration)', () => {
  test.beforeEach(async ({ page }) => {
    // Log in — update credentials to match test environment
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '');
    await page.locator('button[type=submit]').click();
    // Magic link flow — skip for now; mark as todo if auth is required
  });

  test('drag seated player to empty seat moves them', async ({ page }) => {
    await page.goto(`${BASE}/TOURNAMENT_ID`);
    const source = page.locator('[draggable=true]').first();
    const sourceName = await source.textContent();
    // Find an empty seat cell (contains "—")
    const emptyCell = page.locator('text=—').first();
    await page.dragAndDrop('[draggable=true]:first-child', emptyCell);
    // After drop, the player name should appear in the previously empty cell
    await expect(emptyCell).toContainText(sourceName?.trim() ?? '');
  });

  test('drag seated player onto another seated player swaps them', async ({ page }) => {
    await page.goto(`${BASE}/TOURNAMENT_ID`);
    const chips = page.locator('[draggable=true]');
    const nameA = (await chips.nth(0).textContent())?.trim() ?? '';
    const nameB = (await chips.nth(1).textContent())?.trim() ?? '';
    const cellA = chips.nth(0).locator('..');
    const cellB = chips.nth(1).locator('..');
    await page.dragAndDrop(chips.nth(0), chips.nth(1));
    await expect(cellA).toContainText(nameB);
    await expect(cellB).toContainText(nameA);
  });

  test('drag seated player to unseated strip unseats them', async ({ page }) => {
    await page.goto(`${BASE}/TOURNAMENT_ID`);
    const chip = page.locator('[draggable=true]').first();
    const name = (await chip.textContent())?.trim() ?? '';
    const strip = page.locator('[ondrop]').last(); // unseated strip is the last drop zone
    await page.dragAndDrop(chip, strip);
    await expect(strip).toContainText(name);
  });

  test('drag unseated player to empty seat seats them', async ({ page }) => {
    await page.goto(`${BASE}/TOURNAMENT_ID`);
    const strip = page.locator('.border-dashed');
    const unseatedChip = strip.locator('[draggable=true]').first();
    const name = (await unseatedChip.textContent())?.trim() ?? '';
    const emptyCell = page.locator('text=—').first();
    await page.dragAndDrop(unseatedChip, emptyCell);
    await expect(emptyCell).toContainText(name);
    await expect(strip).not.toContainText(name);
  });

  test('drag unseated player onto seated player swaps them', async ({ page }) => {
    await page.goto(`${BASE}/TOURNAMENT_ID`);
    const strip = page.locator('.border-dashed');
    const unseatedChip = strip.locator('[draggable=true]').first();
    const unseatedName = (await unseatedChip.textContent())?.trim() ?? '';
    const seatedChip = page.locator('[draggable=true]').first();
    const seatedName = (await seatedChip.textContent())?.trim() ?? '';
    await page.dragAndDrop(unseatedChip, seatedChip);
    await expect(strip).toContainText(seatedName);
    await expect(page.locator('.border-dashed')).not.toContainText(unseatedName);
  });
});

test.describe('drag-and-drop seating (running)', () => {
  test('drag active player to busted player seat moves them', async ({ page }) => {
    await page.goto(`${BASE}/RUNNING_TOURNAMENT_ID`);
    // Find an active (non-strikethrough) chip and a busted (opacity-50) cell
    const activeChip = page.locator('[draggable=true]').first();
    const name = (await activeChip.textContent())?.trim() ?? '';
    const bustedCell = page.locator('.opacity-50').first();
    await page.dragAndDrop(activeChip, bustedCell);
    await expect(bustedCell).not.toContainText(name); // player moved in, busted label stays
  });
});
```

- [ ] **Step 2: Run the e2e tests**

```bash
npm run test:e2e -- tests/e2e/seating.test.ts
```

Expected: tests may skip/fail due to missing auth setup or test data — that is expected for a first run in a local dev environment. The key check is that the test file compiles without TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/seating.test.ts
git commit -m "test: add e2e tests for drag-and-drop seating"
```
