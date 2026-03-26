<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { slug: string; id: string };
      blindStructures: { id: string; name: string }[];
      prizeStructures: { id: string; name: string }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let name = $state('');
  let date = $state('');
  let buyIn = $state('');
  let rebuyAmount = $state('');
  let addonAmount = $state('');
  let blindStructureId = $state('');
  let prizeStructureId = $state('');
  let format = $state('freezeout');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate() {
    if (loading) return;
    errorKey = null;
    if (!name.trim() || !date || !buyIn) { errorKey = 'error_required'; return; }

    loading = true;
    try {
      const supabase = createClient();
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          club_id: data.club.id,
          name: name.trim(),
          date,
          format,
          buy_in: Number(buyIn),
          rebuy_amount: rebuyAmount ? Number(rebuyAmount) : null,
          addon_amount: addonAmount ? Number(addonAmount) : null,
          blind_structure_id: blindStructureId || null,
          prize_structure_id: prizeStructureId || null,
          status: 'registration',
        })
        .select('id')
        .single();
      if (error) { errorKey = 'server_error'; return; }
      await goto(`/${data.club.slug}/admin/tournaments/${tournament.id}`);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.tournament_new_title()}</h1>

  <div class="bg-card border border-border rounded-lg p-5">
    <div class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="t-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_name_label()}
        </label>
        <input
          id="t-name" type="text"
          bind:value={name}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label for="t-date" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_date_label()}
        </label>
        <input
          id="t-date" type="date"
          bind:value={date}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label for="t-buyin" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_buy_in_label()}
        </label>
        <input
          id="t-buyin" type="number" min="0" step="1"
          bind:value={buyIn}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label for="t-rebuy" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_rebuy_label()}
        </label>
        <input
          id="t-rebuy" type="number" min="0" step="1"
          bind:value={rebuyAmount}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label for="t-addon" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_addon_label()}
        </label>
        <input
          id="t-addon" type="number" min="0" step="1"
          bind:value={addonAmount}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label for="t-blind" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_blind_structure_label()}
        </label>
        <select
          id="t-blind"
          bind:value={blindStructureId}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_none_option()}</option>
          {#each data.blindStructures as bs}
            <option value={bs.id}>{bs.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="t-prize" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_prize_structure_label()}
        </label>
        <select
          id="t-prize"
          bind:value={prizeStructureId}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_none_option()}</option>
          {#each data.prizeStructures as ps}
            <option value={ps.id}>{ps.name}</option>
          {/each}
        </select>
      </div>

      {#if errorKey}
        <p class="text-xs text-accent">{resolveError(errorKey)}</p>
      {/if}

      <button
        type="button"
        onclick={handleCreate}
        disabled={loading}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {m.tournament_create_button()}
      </button>
    </div>
  </div>
</div>
