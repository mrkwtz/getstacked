<script lang="ts">
  import { page } from '$app/state';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();
</script>

<div class="flex min-h-screen bg-background">
  <Sidebar club={data.club} member={data.member} currentPath={page.url.pathname} />
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
