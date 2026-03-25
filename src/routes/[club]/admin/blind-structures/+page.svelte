<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      structures: {
        id: string;
        name: string;
        levels: { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[];
        in_use: boolean;
      }[];
    };
    form: { created?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let levels = $state([{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }]);

  function addLevel() {
    levels = [...levels, { small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.blind_structures_title()}</h1>

  <!-- List -->
  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.blind_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Levels</span>
        <span></span>
      </div>
      {#each data.structures as s}
        <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{s.name}</span>
          <span class="text-xs text-muted-foreground">{s.levels.length}</span>
          <div class="flex justify-end">
            {#if s.in_use}
              <span class="text-xs text-muted-foreground">{m.blind_structure_in_use()}</span>
            {:else}
              <form method="POST" action="?/delete_blind_structure" use:enhance>
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
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.blind_structure_new_title()}</h2>
    <form method="POST" action="?/create_blind_structure" use:enhance class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="bs-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.blind_structure_name_label()}
        </label>
        <input
          id="bs-name" name="name" type="text" required
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <!-- Levels table -->
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
            {#each levels as level, i}
              <tr>
                <td class="pr-2 pb-2">
                  <input name="duration_minutes" type="number" min="1" required bind:value={level.duration_minutes}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="small_blind" type="number" min="1" required bind:value={level.small_blind}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="big_blind" type="number" min="1" required bind:value={level.big_blind}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="ante" type="number" min="0" bind:value={level.ante}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pb-2">
                  {#if levels.length > 1}
                    <button type="button" onclick={() => removeLevel(i)}
                      class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <button type="button" onclick={addLevel}
        class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
        + {m.blind_structure_add_level()}
      </button>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.blind_structure_create_button()}
      </button>
    </form>
  </div>
</div>
