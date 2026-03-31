<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, Player } from '$lib/types';

  const { data } = $props<{ data: { club: Club; player: Player; playerCount: number; tournamentCount: number } }>();
</script>

<div class="p-6 flex flex-col gap-6">
  <h1 class="text-lg font-semibold text-foreground">{m.club_home_welcome({ club_name: data.club.name })}</h1>

  <!-- Stat cards -->
  <div class="grid grid-cols-3 gap-4">
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_players()}</p>
      <p class="text-3xl font-light text-foreground">{data.playerCount}</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_tournaments()}</p>
      <p class="text-3xl font-light text-foreground">{data.tournamentCount}</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_balance()}</p>
      <p class="text-3xl font-light text-accent">—</p>
    </div>
  </div>

  <!-- Next game placeholder -->
  <div class="bg-card border border-border rounded-lg p-4">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{m.dashboard_next_game()}</p>
    <p class="text-sm text-muted-foreground">{m.club_home_placeholder()}</p>
  </div>
</div>
