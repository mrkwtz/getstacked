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

  <!-- Footer: display name + theme toggle -->
  <div class="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
    <span class="text-xs text-muted-foreground truncate">{member.display_name}</span>
    <ThemeToggle />
  </div>
</aside>
