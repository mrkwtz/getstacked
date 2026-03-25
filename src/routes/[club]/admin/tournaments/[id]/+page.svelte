<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { Tournament, TournamentPlayer } from '$lib/types';

  const { data, form } = $props<{
    data: {
      tournament: Tournament;
      players: TournamentPlayer[];
      availableMembers: { user_id: string; display_name: string }[];
      prizePool: number;
    };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

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
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const t = $derived(data.tournament);
  const formatLabel = $derived(
    t.format === 'freezeout' ? m.tournament_format_freezeout() : m.tournament_format_rebuy()
  );
  const metaLine = $derived([
    formatDate(t.date),
    formatLabel,
    `€${(t.buy_in / 100).toFixed(2)} buy-in`,
    t.blind_structures?.name,
    t.prize_structures?.name,
  ].filter(Boolean).join(' · '));

  let selectedMemberId = $state('');
  let guestName = $state('');
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground">{t.name}</h1>
      <p class="text-xs text-muted-foreground mt-1">{metaLine}</p>
    </div>
    <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(t.status)}">
      {statusLabel(t.status)}
    </span>
  </div>

  <!-- Prize pool callout -->
  <div class="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex justify-between items-center">
    <span class="text-xs text-muted-foreground">
      {m.tournament_prize_pool_label()} · {data.players.length} × €{(t.buy_in / 100).toFixed(0)}
    </span>
    <span class="text-lg font-light text-accent">€{(data.prizePool / 100).toFixed(0)}</span>
  </div>

  <!-- Players table -->
  <div>
    <h2 class="text-sm font-semibold text-foreground mb-3">{m.tournament_players_title()}</h2>
    {#if data.players.length === 0}
      <p class="text-sm text-muted-foreground">{m.tournament_no_players()}</p>
    {:else}
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Type</span>
          <span></span>
        </div>
        {#each data.players as player}
          <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
            {#if player.guest_name}
              <span class="text-sm text-muted-foreground">{player.guest_name} {m.tournament_guest_suffix()}</span>
              <span class="text-xs text-muted-foreground">Guest</span>
            {:else}
              <span class="text-sm font-medium text-foreground">{player.club_members?.display_name ?? '—'}</span>
              <span class="text-xs text-muted-foreground">Member</span>
            {/if}
            <div class="flex justify-end">
              {#if t.status === 'registration'}
                <form method="POST" action="?/remove_player" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
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
  </div>

  <!-- Add player -->
  {#if t.status === 'registration'}
    <div class="flex flex-col gap-3">
      <form method="POST" action="?/add_player" use:enhance class="flex gap-2 items-center flex-wrap">
        <select
          name="member_id"
          bind:value={selectedMemberId}
          class="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_member_placeholder()}</option>
          {#each data.availableMembers as member}
            <option value={member.user_id}>{member.display_name}</option>
          {/each}
        </select>
        <input
          name="guest_name"
          type="text"
          placeholder={m.tournament_guest_placeholder()}
          bind:value={guestName}
          disabled={!!selectedMemberId}
          class="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button type="submit"
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
          {m.tournament_add_player_button()}
        </button>
      </form>
      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
    </div>
  {/if}
</div>
