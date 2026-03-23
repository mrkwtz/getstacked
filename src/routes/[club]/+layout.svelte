<script lang="ts">
  import { isAdmin } from '$lib/members';
  import * as m from '$lib/paraglide/messages';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{ data: { club: Club; member: ClubMember }; children: Snippet }>();

  const clubPath = $derived(`/${data.club.slug}`);
</script>

<div class="min-h-screen bg-gray-950 text-white">
  <nav class="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-6">
    <span class="font-bold text-lg">{data.club.name}</span>
    <a href={clubPath} class="text-gray-400 hover:text-white text-sm transition-colors">{m.nav_home()}</a>
    <a href={`${clubPath}/tournaments`} class="text-gray-400 hover:text-white text-sm transition-colors">{m.nav_tournaments()}</a>
    <a href={`${clubPath}/leaderboard`} class="text-gray-400 hover:text-white text-sm transition-colors">{m.nav_leaderboard()}</a>
    {#if isAdmin(data.member)}
      <a href={`${clubPath}/admin`} class="ml-auto text-indigo-400 hover:text-indigo-300 text-sm transition-colors">{m.nav_admin()}</a>
    {/if}
  </nav>

  <main class="max-w-5xl mx-auto px-4 py-6">
    {@render children()}
  </main>
</div>
