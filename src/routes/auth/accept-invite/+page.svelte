<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{ data: { club: { name: string; slug: string } } }>();
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="bg-card border border-border rounded-xl p-8 text-center">
      <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
      <h1 class="text-base font-semibold text-foreground mt-4 mb-2">{m.invite_title()}</h1>
      <p class="text-sm text-muted-foreground mb-6">{m.invite_body({ club_name: data.club.name })}</p>

      <form method="POST" use:enhance>
        <button
          type="submit"
          class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.invite_join_button()}
        </button>
      </form>
    </div>
  </div>
</div>
