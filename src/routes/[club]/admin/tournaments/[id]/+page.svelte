<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
  import * as m from '$lib/paraglide/messages';

  type TournamentPlayer = {
    id: string;
    member_user_id: string | null;
    guest_name: string | null;
    rebuys: number;
    addon: boolean;
    finish_position: number | null;
    payout_amount: number | null;
    club_members: { display_name: string } | null;
  };

  type PageData = {
    tournament: {
      id: string;
      club_id: string;
      name: string;
      date: string;
      status: string;
      format: string;
      buy_in: number;
      rebuy_amount: number | null;
      addon_amount: number | null;
      blind_structures: { name: string } | null;
      prize_structures: { name: string } | null;
    };
    players: TournamentPlayer[];
    availableMembers: { user_id: string; display_name: string }[];
    prizePool: number;
    prizeStructure: { payouts: { position: number; percentage: number }[] } | null;
  };

  const { data }: { data: PageData } = $props();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleAddPlayer(memberId: string | null, guestName: string | null) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    if (memberId) {
      const existing = data.players.find((p) => p.member_user_id === memberId);
      if (existing) { errorKey = 'error_duplicate_player'; return; }
    }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        member_club_id: memberId ? data.tournament.club_id : null,
        member_user_id: memberId,
        guest_name: guestName ?? null,
      });
      if (error) { errorKey = 'server_error'; return; }
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

  async function handleFinishTournament() {
    if (loading) return;
    if (data.tournament.status !== 'running') return;
    if (data.players.some((p) => p.finish_position === null)) {
      errorKey = 'tournament_positions_incomplete'; return;
    }
    if (!data.prizeStructure) { errorKey = 'error_no_prize_structures'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
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
      await supabase.from('tournaments').update({ status: 'finished' }).eq('id', data.tournament.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">{data.tournament.name}</h1>
    <p class="text-sm text-gray-500">{data.tournament.date} &mdash; {data.tournament.status}</p>
    {#if data.tournament.blind_structures}
      <p class="text-sm text-gray-500">Blinds: {data.tournament.blind_structures.name}</p>
    {/if}
    {#if data.tournament.prize_structures}
      <p class="text-sm text-gray-500">Prizes: {data.tournament.prize_structures.name}</p>
    {/if}
    <p class="text-sm font-medium mt-1">Prize Pool: ${data.prizePool}</p>
  </div>

  {#if errorKey}
    <div class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
      {resolveError(errorKey)}
    </div>
  {/if}

  <!-- Registration actions -->
  {#if data.tournament.status === 'registration'}
    <div class="mb-6 rounded border p-4">
      <h2 class="mb-3 text-lg font-semibold">Add Player</h2>
      {#if data.availableMembers.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each data.availableMembers as member (member.user_id)}
            <button
              class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
              onclick={() => handleAddPlayer(member.user_id, null)}
            >
              + {member.display_name}
            </button>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-gray-500">All members are already registered.</p>
      {/if}
    </div>

    <div class="mb-6">
      <button
        class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        disabled={loading || data.players.length < 2}
        onclick={handleStartTournament}
      >
        Start Tournament
      </button>
    </div>
  {/if}

  <!-- Running actions -->
  {#if data.tournament.status === 'running'}
    <div class="mb-6">
      <button
        class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        disabled={loading}
        onclick={handleFinishTournament}
      >
        Finish Tournament
      </button>
    </div>
  {/if}

  <!-- Player list -->
  <div>
    <h2 class="mb-3 text-lg font-semibold">Players ({data.players.length})</h2>
    {#if data.players.length === 0}
      <p class="text-sm text-gray-500">No players registered yet.</p>
    {:else}
      <ul class="space-y-2">
        {#each data.players as player (player.id)}
          {@const playerName = player.club_members?.display_name ?? player.guest_name ?? 'Unknown'}
          <li class="flex items-center justify-between rounded border p-3">
            <div class="flex-1">
              <span class="font-medium">{playerName}</span>
              {#if player.finish_position !== null}
                <span class="ml-2 text-sm text-gray-500">#{player.finish_position}</span>
              {/if}
              {#if data.tournament.format === 'rebuy'}
                <span class="ml-2 text-sm text-gray-500">Rebuys: {player.rebuys}</span>
                {#if player.addon}
                  <span class="ml-2 text-xs text-blue-600">Addon</span>
                {/if}
              {/if}
              {#if player.payout_amount !== null}
                <span class="ml-2 text-sm font-medium text-green-600">${player.payout_amount}</span>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if data.tournament.status === 'registration'}
                <button
                  class="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
                  disabled={loading}
                  onclick={() => handleRemovePlayer(player.id)}
                >
                  Remove
                </button>
              {/if}
              {#if data.tournament.status === 'running'}
                {#if data.tournament.format === 'rebuy'}
                  <button
                    class="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
                    disabled={loading}
                    onclick={() => handleRemoveRebuy(player.id)}
                  >
                    -R
                  </button>
                  <button
                    class="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
                    disabled={loading}
                    onclick={() => handleAddRebuy(player.id)}
                  >
                    +R
                  </button>
                  <button
                    class="rounded px-2 py-1 text-xs disabled:opacity-50 {player.addon ? 'bg-blue-200 text-blue-800 hover:bg-blue-300' : 'bg-gray-100 hover:bg-gray-200'}"
                    disabled={loading}
                    onclick={() => handleToggleAddon(player.id)}
                  >
                    Addon
                  </button>
                {/if}
                {#if player.finish_position === null}
                  <button
                    class="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                    disabled={loading}
                    onclick={() => handleBustPlayer(player.id)}
                  >
                    Bust
                  </button>
                {:else}
                  <button
                    class="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
                    disabled={loading}
                    onclick={() => handleUnsetBust(player.id)}
                  >
                    Unset Bust
                  </button>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
