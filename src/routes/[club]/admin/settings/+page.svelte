<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data, form } = $props<{
    data: { club: Club };
    form: { saved?: boolean; errorKey?: string; action?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let confirmName = $state('');
  const deleteEnabled = $derived(confirmName === data.club.name);
</script>

<div class="max-w-sm flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.settings_title()}</h1>

  <form method="POST" action="?/update" use:enhance={() => async ({ update }) => update({ reset: false })} class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
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

    {#if form?.errorKey && form.action !== 'delete'}
      <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
    {/if}
    {#if form?.saved}
      <p class="text-xs text-green-500">{m.settings_saved()}</p>
    {/if}

    <button
      type="submit"
      class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.settings_save()}
    </button>
  </form>

  <!-- Danger zone -->
  <div class="border border-accent/40 rounded-lg p-5 flex flex-col gap-4">
    <h2 class="text-sm font-semibold text-accent">{m.settings_danger_zone()}</h2>
    <p class="text-xs text-muted-foreground">{m.settings_delete_warning()}</p>

    <form method="POST" action="?/delete_club" use:enhance class="flex flex-col gap-3">
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

      {#if form?.errorKey && form.action === 'delete'}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button
        type="submit" disabled={!deleteEnabled}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {m.settings_delete_club()}
      </button>
    </form>
  </div>
</div>
