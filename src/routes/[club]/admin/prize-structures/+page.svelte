<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import { validatePayouts } from '$lib/tournaments';
  import PrizeStructureForm from '$lib/components/PrizeStructureForm.svelte';

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

  function payoutSummary(payouts: { position: number; percentage: number }[]): string {
    return payouts
      .sort((a, b) => a.position - b.position)
      .map((p) => `${p.position}. ${p.percentage}%`)
      .join(', ');
  }

  let payouts = $state<{ position: number; percentage: string }[]>([{ position: 1, percentage: '' }]);
  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let editingId = $state<string | null>(null);

  function startEdit(s: typeof data.structures[number]) {
    editingId = s.id;
    name = s.name;
    payouts = s.payouts
      .sort((a: { position: number; percentage: number }, b: { position: number; percentage: number }) => a.position - b.position)
      .map((p: { position: number; percentage: number }, i: number) => ({ position: i + 1, percentage: String(p.percentage) }));
    errorKey = null;
    document.getElementById('ps-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    name = '';
    payouts = [{ position: 1, percentage: '' }];
    errorKey = null;
  }

  async function handleSubmit() {
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
      if (editingId) {
        const { error } = await supabase
          .from('prize_structures')
          .update({ name: name.trim(), payouts: parsedPayouts })
          .eq('id', editingId)
          .eq('club_id', data.club.id);
        if (error) { errorKey = 'server_error'; return; }
      } else {
        const { error } = await supabase
          .from('prize_structures')
          .insert({ club_id: data.club.id, name: name.trim(), payouts: parsedPayouts });
        if (error) { errorKey = 'server_error'; return; }
      }
      cancelEdit();
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
      await supabase.from('prize_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.prize_structures_title()}</h1>

  <!-- List -->
  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.prize_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Name</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Payouts</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.structures as s}
            <tr class="border-b border-border last:border-0">
              <td class="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{payoutSummary(s.payouts)}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-3">
                  <button type="button" onclick={() => startEdit(s)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.prize_structure_edit_button()}
                  </button>
                  <button type="button" onclick={() => handleDelete(s.id)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.common_delete()}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create/Edit form -->
  <div id="ps-form" class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">
      {editingId ? m.prize_structure_edit_title() : m.prize_structure_new_title()}
    </h2>
    <div class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.prize_structure_name_label()}
        </label>
        <input
          id="ps-name" type="text"
          bind:value={name}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <PrizeStructureForm bind:payouts />

      {#if errorKey}
        <p class="text-xs text-accent">{resolveError(errorKey)}</p>
      {/if}

      <div class="flex gap-3">
        <button type="button" onclick={handleSubmit}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
          {editingId ? m.prize_structure_save_button() : m.prize_structure_create_button()}
        </button>
        {#if editingId}
          <button type="button" onclick={cancelEdit}
            class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            {m.tournament_cancel_review()}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
