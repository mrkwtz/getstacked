# Design: Structure cards on tournaments page

**Date:** 2026-04-11

## Problem

Blind structures and prize structures are only reachable via two small muted text links at the bottom of the tournaments list page. They're easy to miss and don't communicate that these are distinct, manageable resources.

## Solution

Replace the muted text links with two compact, clickable cards rendered in a horizontal row below the tournament table. Each card shows the resource name, a count of existing structures, and an accent-coloured chevron arrow. The entire card is clickable and navigates to the relevant page.

## Visual design

- Cards sit in a `flex gap` row, sized to their content (not stretched to full table width)
- Style: `bg-card border border-border rounded-lg` — consistent with existing table cards
- Layout per card: title (semibold, foreground) + count (muted) on the left, `›` chevron in accent colour (`text-accent/70`) on the right
- Hover state: slightly lighter background, darker border — same pattern as tournament rows
- No section label above the cards (kept minimal)

## Data

The tournaments page loader (`+page.ts`) needs two additional count queries:

```ts
const { count: blindCount } = await supabase
  .from('blind_structures')
  .select('*', { count: 'exact', head: true })
  .eq('club_id', club.id);

const { count: prizeCount } = await supabase
  .from('prize_structures')
  .select('*', { count: 'exact', head: true })
  .eq('club_id', club.id);
```

Both counts are passed through `+page.svelte` as `data.blindStructureCount` and `data.prizeStructureCount`.

## Interaction

Whole card is clickable via `onclick={() => goto(...)}`, consistent with how tournament rows work. No separate "Manage →" link inside the card.

## Files changed

- `src/routes/[club]/admin/tournaments/+page.ts` — add count queries to loader
- `src/routes/[club]/admin/tournaments/+page.svelte` — replace footer links with card components

## Out of scope

- No changes to sidebar navigation
- No changes to blind-structures or prize-structures pages themselves
- No i18n changes needed (existing `m.blind_structures_title()` and `m.prize_structures_title()` messages are reused)
