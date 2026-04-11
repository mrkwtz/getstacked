<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import { validatePayouts } from '$lib/tournaments';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      blindStructures: { id: string; name: string; levels: unknown }[];
      prizeStructures: { id: string; name: string; payouts: unknown }[];
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

  // Local copies of structure lists so we can reactively add to them
  let blindStructures = $state([...data.blindStructures]);
  let prizeStructures = $state([...data.prizeStructures]);

  // --- Blind structure modal state ---
  let showBlindModal = $state(false);
  let blindName = $state('');
  let blindLevels = $state([{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }]);
  let blindLoading = $state(false);
  let blindError = $state<string | null>(null);
  let selectedBlindId = $state('');

  function openBlindModal() {
    blindName = '';
    blindLevels = [{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
    blindError = null;
    showBlindModal = true;
  }

  function addBlindLevel() {
    blindLevels = [...blindLevels, { small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
  }

  function removeBlindLevel(i: number) {
    blindLevels = blindLevels.filter((_, idx) => idx !== i);
  }

  async function handleCreateBlind() {
    if (blindLoading) return;
    blindError = null;
    if (!blindName.trim()) { blindError = 'error_required'; return; }
    if (blindLevels.length === 0) { blindError = 'error_required'; return; }

    const parsedLevels = blindLevels.map((l) => ({
      small_blind: Number(l.small_blind),
      big_blind: Number(l.big_blind),
      ante: Number(l.ante),
      duration_minutes: Number(l.duration_minutes),
    }));
    for (const level of parsedLevels) {
      if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.duration_minutes <= 0 || level.ante < 0) {
        blindError = 'error_required';
        return;
      }
    }

    blindLoading = true;
    try {
      const supabase = createClient();
      const { data: created, error } = await supabase
        .from('blind_structures')
        .insert({ club_id: data.club.id, name: blindName.trim(), levels: parsedLevels })
        .select('id, name, levels')
        .single();
      if (error || !created) { blindError = 'server_error'; return; }
      blindStructures = [...blindStructures, created];
      selectedBlindId = created.id;
      showBlindModal = false;
    } finally {
      blindLoading = false;
    }
  }

  // --- Prize structure modal state ---
  let showPrizeModal = $state(false);
  let prizeName = $state('');
  let prizePayouts = $state([{ position: 1, percentage: '' }]);
  let prizeLoading = $state(false);
  let prizeError = $state<string | null>(null);
  let selectedPrizeId = $state('');

  function openPrizeModal() {
    prizeName = '';
    prizePayouts = [{ position: 1, percentage: '' }];
    prizeError = null;
    showPrizeModal = true;
  }

  function addPrizePayout() {
    prizePayouts = [...prizePayouts, { position: prizePayouts.length + 1, percentage: '' }];
  }

  function removePrizePayout(i: number) {
    prizePayouts = prizePayouts.filter((_, idx) => idx !== i);
  }

  async function handleCreatePrize() {
    if (prizeLoading) return;
    prizeError = null;
    if (!prizeName.trim()) { prizeError = 'error_required'; return; }
    if (prizePayouts.length === 0) { prizeError = 'error_required'; return; }

    const parsedPayouts = prizePayouts.map((p, i) => ({
      position: i + 1,
      percentage: Number(p.percentage),
    }));
    const validationError = validatePayouts(parsedPayouts);
    if (validationError) { prizeError = validationError; return; }

    prizeLoading = true;
    try {
      const supabase = createClient();
      const { data: created, error } = await supabase
        .from('prize_structures')
        .insert({ club_id: data.club.id, name: prizeName.trim(), payouts: parsedPayouts })
        .select('id, name, payouts')
        .single();
      if (error || !created) { prizeError = 'server_error'; return; }
      prizeStructures = [...prizeStructures, created];
      selectedPrizeId = created.id;
      showPrizeModal = false;
    } finally {
      prizeLoading = false;
    }
  }

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
      const buyInRaw = formData.get('buy_in_amount')?.toString() ?? '';
      const rebuyRaw = formData.get('rebuy_amount')?.toString() ?? '';
      const addonRaw = formData.get('addon_amount')?.toString() ?? '';
      const buyInRakeRaw = formData.get('buy_in_rake')?.toString() ?? '';
      const rebuyRakeRaw = formData.get('rebuy_rake')?.toString() ?? '';
      const addonRakeRaw = formData.get('addon_rake')?.toString() ?? '';
      const buyInChipsRaw = formData.get('buy_in_chips')?.toString() ?? '';
      const rebuyChipsRaw = formData.get('rebuy_chips')?.toString() ?? '';
      const addonChipsRaw = formData.get('addon_chips')?.toString() ?? '';
      const blindStructureId = formData.get('blind_structure_id')?.toString() ?? '';
      const prizeStructureId = formData.get('prize_structure_id')?.toString() ?? '';

      const buyIn = Math.round(parseFloat(buyInRaw) * 100);
      const errors: Record<string, boolean> = {};
      if (!name) errors.name = true;
      if (!date) errors.date = true;
      if (!buyInRaw || buyIn <= 0) errors.buy_in_amount = true;
      let buyInChips: number | null = null;
      const buyInChipsVal = buyInChipsRaw ? parseInt(buyInChipsRaw, 10) : NaN;
      if (!buyInChipsRaw || isNaN(buyInChipsVal) || buyInChipsVal < 1) errors.buy_in_chips = true;
      else buyInChips = buyInChipsVal;

      let rebuyAmount: number | null = null;
      let addonAmount: number | null = null;
      if (formatVal === 'rebuy') {
        const rebuyVal = Math.round(parseFloat(rebuyRaw) * 100);
        if (!rebuyRaw || rebuyVal <= 0) errors.rebuy_amount = true;
        else rebuyAmount = rebuyVal;
        const addonVal = Math.round(parseFloat(addonRaw) * 100);
        if (!addonRaw || addonVal <= 0) errors.addon_amount = true;
        else addonAmount = addonVal;
      }

      let rebuyChips: number | null = null;
      let addonChips: number | null = null;
      if (formatVal === 'rebuy') {
        const rebuyChipsVal = rebuyChipsRaw ? parseInt(rebuyChipsRaw, 10) : NaN;
        if (!rebuyChipsRaw || isNaN(rebuyChipsVal) || rebuyChipsVal < 1) errors.rebuy_chips = true;
        else rebuyChips = rebuyChipsVal;
        const addonChipsVal = addonChipsRaw ? parseInt(addonChipsRaw, 10) : NaN;
        if (!addonChipsRaw || isNaN(addonChipsVal) || addonChipsVal < 1) errors.addon_chips = true;
        else addonChips = addonChipsVal;
      }

      const buyInRake = buyInRakeRaw ? Math.round(parseFloat(buyInRakeRaw) * 100) : null;
      if (buyInRake !== null && buyInRake < 0) errors.buy_in_rake = true;
      if (buyInRake !== null && buyInRake >= buyIn) errors.buy_in_rake = true;

      let rebuyRake: number | null = null;
      let addonRake: number | null = null;
      if (formatVal === 'rebuy') {
        rebuyRake = rebuyRakeRaw ? Math.round(parseFloat(rebuyRakeRaw) * 100) : null;
        if (rebuyRake !== null && rebuyRake < 0) errors.rebuy_rake = true;
        if (rebuyRake !== null && rebuyAmount !== null && rebuyRake >= rebuyAmount) errors.rebuy_rake = true;
        addonRake = addonRakeRaw ? Math.round(parseFloat(addonRakeRaw) * 100) : null;
        if (addonRake !== null && addonRake < 0) errors.addon_rake = true;
        if (addonRake !== null && addonAmount !== null && addonRake >= addonAmount) errors.addon_rake = true;
      }

      if (Object.values(errors).some(Boolean)) {
        fieldErrors = errors;
        errorKey = 'error_required';
        return;
      }

      const selectedBlind = blindStructureId
        ? blindStructures.find((bs) => bs.id === blindStructureId) ?? null
        : null;
      const selectedPrize = prizeStructureId
        ? prizeStructures.find((ps) => ps.id === prizeStructureId) ?? null
        : null;

      const supabase = createClient();

      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          club_id: data.club.id,
          name,
          date,
          format: formatVal,
          buy_in_amount: buyIn,
          rebuy_amount: rebuyAmount,
          addon_amount: addonAmount,
          buy_in_rake: buyInRake,
          rebuy_rake: rebuyRake,
          addon_rake: addonRake,
          buy_in_chips: buyInChips,
          rebuy_chips: rebuyChips,
          addon_chips: addonChips,
          blind_structure_id: blindStructureId || null,
          prize_structure_id: prizeStructureId || null,
          blind_levels: selectedBlind ? selectedBlind.levels : null,
          prize_payouts: selectedPrize ? selectedPrize.payouts : null,
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
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.name ? 'ring-2 ring-accent' : ''}"
        />
      </div>

      <div>
        <label for="t-date" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_date_label()}
        </label>
        <input
          id="t-date" type="date" name="date" value={new Date().toISOString().slice(0, 10)}
          onchange={() => clearFieldError('date')}
          class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.date ? 'ring-2 ring-accent' : ''}"
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

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="t-buyin" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buy_in_label()}
          </label>
          <input
            id="t-buyin" type="number" name="buy_in_amount" min="0" step="0.01"
            oninput={() => clearFieldError('buy_in_amount')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_amount ? 'ring-2 ring-accent' : ''}"
          />
        </div>
        <div>
          <label for="t-buyin-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buy_in_rake_label()}
          </label>
          <input
            id="t-buyin-rake" type="number" name="buy_in_rake" min="0" step="0.01"
            oninput={() => clearFieldError('buy_in_rake')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_rake ? 'ring-2 ring-accent' : ''}"
          />
        </div>
        <div>
          <label for="t-buyin-chips" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buy_in_chips_label()}
          </label>
          <input
            id="t-buyin-chips" type="number" name="buy_in_chips" min="1" step="1"
            oninput={() => clearFieldError('buy_in_chips')}
            class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.buy_in_chips ? 'ring-2 ring-accent' : ''}"
          />
        </div>
      </div>

      <div>
        <label for="t-blind" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_blind_structure_label()}
        </label>
        <div class="flex gap-2">
          <select
            id="t-blind" name="blind_structure_id"
            bind:value={selectedBlindId}
            class="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">{m.tournament_none_option()}</option>
            {#each blindStructures as bs}
              <option value={bs.id}>{bs.name}</option>
            {/each}
          </select>
          <button type="button" onclick={openBlindModal}
            class="px-2.5 py-2 bg-background border border-input rounded-md text-sm text-muted-foreground hover:text-foreground hover:border-accent transition-colors cursor-pointer">
            +
          </button>
        </div>
      </div>

      <div>
        <label for="t-prize" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.tournament_prize_structure_label()}
        </label>
        <div class="flex gap-2">
          <select
            id="t-prize" name="prize_structure_id"
            bind:value={selectedPrizeId}
            class="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">{m.tournament_none_option()}</option>
            {#each prizeStructures as ps}
              <option value={ps.id}>{ps.name}</option>
            {/each}
          </select>
          <button type="button" onclick={openPrizeModal}
            class="px-2.5 py-2 bg-background border border-input rounded-md text-sm text-foreground hover:text-foreground hover:border-accent transition-colors cursor-pointer">
            +
          </button>
        </div>
      </div>

      {#if format === 'rebuy'}
        <div class="border-2 border-red-500 rounded-lg p-4 flex flex-col gap-4">
          <h3 class="text-sm font-semibold text-foreground">{m.tournament_format_options_title()}</h3>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label for="t-rebuy" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_rebuy_label()}
              </label>
              <input
                id="t-rebuy" type="number" name="rebuy_amount" min="0" step="0.01"
                oninput={() => clearFieldError('rebuy_amount')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.rebuy_amount ? 'ring-2 ring-accent' : ''}"
              />
            </div>
            <div>
              <label for="t-rebuy-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_rebuy_rake_label()}
              </label>
              <input
                id="t-rebuy-rake" type="number" name="rebuy_rake" min="0" step="0.01"
                oninput={() => clearFieldError('rebuy_rake')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.rebuy_rake ? 'ring-2 ring-accent' : ''}"
              />
            </div>
            <div>
              <label for="t-rebuy-chips" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_rebuy_chips_label()}
              </label>
              <input
                id="t-rebuy-chips" type="number" name="rebuy_chips" min="1" step="1"
                oninput={() => clearFieldError('rebuy_chips')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.rebuy_chips ? 'ring-2 ring-accent' : ''}"
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label for="t-addon" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_addon_label()}
              </label>
              <input
                id="t-addon" type="number" name="addon_amount" min="0" step="0.01"
                oninput={() => clearFieldError('addon_amount')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.addon_amount ? 'ring-2 ring-accent' : ''}"
              />
            </div>
            <div>
              <label for="t-addon-rake" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_addon_rake_label()}
              </label>
              <input
                id="t-addon-rake" type="number" name="addon_rake" min="0" step="0.01"
                oninput={() => clearFieldError('addon_rake')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.addon_rake ? 'ring-2 ring-accent' : ''}"
              />
            </div>
            <div>
              <label for="t-addon-chips" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.tournament_addon_chips_label()}
              </label>
              <input
                id="t-addon-chips" type="number" name="addon_chips" min="1" step="1"
                oninput={() => clearFieldError('addon_chips')}
                class="w-full px-3 py-2 bg-background border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors ring-offset-background {fieldErrors.addon_chips ? 'ring-2 ring-accent' : ''}"
              />
            </div>
          </div>
        </div>
      {/if}

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

<!-- Blind structure creation modal -->
{#if showBlindModal}
  <div class="fixed inset-0 z-40 bg-black/60" role="presentation" onclick={() => { showBlindModal = false; }}></div>
  <div class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-md mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto">
    <h2 class="text-base font-semibold text-foreground">{m.blind_structure_new_title()}</h2>

    <div>
      <label for="bs-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.blind_structure_name_label()}
      </label>
      <input
        id="bs-name" type="text"
        bind:value={blindName}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-muted-foreground">
            <th class="text-left font-medium pb-2">{m.blind_structure_duration_label()}</th>
            <th class="text-left font-medium pb-2">{m.blind_structure_sb_label()}</th>
            <th class="text-left font-medium pb-2">{m.blind_structure_bb_label()}</th>
            <th class="text-left font-medium pb-2">{m.blind_structure_ante_label()}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each blindLevels as level, i}
            <tr>
              <td class="pr-2 pb-2">
                <input type="number" min="1" bind:value={level.duration_minutes}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="1" bind:value={level.small_blind}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="1" bind:value={level.big_blind}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="0" bind:value={level.ante}
                  class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pb-2">
                {#if blindLevels.length > 1}
                  <button type="button" onclick={() => removeBlindLevel(i)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <button type="button" onclick={addBlindLevel}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.blind_structure_add_level()}
    </button>

    {#if blindError}
      <p class="text-xs text-accent">{resolveError(blindError)}</p>
    {/if}

    <div class="flex items-center gap-4">
      <button type="button" onclick={handleCreateBlind} disabled={blindLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.blind_structure_create_button()}
      </button>
      <button type="button" onclick={() => { showBlindModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </div>
{/if}

<!-- Prize structure creation modal -->
{#if showPrizeModal}
  <div class="fixed inset-0 z-40 bg-black/60" role="presentation" onclick={() => { showPrizeModal = false; }}></div>
  <div class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-md mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto">
    <h2 class="text-base font-semibold text-foreground">{m.prize_structure_new_title()}</h2>

    <div>
      <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.prize_structure_name_label()}
      </label>
      <input
        id="ps-name" type="text"
        bind:value={prizeName}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-muted-foreground">
            <th class="text-left font-medium pb-2">{m.prize_structure_position_label()}</th>
            <th class="text-left font-medium pb-2">{m.prize_structure_percentage_label()}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each prizePayouts as payout, i}
            <tr>
              <td class="pr-2 pb-2">
                <span class="text-sm text-foreground">{i + 1}</span>
              </td>
              <td class="pr-2 pb-2">
                <input type="number" min="0" max="100" step="0.01" bind:value={payout.percentage}
                  class="w-24 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
              </td>
              <td class="pb-2">
                {#if prizePayouts.length > 1}
                  <button type="button" onclick={() => removePrizePayout(i)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <button type="button" onclick={addPrizePayout}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.prize_structure_add_payout()}
    </button>

    {#if prizeError}
      <p class="text-xs text-accent">{resolveError(prizeError)}</p>
    {/if}

    <div class="flex items-center gap-4">
      <button type="button" onclick={handleCreatePrize} disabled={prizeLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.prize_structure_create_button()}
      </button>
      <button type="button" onclick={() => { showPrizeModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </div>
{/if}
