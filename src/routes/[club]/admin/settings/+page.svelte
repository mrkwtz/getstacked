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

<div class="max-w-sm flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.settings_title()}</h1>

  <form method="POST" use:enhance class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
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

    {#if form?.errorKey}
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
</div>
