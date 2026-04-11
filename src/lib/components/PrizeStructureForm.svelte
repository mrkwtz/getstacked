<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let {
    payouts = $bindable<{ position: number; percentage: string }[]>([
      { position: 1, percentage: '' },
    ]),
  }: { payouts: { position: number; percentage: string }[] } = $props();

  function addPayout() {
    payouts = [...payouts, { position: payouts.length + 1, percentage: '' }];
  }

  function removePayout(i: number) {
    payouts = payouts.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-3">
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
        {#each payouts as payout, i}
          <tr>
            <td class="pr-2 pb-2">
              <span class="text-sm text-foreground">{i + 1}</span>
            </td>
            <td class="pr-2 pb-2">
              <input type="number" min="0" max="100" step="0.01" bind:value={payout.percentage}
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
    + {m.prize_structure_add_payout()}
  </button>
</div>
