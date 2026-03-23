<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data } = $props<{ data: { club: Club } }>();

  const adminPath = $derived(`/${data.club.slug}/admin`);
</script>

<h1 class="text-2xl font-bold mb-6">{m.nav_admin()}</h1>
<nav class="flex flex-col gap-2">
  <a href={`${adminPath}/members`} class="text-indigo-400 hover:underline">{m.members_title()}</a>
  <a href={`${adminPath}/settings`} class="text-indigo-400 hover:underline">{m.settings_title()}</a>
</nav>
