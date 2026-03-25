<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Tournament } from '$lib/types';

  const { data } = $props<{ data: { tournaments: Tournament[]; club: { slug: string } } }>();

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
  <div class="flex items-center justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.tournament_list_title()}</h1>
    <a
      href="/{data.club.slug}/admin/tournaments/new"
      class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors"
    >
      {m.tournament_new_button()}
    </a>
  </div>

  {#if data.tournaments.length === 0}
    <p class="text-sm text-muted-foreground">{m.tournament_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_80px_100px_120px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Date</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Format</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Status</span>
      </div>
      {#each data.tournaments as tournament}
        <a
          href="/{data.club.slug}/admin/tournaments/{tournament.id}"
          class="grid grid-cols-[1fr_80px_100px_120px] px-4 py-3 border-b border-border last:border-0 items-center hover:bg-card/80 transition-colors"
        >
          <span class="text-sm font-medium text-foreground">{tournament.name}</span>
          <span class="text-xs text-muted-foreground">{formatDate(tournament.date)}</span>
          <span class="text-xs text-muted-foreground">{formatLabel(tournament.format)}</span>
          <span class="inline-flex">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(tournament.status)}">
              {statusLabel(tournament.status)}
            </span>
          </span>
        </a>
      {/each}
    </div>
  {/if}

  <div class="flex gap-6">
    <a href="/{data.club.slug}/admin/blind-structures" class="text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-border pb-0.5">
      {m.blind_structures_title()}
    </a>
    <a href="/{data.club.slug}/admin/prize-structures" class="text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-border pb-0.5">
      {m.prize_structures_title()}
    </a>
  </div>
</div>
