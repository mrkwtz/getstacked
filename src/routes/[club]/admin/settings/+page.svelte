<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { isValidSlug } from '$lib/clubs';
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data } = $props<{ data: { club: Club } }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let confirmName = $state('');
  const deleteEnabled = $derived(confirmName === data.club.name);

  let loading = $state(false);
  let updateErrorKey = $state<string | null>(null);
  let deleteErrorKey = $state<string | null>(null);
  let saved = $state(false);

  async function handleUpdate(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    loading = true;
    updateErrorKey = null;
    saved = false;
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const name = formData.get('name')?.toString().trim() ?? '';
      const slug = formData.get('slug')?.toString().trim() ?? '';
      if (!name) { updateErrorKey = 'error_required'; return; }
      if (!isValidSlug(slug)) { updateErrorKey = 'error_invalid_slug'; return; }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('clubs')
        .update({ name, slug })
        .eq('id', data.club.id);
      if (updateError?.code === '23505') { updateErrorKey = 'error_slug_taken'; return; }
      if (updateError) { updateErrorKey = 'server_error'; return; }

      if (slug !== data.club.slug) {
        goto(`/${slug}/admin/settings`);
        return;
      }
      saved = true;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDeleteClub(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    if (confirmName !== data.club.name) { deleteErrorKey = 'error_club_name_mismatch'; return; }
    loading = true;
    deleteErrorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('clubs').delete().eq('id', data.club.id);
      if (error) { deleteErrorKey = 'server_error'; return; }
      goto('/');
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-md">
  <h1 class="text-2xl font-bold mb-6">{m.settings_title()}</h1>

  <form onsubmit={handleUpdate} class="bg-gray-900 rounded-xl p-6 space-y-4">
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
    {#if updateErrorKey}
      <p class="text-red-400 text-sm">{resolveError(updateErrorKey)}</p>
    {/if}
    {#if saved}
      <p class="text-green-400 text-sm">{m.settings_saved()}</p>
    {/if}
    <button type="submit" disabled={loading} class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
      {m.settings_save()}
    </button>
  </form>

  <div class="mt-8">
    <h2 class="text-xl font-bold mb-4 text-red-400">{m.settings_delete_title()}</h2>
    <form onsubmit={handleDeleteClub} class="bg-gray-900 rounded-xl p-6 space-y-4">
      <p class="text-sm text-gray-400">{m.settings_delete_description()}</p>
      <div>
        <label for="confirm-name" class="block text-sm font-medium text-gray-300 mb-1">{m.settings_delete_confirm_label()}</label>
        <input id="confirm-name" type="text" bind:value={confirmName}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500" />
      </div>
      {#if deleteErrorKey}
        <p class="text-red-400 text-sm">{resolveError(deleteErrorKey)}</p>
      {/if}
      <button type="submit" disabled={!deleteEnabled || loading} class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
        {m.settings_delete_button()}
      </button>
    </form>
  </div>
</div>
