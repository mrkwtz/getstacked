<script lang="ts">
  import { isAdmin } from '$lib/members';
  import ThemeToggle from './ThemeToggle.svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { club, member, currentPath } = $props<{
    club: Club;
    member: ClubMember;
    currentPath: string;
  }>();

  const clubPath = $derived(`/${club.slug}`);

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
    <p class="text-sm font-medium text-foreground truncate">{club.name}</p>
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
      Dashboard
    </a>

    {#if isAdmin(member)}
      <a
        href="{clubPath}/admin/members"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/members`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        Members
      </a>
      <a
        href="{clubPath}/admin/settings"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/settings`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        Settings
      </a>
    {/if}
  </nav>

  <!-- Footer: display name + theme toggle + logout -->
  <div class="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
    <span class="text-xs text-muted-foreground truncate">{member.display_name}</span>
    <div class="flex items-center gap-1 flex-shrink-0">
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
