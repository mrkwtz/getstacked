<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import { validatePayouts } from '$lib/tournaments';

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

  let payouts = $state([{ position: 1, percentage: '' }]);

  function addPayout() {
    payouts = [...payouts, { position: payouts.length + 1, percentage: '' }];
  }

  function removePayout(i: number) {
    payouts = payouts.filter((_, idx) => idx !== i);
  }

  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate() {
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
      const { error } = await supabase
        .from('prize_structures')
        .insert({ club_id: data.club.id, name: name.trim(), payouts: parsedPayouts });
      if (error) { errorKey = 'server_error'; return; }
      name = '';
      payouts = [{ position: 1, percentage: '' }];
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
      const { data: linked } = await supabase
        .from('tournaments')
        .select('id')
        .eq('prize_structure_id', id)
        .eq('club_id', data.club.id)
        .limit(1);
      if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
      await supabase.from('prize_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">Prize structures</h1>

  <!-- List -->
  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">No prize structures yet.</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Places</span>
        <span></span>
      </div>
      {#each data.structures as s}
        <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{s.name}</span>
          <span class="text-xs text-muted-foreground">{s.payouts.length}</span>
          <div class="flex justify-end">
            {#if s.in_use}
              <span class="text-xs text-muted-foreground">In use</span>
            {:else}
              <button type="button" onclick={() => handleDelete(s.id)} class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Delete
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">New prize structure</h2>
    <div class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          Name
        </label>
        <input
          id="ps-name" type="text"
          bind:value={name}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <!-- Payouts table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-muted-foreground">
              <th class="text-left font-medium pb-2">Place</th>
              <th class="text-left font-medium pb-2">Percentage (%)</th>
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
                  <input type="number" min="0.01" max="100" step="0.01" bind:value={payout.percentage}
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
        + Add place
      </button>

      {#if errorKey}
        <p class="text-xs text-accent">{resolveError(errorKey)}</p>
      {/if}

      <button type="button" onclick={handleCreate}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        Create
      </button>
    </div>
  </div>
</div>
