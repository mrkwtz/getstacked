<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, ClubMember } from '$lib/types';

  const { data } = $props<{ data: { club: Club; member: ClubMember } }>();
</script>

<div class="p-6 flex flex-col gap-6">
  <h1 class="text-lg font-semibold text-foreground">{m.club_home_welcome({ club_name: data.club.name })}</h1>

  <!-- Stat cards -->
  <div class="grid grid-cols-3 gap-4">
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Members</p>
      <p class="text-3xl font-light text-foreground">—</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Games</p>
      <p class="text-3xl font-light text-foreground">—</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Balance</p>
      <p class="text-3xl font-light text-accent">—</p>
    </div>
  </div>

  <!-- Next game placeholder -->
  <div class="bg-card border border-border rounded-lg p-4">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Next game</p>
    <p class="text-sm text-muted-foreground">{m.club_home_placeholder()}</p>
  </div>
</div>
