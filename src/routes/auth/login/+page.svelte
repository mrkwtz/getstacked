<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { form } = $props<{ form: { sent?: boolean; errorKey?: string; errorMessage?: string } | null }>();
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-2xl font-bold text-white mb-6">{m.auth_sign_in()}</h1>

    {#if form?.sent}
      <p class="text-green-400">{m.auth_check_email()}</p>
    {:else}
      <form method="POST" use:enhance>
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-300 mb-1">{m.auth_email_label()}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="you@example.com"
          />
        </div>

        {#if form?.errorKey === 'invalid_email'}
          <p class="text-red-400 text-sm mb-3">{m.auth_invalid_email()}</p>
        {:else if form?.errorKey}
          <p class="text-red-400 text-sm mb-3">{form.errorMessage ?? m.auth_invalid_email()}</p>
        {/if}

        <button
          type="submit"
          class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          {m.auth_magic_link_button()}
        </button>
      </form>
    {/if}
  </div>
</div>
