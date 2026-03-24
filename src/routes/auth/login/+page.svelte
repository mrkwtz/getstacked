<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { form } = $props<{ form: { sent?: boolean; errorKey?: string; errorMessage?: string } | null }>();
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-2xl font-bold text-white mb-6">{m.auth_sign_in()}</h1>

    <form method="POST" action="?/google" use:enhance>
      <button
        type="submit"
        class="w-full py-2 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {m.auth_continue_with_google()}
      </button>
    </form>

    <div class="flex items-center gap-3 my-6">
      <div class="flex-1 h-px bg-gray-700"></div>
      <span class="text-gray-500 text-sm">{m.auth_or_divider()}</span>
      <div class="flex-1 h-px bg-gray-700"></div>
    </div>

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
