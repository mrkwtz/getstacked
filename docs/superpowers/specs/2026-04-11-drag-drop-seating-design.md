# Drag-and-Drop Seating Design

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Replace the existing click-select → click-seat interaction in the running phase, and the table-preference lock + unseated dropdown in the registration phase, with a unified drag-and-drop seating interface across both phases. Players can be dragged between seats (swapping if the target is occupied) and to/from an unseated strip.

## Data Model

No schema changes. Existing fields are sufficient:
- `table_id` + `seat_number` — actual seat assignment
- `preferred_table` — table-level preference for the registration draw (unchanged)

## State Changes

In `+page.svelte`:
- Remove `movingPlayerId: string | null`
- Add `draggedPlayerId: string | null`

## Drag Interactions

Both registration and running phases use the same six cases:

| Drag source | Drop target | Result |
|---|---|---|
| Seated (active) | Empty seat | Move |
| Seated (active) | Active player's seat | Swap |
| Seated (active) | Unseated strip | Unseat |
| Unseated player | Empty seat | Move |
| Unseated player | Active player's seat | Swap (dragged player seated, other unseated) |
| Seated (active) | Busted player's seat | Move (busted treated as empty) |

**Busted players** (running phase, `finish_position !== null`) are not draggable but their seat cells are valid drop targets.

**Swap implementation** — two parallel DB updates (no unique constraint in DB):
```ts
await Promise.all([
  supabase.from('tournament_players').update({ table_id: b.tableId, seat_number: b.seatNumber }).eq('id', a.playerId),
  supabase.from('tournament_players').update({ table_id: a.tableId, seat_number: a.seatNumber }).eq('id', b.playerId),
]);
```

## UI Changes

### Registration Phase
- The per-player table lock dropdown (sets `preferred_table` for the initial draw) is **kept** — it is a pre-draw preference, not a seating action
- Seating grid (shown after draw) becomes interactive: player chips are `draggable="true"`, seat cells are drop targets
- Remove the "unseated players" section with its per-player seat dropdown
- Add an **unseated players strip** below the table grid: horizontal row of draggable player chips + drop zone (drag seated player here to unseat)

### Running Phase
- Same DnD interaction replaces the `movingPlayerId` click-select pattern
- Remove the "Manual move hint / cancel" banner
- Keep the rebalance/break suggestion banner (independent of manual seating)
- Same unseated strip shown if any players lack a seat

### Visual Feedback (Both Phases)
- Dragging player chip: `opacity-50` on the source element
- Valid drop target on `dragover`: `border-accent bg-accent/10`
- Highlight reset on `dragleave` and after drop

## Implementation Notes

- Use the HTML5 Drag and Drop API (`draggable`, `ondragstart`, `ondragover`, `ondrop`, `ondragleave`)
- No new library dependencies
- Desktop/mouse only — touch support deferred
- `draggedPlayerId` is set in `ondragstart` and cleared in `ondragend`/after drop
- Drop handler reads `draggedPlayerId` to determine source, inspects target to choose move/swap/unseat

## Testing

E2E tests (Playwright) covering:
1. Drag seated → empty seat: player appears at new seat
2. Drag seated → seated: players swap seats
3. Drag seated → unseated strip: player moves to unseated area
4. Drag unseated → empty seat: player becomes seated
5. Drag unseated → seated: swap (unseated player seated, seated player moves to strip)
6. Running phase: drag active player to busted player's seat: active player moves there
