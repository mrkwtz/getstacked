<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { calculatePayouts } from '$lib/tournaments';
  import type { Tournament, TournamentPlayer } from '$lib/types';

  const { data, form } = $props<{
    data: {
      tournament: Tournament;
      players: TournamentPlayer[];
      availableMembers: { user_id: string; display_name: string }[];
      prizePool: number;
      prizeStructure: { payouts: { position: number; percentage: number }[] } | null;
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

  function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
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

  // Running state derived values
  const nextBustPosition = $derived((() => {
    const assigned = new Set(data.players.map((p) => p.finish_position).filter((p) => p !== null));
    const total = data.players.length;
    const available = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !assigned.has(p));
    return available.length > 0 ? Math.max(...available) : 1;
  })());

  const allPositionsAssigned = $derived(
    data.players.length > 0 && data.players.every((p) => p.finish_position !== null)
  );

  const canFinish = $derived(allPositionsAssigned && data.prizeStructure !== null);

  // Finish review state
  let showReview = $state(false);

  const reviewPayouts = $derived(
    data.prizeStructure
      ? calculatePayouts(data.players, data.prizeStructure.payouts, data.prizePool)
      : []
  );

  // Sort players by position for finished view
  const sortedFinished = $derived(
    [...data.players].sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999))
  );

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
    <div class="flex items-center gap-3">
      <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(t.status)}">
        {statusLabel(t.status)}
      </span>

      {#if t.status === 'registration'}
        <form method="POST" action="?/start_tournament" use:enhance>
          <button
            type="submit"
            disabled={data.players.length < 2}
            title={data.players.length < 2 ? m.tournament_min_players_error() : undefined}
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.tournament_start_button()}
          </button>
        </form>
      {:else if t.status === 'running'}
        <button
          type="button"
          disabled={!canFinish}
          title={!data.prizeStructure ? resolveError('error_no_prize_structures') : !allPositionsAssigned ? m.tournament_positions_incomplete() : undefined}
          onclick={() => { showReview = true; }}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_finish_button()}
        </button>
      {/if}
    </div>
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

    {:else if t.status === 'registration'}
      <!-- Registration table: Player · Type · Remove -->
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
              <form method="POST" action="?/remove_player" use:enhance>
                <input type="hidden" name="player_id" value={player.id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {m.common_delete()}
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>

    {:else if t.status === 'running'}
      <!-- Running table: Player · Rebuys · Add-on · Position · Bust/Undo -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid border-b border-border px-4 py-2.5
          {t.format === 'rebuy' ? 'grid-cols-[1fr_120px_80px_80px_80px]' : 'grid-cols-[1fr_80px_80px]'}">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          {#if t.format === 'rebuy'}
            <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_rebuy_col()}</span>
            <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_addon_col()}</span>
          {/if}
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span></span>
        </div>
        {#each data.players as player}
          <div class="grid border-b border-border last:border-0 px-4 py-3 items-center
            {t.format === 'rebuy' ? 'grid-cols-[1fr_120px_80px_80px_80px]' : 'grid-cols-[1fr_80px_80px]'}">
            <!-- Player name -->
            <span class="text-sm {player.finish_position !== null ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>

            {#if t.format === 'rebuy'}
              <!-- Rebuys: − count + -->
              <div class="flex items-center gap-1">
                <form method="POST" action="?/remove_rebuy" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit" disabled={player.rebuys === 0}
                    class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    −
                  </button>
                </form>
                <span class="text-sm text-foreground w-4 text-center">{player.rebuys}</span>
                <form method="POST" action="?/add_rebuy" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    +
                  </button>
                </form>
              </div>

              <!-- Add-on checkbox -->
              <div class="flex justify-center">
                <form method="POST" action="?/toggle_addon" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer
                      {player.addon ? 'bg-accent border-accent' : 'border-border hover:border-accent'}">
                    {#if player.addon}
                      <svg class="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </button>
                </form>
              </div>
            {/if}

            <!-- Position -->
            <span class="text-sm text-center text-muted-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>

            <!-- Bust / Undo -->
            <div class="flex justify-end">
              {#if player.finish_position === null}
                <form method="POST" action="?/bust_player" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.tournament_bust_button({ position: ordinal(nextBustPosition) })}
                  </button>
                </form>
              {:else}
                <form method="POST" action="?/unset_bust" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.tournament_undo_bust()}
                  </button>
                </form>
              {/if}
            </div>
          </div>
        {/each}
      </div>

    {:else}
      <!-- Finished table: Position · Player · Payout -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[60px_1fr_100px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground text-right">{m.tournament_payout_col()}</span>
        </div>
        {#each sortedFinished as player}
          <div class="grid grid-cols-[60px_1fr_100px] px-4 py-3 border-b border-border last:border-0 items-center">
            <span class="text-sm font-medium text-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>
            <span class="text-sm text-foreground">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>
            <span class="text-sm text-right {(player.payout_amount ?? 0) > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}">
              {(player.payout_amount ?? 0) > 0 ? `€${((player.payout_amount ?? 0) / 100).toFixed(2)}` : '—'}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Add player (registration only) -->
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

  <!-- Error display for running status actions (bust, rebuy, etc.) -->
  {#if t.status === 'running' && form?.errorKey && !showReview}
    <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
  {/if}

  <!-- Finish review section (running status, shown when "Finish Tournament" clicked) -->
  {#if t.status === 'running' && showReview}
    <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.tournament_review_title()}</h2>

      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[60px_1fr_100px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground text-right">{m.tournament_payout_col()}</span>
        </div>
        {#each [...reviewPayouts].sort((a, b) => {
          const posA = data.players.find(p => p.id === a.playerId)?.finish_position ?? 999;
          const posB = data.players.find(p => p.id === b.playerId)?.finish_position ?? 999;
          return posA - posB;
        }) as payout}
          {@const player = data.players.find(p => p.id === payout.playerId)!}
          <div class="grid grid-cols-[60px_1fr_100px] px-4 py-3 border-b border-border last:border-0 items-center">
            <span class="text-sm font-medium text-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>
            <span class="text-sm text-foreground">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>
            <span class="text-sm text-right {payout.amount > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}">
              {payout.amount > 0 ? `€${(payout.amount / 100).toFixed(2)}` : '—'}
            </span>
          </div>
        {/each}
      </div>

      <div class="flex items-center gap-4">
        <form method="POST" action="?/finish_tournament" use:enhance>
          <button type="submit"
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
            {m.tournament_confirm_finish()}
          </button>
        </form>
        <button type="button" onclick={() => { showReview = false; }}
          class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.tournament_cancel_review()}
        </button>
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
    </div>
  {/if}
</div>
