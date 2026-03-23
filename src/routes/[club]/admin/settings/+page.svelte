<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data, form } = $props<{
    data: { club: Club };
    form: { saved?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="max-w-md">
  <h1 class="text-2xl font-bold mb-6">{m.settings_title()}</h1>

  <form method="POST" use:enhance class="bg-gray-900 rounded-xl p-6 space-y-4">
    <div>
      <label for="name" class="block text-sm font-medium text-gray-300 mb-1">{m.club_name_label()}</label>
      <input id="name" name="name" type="text" required value={data.club.name}
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
    </div>
    <div>
      <label for="slug" class="block text-sm font-medium text-gray-300 mb-1">{m.club_slug_label()}</label>
      <input id="slug" name="slug" type="text" required value={data.club.slug}
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
    </div>
    {#if form?.errorKey}
      <p class="text-red-400 text-sm">{resolveError(form.errorKey)}</p>
    {/if}
    {#if form?.saved}
      <p class="text-green-400 text-sm">{m.settings_saved()}</p>
    {/if}
    <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
      {m.settings_save()}
    </button>
  </form>
</div>
