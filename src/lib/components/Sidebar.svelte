<script lang="ts">
  import { isAdmin, displayName } from '$lib/members';
  import { ArrowLeftRight } from '@lucide/svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { Club, Member } from '$lib/types';

  const { club, player, otherClubs, currentPath } = $props<{
    club: Club;
    player: Member;
    otherClubs: { slug: string; name: string }[];
    currentPath: string;
  }>();

  const clubPath = $derived(`/${club.slug}`);
  let showClubSwitcher = $state(false);

  function isActive(path: string, exact = false): boolean {
    if (exact) return currentPath === path;
    return currentPath === path || currentPath.startsWith(path + '/');
  }
</script>

<aside class="w-[200px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0">
  <!-- Logo -->
  <div class="px-4 py-4 border-b border-border">
    <span class="font-extrabold text-sm tracking-tight text-foreground">GETSTACKED</span>
  </div>

  <!-- Club name -->
  <div class="px-4 py-3 border-b border-border">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Club</p>
    <div class="flex items-center gap-1.5">
      <p class="text-sm font-medium text-foreground truncate flex-1">{club.name}</p>
      {#if otherClubs.length > 0}
        <button
          type="button"
          onclick={() => { showClubSwitcher = true; }}
          title="Switch club"
          class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeftRight size={12} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Nav items -->
  <nav class="flex-1 p-2 flex flex-col gap-0.5">
    <a
      href={clubPath}
      class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
        isActive(clubPath, true)
          ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }"
    >
      {m.nav_dashboard()}
    </a>

    {#if isAdmin(player)}
      <a
        href="{clubPath}/admin/tournaments"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/tournaments`) ||
          isActive(`${clubPath}/admin/blind-structures`) ||
          isActive(`${clubPath}/admin/prize-structures`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        {m.nav_tournaments()}
      </a>
      <a
        href="{clubPath}/admin/members"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/members`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        {m.nav_members()}
      </a>
      <a
        href="{clubPath}/admin/settings"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/settings`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        {m.nav_settings()}
      </a>
    {/if}
  </nav>

  <!-- Footer: display name + theme toggle + logout -->
  <div class="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
    <span class="text-xs text-muted-foreground truncate">{displayName(player)}</span>
    <div class="flex items-center gap-1 flex-shrink-0">
      <LanguageSwitcher />
      <ThemeToggle />
      <form method="POST" action="/auth/logout">
        <button type="submit" title="Sign out" class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </form>
    </div>
  </div>
</aside>

{#if showClubSwitcher}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button type="button" class="absolute inset-0 bg-black/50" aria-label="Close" onclick={() => (showClubSwitcher = false)}></button>
    <div class="relative bg-card border border-border rounded-xl p-6 w-full max-w-xs mx-4">
      <h2 class="text-sm font-semibold text-foreground mb-4">{m.club_switch_title()}</h2>
      <div class="flex flex-col gap-1">
        <!-- Current club -->
        <div class="flex items-center gap-2 px-3 py-2.5 rounded-md bg-accent/10">
          <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
          <span class="text-sm font-medium text-foreground truncate">{club.name}</span>
        </div>
        <!-- Other clubs -->
        {#each otherClubs as other}
          <a
            href="/{other.slug}"
            class="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onclick={() => { showClubSwitcher = false; }}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0"></span>
            <span class="truncate">{other.name}</span>
          </a>
        {/each}
      </div>
    </div>
  </div>
{/if}
