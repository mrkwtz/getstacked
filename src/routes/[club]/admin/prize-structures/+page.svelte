<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      structures: {
        id: string;
        name: string;
        payouts: { position: number; percentage: number }[];
        in_use: boolean;
      }[];
    };
    form: { created?: boolean; errorKey?: string } | null;
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

  let payoutRows = $state([{ position: '1', percentage: '' }]);
  const total = $derived(payoutRows.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0));

  function addRow() {
    payoutRows = [...payoutRows, { position: String(payoutRows.length + 1), percentage: '' }];
  }

  function removeRow(i: number) {
    payoutRows = payoutRows.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.prize_structures_title()}</h1>

  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.prize_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_1fr_80px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Payouts</span>
        <span></span>
      </div>
      {#each data.structures as s}
        <div class="grid grid-cols-[1fr_1fr_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{s.name}</span>
          <span class="text-xs text-muted-foreground">{payoutSummary(s.payouts)}</span>
          <div class="flex justify-end">
            {#if s.in_use}
              <span class="text-xs text-muted-foreground">{m.prize_structure_in_use()}</span>
            {:else}
              <form method="POST" action="?/delete_prize_structure" use:enhance>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {m.common_delete()}
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.prize_structure_new_title()}</h2>
    <form method="POST" action="?/create_prize_structure" use:enhance class="flex flex-col gap-4 max-w-sm">
      <div>
        <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.prize_structure_name_label()}
        </label>
        <input
          id="ps-name" name="name" type="text" required
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <div class="flex gap-4 text-xs font-medium text-muted-foreground mb-1.5">
          <span class="w-20">{m.prize_structure_position_label()}</span>
          <span class="w-20">{m.prize_structure_percentage_label()}</span>
        </div>
        {#each payoutRows as row, i}
          <div class="flex gap-2 mb-2 items-center">
            <input name="position" type="number" min="1" required bind:value={row.position}
              class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            <input name="percentage" type="number" min="1" max="100" required bind:value={row.percentage}
              class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            {#if payoutRows.length > 1}
              <button type="button" onclick={() => removeRow(i)}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
            {/if}
          </div>
        {/each}
        <p class="text-xs mt-1 {total === 100 ? 'text-muted-foreground' : 'text-accent'}">
          Total: {total}%
        </p>
      </div>

      <button type="button" onclick={addRow}
        class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
        + {m.prize_structure_add_payout()}
      </button>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit" disabled={total !== 100}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.prize_structure_create_button()}
      </button>
    </form>
  </div>
</div>
