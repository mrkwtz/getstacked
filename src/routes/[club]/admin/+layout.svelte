<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();

  const base = $derived(`/${data.club.slug}/admin`);
</script>

<div class="flex flex-col h-full">
  <!-- Sub-nav tab bar -->
  <div class="border-b border-border px-6 flex">
    <a
      href="{base}/members"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/members`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      Members
    </a>
    <a
      href="{base}/settings"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/settings`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      Settings
    </a>
  </div>

  <!-- Page content -->
  <div class="flex-1 p-6">
    {@render children()}
  </div>
</div>
