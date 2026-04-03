<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Club, Member } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; player: Member };
    children: Snippet;
  }>();
</script>

<div class="flex-1 p-6">
  {@render children()}
</div>
