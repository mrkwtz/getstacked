# Timekeeping Design

**Date:** 2026-04-09  
**Status:** Approved

## Overview

Add a tournament clock driven by the blind structure. Time state is stored as immutable timestamps in Supabase — any client can derive the full current state at any moment without requiring a client to be online for level advancement. Includes a minimal timer strip on the tournament admin page and a dedicated full-screen clock page.

---

## 1. Data Model

### BlindLevel extension

`BlindLevel` gains an optional `type` field (backwards-compatible — omitted means `'level'`):

```ts
export interface BlindLevel {
  type?: 'level' | 'break'  // defaults to 'level' when omitted
  small_blind: number        // 0 for breaks
  big_blind: number          // 0 for breaks
  ante: number               // 0 for breaks
  duration_minutes: number
  label?: string             // optional name, e.g. "Dinner Break"
}
```

No DB schema change needed — `levels` is already a JSONB column.

### TimerState

New JSONB column `timer_state` on `tournaments` (nullable — null until started):

```ts
interface TimerState {
  started_at: string           // ISO timestamp — set once when tournament starts, never changes
  pauses: Array<{
    paused_at: string          // ISO timestamp
    resumed_at: string | null  // null = currently paused
  }>
  skip_ms: number              // accumulated ms skipped by manual "Next Level" actions (default 0)
}
```

**DB migration:** `ALTER TABLE tournaments ADD COLUMN timer_state jsonb;`

### Deriving state from TimerState

Any client computes the full clock state from `timer_state`, the blind `levels` array, and `now`:

```
total_paused_ms = Σ completed pauses (resumed_at − paused_at)
                + if currently paused: (now − last paused_at)

effective_elapsed_ms = (now − started_at) − total_paused_ms + skip_ms

current_level = walk levels accumulating duration_minutes * 60_000
                until accumulated > effective_elapsed_ms
```

No client ever needs to write a "level advanced" event. Level advancement, remaining time, current blinds, time until next break — all derived, never stored.

---

## 2. Business Logic

New file: `src/lib/timer.ts` — pure functions, no side effects.

```ts
// Time remaining in current level (ms). Returns 0 if level has overrun.
computeRemainingMs(state: TimerState, levels: BlindLevel[], now: Date): number

// Current level index (0-based). Returns last index if all levels exhausted.
computeCurrentLevelIndex(state: TimerState, levels: BlindLevel[], now: Date): number

// Total effective playtime elapsed since tournament started (ms), excluding pauses.
computeEffectiveElapsedMs(state: TimerState, now: Date): number

// Total wall-clock playtime since tournament started (ms), including pauses.
computePlaytimeMs(state: TimerState, now: Date): number

// Time until the next break level (ms), or null if no break ahead.
computeTimeUntilNextBreakMs(state: TimerState, levels: BlindLevel[], now: Date): number | null

// Whether the timer is currently paused.
isTimerPaused(state: TimerState): boolean

// Produce new TimerState for start, pause, resume.
// Level advancement is fully automatic — no advanceLevel function needed.
startTimer(now: Date): TimerState
pauseTimer(state: TimerState, now: Date): TimerState
resumeTimer(state: TimerState, now: Date): TimerState
```

Unit tests live in `tests/unit/timer.test.ts`.

---

## 3. UI

### 3a. Blind Structure Editor

- Each level row has columns: #, Duration, SB, BB, Ante, Label, ✕
- Break rows show: BRK badge, Duration, Label input — blind columns are greyed out/hidden
- Two buttons below the table: **+ Add Level** and **+ Add Break**
- Validation: breaks require a label and duration > 0; blinds are not validated for break rows

### 3b. Tournament Admin Page — Timer Strip

A compact strip just below the tournament header, only visible when status is `running`:

- Left: level name/number + countdown in monospace (`14:22`)
- Middle: progress bar + "Next: SB/BB · X min"
- Right: **⏸ Pause** / **▶ Resume** button, **⏭ Next** button (manual override to skip to next level), **🖥 Clock ↗** link to clock page
- Updates via a local `setInterval` (1s tick) computing state from DB timestamps
- Polls Supabase every 5s via `invalidateAll()` to pick up pause/resume actions from other devices

The "Start Tournament" button (existing flow for transitioning from `registration` → `running`) also initialises `timer_state` with `started_at = now, pauses = []`.

### 3c. Dedicated Clock Page

Route: `src/routes/[club]/admin/tournaments/[id]/clock/+page.svelte`

Dark full-screen layout designed for display on a TV or projector:

**Top bar:** Tournament name (left) · Current wall time + total playtime (right)

**Center:** Level number label · Big countdown timer · Level progress bar

**Blinds row:** Small Blind · Big Blind · Ante · Next Level preview

**Stats row:** Players remaining/total · Average stack · Prize pool · Time until next break

All values are derived client-side from `timer_state` + `levels` + live player data. The page polls every 5s and ticks locally every 1s.

---

## 4. Routing & DB Writes

| Action | DB write |
|--------|----------|
| Start tournament | `tournaments.status = 'running'`, `timer_state = { started_at: now, pauses: [] }` |
| Pause | Append `{ paused_at: now, resumed_at: null }` to `timer_state.pauses` |
| Resume | Set `resumed_at = now` on the last pause entry |
| Manual next level | Add remaining time of current level to `timer_state.skip_ms`, causing `effective_elapsed_ms` to jump forward into the next level. |

> **Note on manual next level:** Skipping a level adds its remaining time to `skip_ms`. The formula `effective_elapsed_ms = (now − started_at) − total_paused_ms + skip_ms` then naturally places the clock at the start of the next level. No level index is stored.

**Clock page visibility:** Admin-only for now (`/[club]/admin/...`). Making it publicly accessible (no auth required) is a future enhancement.

---

## 5. Out of Scope

- Auto-finishing the tournament when the last level ends (admin manually finishes as today)
- Public (unauthenticated) clock URL
- Sound alerts when a level ends
- Per-level color theming on the clock page
