# Editable Blind & Prize Structures

**Date:** 2026-04-11

## Problem

Blind and prize structures are currently create/delete only. Editing is not possible, and structures in use cannot be deleted. Tournaments reference structures by FK — there is no way to adjust a blind structure mid-tournament without affecting all other tournaments using the same template.

## Goals

- Allow editing global blind/prize structure templates at any time
- Allow adjusting a tournament's blind/prize structure while the tournament is running
- Tournament edits must not affect the global template, and global template edits must not affect running tournaments

## Approach: Copy on Assign (Option A)

When a tournament is created with a blind or prize structure selected, the structure's data is copied into the tournament record. The tournament owns its copy independently of the global template.

Global templates remain editable at all times. The FK references on `tournaments` are soft references (for traceability) — not the source of truth for tournament data.

---

## 1. Database Migration

Add two nullable JSONB columns to `tournaments`:

- `blind_levels` — same shape as `blind_structures.levels`: array of `{ type, small_blind, big_blind, ante, duration_minutes, label }`
- `prize_payouts` — same shape as `prize_structures.payouts`: array of `{ position, percentage }`

**Backfill:** For all existing tournaments with a `blind_structure_id`, copy `blind_structures.levels` into `blind_levels`. Same for `prize_payouts`. Tournaments with no structure reference remain NULL.

**FK behaviour:** `blind_structure_id` and `prize_structure_id` are altered to `ON DELETE SET NULL` (if not already). Deleting a global template nulls the FK on any tournament that referenced it, but the copied data in `blind_levels`/`prize_payouts` is untouched.

---

## 2. Shared Form Components

Extract the level/payout editing UI into reusable components:

- `src/lib/components/BlindStructureForm.svelte` — levels table with add level, add break, remove row controls; accepts initial levels as a prop, exposes current levels via a bindable prop or callback
- `src/lib/components/PrizeStructureForm.svelte` — payouts table with add/remove controls; same pattern

Add a Dialog component at `src/lib/components/ui/dialog/` using bits-ui's Dialog primitive, following the same pattern as the existing shadcn-svelte style components (button, card, etc.).

---

## 3. Global Structure Pages (Edit Mode)

Both `/[club]/admin/blind-structures` and `/[club]/admin/prize-structures` get edit mode.

**Changes:**
- Add `let editingId = $state<string | null>(null)`
- Each row in the list gets an **Edit** button (always visible) alongside Delete
- Delete is always available — the "in use" check and "In use" label are removed
- Clicking **Edit** on a row: sets `editingId`, pre-fills `name` and the form component with the row's data, scrolls to the form
- Form heading changes to "Edit blind/prize structure"; a **Cancel** button appears
- Submit button label: "Save" in edit mode, "Create" in create mode
- Submit in edit mode: `update().eq('id', editingId)` then reset to create mode + `invalidateAll()`
- Submit in create mode: unchanged `insert()` behaviour

Editing a global template has no effect on any tournament's copied data.

---

## 4. New Tournament Form (Copy on Assign)

The new tournament form (`/[club]/admin/tournaments/new`) already loads available structures. At insert time, when `blind_structure_id` is selected, find the structure in the already-loaded list and include its `levels` data as `blind_levels` in the insert payload. Same for `prize_structure_id` / `prize_payouts`.

This happens client-side — no extra fetch needed since the structures are already in page data.

---

## 5. Tournament Detail Page (Editing the Tournament's Copy)

On `/[club]/admin/tournaments/[id]`, add edit buttons for blind and prize structures when the tournament has `blind_levels`/`prize_payouts` data.

- "Edit blind structure" button opens a Dialog pre-filled with the tournament's `blind_levels`
- "Edit prize structure" button opens a Dialog pre-filled with the tournament's `prize_payouts`
- Both dialogs reuse `BlindStructureForm` / `PrizeStructureForm` components
- Saving calls `update().eq('id', tournament.id)` on `tournaments`, writing updated `blind_levels` or `prize_payouts`
- Available at any tournament status (`registration`, `running`, `finished`)

The loader for the tournament detail page adds `blind_levels` and `prize_payouts` to its select query.

---

## 6. i18n

New message keys needed (EN + DE):
- `blind_structure_edit_title` — "Edit blind structure"
- `blind_structure_save_button` — "Save"
- `prize_structure_edit_title` — "Edit prize structure"
- `prize_structure_save_button` — "Save"
- Tournament detail edit button labels (e.g. `tournament_edit_blind_structure`, `tournament_edit_prize_structure`)

---

## Testing

- Unit tests: none needed for pure UI state changes; existing `tournaments.ts` / `seating.ts` logic is unaffected
- E2E: update or add tests for create-with-copy, edit global structure, edit tournament structure via modal
