<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      blindStructures: { id: string; name: string }[];
      prizeStructures: { id: string; name: string }[];
      club: { slug: string };
    };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let format = $state('freezeout');
</script>

<div class="flex flex-col gap-6 max-w-lg">
  <h1 class="text-base font-semibold text-foreground">{m.tournament_new_title()}</h1>

  <div class="bg-card border border-border rounded-lg p-5">
    <form method="POST" action="?/create_tournament" use:enhance class="flex flex-col gap-4">

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_name_label()}
          </label>
          <input id="t-name" name="name" type="text" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label for="t-date" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_date_label()}
          </label>
          <input id="t-date" name="date" type="date" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-format" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_format_label()}
          </label>
          <select id="t-format" name="format" bind:value={format} required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
            <option value="freezeout">{m.tournament_format_freezeout()}</option>
            <option value="rebuy">{m.tournament_format_rebuy()}</option>
          </select>
        </div>
        <div>
          <label for="t-buyin" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buyin_label()}
          </label>
          <input id="t-buyin" name="buy_in" type="number" min="1" step="0.01" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>

      {#if format === 'rebuy'}
        <div class="grid grid-cols-2 gap-4 bg-accent/5 border border-accent/20 rounded-md p-3">
          <div>
            <label for="t-rebuy" class="block text-xs font-medium text-accent mb-1.5">
              {m.tournament_rebuy_label()}
            </label>
            <input id="t-rebuy" name="rebuy_amount" type="number" min="1" step="0.01" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label for="t-addon" class="block text-xs font-medium text-accent mb-1.5">
              {m.tournament_addon_label()}
            </label>
            <input id="t-addon" name="addon_amount" type="number" min="1" step="0.01"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-bs" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_blind_structure_label()}
          </label>
          {#if data.blindStructures.length === 0}
            <p class="text-xs text-accent">
              <a href="/{data.club.slug}/admin/blind-structures" class="underline">{m.error_no_blind_structures()}</a>
            </p>
          {:else}
            <select id="t-bs" name="blind_structure_id" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
              <option value="">—</option>
              {#each data.blindStructures as bs}
                <option value={bs.id}>{bs.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div>
          <label for="t-ps" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_prize_structure_label()}
          </label>
          {#if data.prizeStructures.length === 0}
            <p class="text-xs text-accent">
              <a href="/{data.club.slug}/admin/prize-structures" class="underline">{m.error_no_prize_structures()}</a>
            </p>
          {:else}
            <select id="t-ps" name="prize_structure_id" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
              <option value="">—</option>
              {#each data.prizeStructures as ps}
                <option value={ps.id}>{ps.name}</option>
              {/each}
            </select>
          {/if}
        </div>
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.tournament_create_button()}
      </button>
    </form>
  </div>
</div>
