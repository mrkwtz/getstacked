<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, ClubMember } from '$lib/types';

  const { data } = $props<{ data: { club: Club; member: ClubMember } }>();
</script>

<h1 class="text-2xl font-bold mb-2">{m.club_home_welcome({ club_name: data.club.name })}</h1>
<p class="text-gray-400">{m.club_home_placeholder()}</p>
