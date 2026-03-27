<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      blindStructures: { id: string; name: string }[];
      prizeStructures: { id: string; name: string }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let format = $state('freezeout');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let fieldErrors = $state<Record<string, boolean>>({});

  function clearFieldError(field: string) {
    if (fieldErrors[field]) fieldErrors = { ...fieldErrors, [field]: false };
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    loading = true;
    errorKey = null;
    fieldErrors = {};
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const name = formData.get('name')?.toString().trim() ?? '';
      const date = formData.get('date')?.toString() ?? '';
      const formatVal = formData.get('format')?.toString() ?? '';
      const buyInRaw = formData.get('buy_in')?.toString() ?? '';
      const rebuyRaw = formData.get('rebuy_amount')?.toString() ?? '';
      const addonRaw = formData.get('addon_amount')?.toString() ?? '';
      const blindStructureId = formData.get('blind_structure_id')?.toString() ?? '';
      const prizeStructureId = formData.get('prize_structure_id')?.toString() ?? '';

      const buyIn = Math.round(parseFloat(buyInRaw) * 100);
      const errors: Record<string, boolean> = {};
      if (!name) errors.name = true;
      if (!date) errors.date = true;
      if (!buyInRaw || buyIn <= 0) errors.buy_in = true;

      let rebuyAmount: number | null = null;
      let addonAmount: number | null = null;
      if (formatVal === 'rebuy') {
        const rebuyVal = Math.round(parseFloat(rebuyRaw) * 100);
        if (!rebuyRaw || rebuyVal <= 0) errors.rebuy_amount = true;
        else rebuyAmount = rebuyVal;
        if (addonRaw) {
          addonAmount = Math.round(parseFloat(addonRaw) * 100);
          if (addonAmount <= 0) { errors.addon_amount = true; addonAmount = null; }
        }
      }

      if (Object.values(errors).some(Boolean)) {
        fieldErrors = errors;
        errorKey = 'error_required';
        return;
      }

      const supabase = createClient();

      if (blindStructureId) {
        const { data: bs } = await supabase.from('blind_structures').select('id').eq('id', blindStructureId).eq('club_id', data.club.id).single();
        if (!bs) { errorKey = 'error_required'; return; }
      }
      if (prizeStructureId) {
        const { data: ps } = await supabase.from('prize_structures').select('id').eq('id', prizeStructureId).eq('club_id', data.club.id).single();
        if (!ps) { errorKey = 'error_required'; return; }
      }

      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          club_id: data.club.id,
          name,
          date,
          format: formatVal,
          buy_in: buyIn,
          rebuy_amount: rebuyAmount,
          addon_amount: addonAmount,
          blind_structure_id: blindStructureId || null,
          prize_structure_id: prizeStructureId || null,
          status: 'registration',
        })
        .select('id')
        .single();

      if (error || !tournament) { errorKey = 'server_error'; return; }
      goto(`/${data.club.slug}/admin/tournaments/${tournament.id}`);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.tournament_new_title()}</h1>

  <div class="bg-card border border-border rounded-lg p-5">
    <form class="flex flex-col gap-4 max-w-lg" onsubmit={handleCreate}>
      <div>
        <label for="t-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_name_label()}
        </label>
        <input
          id="t-name" type="text" name="name"
          oninput={() => clearFieldError('name')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors {fieldErrors.name ? 'border-accent' : 'border-input'}"
        />
      </div>

      <div>
        <label for="t-date" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_date_label()}
        </label>
        <input
          id="t-date" type="date" name="date"
          onchange={() => clearFieldError('date')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {fieldErrors.date ? 'border-accent' : 'border-input'}"
        />
      </div>

      <div>
        <label for="t-format" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_format_label()}
        </label>
        <select
          id="t-format" name="format"
          bind:value={format}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="freezeout">{m.tournament_format_freezeout()}</option>
          <option value="rebuy">{m.tournament_format_rebuy()}</option>
        </select>
      </div>

      <div>
        <label for="t-buyin" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_buy_in_label()}
        </label>
        <input
          id="t-buyin" type="number" name="buy_in" min="0" step="0.01"
          oninput={() => clearFieldError('buy_in')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {fieldErrors.buy_in ? 'border-accent' : 'border-input'}"
        />
      </div>

      {#if format === 'rebuy'}
        <div>
          <label for="t-rebuy" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_rebuy_label()}
          </label>
          <input
            id="t-rebuy" type="number" name="rebuy_amount" min="0" step="0.01"
            oninput={() => clearFieldError('rebuy_amount')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {fieldErrors.rebuy_amount ? 'border-accent' : 'border-input'}"
          />
        </div>

        <div>
          <label for="t-addon" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_addon_label()}
          </label>
          <input
            id="t-addon" type="number" name="addon_amount" min="0" step="0.01"
            oninput={() => clearFieldError('addon_amount')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {fieldErrors.addon_amount ? 'border-accent' : 'border-input'}"
          />
        </div>
      {/if}

      <div>
        <label for="t-blind" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_blind_structure_label()}
        </label>
        <select
          id="t-blind" name="blind_structure_id"
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
          id="t-prize" name="prize_structure_id"
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
        type="submit"
        disabled={loading}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {m.tournament_create_button()}
      </button>
    </form>
  </div>
</div>
