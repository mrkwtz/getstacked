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

<div class="min-h-screen bg-background flex items-center justify-center px-4 relative">
  <div class="absolute top-4 right-4">
    <form method="POST" action="/auth/logout">
      <button type="submit" title="Sign out" class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
        Sign out
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </form>
  </div>
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

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="first_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
              {m.player_first_name_label()}
            </label>
            <input
              id="first_name" name="first_name" type="text" required
              placeholder="John"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label for="last_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
              {m.player_last_name_label()}
            </label>
            <input
              id="last_name" name="last_name" type="text" required
              placeholder="Doe"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
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

