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

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-md p-8 bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-2xl font-bold text-white mb-6">{m.club_create_title()}</h1>

    <form method="POST" use:enhance>
      <div class="mb-4">
        <label for="name" class="block text-sm font-medium text-gray-300 mb-1">{m.club_name_label()}</label>
        <input
          id="name" name="name" type="text" required
          value={name} oninput={onNameInput}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="River City Poker Club"
        />
      </div>

      <div class="mb-4">
        <label for="slug" class="block text-sm font-medium text-gray-300 mb-1">
          {m.club_slug_label()} <span class="text-gray-500 font-normal">— yourclub.app/<span class="text-indigo-400">{slug || 'slug'}</span></span>
        </label>
        <input
          id="slug" name="slug" type="text" required
          value={slug} oninput={onSlugInput}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="river-city"
        />
      </div>

      <div class="mb-6">
        <label for="display_name" class="block text-sm font-medium text-gray-300 mb-1">{m.club_display_name_label()}</label>
        <input
          id="display_name" name="display_name" type="text" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="Poker Pete"
        />
      </div>

      {#if errorMessage()}
        <p class="text-red-400 text-sm mb-4">{errorMessage()}</p>
      {/if}

      <button type="submit" class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
        {m.club_create_button()}
      </button>
    </form>
  </div>
</div>
