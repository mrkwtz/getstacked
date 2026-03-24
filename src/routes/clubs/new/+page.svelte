<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { form } = $props<{ form: { errorKey?: string; field?: string; errorMessage?: string } | null }>();

  let name = $state('');
  let slug = $state('');
  let autoSlug = $state(true);

  function onNameInput(e: Event) {
    name = (e.target as HTMLInputElement).value;
    if (autoSlug) {
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  function onSlugInput(e: Event) {
    slug = (e.target as HTMLInputElement).value;
    autoSlug = false;
  }

  function errorMessage(): string | null {
    if (!form?.errorKey) return null;
    if (form.errorKey === 'error_required') return m.error_required();
    if (form.errorKey === 'error_invalid_slug') return m.error_invalid_slug();
    if (form.errorKey === 'error_slug_taken') return m.error_slug_taken();
    return form.errorMessage ?? null;
  }
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="bg-card border border-border rounded-xl p-8">
      <div class="mb-6">
        <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
        <p class="text-sm text-muted-foreground">{m.club_create_title()}</p>
      </div>

      <form method="POST" use:enhance class="flex flex-col gap-4">
        <div>
          <label for="name" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.club_name_label()}
          </label>
          <input
            id="name" name="name" type="text" required
            value={name} oninput={onNameInput}
            placeholder="River City Poker Club"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label for="slug" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.club_slug_label()}
            <span class="text-muted-foreground font-normal ml-1">
              — app/<span class="text-accent">{slug || 'slug'}</span>
            </span>
          </label>
          <input
            id="slug" name="slug" type="text" required
            value={slug} oninput={onSlugInput}
            placeholder="river-city"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

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

        {#if errorMessage()}
          <p class="text-xs text-accent">{errorMessage()}</p>
        {/if}

        <button
          type="submit"
          class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.club_create_button()}
        </button>
      </form>
    </div>
  </div>
</div>
