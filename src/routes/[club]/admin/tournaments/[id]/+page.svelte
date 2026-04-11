<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { calculatePayouts, formatPrizePoolBreakdown, calculateAverageStack, validatePayouts } from '$lib/tournaments';
  import * as m from '$lib/paraglide/messages';
  import { drawSeats, autoSeat, suggestRebalanceMove, suggestTableBreak } from '$lib/seating';
  import { page } from '$app/stores';
  import {
    computeCurrentLevelIndex,
    computeRemainingMs,
    computePlaytimeMs,
    computeTimeUntilNextBreakMs,
    isTimerPaused,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipLevel,
  } from '$lib/timer';
  import type { TimerState, BlindLevel, Json } from '$lib/types';
  import type { TournamentTable } from '$lib/types';
  import type { PageData } from './$types';
  import { Pencil } from '@lucide/svelte';
  import { displayName } from '$lib/members';
  import BlindStructureForm from '$lib/components/BlindStructureForm.svelte';
  import PrizeStructureForm from '$lib/components/PrizeStructureForm.svelte';
  import { DialogContent } from '$lib/components/ui/dialog/index.js';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { LevelRow } from '$lib/components/BlindStructureForm.svelte';

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
    `€${(t.buy_in_amount / 100).toFixed(2)} buy-in`,
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
  let showDeleteModal = $state(false);
  let deleting = $state(false);

  // Structure edit modal state
  let showBlindEditModal = $state(false);
  let blindEditLevels = $state<LevelRow[]>([]);
  let blindEditLoading = $state(false);
  let blindEditError = $state<string | null>(null);

  let showPrizeEditModal = $state(false);
  let prizeEditPayouts = $state<{ position: number; percentage: string }[]>([]);
  let prizeEditLoading = $state(false);
  let prizeEditError = $state<string | null>(null);

  const totalRebuys = $derived(data.players.reduce((sum, p) => sum + p.rebuys, 0));
  const addonCount = $derived(data.players.filter((p) => p.addon).length);

  const averageStack = $derived(
    calculateAverageStack(t, data.players)
  );

  let now = $state(new Date());

  $effect(() => {
    const tick = setInterval(() => { now = new Date(); }, 1000);
    const poll = setInterval(() => { invalidateAll(); }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  });

  const timerState = $derived(t.timer_state as unknown as TimerState | null);
  const blindLevels = $derived(
    ((t.blind_levels ?? t.blind_structures?.levels ?? []) as unknown as BlindLevel[])
  );

  const currentLevelIdx = $derived(
    timerState && blindLevels.length > 0
      ? computeCurrentLevelIndex(timerState, blindLevels, now)
      : 0,
  );
  const currentLevel = $derived(blindLevels[currentLevelIdx] ?? null);
  const remainingMs = $derived(
    timerState && blindLevels.length > 0
      ? computeRemainingMs(timerState, blindLevels, now)
      : 0,
  );
  const nextLevel = $derived(blindLevels[currentLevelIdx + 1] ?? null);
  const timerPaused = $derived(timerState ? isTimerPaused(timerState) : false);
  const levelProgress = $derived(
    currentLevel
      ? 1 - remainingMs / (currentLevel.duration_minutes * 60_000)
      : 0,
  );

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const reviewPayouts = $derived(
    data.prizeStructure
      ? calculatePayouts(data.players, data.prizeStructure.payouts, data.prizePool)
      : []
  );

  // Editable payout amounts (in cents), keyed by playerId
  let editedPayouts: Record<string, number> = $state({});

  const editedPayoutsTotal = $derived(
    Object.values(editedPayouts).reduce((sum, v) => sum + v, 0)
  );

  function openReview() {
    editedPayouts = {};
    for (const p of data.players) {
      editedPayouts[p.id] = 0;
    }
    for (const p of reviewPayouts) {
      editedPayouts[p.playerId] = p.amount;
    }
    showReview = true;
  }

  // Sort players by position for finished view
  const sortedFinished = $derived(
    [...data.players].sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999))
  );

  let selectedMemberId = $state('');
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
        name: p.members ? displayName(p.members) : '?',
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

  async function handleAddPlayer(memberId: string) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        member_id: memberId,
      });
      if (error) { errorKey = 'server_error'; return; }
      selectedMemberId = '';
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
      const { data: maxMember } = await supabase
        .from('members')
        .select('member_number')
        .eq('club_id', data.tournament.club_id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxMember?.member_number ?? 0) + 1;

      // Create member
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          club_id: data.tournament.club_id,
          first_name: quickFirstName.trim(),
          last_name: quickLastName.trim(),
          member_number: nextNumber,
        })
        .select('id')
        .single();
      if (memberError) { errorKey = 'server_error'; return; }

      // Register for tournament
      const { error: regError } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        member_id: newMember.id,
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
    if (data.tournament.status === 'finished') { errorKey = 'error_tournament_not_open'; return; }
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
      const newTimerState = startTimer(new Date());
      await supabase.from('tournaments').update({
        status: 'running',
        timer_state: newTimerState as unknown as Json,
      }).eq('id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleTimerPause() {
    if (!timerState) return;
    const supabase = createClient();
    await supabase.from('tournaments')
      .update({ timer_state: pauseTimer(timerState, new Date()) as unknown as Json })
      .eq('id', data.tournament.id);
    await invalidateAll();
  }

  async function handleTimerResume() {
    if (!timerState) return;
    const supabase = createClient();
    await supabase.from('tournaments')
      .update({ timer_state: resumeTimer(timerState, new Date()) as unknown as Json })
      .eq('id', data.tournament.id);
    await invalidateAll();
  }

  async function handleTimerSkip() {
    if (!timerState || blindLevels.length === 0) return;
    const supabase = createClient();
    await supabase.from('tournaments')
      .update({ timer_state: skipLevel(timerState, blindLevels, new Date()) as unknown as Json })
      .eq('id', data.tournament.id);
    await invalidateAll();
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
      const { data: insertedTables, error } = await supabase.from('tournament_tables').insert(rows).select('id, number, max_seats');
      if (error || !insertedTables) { seatingError = error?.message ?? 'Failed to create tables'; return; }

      // Draw seats immediately after creating tables
      if (data.players.length >= 2) {
        const players = data.players.map((p) => ({ id: p.id, preferred_table: p.preferred_table ?? null }));
        const tables = insertedTables.map((t) => ({ id: t.id, number: t.number, max_seats: t.max_seats }));
        const result = drawSeats(players, tables);
        if (result.error) { seatingError = result.error; await invalidateAll(); return; }

        await supabase
          .from('tournament_players')
          .update({ table_id: null, seat_number: null })
          .eq('tournament_id', data.tournament.id);
        await Promise.all(
          result.assignments.map((a) =>
            supabase
              .from('tournament_players')
              .update({ table_id: a.tableId, seat_number: a.seatNumber })
              .eq('id', a.playerId),
          ),
        );
      }

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

  function openBlindEditModal() {
    const raw = (t.blind_levels ?? t.blind_structures?.levels ?? []) as {
      type?: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label?: string
    }[];
    blindEditLevels = raw.map((l) =>
      (l.type === 'break')
        ? { type: 'break' as const, duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
        : { type: 'level' as const, small_blind: String(l.small_blind), big_blind: String(l.big_blind), ante: String(l.ante), duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
    );
    blindEditError = null;
    showBlindEditModal = true;
  }

  async function saveBlindLevels() {
    if (blindEditLoading) return;
    blindEditError = null;
    const parsed = blindEditLevels.map((l) =>
      l.type === 'break'
        ? { type: 'break' as const, small_blind: 0, big_blind: 0, ante: 0, duration_minutes: Number(l.duration_minutes), label: l.label.trim() || 'Break' }
        : { type: 'level' as const, small_blind: Number(l.small_blind), big_blind: Number(l.big_blind), ante: Number(l.ante), duration_minutes: Number(l.duration_minutes), label: l.label.trim() }
    );
    for (const level of parsed) {
      if (level.duration_minutes <= 0) { blindEditError = 'error_required'; return; }
      if (level.type === 'level' && (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0)) {
        blindEditError = 'error_required'; return;
      }
    }
    blindEditLoading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tournaments')
        .update({ blind_levels: parsed })
        .eq('id', t.id);
      if (error) { blindEditError = 'server_error'; return; }
      showBlindEditModal = false;
      await invalidateAll();
    } finally {
      blindEditLoading = false;
    }
  }

  function openPrizeEditModal() {
    const raw = (t.prize_payouts ?? t.prize_structures?.payouts ?? []) as { position: number; percentage: number }[];
    prizeEditPayouts = raw
      .sort((a, b) => a.position - b.position)
      .map((p, i) => ({ position: i + 1, percentage: String(p.percentage) }));
    prizeEditError = null;
    showPrizeEditModal = true;
  }

  async function savePrizePayouts() {
    if (prizeEditLoading) return;
    prizeEditError = null;
    const parsed = prizeEditPayouts.map((p, i) => ({ position: i + 1, percentage: Number(p.percentage) }));
    const validationError = validatePayouts(parsed);
    if (validationError) { prizeEditError = validationError; return; }
    prizeEditLoading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tournaments')
        .update({ prize_payouts: parsed })
        .eq('id', t.id);
      if (error) { prizeEditError = 'server_error'; return; }
      showPrizeEditModal = false;
      await invalidateAll();
    } finally {
      prizeEditLoading = false;
    }
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
      if (Object.keys(editedPayouts).length > 0) {
        await Promise.all(
          Object.entries(editedPayouts).map(([playerId, amount]) =>
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

  async function handleDeleteTournament() {
    deleting = true;
    try {
      const supabase = createClient();
      await supabase.from('tournament_players').delete().eq('tournament_id', data.tournament.id);
      await supabase.from('tournament_tables').delete().eq('tournament_id', data.tournament.id);
      await supabase.from('tournaments').delete().eq('id', data.tournament.id);
      await goto(`/${data.club.slug}/admin/tournaments`);
    } finally {
      deleting = false;
      showDeleteModal = false;
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
        <button
          type="button"
          onclick={() => { showDeleteModal = true; }}
          class="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
          aria-label={m.tournament_delete_confirm_title()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </h1>
      <p class="text-xs text-muted-foreground mt-1">{metaLine}</p>
      {#if t.blind_levels || t.blind_structures}
        <button type="button" onclick={openBlindEditModal}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-0.5">
          {m.tournament_edit_blind_structure()}
        </button>
      {/if}
      {#if t.prize_payouts || t.prize_structures}
        <button type="button" onclick={openPrizeEditModal}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-0.5">
          {m.tournament_edit_prize_structure()}
        </button>
      {/if}
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
          class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_start_button()}
        </button>
      {:else if t.status === 'running'}
        <button
          type="button"
          disabled={!canFinish || loading}
          title={!allPositionsAssigned ? m.tournament_positions_incomplete() : undefined}
          onclick={() => { openReview(); }}
          class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_finish_button()}
        </button>
      {/if}
    </div>
  </div>

  {#if t.status === 'running' && timerState && blindLevels.length > 0}
    <div class="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
      <div class="min-w-0">
        <div class="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">
          {currentLevel?.type === 'break'
            ? (currentLevel.label || m.timer_break())
            : `${m.timer_level()} ${currentLevelIdx + 1 - blindLevels.slice(0, currentLevelIdx).filter((l) => l.type === 'break').length} · ${currentLevel?.small_blind}/${currentLevel?.big_blind}`}
        </div>
        <div class="text-2xl font-bold font-mono tracking-widest leading-none {remainingMs === 0 ? 'text-accent' : 'text-foreground'}">
          {remainingMs === 0 ? m.timer_times_up() : formatTime(remainingMs)}
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="bg-border rounded-full h-1 mb-1.5">
          <div
            class="bg-accent h-1 rounded-full transition-all duration-1000"
            style="width: {Math.min(100, Math.round(levelProgress * 100))}%"
          ></div>
        </div>
        {#if nextLevel}
          <div class="text-[10px] text-muted-foreground truncate">
            {m.timer_next_preview()}:
            {nextLevel.type === 'break'
              ? (nextLevel.label || m.timer_break())
              : `${nextLevel.small_blind}/${nextLevel.big_blind}`}
            · {nextLevel.duration_minutes} min
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        {#if timerPaused}
          <button
            type="button"
            onclick={handleTimerResume}
            class="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
          >
            ▶ {m.timer_resume()}
          </button>
        {:else}
          <button
            type="button"
            onclick={handleTimerPause}
            class="text-xs bg-muted text-foreground px-3 py-1.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
          >
            ⏸ {m.timer_pause()}
          </button>
        {/if}
        <button
          type="button"
          onclick={handleTimerSkip}
          class="text-xs bg-muted text-foreground px-3 py-1.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
        >
          ⏭ {m.timer_next_level()}
        </button>
        <a
          href="{$page.url.pathname}/clock"
          target="_blank"
          class="text-xs text-accent hover:text-accent/80 transition-colors ml-1"
        >
          🖥 {m.timer_clock_link()} ↗
        </a>
      </div>
    </div>
  {/if}

  <!-- Prize pool callout -->
  <div class="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex justify-between items-start">
    <div class="flex flex-col gap-0.5">
      <span class="text-xs font-medium text-muted-foreground">{m.tournament_prize_pool_label()}</span>
      {#each formatPrizePoolBreakdown(data.players.length, t.buy_in_amount - (t.buy_in_rake ?? 0), totalRebuys, (t.rebuy_amount ?? 0) - (t.rebuy_rake ?? 0), addonCount, (t.addon_amount ?? 0) - (t.addon_rake ?? 0)) as part}
        <span class="text-xs text-muted-foreground">
          {part.count} × €{(part.amountCents / 100).toFixed(0)}
          <span class="opacity-60">
            {part.type === 'buyin' ? m.tournament_buy_in_label() : part.type === 'rebuy' ? m.tournament_rebuy_col() : m.tournament_addon_col()}
          </span>
        </span>
      {/each}
      {#if data.totalRake > 0}
        <span class="text-xs text-muted-foreground">
          {m.tournament_rake_label()}: €{(data.totalRake / 100).toFixed(0)}
        </span>
      {/if}
    </div>
    <div class="flex flex-col items-end gap-1">
      <span class="text-lg font-light text-accent">€{(data.prizePool / 100).toFixed(0)}</span>
      {#if averageStack !== null}
        <span class="text-xs text-muted-foreground">
          {m.tournament_avg_stack_label()}: {averageStack.toLocaleString()}
        </span>
      {/if}
    </div>
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
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Player</th>
              <th class="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {#each data.players as player}
              <tr class="border-b border-border last:border-0">
                <td class="px-4 py-3 text-sm font-medium text-foreground">{player.members ? displayName(player.members) : '—'}</td>
                <td class="px-4 py-3 text-right">
                  <button type="button" onclick={() => handleRemovePlayer(player.id)} disabled={loading}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
                    {m.common_delete()}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else if t.status === 'running'}
      <!-- Running table: Player · Rebuys · Add-on · Position · Bust/Undo -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Player</th>
              {#if t.format === 'rebuy'}
                <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_rebuy_col()}</th>
                <th class="px-4 py-2.5 text-center font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_addon_col()}</th>
              {/if}
              <th class="px-4 py-2.5 text-center font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_position_col()}</th>
              <th class="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {#each data.players as player}
              <tr class="border-b border-border last:border-0">
                <!-- Player name -->
                <td class="px-4 py-3 text-sm {player.finish_position !== null ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}">
                  {player.members ? displayName(player.members) : '—'}
                </td>

                {#if t.format === 'rebuy'}
                  <!-- Rebuys: − count + -->
                  <td class="px-4 py-3">
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
                  </td>

                  <!-- Add-on checkbox -->
                  <td class="px-4 py-3">
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
                  </td>
                {/if}

                <!-- Position -->
                <td class="px-4 py-3 text-sm text-center text-muted-foreground">
                  {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
                </td>

                <!-- Bust / Undo -->
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
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
                    <button type="button" onclick={() => handleRemovePlayer(player.id)} disabled={loading}
                      class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                      aria-label={m.common_delete()}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else}
      <!-- Finished table: Position · Player · Payout -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_position_col()}</th>
              <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Player</th>
              <th class="px-4 py-2.5 text-right font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_payout_col()}</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedFinished as player}
              <tr class="border-b border-border last:border-0">
                <td class="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
                </td>
                <td class="px-4 py-3 text-sm text-foreground">
                  {player.members ? displayName(player.members) : '—'}
                </td>
                <td class="px-4 py-3 text-sm text-right {(player.payout_amount ?? 0) > 0 ? 'text-accent font-medium' : 'text-muted-foreground'} whitespace-nowrap">
                  {(player.payout_amount ?? 0) > 0 ? `€${((player.payout_amount ?? 0) / 100).toFixed(2)}` : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Add player (registration only) -->
  {#if t.status === 'registration'}
    <div class="flex gap-2">
      <select
        bind:value={selectedMemberId}
        class="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground"
      >
        <option value="">{m.tournament_select_player()}</option>
        {#each data.availableMembers as player}
          <option value={player.id}>
            {player.nickname || `${player.first_name} ${player.last_name}`}{player.member_number != null ? ` #${player.member_number}` : ''}
          </option>
        {/each}
      </select>
      <button
        type="button"
        onclick={() => handleAddPlayer(selectedMemberId)}
        disabled={loading || !selectedMemberId}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {m.tournament_add_player_button()}
      </button>
      <button
        type="button"
        onclick={() => { showQuickAdd = true; quickFirstName = ''; quickLastName = ''; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2"
        title={m.member_quick_add_title()}
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
            <table class="w-full">
              <thead>
                <tr class="border-b border-border">
                  <th class="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">Player</th>
                  <th class="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{m.seating_lock_label()}</th>
                </tr>
              </thead>
              <tbody>
                {#each data.players as player}
                  <tr class="border-b border-border last:border-0">
                    <td class="px-4 py-2 text-sm text-foreground">
                      {player.members ? displayName(player.members) : '—'}
                    </td>
                    <td class="px-4 py-2">
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
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

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
                      {seat} {player ? (player.members ? displayName(player.members) : '?') : '—'}
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
                  <span class="flex-1">{player.members ? displayName(player.members) : '?'}</span>
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
              {m.seating_move_hint({ name: movingPlayer?.members ? displayName(movingPlayer.members) : '?' })}
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
                    {seat} {player ? (player.members ? displayName(player.members) : '?') : '—'}
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

<!-- Blind structure edit modal -->
<DialogPrimitive.Root bind:open={showBlindEditModal}>
  <DialogContent>
    <h2 class="text-base font-semibold text-foreground">{m.blind_structure_edit_title()}</h2>
    <BlindStructureForm bind:levels={blindEditLevels} />
    {#if blindEditError}
      <p class="text-xs text-accent">{resolveError(blindEditError)}</p>
    {/if}
    <div class="flex gap-3">
      <button type="button" onclick={saveBlindLevels} disabled={blindEditLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.blind_structure_save_button()}
      </button>
      <button type="button" onclick={() => { showBlindEditModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </DialogContent>
</DialogPrimitive.Root>

<!-- Prize structure edit modal -->
<DialogPrimitive.Root bind:open={showPrizeEditModal}>
  <DialogContent>
    <h2 class="text-base font-semibold text-foreground">{m.prize_structure_edit_title()}</h2>
    <PrizeStructureForm bind:payouts={prizeEditPayouts} />
    {#if prizeEditError}
      <p class="text-xs text-accent">{resolveError(prizeEditError)}</p>
    {/if}
    <div class="flex gap-3">
      <button type="button" onclick={savePrizePayouts} disabled={prizeEditLoading}
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.prize_structure_save_button()}
      </button>
      <button type="button" onclick={() => { showPrizeEditModal = false; }}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {m.tournament_cancel_review()}
      </button>
    </div>
  </DialogContent>
</DialogPrimitive.Root>

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
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_position_col()}</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Player</th>
            <th class="px-4 py-2.5 text-right font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{m.tournament_payout_col()}</th>
          </tr>
        </thead>
        <tbody>
          {#each [...data.players].sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999)) as player}
            <tr class="border-b border-border last:border-0">
              <td class="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
              </td>
              <td class="px-4 py-3 text-sm text-foreground">
                {player.members ? displayName(player.members) : '—'}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <div class="relative w-24">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(editedPayouts[player.id] ?? 0) / 100}
                      onchange={(e) => { editedPayouts[player.id] = Math.round(parseFloat((e.currentTarget as HTMLInputElement).value || '0') * 100); }}
                      class="w-full bg-background border border-border rounded-md px-2 pl-6 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t border-border bg-muted/30">
            <td class="px-4 py-3"></td>
            <td class="px-4 py-3 text-xs font-medium text-muted-foreground">{m.tournament_payout_total_label()}</td>
            <td class="px-4 py-3 text-sm text-right font-medium text-foreground">€{(editedPayoutsTotal / 100).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    {#if editedPayoutsTotal !== data.prizePool}
      <p class="text-xs text-amber-500">{m.tournament_payout_mismatch_warning({ pool: (data.prizePool / 100).toFixed(2) })}</p>
    {/if}
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
      <h2 class="text-sm font-semibold text-foreground mb-4">{m.member_quick_add_title()}</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleQuickAdd(); }} class="flex flex-col gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.member_first_name_label()} *</label>
          <input bind:value={quickFirstName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.member_last_name_label()} *</label>
          <input bind:value={quickLastName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        {#if errorKey}
          <p class="text-xs text-accent">{resolveError(errorKey)}</p>
        {/if}
        <div class="flex gap-2 justify-end mt-2">
          <button type="button" onclick={() => (showQuickAdd = false)} class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5">
            {m.member_cancel()}
          </button>
          <button type="submit" disabled={loading} class="bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.member_quick_add_button()}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete tournament confirmation modal -->
{#if showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0" onclick={() => showDeleteModal = false}></div>
    <div class="relative bg-card border border-border rounded-lg p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.tournament_delete_confirm_title()}</h2>
      <p class="text-sm text-muted-foreground">
        {m.tournament_delete_confirm_body({ name: t.name })}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => showDeleteModal = false}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.tournament_cancel_review()}
        </button>
        <button
          type="button"
          onclick={handleDeleteTournament}
          disabled={deleting}
          class="bg-destructive text-destructive-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_delete_confirm()}
        </button>
      </div>
    </div>
  </div>
{/if}
