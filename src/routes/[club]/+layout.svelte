<script lang="ts">
  import { page } from '$app/state';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import type { Snippet } from 'svelte';
  import type { Club, Player } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; player: Player };
    children: Snippet;
  }>();
</script>

<div class="flex min-h-screen bg-background">
  <Sidebar club={data.club} player={data.player} otherClubs={data.otherClubs} currentPath={page.url.pathname} />
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
