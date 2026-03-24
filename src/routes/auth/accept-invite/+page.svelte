<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{ data: { club: { name: string; slug: string } } }>();
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg text-center">
    <h1 class="text-2xl font-bold text-white mb-2">{m.invite_title()}</h1>
    <p class="text-gray-400 mb-6">{m.invite_body({ club_name: data.club.name })}</p>
    <form method="POST" use:enhance>
      <button type="submit" class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
        {m.invite_join_button()}
      </button>
    </form>
  </div>
</div>
