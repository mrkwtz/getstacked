<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  export type LevelRow =
    | { type: 'level'; small_blind: string; big_blind: string; ante: string; duration_minutes: string; label: string }
    | { type: 'break'; duration_minutes: string; label: string };

  let {
    levels = $bindable<LevelRow[]>([
      { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
    ]),
  }: { levels: LevelRow[] } = $props();

  function addLevel() {
    levels = [...levels, { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
  }

  function addBreak() {
    levels = [...levels, { type: 'break', duration_minutes: '', label: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-3">
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="text-muted-foreground">
          <th class="text-left font-medium pb-2 pr-2 w-10">#</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_duration_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_sb_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_bb_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_ante_label()}</th>
          <th class="text-left font-medium pb-2 pr-2">Label</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each levels as level, i}
          <tr>
            <td class="pr-2 pb-2">
              {#if level.type === 'break'}
                <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-accent/15 text-accent">BRK</span>
              {:else}
                <span class="text-xs text-muted-foreground">{i + 1 - levels.slice(0, i).filter((l) => l.type === 'break').length}</span>
              {/if}
            </td>
            <td class="pr-2 pb-2">
              <input type="number" min="1" bind:value={level.duration_minutes}
                class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            </td>
            {#if level.type === 'level'}
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
            {:else}
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
              <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
            {/if}
            <td class="pr-2 pb-2">
              {#if level.type === 'break'}
                <input type="text" bind:value={level.label}
                  placeholder={m.blind_structure_break_label_placeholder()}
                  class="w-36 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent" />
              {/if}
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

  <div class="flex gap-4">
    <button type="button" onclick={addLevel}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.blind_structure_add_level()}
    </button>
    <button type="button" onclick={addBreak}
      class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
      + {m.blind_structure_add_break()}
    </button>
  </div>
</div>
