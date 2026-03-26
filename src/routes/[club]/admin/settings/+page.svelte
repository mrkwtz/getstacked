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

<div class="max-w-sm flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.settings_title()}</h1>

  <form onsubmit={handleUpdate} class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    <div>
      <label for="name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.club_name_label()}
      </label>
      <input
        id="name" name="name" type="text" required value={data.club.name}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>
    <div>
      <label for="slug" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.club_slug_label()}
      </label>
      <input
        id="slug" name="slug" type="text" required value={data.club.slug}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    {#if updateErrorKey}
      <p class="text-xs text-accent">{resolveError(updateErrorKey)}</p>
    {/if}
    {#if saved}
      <p class="text-xs text-green-500">{m.settings_saved()}</p>
    {/if}

    <button
      type="submit" disabled={loading}
      class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {m.settings_save()}
    </button>
  </form>

  <!-- Danger zone -->
  <div class="border border-accent/40 rounded-lg p-5 flex flex-col gap-4">
    <h2 class="text-sm font-semibold text-accent">{m.settings_danger_zone()}</h2>
    <p class="text-xs text-muted-foreground">{m.settings_delete_warning()}</p>

    <form onsubmit={handleDeleteClub} class="flex flex-col gap-3">
      <div>
        <label for="confirm_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.settings_delete_confirm_label()}
        </label>
        <input
          id="confirm_name" name="confirm_name" type="text" autocomplete="off"
          bind:value={confirmName}
          placeholder={data.club.name}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {#if deleteErrorKey}
        <p class="text-xs text-accent">{resolveError(deleteErrorKey)}</p>
      {/if}

      <button
        type="submit" disabled={!deleteEnabled || loading}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {m.settings_delete_club()}
      </button>
    </form>
  </div>
</div>
