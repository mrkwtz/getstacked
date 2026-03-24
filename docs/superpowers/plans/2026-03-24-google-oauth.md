# Google OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Continue with Google" button to the login page alongside the existing magic link form, using Supabase OAuth with PKCE.

**Architecture:** A new named form action `google` in the login page server calls `signInWithOAuth` and redirects the browser to Google. On return, the existing `/auth/callback` handler exchanges the code for a session — no changes needed to the session or RLS setup. The callback is also updated to handle the cancellation case (Google returns `?error=` with no `code`).

**Tech Stack:** SvelteKit form actions, Supabase Auth (`signInWithOAuth`), `@supabase/ssr`, Paraglide JS (i18n), Tailwind CSS

---

## File Structure

```
messages/
  en.json          # Add: auth_continue_with_google, auth_or_divider
  de.json          # Add: auth_continue_with_google, auth_or_divider
src/routes/
  auth/
    login/
      +page.server.ts   # Add: google named action
      +page.svelte      # Add: Google button + "or" divider
    callback/
      +server.ts        # Add: error param handling for OAuth cancellation
```

---

## Task 1: i18n — Add message keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add keys to en.json**

Add after `"auth_magic_link_button"`:
```json
"auth_continue_with_google": "Continue with Google",
"auth_or_divider": "or",
```

- [ ] **Step 2: Add keys to de.json**

Add the equivalent in `messages/de.json` (same position for consistency):
```json
"auth_continue_with_google": "Mit Google fortfahren",
"auth_or_divider": "oder",
```

- [ ] **Step 3: Verify Paraglide compiles**

```bash
npm run build 2>&1 | grep -i error
```

Expected: no errors. (Paraglide regenerates `src/lib/paraglide/` automatically on build/dev.)

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat: add i18n keys for Google OAuth button"
```

---

## Task 2: Callback — Handle OAuth cancellation

**Files:**
- Modify: `src/routes/auth/callback/+server.ts`

- [ ] **Step 1: Add error param check**

Update the handler to redirect back to `/auth/login` when Google returns an error (e.g. user cancelled):

```typescript
import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  // OAuth cancellation: Google returns ?error=access_denied with no code
  if (url.searchParams.get('error')) {
    throw redirect(303, '/auth/login');
  }

  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  // Validate next is a relative path to prevent open redirect attacks.
  // Reject protocol-relative URLs (//evil.com) which start with '/' but redirect off-site.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const supabase = createAnonClient(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  throw redirect(303, safeNext);
};
```

- [ ] **Step 2: Verify dev server compiles**

```bash
npm run dev 2>&1 | grep -i error | head -5
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth/callback/+server.ts
git commit -m "fix: redirect to login on OAuth cancellation in callback"
```

---

## Task 3: Login server — Add Google action

**Files:**
- Modify: `src/routes/auth/login/+page.server.ts`

- [ ] **Step 1: Add the google named action**

The file currently exports `actions: Actions` with a single `default` action. Add `google` alongside it:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { errorKey: 'invalid_email' });
    }

    const supabase = createAnonClient(cookies);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback` }
    });

    if (error) return fail(500, { errorKey: 'server_error', errorMessage: error.message });

    return { sent: true };
  },

  google: async ({ cookies, url }) => {
    const supabase = createAnonClient(cookies);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${url.origin}/auth/callback` }
    });

    if (error) return fail(500, { errorKey: 'server_error', errorMessage: error.message });

    throw redirect(303, data.url);
  }
};
```

- [ ] **Step 2: Verify dev server compiles**

```bash
npm run dev 2>&1 | grep -i error | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth/login/+page.server.ts
git commit -m "feat: add Google OAuth named action to login"
```

---

## Task 4: Login page — Add Google button and divider

**Files:**
- Modify: `src/routes/auth/login/+page.svelte`

- [ ] **Step 1: Add the Google button and divider**

Replace the full file content with:

```svelte
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
```

- [ ] **Step 2: Check dev server renders the page**

```bash
npm run dev
```

Visit `http://localhost:5173/auth/login`. Verify:
- "Continue with Google" button with Google logo appears at the top
- "or" divider below it
- Email input and "Send magic link" button below that

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth/login/+page.svelte
git commit -m "feat: add Google OAuth button to login page"
```

---

## Manual Setup (do before testing)

Before testing the Google login flow on any environment:

1. **Google Cloud Console** — create an OAuth 2.0 client (Web application), add redirect URIs:
   - `http://localhost:5173/auth/callback` (local)
   - `https://<your-vercel-url>/auth/callback` (prod)

2. **Supabase dashboard**:
   - Authentication → Providers → Google → enable, paste Client ID + Secret
   - Authentication → URL Configuration → Site URL: `https://<your-vercel-url>`
   - Authentication → URL Configuration → Redirect URLs: add both URIs above
