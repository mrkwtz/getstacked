# Structure Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the muted text links on the tournaments page with compact, clickable cards showing blind/prize structure counts.

**Architecture:** Two changes in tandem — the page loader adds two `count` queries to Supabase, and the Svelte template replaces the `<div class="flex gap-6">` footer links with inline card elements. No new files needed.

**Tech Stack:** SvelteKit (Svelte 5 runes), Supabase JS client, Tailwind CSS v4

---

## File map

| File | Change |
|------|--------|
| `src/routes/[club]/admin/tournaments/+page.ts` | Add `blindStructureCount` and `prizeStructureCount` to loader return |
| `src/routes/[club]/admin/tournaments/+page.svelte` | Replace footer text links with clickable card elements |

---

### Task 1: Add structure counts to the loader

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/+page.ts`

This task has no unit-testable logic (it's a DB query). Verification is via type-check.

- [ ] **Step 1: Update the loader**

Replace the entire contents of `src/routes/[club]/admin/tournaments/+page.ts` with:

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [
    { data: tournaments },
    { count: blindStructureCount },
    { count: prizeStructureCount },
  ] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .eq('club_id', club.id)
      .order('date', { ascending: false }),
    supabase
      .from('blind_structures')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', club.id),
    supabase
      .from('prize_structures')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', club.id),
  ]);

  return {
    tournaments: tournaments ?? [],
    blindStructureCount: blindStructureCount ?? 0,
    prizeStructureCount: prizeStructureCount ?? 0,
  };
};
```

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: no errors related to `+page.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/+page.ts
git commit -m "feat: add blind/prize structure counts to tournaments loader"
```

---

### Task 2: Replace footer links with structure cards

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/+page.svelte`

- [ ] **Step 1: Update the props type and replace the footer**

In `src/routes/[club]/admin/tournaments/+page.svelte`:

1. Update the `$props` type to include the new counts (line 6):

```svelte
const { data } = $props<{
  data: {
    tournaments: Tournament[];
    club: { slug: string };
    blindStructureCount: number;
    prizeStructureCount: number;
  };
}>();
```

2. Replace the footer links block (the `<div class="flex gap-6">` at the bottom, lines 72–79) with:

```svelte
<div class="flex gap-3">
  <button
    type="button"
    onclick={() => goto(`/${data.club.slug}/admin/blind-structures`)}
    class="flex items-center justify-between gap-5 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
  >
    <div>
      <p class="text-sm font-semibold text-foreground">{m.blind_structures_title()}</p>
      <p class="text-xs text-muted-foreground">{data.blindStructureCount} structures</p>
    </div>
    <span class="text-accent/70 text-base leading-none">›</span>
  </button>

  <button
    type="button"
    onclick={() => goto(`/${data.club.slug}/admin/prize-structures`)}
    class="flex items-center justify-between gap-5 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
  >
    <div>
      <p class="text-sm font-semibold text-foreground">{m.prize_structures_title()}</p>
      <p class="text-xs text-muted-foreground">{data.prizeStructureCount} structures</p>
    </div>
    <span class="text-accent/70 text-base leading-none">›</span>
  </button>
</div>
```

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Verify in the browser**

```bash
npm run dev
```

Open the tournaments page. Confirm:
- Two compact cards appear below the tournament list
- Each card shows the correct title and count
- Clicking either card navigates to the correct page
- Cards don't stretch to full table width

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/tournaments/+page.svelte
git commit -m "feat: replace structure text links with clickable cards on tournaments page"
```
