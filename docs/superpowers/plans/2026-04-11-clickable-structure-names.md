# Clickable Structure Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate "Edit blind structure" / "Edit prize structure" buttons in the tournament details header with clickable structure names inline in the meta line.

**Architecture:** The `metaLine` derived string is replaced by inline template elements. The blind and prize structure names become `<button>` elements that open the existing edit modals. The two standalone edit buttons below the meta line are removed.

**Tech Stack:** SvelteKit, Svelte 5 runes, Tailwind CSS v4

---

### Task 1: Replace metaLine with inline template elements

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

This is a pure template change — no business logic, no new functions. The existing `openBlindEditModal` and `openPrizeEditModal` functions stay untouched.

- [ ] **Step 1: Remove the `metaLine` derived value (lines 63–69)**

Delete this block from the `<script>` section:

```ts
  const metaLine = $derived([
    formatDate(t.date),
    formatLabel,
    `€${(t.buy_in_amount / 100).toFixed(2)} buy-in`,
    t.blind_structures?.name,
    t.prize_structures?.name,
  ].filter(Boolean).join(' · '));
```

- [ ] **Step 2: Replace the `<p>{metaLine}</p>` and the two edit buttons (lines 753–765)**

Replace this block:

```svelte
      <p class="text-xs text-muted-foreground mt-1">{metaLine}</p>
      {#if t.blind_levels || t.blind_structures}
        <button type="button" onclick={openBlindEditModal}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-0.5">
          {m.tournament_edit_blind_structure()}
        </button>
      {/if}
      {#if t.prize_payouts || t.prize_structures}
        <button type="button" onclick={openPrizeEditModal}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-0.5">
          {m.tournament_edit_prize_structure()}
        </button>
      {/if}
```

With this single meta line that renders each part individually:

```svelte
      <p class="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1">
        <span>{formatDate(t.date)}</span>
        <span>·</span>
        <span>{formatLabel}</span>
        <span>·</span>
        <span>€{(t.buy_in_amount / 100).toFixed(2)} buy-in</span>
        {#if t.blind_structures?.name}
          <span>·</span>
          <button type="button" onclick={openBlindEditModal}
            class="hover:underline hover:text-foreground transition-colors cursor-pointer">
            {t.blind_structures.name}
          </button>
        {/if}
        {#if t.prize_structures?.name}
          <span>·</span>
          <button type="button" onclick={openPrizeEditModal}
            class="hover:underline hover:text-foreground transition-colors cursor-pointer">
            {t.prize_structures.name}
          </button>
        {/if}
      </p>
```

- [ ] **Step 3: Verify the dev server renders correctly**

Run: `npm run dev`

Navigate to a tournament detail page and verify:
- The meta line shows date · format · buy-in · blind name · prize name on one line
- Clicking the blind structure name opens the blind edit modal
- Clicking the prize structure name opens the prize edit modal
- The two standalone edit buttons are gone

- [ ] **Step 4: Run type check**

Run: `npm run check`

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/\[club\]/admin/tournaments/\[id\]/+page.svelte
git commit -m "feat: make structure names in tournament header clickable to open edit modals"
```
