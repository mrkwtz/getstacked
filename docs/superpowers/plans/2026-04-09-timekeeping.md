# Timekeeping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a synchronized tournament clock derived from the blind structure, with a timer strip on the admin page and a dedicated full-screen clock page.

**Architecture:** Timer state is stored as immutable timestamps (`started_at`, `pauses[]`, `skip_ms`) in a new `timer_state` JSONB column on `tournaments`. Any client can derive the current level, remaining time, and all displayed values from these timestamps — no client needs to be open for level advancement. A 1-second local interval drives the display; a 5-second `invalidateAll()` poll syncs control changes from other devices.

**Tech Stack:** SvelteKit + Svelte 5 runes, Supabase (browser client), TypeScript, Paraglide JS (i18n), Tailwind CSS v4, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/timer.ts` | Create | Pure timer computation functions |
| `tests/unit/timer.test.ts` | Create | Unit tests for timer logic |
| `src/lib/types.ts` | Modify | Add `TimerState`, update `BlindLevel`, update `Tournament` |
| `messages/en.json` | Modify | Add timer/clock/break i18n keys |
| `messages/de.json` | Modify | German translations for same keys |
| `src/routes/[club]/admin/blind-structures/+page.svelte` | Modify | Break row UI |
| `src/routes/[club]/admin/tournaments/[id]/+page.ts` | Modify | Load blind levels + timer_state |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Modify | Timer strip + updated start handler |
| `src/routes/[club]/admin/tournaments/[id]/clock/+page.ts` | Create | Clock page data loader |
| `src/routes/[club]/admin/tournaments/[id]/clock/+page.svelte` | Create | Full-screen clock UI |

---

## Task 1: DB Migration

**Files:**
- Modify: Supabase dashboard SQL editor (not a repo file)
- Modify: `src/lib/types.ts` — add `timer_state` to the auto-generated `tournaments` row type

- [ ] **Step 1: Run the migration in Supabase dashboard**

Open your project's SQL editor and run:

```sql
ALTER TABLE tournaments ADD COLUMN timer_state jsonb;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add timer_state column migration and type stub"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts:569-618`

- [ ] **Step 1: Update `BlindLevel` interface**

Replace the existing `BlindLevel` interface (around line 569):

```ts
// Before:
export interface BlindLevel {
  small_blind: number;
  big_blind: number;
  ante: number;
  duration_minutes: number;
}

// After:
export interface BlindLevel {
  type?: 'level' | 'break'; // omitted means 'level' (backwards-compatible)
  small_blind: number;       // 0 for breaks
  big_blind: number;         // 0 for breaks
  ante: number;              // 0 for breaks
  duration_minutes: number;
  label?: string;            // optional name, e.g. "Dinner Break"
}
```

- [ ] **Step 2: Add `TimerState` interface**

Add this after the `BlindLevel` interface:

```ts
export interface TimerState {
  started_at: string;
  pauses: Array<{
    paused_at: string;
    resumed_at: string | null;
  }>;
  skip_ms: number;
}
```

- [ ] **Step 3: Update the `Tournament` manual interface**

The `Tournament` interface (around line 597) has `blind_structures?: { name: string } | null`. Update it to include levels and add `timer_state`:

```ts
// Before:
blind_structures?: { name: string } | null;
prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;

// After:
blind_structures?: { name: string; levels: BlindLevel[] } | null;
prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;
timer_state?: TimerState | null;
```

- [ ] **Step 4: Run type check**

```bash
npm run check
```

Expected: no new errors (the `timer_state` import in the generated types section is fine as a forward reference — if it causes issues, move the `TimerState` definition above the `Database` type block instead and remove the import syntax).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: update BlindLevel and Tournament types for timekeeping"
```

---

## Task 3: Write Failing Timer Tests

**Files:**
- Create: `tests/unit/timer.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from 'vitest';
import {
  computeEffectiveElapsedMs,
  computeCurrentLevelIndex,
  computeRemainingMs,
  computePlaytimeMs,
  computeTimeUntilNextBreakMs,
  isTimerPaused,
  startTimer,
  pauseTimer,
  resumeTimer,
  skipLevel,
} from '$lib/timer';
import type { BlindLevel, TimerState } from '$lib/types';

const t0 = new Date('2026-01-01T12:00:00.000Z');
const t5m = new Date('2026-01-01T12:05:00.000Z');   // 5 min after start
const t20m = new Date('2026-01-01T12:20:00.000Z');  // 20 min after start
const t25m = new Date('2026-01-01T12:25:00.000Z');  // 25 min after start
const t45m = new Date('2026-01-01T12:45:00.000Z');  // 45 min after start

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    started_at: t0.toISOString(),
    pauses: [],
    skip_ms: 0,
    ...overrides,
  };
}

const levels: BlindLevel[] = [
  { duration_minutes: 20, small_blind: 25, big_blind: 50, ante: 0 },           // L1: 0–20 min
  { duration_minutes: 20, small_blind: 50, big_blind: 100, ante: 0 },          // L2: 20–40 min
  { type: 'break', duration_minutes: 15, small_blind: 0, big_blind: 0, ante: 0, label: 'Dinner' }, // B: 40–55 min
  { duration_minutes: 20, small_blind: 75, big_blind: 150, ante: 25 },         // L3: 55–75 min
];

// ─── computeEffectiveElapsedMs ─────────────────────────────────────────────

describe('computeEffectiveElapsedMs', () => {
  it('returns 0 at start', () => {
    expect(computeEffectiveElapsedMs(makeState(), t0)).toBe(0);
  });

  it('returns elapsed ms with no pauses', () => {
    expect(computeEffectiveElapsedMs(makeState(), t5m)).toBe(5 * 60_000);
  });

  it('subtracts completed pause duration', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: new Date('2026-01-01T12:08:00.000Z').toISOString() }],
    });
    // 20 min elapsed - 3 min pause = 17 min
    const now = new Date('2026-01-01T12:20:00.000Z');
    expect(computeEffectiveElapsedMs(state, now)).toBe(17 * 60_000);
  });

  it('subtracts ongoing pause duration when currently paused', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }],
    });
    // 20 min wall time, paused at 5 min → 5 min effective elapsed
    expect(computeEffectiveElapsedMs(state, t20m)).toBe(5 * 60_000);
  });

  it('adds skip_ms to effective elapsed', () => {
    const state = makeState({ skip_ms: 3 * 60_000 });
    // 5 min elapsed + 3 min skipped = 8 min effective
    expect(computeEffectiveElapsedMs(state, t5m)).toBe(8 * 60_000);
  });
});

// ─── computeCurrentLevelIndex ─────────────────────────────────────────────

describe('computeCurrentLevelIndex', () => {
  it('returns 0 at start', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t0)).toBe(0);
  });

  it('returns 0 at 5 minutes (within first 20-min level)', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t5m)).toBe(0);
  });

  it('returns 1 at exactly 20 minutes (start of second level)', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t20m)).toBe(1);
  });

  it('returns 2 at 40 minutes (break level)', () => {
    const t40m = new Date('2026-01-01T12:40:00.000Z');
    expect(computeCurrentLevelIndex(makeState(), levels, t40m)).toBe(2);
  });

  it('returns last level index when all levels exhausted', () => {
    const t99m = new Date('2026-01-01T13:39:00.000Z');
    expect(computeCurrentLevelIndex(makeState(), levels, t99m)).toBe(levels.length - 1);
  });
});

// ─── computeRemainingMs ───────────────────────────────────────────────────

describe('computeRemainingMs', () => {
  it('returns full level duration at start', () => {
    expect(computeRemainingMs(makeState(), levels, t0)).toBe(20 * 60_000);
  });

  it('returns remaining time mid-level', () => {
    // 5 min into 20-min level → 15 min remaining
    expect(computeRemainingMs(makeState(), levels, t5m)).toBe(15 * 60_000);
  });

  it('returns 0 when all levels exhausted', () => {
    const t99m = new Date('2026-01-01T13:39:00.000Z');
    expect(computeRemainingMs(makeState(), levels, t99m)).toBe(0);
  });

  it('accounts for pauses in remaining time', () => {
    // Paused for 3 min starting at t5m. At t20m: 20min wall - 3min pause = 17min effective.
    // In level 0 (0–20min), so remaining = 20min - 17min = 3min
    const t8m = new Date('2026-01-01T12:08:00.000Z');
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t8m.toISOString() }],
    });
    expect(computeRemainingMs(state, levels, t20m)).toBe(3 * 60_000);
  });
});

// ─── computePlaytimeMs ────────────────────────────────────────────────────

describe('computePlaytimeMs', () => {
  it('returns wall-clock time including pauses', () => {
    // 20 min wall clock, even if timer was paused for some of it
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t20m.toISOString() }],
    });
    expect(computePlaytimeMs(state, t20m)).toBe(20 * 60_000);
  });
});

// ─── computeTimeUntilNextBreakMs ──────────────────────────────────────────

describe('computeTimeUntilNextBreakMs', () => {
  it('returns null when no break ahead', () => {
    const noBreakLevels: BlindLevel[] = [
      { duration_minutes: 20, small_blind: 25, big_blind: 50, ante: 0 },
      { duration_minutes: 20, small_blind: 50, big_blind: 100, ante: 0 },
    ];
    expect(computeTimeUntilNextBreakMs(makeState(), noBreakLevels, t0)).toBeNull();
  });

  it('returns time until next break from level 1 (two levels away)', () => {
    // At t0: in L1 (20min). Break starts at 40min. Time until break = 40min.
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t0)).toBe(40 * 60_000);
  });

  it('returns time until next break from level 2', () => {
    // At t25m: 25min elapsed, in L2 (20–40min). Break starts at 40min. Time until break = 15min.
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t25m)).toBe(15 * 60_000);
  });

  it('returns null when currently in a break level', () => {
    // At t45m: 45min elapsed, in Break (40–55min).
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t45m)).toBeNull();
  });
});

// ─── isTimerPaused ────────────────────────────────────────────────────────

describe('isTimerPaused', () => {
  it('returns false when no pauses', () => {
    expect(isTimerPaused(makeState())).toBe(false);
  });

  it('returns false when last pause has a resumed_at', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t20m.toISOString() }],
    });
    expect(isTimerPaused(state)).toBe(false);
  });

  it('returns true when last pause has no resumed_at', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }],
    });
    expect(isTimerPaused(state)).toBe(true);
  });
});

// ─── startTimer ───────────────────────────────────────────────────────────

describe('startTimer', () => {
  it('sets started_at to now ISO string', () => {
    const state = startTimer(t0);
    expect(state.started_at).toBe(t0.toISOString());
  });

  it('initialises pauses as empty array', () => {
    expect(startTimer(t0).pauses).toEqual([]);
  });

  it('initialises skip_ms as 0', () => {
    expect(startTimer(t0).skip_ms).toBe(0);
  });
});

// ─── pauseTimer ───────────────────────────────────────────────────────────

describe('pauseTimer', () => {
  it('appends a pause entry with paused_at and null resumed_at', () => {
    const state = pauseTimer(makeState(), t5m);
    expect(state.pauses).toEqual([{ paused_at: t5m.toISOString(), resumed_at: null }]);
  });

  it('returns same state when already paused', () => {
    const state = makeState({ pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }] });
    expect(pauseTimer(state, t20m)).toBe(state);
  });
});

// ─── resumeTimer ──────────────────────────────────────────────────────────

describe('resumeTimer', () => {
  it('sets resumed_at on the last pause entry', () => {
    const state = makeState({ pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }] });
    const resumed = resumeTimer(state, t20m);
    expect(resumed.pauses[0].resumed_at).toBe(t20m.toISOString());
  });

  it('returns same state when not paused', () => {
    const state = makeState();
    expect(resumeTimer(state, t5m)).toBe(state);
  });
});

// ─── skipLevel ────────────────────────────────────────────────────────────

describe('skipLevel', () => {
  it('adds remaining time of current level to skip_ms', () => {
    // At t5m: 15min remaining in L1. skip_ms should become 15min.
    const result = skipLevel(makeState(), levels, t5m);
    expect(result.skip_ms).toBe(15 * 60_000);
  });

  it('accumulates skip_ms across multiple skips', () => {
    // First skip at t5m adds 15min. Second skip would be at start of next level.
    const afterFirst = skipLevel(makeState(), levels, t5m);
    // Now effective elapsed = 5min + 15min skip = 20min, at start of L2 (20min duration)
    const afterSecond = skipLevel(afterFirst, levels, t5m);
    expect(afterSecond.skip_ms).toBe(15 * 60_000 + 20 * 60_000);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they all fail**

```bash
npx vitest run tests/unit/timer.test.ts
```

Expected: All tests fail with `Cannot find module '$lib/timer'` or similar.

---

## Task 4: Implement Timer Logic

**Files:**
- Create: `src/lib/timer.ts`

- [ ] **Step 1: Create `src/lib/timer.ts`**

```ts
import type { BlindLevel, TimerState } from '$lib/types';

function totalPausedMs(state: TimerState, now: Date): number {
  let total = 0;
  for (const pause of state.pauses) {
    const end = pause.resumed_at ? new Date(pause.resumed_at).getTime() : now.getTime();
    total += end - new Date(pause.paused_at).getTime();
  }
  return total;
}

export function computeEffectiveElapsedMs(state: TimerState, now: Date): number {
  const wall = now.getTime() - new Date(state.started_at).getTime();
  return Math.max(0, wall - totalPausedMs(state, now) + (state.skip_ms ?? 0));
}

export function computeCurrentLevelIndex(state: TimerState, levels: BlindLevel[], now: Date): number {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  for (let i = 0; i < levels.length; i++) {
    accumulated += levels[i].duration_minutes * 60_000;
    if (elapsed < accumulated) return i;
  }
  return levels.length - 1;
}

export function computeRemainingMs(state: TimerState, levels: BlindLevel[], now: Date): number {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  for (const level of levels) {
    accumulated += level.duration_minutes * 60_000;
    if (elapsed < accumulated) return accumulated - elapsed;
  }
  return 0;
}

export function computePlaytimeMs(state: TimerState, now: Date): number {
  return now.getTime() - new Date(state.started_at).getTime();
}

export function computeTimeUntilNextBreakMs(
  state: TimerState,
  levels: BlindLevel[],
  now: Date,
): number | null {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  let currentFound = false;

  for (let i = 0; i < levels.length; i++) {
    const levelStart = accumulated;
    accumulated += levels[i].duration_minutes * 60_000;

    if (!currentFound) {
      if (elapsed < accumulated) {
        currentFound = true;
        if (levels[i].type === 'break') return null; // already in a break
      }
      continue;
    }

    if (levels[i].type === 'break') return levelStart - elapsed;
  }

  return null;
}

export function isTimerPaused(state: TimerState): boolean {
  if (state.pauses.length === 0) return false;
  return state.pauses[state.pauses.length - 1].resumed_at === null;
}

export function startTimer(now: Date): TimerState {
  return { started_at: now.toISOString(), pauses: [], skip_ms: 0 };
}

export function pauseTimer(state: TimerState, now: Date): TimerState {
  if (isTimerPaused(state)) return state;
  return { ...state, pauses: [...state.pauses, { paused_at: now.toISOString(), resumed_at: null }] };
}

export function resumeTimer(state: TimerState, now: Date): TimerState {
  if (!isTimerPaused(state)) return state;
  const pauses = state.pauses.map((p, i) =>
    i === state.pauses.length - 1 ? { ...p, resumed_at: now.toISOString() } : p,
  );
  return { ...state, pauses };
}

export function skipLevel(state: TimerState, levels: BlindLevel[], now: Date): TimerState {
  const remaining = computeRemainingMs(state, levels, now);
  return { ...state, skip_ms: (state.skip_ms ?? 0) + remaining };
}
```

- [ ] **Step 2: Run the tests and confirm they all pass**

```bash
npx vitest run tests/unit/timer.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/timer.ts tests/unit/timer.test.ts
git commit -m "feat: add timer pure functions with full test coverage"
```

---

## Task 5: Add i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

Before the closing `}`, add:

```json
  "blind_structure_add_break": "Add Break",
  "blind_structure_break_label_placeholder": "Break name (e.g. Dinner Break)",
  "timer_level": "Level",
  "timer_break": "Break",
  "timer_pause": "Pause",
  "timer_resume": "Resume",
  "timer_next_level": "Next",
  "timer_clock_link": "Clock",
  "timer_times_up": "Time's up",
  "timer_next_preview": "Next",
  "clock_small_blind": "Small Blind",
  "clock_big_blind": "Big Blind",
  "clock_ante": "Ante",
  "clock_next_level": "Next Level",
  "clock_players": "Players",
  "clock_avg_stack": "Avg Stack",
  "clock_prize_pool": "Prize Pool",
  "clock_next_break": "Next Break",
  "clock_playing": "Playing"
```

- [ ] **Step 2: Add keys to `messages/de.json`**

Before the closing `}`, add:

```json
  "blind_structure_add_break": "Pause hinzufügen",
  "blind_structure_break_label_placeholder": "Pausenname (z.B. Abendessen)",
  "timer_level": "Level",
  "timer_break": "Pause",
  "timer_pause": "Pausieren",
  "timer_resume": "Fortsetzen",
  "timer_next_level": "Weiter",
  "timer_clock_link": "Uhr",
  "timer_times_up": "Zeit abgelaufen",
  "timer_next_preview": "Nächstes",
  "clock_small_blind": "Small Blind",
  "clock_big_blind": "Big Blind",
  "clock_ante": "Ante",
  "clock_next_level": "Nächstes Level",
  "clock_players": "Spieler",
  "clock_avg_stack": "Ø Stack",
  "clock_prize_pool": "Preispool",
  "clock_next_break": "Nächste Pause",
  "clock_playing": "Spieldauer"
```

- [ ] **Step 3: Regenerate Paraglide output**

```bash
npm run build
```

Expected: Build succeeds. The new message functions now appear in `src/lib/paraglide/messages/en.js` and `de.js`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json src/lib/paraglide/messages/en.js src/lib/paraglide/messages/de.js
git commit -m "feat: add timekeeping i18n messages"
```

---

## Task 6: Add Break Support to Blind Structure Editor

**Files:**
- Modify: `src/routes/[club]/admin/blind-structures/+page.svelte`

- [ ] **Step 1: Update the levels state type and add `addBreak`**

In the `<script>` section, replace:

```ts
let levels = $state([{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }]);

function addLevel() {
  levels = [...levels, { small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
}
```

With:

```ts
type LevelRow =
  | { type: 'level'; small_blind: string; big_blind: string; ante: string; duration_minutes: string; label: string }
  | { type: 'break'; duration_minutes: string; label: string };

let levels = $state<LevelRow[]>([
  { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
]);

function addLevel() {
  levels = [...levels, { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
}

function addBreak() {
  levels = [...levels, { type: 'break', duration_minutes: '', label: '' }];
}
```

- [ ] **Step 2: Update the `handleCreate` validation and parsing**

Replace the existing `parsedLevels` block in `handleCreate`:

```ts
const parsedLevels = levels.map((l) =>
  l.type === 'break'
    ? {
        type: 'break' as const,
        small_blind: 0,
        big_blind: 0,
        ante: 0,
        duration_minutes: Number(l.duration_minutes),
        label: l.label.trim() || 'Break',
      }
    : {
        type: 'level' as const,
        small_blind: Number(l.small_blind),
        big_blind: Number(l.big_blind),
        ante: Number(l.ante),
        duration_minutes: Number(l.duration_minutes),
        label: l.label.trim(),
      }
);
for (const level of parsedLevels) {
  if (level.duration_minutes <= 0) { errorKey = 'error_required'; return; }
  if (level.type === 'level') {
    if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0) {
      errorKey = 'error_required';
      return;
    }
  }
}
```

Also update the reset line after successful create:

```ts
levels = [{ type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
```

- [ ] **Step 3: Update the levels table in the template**

Replace the existing `{#each levels as level, i}` table body with:

```svelte
{#each levels as level, i}
  <tr>
    <!-- Level type badge -->
    <td class="pr-2 pb-2">
      {#if level.type === 'break'}
        <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-accent/15 text-accent">BRK</span>
      {:else}
        <span class="text-xs text-muted-foreground">{i + 1 - levels.slice(0, i).filter(l => l.type === 'break').length}</span>
      {/if}
    </td>
    <!-- Duration -->
    <td class="pr-2 pb-2">
      <input type="number" min="1" bind:value={level.duration_minutes}
        class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
    </td>
    <!-- SB / BB / Ante — hidden for breaks -->
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
      <td class="pr-2 pb-2 text-muted-foreground text-xs text-center">—</td>
      <td class="pr-2 pb-2 text-muted-foreground text-xs text-center">—</td>
      <td class="pr-2 pb-2 text-muted-foreground text-xs text-center">—</td>
    {/if}
    <!-- Label (break only) -->
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
```

Also update the table header to add a "Label" column:

```svelte
<tr class="text-muted-foreground">
  <th class="text-left font-medium pb-2 w-10">#</th>
  <th class="text-left font-medium pb-2">{m.blind_structure_duration_label()}</th>
  <th class="text-left font-medium pb-2">{m.blind_structure_sb_label()}</th>
  <th class="text-left font-medium pb-2">{m.blind_structure_bb_label()}</th>
  <th class="text-left font-medium pb-2">{m.blind_structure_ante_label()}</th>
  <th class="text-left font-medium pb-2">Label</th>
  <th></th>
</tr>
```

- [ ] **Step 4: Add the "Add Break" button**

Replace the existing `+ Add Level` button:

```svelte
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
```

- [ ] **Step 5: Verify manually**

```bash
npm run dev
```

Open a blind structure page and confirm:
- "Add Level" and "Add Break" buttons appear
- Break rows show BRK badge, Duration, Label inputs; SB/BB/Ante show "—"
- Level rows show SB/BB/Ante inputs as before
- Saving a structure with breaks works (check Supabase to confirm levels JSON includes `type: 'break'`)

- [ ] **Step 6: Commit**

```bash
git add src/routes/[club]/admin/blind-structures/+page.svelte
git commit -m "feat: add break level support to blind structure editor"
```

---

## Task 7: Update Tournament Detail Loader

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`

- [ ] **Step 1: Update the select to include blind structure levels**

Change line 9 from:

```ts
.select('*, blind_structures(name), prize_structures(name, payouts)')
```

To:

```ts
.select('*, blind_structures(name, levels), prize_structures(name, payouts)')
```

The `timer_state` column is already returned by `*` since it's a real column on `tournaments`.

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.ts
git commit -m "feat: load blind structure levels in tournament detail loader"
```

---

## Task 8: Add Timer Strip to Tournament Admin Page

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Add imports and timer state in the `<script>` section**

Add to the existing imports at the top of the script:

```ts
import { page } from '$app/stores';
import {
  computeCurrentLevelIndex,
  computeRemainingMs,
  computePlaytimeMs,
  computeTimeUntilNextBreakMs,
  isTimerPaused,
  startTimer,
  pauseTimer,
  resumeTimer,
  skipLevel,
} from '$lib/timer';
import type { TimerState, BlindLevel } from '$lib/types';
```

- [ ] **Step 2: Add reactive timer state**

Add after the existing `$derived` blocks (e.g. after `const averageStack = ...`):

```ts
let now = $state(new Date());

$effect(() => {
  const tick = setInterval(() => { now = new Date(); }, 1000);
  const poll = setInterval(() => { invalidateAll(); }, 5000);
  return () => { clearInterval(tick); clearInterval(poll); };
});

const timerState = $derived(t.timer_state as TimerState | null);
const blindLevels = $derived((t.blind_structures?.levels ?? []) as BlindLevel[]);

const currentLevelIdx = $derived(
  timerState && blindLevels.length > 0
    ? computeCurrentLevelIndex(timerState, blindLevels, now)
    : 0,
);
const currentLevel = $derived(blindLevels[currentLevelIdx] ?? null);
const remainingMs = $derived(
  timerState && blindLevels.length > 0
    ? computeRemainingMs(timerState, blindLevels, now)
    : 0,
);
const nextLevel = $derived(blindLevels[currentLevelIdx + 1] ?? null);
const timerPaused = $derived(timerState ? isTimerPaused(timerState) : false);
const levelProgress = $derived(
  currentLevel
    ? 1 - remainingMs / (currentLevel.duration_minutes * 60_000)
    : 0,
);

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
```

- [ ] **Step 3: Update `handleStartTournament` to also initialise `timer_state`**

Replace the existing `handleStartTournament` function (lines 229–242):

```ts
async function handleStartTournament() {
  if (loading) return;
  if (data.tournament.status !== 'registration') return;
  if (data.players.length < 2) { errorKey = 'tournament_min_players_error'; return; }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    const newTimerState = startTimer(new Date());
    await supabase.from('tournaments').update({
      status: 'running',
      timer_state: newTimerState,
    }).eq('id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}
```

- [ ] **Step 4: Add timer control handlers**

Add these three functions after `handleStartTournament`:

```ts
async function handleTimerPause() {
  if (!timerState) return;
  const supabase = createClient();
  await supabase.from('tournaments')
    .update({ timer_state: pauseTimer(timerState, new Date()) })
    .eq('id', data.tournament.id);
  await invalidateAll();
}

async function handleTimerResume() {
  if (!timerState) return;
  const supabase = createClient();
  await supabase.from('tournaments')
    .update({ timer_state: resumeTimer(timerState, new Date()) })
    .eq('id', data.tournament.id);
  await invalidateAll();
}

async function handleTimerSkip() {
  if (!timerState || blindLevels.length === 0) return;
  const supabase = createClient();
  await supabase.from('tournaments')
    .update({ timer_state: skipLevel(timerState, blindLevels, new Date()) })
    .eq('id', data.tournament.id);
  await invalidateAll();
}
```

- [ ] **Step 5: Add the timer strip in the template**

In the template, find where `{#if t.status === 'registration'}` renders the Start button (around line 587). Just below the existing header/meta section and before the `{#if t.status === 'registration'}` status-based section, add the timer strip so it shows when `status === 'running'`:

```svelte
{#if t.status === 'running' && timerState && blindLevels.length > 0}
  <div class="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
    <!-- Level + countdown -->
    <div class="min-w-0">
      <div class="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">
        {currentLevel?.type === 'break'
          ? (currentLevel.label || m.timer_break())
          : `${m.timer_level()} ${currentLevelIdx + 1 - blindLevels.slice(0, currentLevelIdx).filter(l => l.type === 'break').length} · ${currentLevel?.small_blind}/${currentLevel?.big_blind}`}
      </div>
      <div class="text-2xl font-bold font-mono tracking-widest leading-none {remainingMs === 0 ? 'text-accent' : 'text-foreground'}">
        {remainingMs === 0 ? m.timer_times_up() : formatTime(remainingMs)}
      </div>
    </div>
    <!-- Progress + next level -->
    <div class="flex-1 min-w-0">
      <div class="bg-border rounded-full h-1 mb-1.5">
        <div
          class="bg-accent h-1 rounded-full transition-all duration-1000"
          style="width: {Math.min(100, Math.round(levelProgress * 100))}%"
        ></div>
      </div>
      {#if nextLevel}
        <div class="text-[10px] text-muted-foreground truncate">
          {m.timer_next_preview()}:
          {nextLevel.type === 'break'
            ? (nextLevel.label || m.timer_break())
            : `${nextLevel.small_blind}/${nextLevel.big_blind}`}
          · {nextLevel.duration_minutes} min
        </div>
      {/if}
    </div>
    <!-- Controls -->
    <div class="flex items-center gap-2 shrink-0">
      {#if timerPaused}
        <button
          type="button"
          onclick={handleTimerResume}
          class="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          ▶ {m.timer_resume()}
        </button>
      {:else}
        <button
          type="button"
          onclick={handleTimerPause}
          class="text-xs bg-muted text-foreground px-3 py-1.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
        >
          ⏸ {m.timer_pause()}
        </button>
      {/if}
      <button
        type="button"
        onclick={handleTimerSkip}
        class="text-xs bg-muted text-foreground px-3 py-1.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
      >
        ⏭ {m.timer_next_level()}
      </button>
      <a
        href="{$page.url.pathname}/clock"
        target="_blank"
        class="text-xs text-accent hover:text-accent/80 transition-colors ml-1"
      >
        🖥 {m.timer_clock_link()} ↗
      </a>
    </div>
  </div>
{/if}
```

- [ ] **Step 6: Run type check and verify manually**

```bash
npm run check
npm run dev
```

Verify: Starting a tournament shows the timer strip. Pause/resume/skip buttons update the DB. The "Clock ↗" link opens (the clock page doesn't exist yet — that's Task 9).

- [ ] **Step 7: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: add timer strip to tournament admin page"
```

---

## Task 9: Create the Clock Page

**Files:**
- Create: `src/routes/[club]/admin/tournaments/[id]/clock/+page.ts`
- Create: `src/routes/[club]/admin/tournaments/[id]/clock/+page.svelte`

- [ ] **Step 1: Create `+page.ts`**

```ts
import { error } from '@sveltejs/kit';
import { calculatePrizePool, calculateAverageStack } from '$lib/tournaments';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name, levels), prize_structures(name, payouts)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();
  if (!tournament) throw error(404, 'Tournament not found');

  const { data: players } = await supabase
    .from('tournament_players')
    .select('rebuys, addon, finish_position')
    .eq('tournament_id', params.id);

  const allPlayers = players ?? [];
  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );
  const averageStack = calculateAverageStack(tournament, allPlayers);
  const playersRemaining = allPlayers.filter((p) => p.finish_position === null).length;

  return { tournament, prizePool, averageStack, playersTotal: allPlayers.length, playersRemaining };
};
```

- [ ] **Step 2: Create `+page.svelte`**

```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    computeCurrentLevelIndex,
    computeRemainingMs,
    computePlaytimeMs,
    computeTimeUntilNextBreakMs,
    isTimerPaused,
  } from '$lib/timer';
  import type { TimerState, BlindLevel } from '$lib/types';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let now = $state(new Date());

  $effect(() => {
    const tick = setInterval(() => { now = new Date(); }, 1000);
    const poll = setInterval(() => { invalidateAll(); }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  });

  const t = $derived(data.tournament);
  const timerState = $derived(t.timer_state as TimerState | null);
  const blindLevels = $derived((t.blind_structures?.levels ?? []) as BlindLevel[]);

  const currentLevelIdx = $derived(
    timerState && blindLevels.length > 0
      ? computeCurrentLevelIndex(timerState, blindLevels, now)
      : 0,
  );
  const currentLevel = $derived(blindLevels[currentLevelIdx] ?? null);
  const nextLevel = $derived(blindLevels[currentLevelIdx + 1] ?? null);
  const remainingMs = $derived(
    timerState && blindLevels.length > 0
      ? computeRemainingMs(timerState, blindLevels, now)
      : 0,
  );
  const playtimeMs = $derived(timerState ? computePlaytimeMs(timerState, now) : 0);
  const nextBreakMs = $derived(
    timerState && blindLevels.length > 0
      ? computeTimeUntilNextBreakMs(timerState, blindLevels, now)
      : null,
  );
  const timerPaused = $derived(timerState ? isTimerPaused(timerState) : false);

  // Level number (breaks don't count)
  const levelNumber = $derived(
    currentLevelIdx + 1 - blindLevels.slice(0, currentLevelIdx).filter((l) => l.type === 'break').length,
  );

  const levelProgress = $derived(
    currentLevel ? 1 - remainingMs / (currentLevel.duration_minutes * 60_000) : 0,
  );

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatPlaytime(ms: number): string {
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
    return `${mins}m`;
  }

  function formatWallTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function formatMoney(cents: number): string {
    return `€${(cents / 100).toFixed(0)}`;
  }

  function formatStack(chips: number | null): string {
    if (chips === null) return '—';
    if (chips >= 1000) return `${(chips / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(chips);
  }

  const isBreak = $derived(currentLevel?.type === 'break');
  const levelLabel = $derived(
    isBreak
      ? (currentLevel?.label || m.timer_break())
      : `${m.timer_level()} ${levelNumber}`,
  );
</script>

<svelte:head>
  <title>{t.name} · Clock</title>
</svelte:head>

<div class="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6 font-sans select-none">
  <!-- Top bar -->
  <div class="flex justify-between items-center mb-auto">
    <span class="text-xs text-zinc-600 uppercase tracking-widest">{t.name}</span>
    <span class="text-xs text-zinc-600">
      {formatWallTime(now)}
      {#if timerState}
        &nbsp;·&nbsp; {m.clock_playing()} {formatPlaytime(playtimeMs)}
      {/if}
      {#if timerPaused}
        &nbsp;·&nbsp; <span class="text-accent">⏸</span>
      {/if}
    </span>
  </div>

  <!-- Center: big timer -->
  <div class="flex-1 flex flex-col items-center justify-center gap-6">
    <div class="text-xs text-zinc-500 uppercase tracking-[0.3em]">{levelLabel}</div>

    <div class="text-[min(20vw,8rem)] font-bold font-mono leading-none tracking-widest {remainingMs === 0 ? 'text-accent' : timerPaused ? 'text-zinc-400' : 'text-white'}">
      {formatTime(remainingMs)}
    </div>

    <!-- Progress bar -->
    <div class="w-64 bg-zinc-800 rounded-full h-1">
      <div
        class="bg-accent h-1 rounded-full transition-all duration-1000"
        style="width: {Math.min(100, Math.round(levelProgress * 100))}%"
      ></div>
    </div>

    <!-- Blinds row -->
    {#if currentLevel && !isBreak}
      <div class="flex gap-8 mt-2">
        <div class="text-center">
          <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_small_blind()}</div>
          <div class="text-3xl font-semibold text-zinc-200">{currentLevel.small_blind}</div>
        </div>
        <div class="text-center">
          <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_big_blind()}</div>
          <div class="text-3xl font-semibold text-zinc-200">{currentLevel.big_blind}</div>
        </div>
        {#if currentLevel.ante > 0}
          <div class="text-center">
            <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_ante()}</div>
            <div class="text-3xl font-semibold text-zinc-200">{currentLevel.ante}</div>
          </div>
        {/if}
        {#if nextLevel}
          <div class="text-center border-l border-zinc-800 pl-8">
            <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_level()}</div>
            <div class="text-base text-zinc-500 mt-1.5">
              {nextLevel.type === 'break'
                ? (nextLevel.label || m.timer_break())
                : `${nextLevel.small_blind} / ${nextLevel.big_blind}`}
            </div>
          </div>
        {/if}
      </div>
    {:else if isBreak && nextLevel}
      <div class="text-center">
        <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_level()}</div>
        <div class="text-base text-zinc-500">
          {nextLevel.type === 'break'
            ? (nextLevel.label || m.timer_break())
            : `${nextLevel.small_blind} / ${nextLevel.big_blind}`}
        </div>
      </div>
    {/if}
  </div>

  <!-- Bottom stats bar -->
  <div class="mt-auto pt-6 border-t border-zinc-900 flex justify-center gap-10">
    <div class="text-center">
      <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_players()}</div>
      <div class="text-lg text-zinc-400">{data.playersRemaining} / {data.playersTotal}</div>
    </div>
    {#if data.averageStack !== null}
      <div class="text-center">
        <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_avg_stack()}</div>
        <div class="text-lg text-zinc-400">{formatStack(data.averageStack)}</div>
      </div>
    {/if}
    <div class="text-center">
      <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_prize_pool()}</div>
      <div class="text-lg text-zinc-400">{formatMoney(data.prizePool)}</div>
    </div>
    {#if nextBreakMs !== null}
      <div class="text-center">
        <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_break()}</div>
        <div class="text-lg text-zinc-400">{formatTime(nextBreakMs)}</div>
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 3: Run type check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Verify manually**

```bash
npm run dev
```

1. Start a tournament that has a blind structure assigned.
2. Click "Start Tournament" — timer strip should appear on the admin page.
3. Click "Clock ↗" — the clock page should open in a new tab showing the countdown.
4. Let the timer tick — both pages should stay in sync.
5. Pause from the admin page — both pages should reflect the paused state within 5 seconds.
6. Click "Next" — the clock advances to the next level.

- [ ] **Step 5: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/clock/
git commit -m "feat: add dedicated tournament clock page"
```
