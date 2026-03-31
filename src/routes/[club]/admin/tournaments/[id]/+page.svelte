<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { calculatePrizePool, calculatePayouts, formatPrizePoolBreakdown } from '$lib/tournaments';
  import * as m from '$lib/paraglide/messages';
  import { drawSeats, autoSeat, suggestRebalanceMove, suggestTableBreak } from '$lib/seating';
  import type { TournamentTable } from '$lib/types';
  import type { PageData } from './$types';
  import { Pencil } from '@lucide/svelte';
  import { displayName } from '$lib/players';

  const { data }: { data: PageData } = $props();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function statusLabel(status: string): string {
    if (status === 'registration') return m.tournament_status_registration();
    if (status === 'running') return m.tournament_status_running();
    return m.tournament_status_finished();
  }

  function statusClass(status: string): string {
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

  const canFinish = $derived(allPositionsAssigned);

  // Finish review state
  let showReview = $state(false);
  let showEditModal = $state(false);

  const totalRebuys = $derived(data.players.reduce((sum, p) => sum + p.rebuys, 0));
  const addonCount = $derived(data.players.filter((p) => p.addon).length);

  const reviewPayouts = $derived(
    data.prizeStructure
      ? calculatePayouts(data.players, data.prizeStructure.payouts, data.prizePool)
      : []
  );

  // Sort players by position for finished view
  const sortedFinished = $derived(
    [...data.players].sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999))
  );

  let selectedPlayerId = $state('');
  let showQuickAdd = $state(false);
  let quickFirstName = $state('');
  let quickLastName = $state('');

  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  // Seating state
  let numTables = $state('');
  let seatsPerTable = $state('');
  let seatingError = $state<string | null>(null);
  let confirmReset = $state(false);
  let dismissedSuggestion = $state(false);
  let movingPlayerId = $state<string | null>(null);

  const activePlayers = $derived(
    data.players
      .filter((p) => p.finish_position === null && p.table_id !== null && p.seat_number !== null)
      .map((p) => ({
        id: p.id,
        name: p.players ? displayName(p.players) : '?',
        tableId: p.table_id!,
        tableNumber: data.tables.find((t) => t.id === p.table_id)?.number ?? 0,
        seatNumber: p.seat_number!,
      })),
  );

  const rebalanceMove = $derived(
    !dismissedSuggestion && t.status === 'running' && data.tables.length > 0
      ? suggestTableBreak(activePlayers, data.tables) ??
        suggestRebalanceMove(activePlayers, data.tables)
      : null,
  );

  $effect(() => {
    // Reset dismiss flag when player state changes (new bust = new suggestion opportunity)
    void data.players;
    dismissedSuggestion = false;
  });

  async function handleAddPlayer(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        player_id: playerId,
      });
      if (error) { errorKey = 'server_error'; return; }
      selectedPlayerId = '';
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleQuickAdd() {
    if (loading) return;
    if (!quickFirstName.trim() || !quickLastName.trim()) { errorKey = 'error_required'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      // Get next member number
      const { data: maxPlayer } = await supabase
        .from('players')
        .select('member_number')
        .eq('club_id', data.tournament.club_id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxPlayer?.member_number ?? 0) + 1;

      // Create player
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert({
          club_id: data.tournament.club_id,
          first_name: quickFirstName.trim(),
          last_name: quickLastName.trim(),
          member_number: nextNumber,
        })
        .select('id')
        .single();
      if (playerError) { errorKey = 'server_error'; return; }

      // Register for tournament
      const { error: regError } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        player_id: newPlayer.id,
      });
      if (regError) { errorKey = 'server_error'; return; }

      showQuickAdd = false;
      quickFirstName = '';
      quickLastName = '';
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRemovePlayer(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players').delete().eq('id', playerId).eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleStartTournament() {
    if (loading) return;
    if (data.tournament.status !== 'registration') return;
    if (data.players.length < 2) { errorKey = 'tournament_min_players_error'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournaments').update({ status: 'running' }).eq('id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleBustPlayer(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
    const player = data.players.find((p) => p.id === playerId);
    if (!player || player.finish_position !== null) return;
    const totalPlayers = data.players.length;
    const assigned = new Set(data.players.map((p) => p.finish_position).filter((p) => p !== null));
    const available = Array.from({ length: totalPlayers }, (_, i) => i + 1).filter((p) => !assigned.has(p));
    if (available.length === 0) return;
    const nextPosition = Math.max(...available);
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players')
        .update({ finish_position: nextPosition })
        .eq('id', playerId)
        .eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleUnsetBust(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players')
        .update({ finish_position: null })
        .eq('id', playerId)
        .eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleAddRebuy(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
    if (data.tournament.format !== 'rebuy') return;
    const player = data.players.find((p) => p.id === playerId)!;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players')
        .update({ rebuys: player.rebuys + 1 })
        .eq('id', playerId)
        .eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRemoveRebuy(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
    if (data.tournament.format !== 'rebuy') return;
    const player = data.players.find((p) => p.id === playerId)!;
    if (player.rebuys <= 0) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players')
        .update({ rebuys: player.rebuys - 1 })
        .eq('id', playerId)
        .eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleToggleAddon(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
    if (data.tournament.format !== 'rebuy') return;
    const player = data.players.find((p) => p.id === playerId)!;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players')
        .update({ addon: !player.addon })
        .eq('id', playerId)
        .eq('tournament_id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  // --- Seating handlers ---

  async function handleSetTables(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    const n = parseInt(numTables);
    const s = parseInt(seatsPerTable);
    if (!n || n < 1 || !s || s < 1) { seatingError = m.seating_error_invalid_config(); return; }

    if (data.tables.length > 0) {
      if (!confirmReset) { confirmReset = true; return; }
    }

    loading = true;
    seatingError = null;
    confirmReset = false;
    try {
      const supabase = createClient();
      // Delete existing tables (cascades to clear table_id/seat_number on players)
      if (data.tables.length > 0) {
        await supabase.from('tournament_tables').delete().eq('tournament_id', data.tournament.id);
        // Clear preferred_table on all players
        await supabase
          .from('tournament_players')
          .update({ preferred_table: null })
          .eq('tournament_id', data.tournament.id);
      }
      // Insert new tables
      const rows = Array.from({ length: n }, (_, i) => ({
        tournament_id: data.tournament.id,
        number: i + 1,
        max_seats: s,
      }));
      const { error } = await supabase.from('tournament_tables').insert(rows);
      if (error) { seatingError = error.message; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleSetLock(playerId: string, preferredTable: number | null) {
    if (loading) return;
    loading = true;
    seatingError = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tournament_players')
        .update({ preferred_table: preferredTable })
        .eq('id', playerId);
      if (error) { seatingError = error.message; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDrawSeats() {
    if (loading) return;
    seatingError = null;
    const players = data.players.map((p) => ({ id: p.id, preferred_table: p.preferred_table ?? null }));
    const tables = data.tables.map((t) => ({ id: t.id, number: t.number, max_seats: t.max_seats }));
    const result = drawSeats(players, tables);
    if (result.error) { seatingError = result.error; return; }

    loading = true;
    try {
      const supabase = createClient();
      // Reset all seats first
      await supabase
        .from('tournament_players')
        .update({ table_id: null, seat_number: null })
        .eq('tournament_id', data.tournament.id);
      // Apply assignments
      await Promise.all(
        result.assignments.map((a) =>
          supabase
            .from('tournament_players')
            .update({ table_id: a.tableId, seat_number: a.seatNumber })
            .eq('id', a.playerId),
        ),
      );
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleAutoSeat() {
    if (loading) return;
    seatingError = null;
    const unseated = data.players
      .filter((p) => p.table_id === null)
      .map((p) => ({ id: p.id, preferred_table: p.preferred_table ?? null }));
    const tables = data.tables.map((t) => ({ id: t.id, number: t.number, max_seats: t.max_seats }));
    const existing = data.players
      .filter((p) => p.table_id !== null)
      .map((p) => ({ playerId: p.id, tableId: p.table_id!, seatNumber: p.seat_number! }));
    const assignments = autoSeat(unseated, tables, existing);

    loading = true;
    try {
      const supabase = createClient();
      await Promise.all(
        assignments.map((a) =>
          supabase
            .from('tournament_players')
            .update({ table_id: a.tableId, seat_number: a.seatNumber })
            .eq('id', a.playerId),
        ),
      );
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleManualSeat(playerId: string, tableId: string, seatNumber: number) {
    if (loading) return;
    seatingError = null;
    // Check seat not already taken
    const taken = data.players.some(
      (p) => p.table_id === tableId && p.seat_number === seatNumber && p.id !== playerId,
    );
    if (taken) {
      const tNum = data.tables.find((t) => t.id === tableId)?.number ?? '?';
      seatingError = m.seating_error_seat_taken({ seat: String(seatNumber), table: String(tNum) });
      return;
    }
    loading = true;
    try {
      const supabase = createClient();
      await supabase
        .from('tournament_players')
        .update({ table_id: tableId, seat_number: seatNumber })
        .eq('id', playerId);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleUpdateDealer(tableId: string, dealer: string) {
    if (loading) return;
    loading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_tables').update({ dealer: dealer || null }).eq('id', tableId);
      if (error) { seatingError = error.message; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleConfirmMove(move: { playerId: string; toTableId: string; toSeatNumber: number }) {
    if (loading) return;
    loading = true;
    seatingError = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tournament_players')
        .update({ table_id: move.toTableId, seat_number: move.toSeatNumber })
        .eq('id', move.playerId);
      if (error) { seatingError = error.message; return; }
      dismissedSuggestion = false;
      movingPlayerId = null;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleUpdateStructure(field: 'prize_structure_id' | 'blind_structure_id', value: string) {
    const supabase = createClient();
    await supabase.from('tournaments').update({ [field]: value || null }).eq('id', t.id);
    await invalidateAll();
  }

  async function handleFinishTournament() {
    if (loading) return;
    if (data.tournament.status !== 'running') return;
    if (data.players.some((p) => p.finish_position === null)) {
      errorKey = 'tournament_positions_incomplete'; return;
    }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      if (data.prizeStructure) {
        const totalRebuys = data.players.reduce((sum, p) => sum + p.rebuys, 0);
        const addonCount = data.players.filter((p) => p.addon).length;
        const prizePool = calculatePrizePool(
          data.players.length,
          data.tournament.buy_in,
          totalRebuys,
          data.tournament.rebuy_amount ?? 0,
          addonCount,
          data.tournament.addon_amount ?? 0,
        );
        const payoutResults = calculatePayouts(data.players, data.prizeStructure.payouts, prizePool);
        await Promise.all(
          payoutResults.map(({ playerId, amount }) =>
            supabase.from('tournament_players').update({ payout_amount: amount }).eq('id', playerId).eq('tournament_id', data.tournament.id)
          )
        );
      }
      await supabase.from('tournaments').update({ status: 'finished' }).eq('id', data.tournament.id);
      showReview = false;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground flex items-center gap-1.5">
        {t.name}
        {#if t.status !== 'finished'}
          <button
            type="button"
            onclick={() => { showEditModal = true; }}
            class="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Edit tournament settings"
          >
            <Pencil size={12} />
          </button>
        {/if}
      </h1>
      <p class="text-xs text-muted-foreground mt-1">{metaLine}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(t.status)}">
        {statusLabel(t.status)}
      </span>

      {#if t.status === 'registration'}
        <button
          type="button"
          onclick={handleStartTournament}
          disabled={data.players.length < 2 || loading}
          title={data.players.length < 2 ? m.tournament_min_players_error() : undefined}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_start_button()}
        </button>
      {:else if t.status === 'running'}
        <button
          type="button"
          disabled={!canFinish || loading}
          title={!allPositionsAssigned ? m.tournament_positions_incomplete() : undefined}
          onclick={() => { showReview = true; }}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_finish_button()}
        </button>
      {/if}
    </div>
  </div>

  <!-- Prize pool callout -->
  <div class="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex justify-between items-start">
    <div class="flex flex-col gap-0.5">
      <span class="text-xs font-medium text-muted-foreground">{m.tournament_prize_pool_label()}</span>
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in, totalRebuys, t.rebuy_amount ?? 0, addonCount, t.addon_amount ?? 0) as part}
        <span class="text-xs text-muted-foreground">
          {part.count} × €{(part.amountCents / 100).toFixed(0)}
          <span class="opacity-60">
            {part.type === 'buyin' ? m.tournament_buy_in_label() : part.type === 'rebuy' ? m.tournament_rebuy_col() : m.tournament_addon_col()}
          </span>
        </span>
      {/each}
    </div>
    <span class="text-lg font-light text-accent">€{(data.prizePool / 100).toFixed(0)}</span>
  </div>

  {#if errorKey}
    <p class="text-xs text-accent">{resolveError(errorKey)}</p>
  {/if}

  <!-- Players table -->
  <div>
    <h2 class="text-sm font-semibold text-foreground mb-3">{m.tournament_players_title()}</h2>

    {#if data.players.length === 0}
      <p class="text-sm text-muted-foreground">{m.tournament_no_players()}</p>

    {:else if t.status === 'registration'}
      <!-- Registration table: Player · Remove -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[1fr_80px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span></span>
        </div>
        {#each data.players as player}
          <div class="grid grid-cols-[1fr_80px] px-4 py-3 border-b border-border last:border-0 items-center">
            <span class="text-sm font-medium text-foreground">{player.players ? displayName(player.players) : '—'}</span>
            <div class="flex justify-end">
              <button type="button" onclick={() => handleRemovePlayer(player.id)} disabled={loading}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
                {m.common_delete()}
              </button>
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
              {player.players ? displayName(player.players) : '—'}
            </span>

            {#if t.format === 'rebuy'}
              <!-- Rebuys: − count + -->
              <div class="flex items-center gap-1">
                <button type="button" onclick={() => handleRemoveRebuy(player.id)} disabled={player.rebuys === 0 || loading}
                  class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                  −
                </button>
                <span class="text-sm text-foreground w-4 text-center">{player.rebuys}</span>
                <button type="button" onclick={() => handleAddRebuy(player.id)} disabled={loading}
                  class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30">
                  +
                </button>
              </div>

              <!-- Add-on checkbox -->
              <div class="flex justify-center">
                <button type="button" onclick={() => handleToggleAddon(player.id)} disabled={loading}
                  class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer
                    {player.addon ? 'bg-accent border-accent' : 'border-border hover:border-accent'}">
                  {#if player.addon}
                    <svg class="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
              </div>
            {/if}

            <!-- Position -->
            <span class="text-sm text-center text-muted-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>

            <!-- Bust / Undo -->
            <div class="flex justify-end">
              {#if player.finish_position === null}
                <button type="button" onclick={() => handleBustPlayer(player.id)} disabled={loading}
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
                  {m.tournament_bust_button({ position: ordinal(nextBustPosition) })}
                </button>
              {:else}
                <button type="button" onclick={() => handleUnsetBust(player.id)} disabled={loading}
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
                  {m.tournament_undo_bust()}
                </button>
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
              {player.players ? displayName(player.players) : '—'}
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
    <div class="flex gap-2">
      <select
        bind:value={selectedPlayerId}
        class="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground"
      >
        <option value="">{m.tournament_select_player()}</option>
        {#each data.availablePlayers as player}
          <option value={player.id}>
            {player.nickname || `${player.first_name} ${player.last_name}`} #{player.member_number}
          </option>
        {/each}
      </select>
      <button
        type="button"
        onclick={() => handleAddPlayer(selectedPlayerId)}
        disabled={loading || !selectedPlayerId}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {m.tournament_add_player_button()}
      </button>
      <button
        type="button"
        onclick={() => { showQuickAdd = true; quickFirstName = ''; quickLastName = ''; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2"
        title={m.player_quick_add_title()}
      >
        +
      </button>
    </div>
  {/if}

  <!-- Seating configuration (registration only) -->
  {#if t.status === 'registration'}
    <!-- ── Seating configuration ── -->
    <div class="flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.seating_title()}</h2>

      <!-- Configure tables form -->
      <form onsubmit={handleSetTables} class="flex gap-2 items-end">
        <div>
          <label for="num-tables" class="block text-xs font-medium text-muted-foreground mb-1">{m.seating_tables_label()}</label>
          <input
            id="num-tables" type="number" min="1" required bind:value={numTables}
            class="w-20 px-2 py-1.5 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label for="seats-per-table" class="block text-xs font-medium text-muted-foreground mb-1">{m.seating_seats_per_table_label()}</label>
          <input
            id="seats-per-table" type="number" min="1" required bind:value={seatsPerTable}
            class="w-20 px-2 py-1.5 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
          />
        </div>
        {#if confirmReset}
          <div class="flex flex-col gap-1">
            <p class="text-xs text-accent">{m.seating_reset_warning()}</p>
            <button type="submit" disabled={loading}
              class="self-start bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
              {m.seating_confirm_reset_button()}
            </button>
          </div>
        {:else}
          <button type="submit" disabled={loading}
            class="bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.seating_set_tables_button()}
          </button>
        {/if}
      </form>

      {#if seatingError}
        <p class="text-xs text-accent">{seatingError}</p>
      {/if}

      {#if data.tables.length > 0}
        <!-- Per-player lock dropdowns -->
        {#if data.players.length > 0}
          <div class="bg-card border border-border rounded-lg overflow-hidden">
            <div class="grid grid-cols-[1fr_auto] text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border uppercase tracking-wide">
              <span>Player</span><span>{m.seating_lock_label()}</span>
            </div>
            {#each data.players as player}
              <div class="grid grid-cols-[1fr_auto] items-center px-4 py-2 border-b border-border last:border-0">
                <span class="text-sm text-foreground">
                  {player.players ? displayName(player.players) : '—'}
                </span>
                <select
                  class="bg-background border border-input rounded-md text-xs px-2 py-1 text-foreground"
                  value={player.preferred_table ?? ''}
                  onchange={(e) => {
                    const val = (e.currentTarget as HTMLSelectElement).value;
                    handleSetLock(player.id, val ? parseInt(val) : null);
                  }}
                >
                  <option value="">{m.seating_lock_any()}</option>
                  {#each data.tables as table}
                    <option value={table.number}>{m.seating_table_label({ number: String(table.number) })}</option>
                  {/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Draw / re-draw button -->
        <div class="flex gap-2">
          <button
            type="button"
            disabled={loading || data.players.length < 2}
            onclick={handleDrawSeats}
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {data.players.some(p => p.table_id !== null) ? m.seating_redraw_button() : m.seating_draw_button()}
          </button>
        </div>

        <!-- Seating grid (after draw) -->
        {#if data.players.some((p) => p.table_id !== null)}
          <div class="grid grid-cols-2 gap-3">
            {#each data.tables as table}
              {@const seated = data.players.filter((p) => p.table_id === table.id).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
              <div class="bg-card border border-border rounded-lg p-3">
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {m.seating_table_label({ number: String(table.number) })}
                </div>
                <div class="grid grid-cols-2 gap-1.5 text-xs">
                  {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                    {@const player = seated.find((p) => p.seat_number === seat)}
                    <div class="px-2 py-1 rounded {player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'}">
                      {seat} {player ? (player.players ? displayName(player.players) : '?') : '—'}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Unseated players -->
          {@const unseated = data.players.filter((p) => p.table_id === null)}
          {#if unseated.length > 0}
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.seating_unseated_title()}</h3>
                <button
                  type="button"
                  onclick={handleAutoSeat}
                  disabled={loading}
                  class="text-xs bg-accent text-accent-foreground px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {m.seating_auto_seat_button()}
                </button>
              </div>
              {#each unseated as player}
                <div class="flex items-center gap-2 text-sm text-foreground">
                  <span class="flex-1">{player.players ? displayName(player.players) : '?'}</span>
                  <select
                    class="bg-background border border-input rounded-md text-xs px-2 py-1"
                    onchange={(e) => {
                      const [tableId, seatStr] = (e.currentTarget as HTMLSelectElement).value.split(':');
                      if (tableId && seatStr) handleManualSeat(player.id, tableId, parseInt(seatStr));
                    }}
                  >
                    <option value="">{m.seating_assign_seat_placeholder()}</option>
                    {#each data.tables as table}
                      {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                        {@const taken = data.players.some((p) => p.table_id === table.id && p.seat_number === seat && p.id !== player.id)}
                        {#if !taken}
                          <option value="{table.id}:{seat}">T{table.number} S{seat}</option>
                        {/if}
                      {/each}
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Running seating grid -->
  {#if t.status === 'running'}
    {#if data.tables.length > 0}
      <!-- ── Seating grid ── -->
      <div class="flex flex-col gap-4">
        <h2 class="text-sm font-semibold text-foreground">{m.seating_title()}</h2>

        <!-- Rebalance / break suggestion banner -->
        {#if rebalanceMove}
          <div class="flex items-center justify-between gap-3 bg-accent/10 border border-accent/30 rounded-lg px-4 py-3">
            <span class="text-sm text-foreground">
              {#if 'fromSeatNumber' in rebalanceMove}
                Move <strong>{rebalanceMove.playerName}</strong>
                T{rebalanceMove.fromTableNumber} S{rebalanceMove.fromSeatNumber}
                → T{rebalanceMove.toTableNumber} S{rebalanceMove.toSeatNumber}
              {:else}
                Break Table <strong>{rebalanceMove.fromTableNumber}</strong>
                — move <strong>{rebalanceMove.playerName}</strong>
                to T{rebalanceMove.toTableNumber} S{rebalanceMove.toSeatNumber}
              {/if}
            </span>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                onclick={() => handleConfirmMove(rebalanceMove as { playerId: string; toTableId: string; toSeatNumber: number })}
                disabled={loading}
                class="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {m.seating_confirm_move_button()}
              </button>
              <button
                type="button"
                onclick={() => { dismissedSuggestion = true; }}
                class="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                {m.seating_dismiss_button()}
              </button>
            </div>
          </div>
        {/if}

        <!-- Manual move hint / cancel -->
        {#if movingPlayerId}
          {@const movingPlayer = data.players.find((p) => p.id === movingPlayerId)}
          <div class="flex items-center justify-between gap-3 bg-muted border border-border rounded-lg px-4 py-3">
            <span class="text-sm text-foreground">
              {m.seating_move_hint({ name: movingPlayer?.players ? displayName(movingPlayer.players) : '?' })}
            </span>
            <button
              type="button"
              onclick={() => { movingPlayerId = null; }}
              class="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              {m.seating_cancel_move()}
            </button>
          </div>
        {/if}

        <!-- Table cards grid -->
        <div class="grid grid-cols-2 gap-3">
          {#each data.tables as table}
            {@const tablePlayers = data.players
              .filter((p) => p.table_id === table.id)
              .sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
            {@const activeCount = tablePlayers.filter((p) => p.finish_position === null).length}
            <div class="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {m.seating_table_label({ number: String(table.number) })}
                </span>
                <span class="text-xs text-muted-foreground">{m.seating_active_count({ count: String(activeCount) })}</span>
              </div>
              <!-- Dealer field -->
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-muted-foreground">{m.seating_dealer_label()}:</span>
                <input
                  type="text"
                  value={table.dealer ?? ''}
                  placeholder="—"
                  class="flex-1 text-xs bg-background border border-input rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:border-accent"
                  onchange={(e) => handleUpdateDealer(table.id, (e.currentTarget as HTMLInputElement).value)}
                />
              </div>
              <!-- Seat grid -->
              <div class="grid grid-cols-2 gap-1 text-xs">
                {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                  {@const player = tablePlayers.find((p) => p.seat_number === seat && p.finish_position === null) ?? tablePlayers.find((p) => p.seat_number === seat)}
                  {@const busted = player && player.finish_position !== null}
                  {@const isSelected = player && player.id === movingPlayerId}
                  {@const isTarget = movingPlayerId && !isSelected && (!player || busted)}
                  <button
                    type="button"
                    disabled={loading || (!isSelected && !isTarget && !!movingPlayerId)}
                    onclick={() => {
                      if (isSelected) { movingPlayerId = null; return; }
                      if (movingPlayerId && isTarget) {
                        handleConfirmMove({ playerId: movingPlayerId, toTableId: table.id, toSeatNumber: seat });
                        return;
                      }
                      if (!movingPlayerId && player && !busted) {
                        movingPlayerId = player.id;
                      }
                    }}
                    class="px-2 py-1 rounded text-left w-full transition-colors
                      {isSelected
                        ? 'bg-accent text-accent-foreground ring-2 ring-accent cursor-pointer'
                        : isTarget
                          ? 'bg-accent/10 text-muted-foreground border border-dashed border-accent/50 cursor-pointer hover:bg-accent/20'
                          : busted
                            ? 'bg-muted text-muted-foreground line-through opacity-50 cursor-default'
                            : player
                              ? 'bg-accent/20 text-foreground cursor-pointer hover:bg-accent/30'
                              : 'bg-muted text-muted-foreground cursor-default'}"
                  >
                    {seat} {player ? (player.players ? displayName(player.players) : '?') : '—'}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

</div>

<!-- Finish review modal -->
{#if t.status === 'running' && showReview}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/60"
    role="presentation"
    onclick={() => { showReview = false; }}
  ></div>

  <!-- Modal -->
  <div class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-md mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5">
    <h2 class="text-base font-semibold text-foreground">{m.tournament_review_title()}</h2>

    {#if !data.prizeStructure}
      <p class="text-xs text-muted-foreground">{m.tournament_no_prize_structure_note()}</p>
    {:else}
    <div class="border border-border rounded-lg overflow-hidden">
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
            {player.players ? displayName(player.players) : '—'}
          </span>
          <span class="text-sm text-right {payout.amount > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}">
            {payout.amount > 0 ? `€${(payout.amount / 100).toFixed(2)}` : '—'}
          </span>
        </div>
      {/each}
    </div>
    {/if}

    <div class="flex items-center gap-4">
      <button type="button" onclick={handleFinishTournament} disabled={loading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.tournament_confirm_finish()}
      </button>
      <button type="button" onclick={() => { showReview = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </div>
{/if}

<!-- Edit tournament modal -->
{#if showEditModal}
  <div
    class="fixed inset-0 z-40 bg-black/60"
    role="presentation"
    onclick={() => { showEditModal = false; }}
  ></div>

  <div class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-sm mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5">
    <h2 class="text-base font-semibold text-foreground">Edit tournament</h2>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="edit-blind-structure" class="text-xs font-medium text-muted-foreground">{m.tournament_blind_structure_label()}</label>
        <select
          id="edit-blind-structure"
          value={t.blind_structure_id ?? ''}
          onchange={(e) => handleUpdateStructure('blind_structure_id', (e.currentTarget as HTMLSelectElement).value)}
          class="w-full text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_none_option()}</option>
          {#each data.blindStructures as bs}
            <option value={bs.id}>{bs.name}</option>
          {/each}
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="edit-prize-structure" class="text-xs font-medium text-muted-foreground">{m.tournament_prize_structure_label()}</label>
        <select
          id="edit-prize-structure"
          value={t.prize_structure_id ?? ''}
          onchange={(e) => handleUpdateStructure('prize_structure_id', (e.currentTarget as HTMLSelectElement).value)}
          class="w-full text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_none_option()}</option>
          {#each data.prizeStructures as ps}
            <option value={ps.id}>{ps.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        onclick={() => { showEditModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  </div>
{/if}

{#if showQuickAdd}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button type="button" class="absolute inset-0 bg-black/50" onclick={() => (showQuickAdd = false)}></button>
    <div class="relative bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-sm font-semibold text-foreground mb-4">{m.player_quick_add_title()}</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleQuickAdd(); }} class="flex flex-col gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_first_name_label()} *</label>
          <input bind:value={quickFirstName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_last_name_label()} *</label>
          <input bind:value={quickLastName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        {#if errorKey}
          <p class="text-xs text-accent">{resolveError(errorKey)}</p>
        {/if}
        <div class="flex gap-2 justify-end mt-2">
          <button type="button" onclick={() => (showQuickAdd = false)} class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5">
            {m.player_cancel()}
          </button>
          <button type="submit" disabled={loading} class="bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.player_quick_add_button()}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
