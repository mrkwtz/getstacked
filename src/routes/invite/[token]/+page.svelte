<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: { clubName: string; clubSlug: string };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="bg-card border border-border rounded-xl p-8">
      <div class="mb-6">
        <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
        <p class="text-sm text-muted-foreground">{m.invite_title()}</p>
      </div>

      <p class="text-sm text-foreground mb-6">{m.invite_body({ club_name: data.clubName })}</p>

      <form method="POST" use:enhance class="flex flex-col gap-4">
        <div>
          <label for="display_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.club_display_name_label()}
          </label>
          <input
            id="display_name" name="display_name" type="text" required
            placeholder="Poker Pete"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {#if form?.errorKey}
          <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
        {/if}

        <button
          type="submit"
          class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.invite_join_button()}
        </button>
      </form>
    </div>
  </div>
</div>
