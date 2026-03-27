<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();
</script>

<div class="flex-1 p-6">
  {@render children()}
</div>
