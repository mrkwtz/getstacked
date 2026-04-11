<script lang="ts">
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import type { Tournament } from '$lib/types';

  const { data } = $props<{
    data: {
      tournaments: Tournament[];
      club: { slug: string };
      blindStructureCount: number;
      prizeStructureCount: number;
    };
  }>();

  function statusLabel(status: Tournament['status']): string {
    if (status === 'registration') return m.tournament_status_registration();
    if (status === 'running') return m.tournament_status_running();
    return m.tournament_status_finished();
  }

  function statusClass(status: Tournament['status']): string {
    if (status === 'registration') return 'bg-accent/15 text-accent';
    if (status === 'running') return 'bg-amber-500/15 text-amber-500';
    return 'bg-muted text-muted-foreground';
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function formatLabel(format: Tournament['format']): string {
    return format === 'freezeout' ? m.tournament_format_freezeout() : m.tournament_format_rebuy();
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-start justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.tournament_list_title()}</h1>
    <a
      href="/{data.club.slug}/admin/tournaments/new"
      class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors"
    >
      {m.tournament_new_button()}
    </a>
  </div>

  {#if data.tournaments.length === 0}
    <p class="text-sm text-muted-foreground">{m.tournament_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Name</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Date</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Format</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.tournaments as tournament}
            <tr onclick={() => goto(`/${data.club.slug}/admin/tournaments/${tournament.id}`)}
              class="border-b border-border last:border-0 hover:bg-card/80 cursor-pointer transition-colors">
              <td class="px-4 py-3 text-sm font-medium text-foreground">{tournament.name}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(tournament.date)}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatLabel(tournament.format)}</td>
              <td class="px-4 py-3">
                <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(tournament.status)}">
                  {statusLabel(tournament.status)}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <div class="flex gap-3">
    <button
      type="button"
      onclick={() => goto(`/${data.club.slug}/admin/blind-structures`)}
      class="flex items-center justify-between gap-5 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
    >
      <div>
        <p class="text-sm font-semibold text-foreground">{m.blind_structures_title()}</p>
        <p class="text-xs text-muted-foreground">{m.structure_count({ count: data.blindStructureCount })}</p>
      </div>
      <span class="text-accent/70 text-base leading-none" aria-hidden="true">›</span>
    </button>

    <button
      type="button"
      onclick={() => goto(`/${data.club.slug}/admin/prize-structures`)}
      class="flex items-center justify-between gap-5 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
    >
      <div>
        <p class="text-sm font-semibold text-foreground">{m.prize_structures_title()}</p>
        <p class="text-xs text-muted-foreground">{m.structure_count({ count: data.prizeStructureCount })}</p>
      </div>
      <span class="text-accent/70 text-base leading-none" aria-hidden="true">›</span>
    </button>
  </div>
</div>
