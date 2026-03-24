# Google OAuth Login — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Goal:** Add Google sign-in alongside magic link on the login page to unblock testing during Supabase email rate limits.

---

## Context

The app currently supports magic link (OTP) login only. Supabase's free tier has email rate limits that block testing. Google OAuth is added as a secondary option now; email + password is planned as the primary method for end users in a future iteration.

---

## What Changes

### `src/routes/auth/login/+page.server.ts`

Add a named action `google` alongside the existing `default` (magic link) action:

```ts
google: async ({ cookies, url }) => {
  const supabase = createAnonClient(cookies);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${url.origin}/auth/callback` }
  });
  if (error) return fail(500, { errorKey: 'server_error', errorMessage: error.message });
  throw redirect(303, data.url);
}
```

The existing `default` action (magic link) is unchanged.

### `src/routes/auth/login/+page.svelte`

Add a "Continue with Google" button in its own form targeting the `?/google` action, separated from the magic link form with an "or" divider:

```
[ Continue with Google ]
———————— or ————————
[ email input ]
[ Send magic link ]
```

No changes to the error/confirmation state logic.

### `src/routes/auth/callback/+server.ts`

Add handling for the OAuth cancellation case. When the user cancels on the Google consent screen, Google redirects back with `?error=access_denied` and no `code`. The handler should detect this and redirect to `/auth/login` rather than silently bouncing through the app:

```ts
if (url.searchParams.get('error')) {
  throw redirect(303, '/auth/login');
}
```

### `src/lib/paraglide/messages/en.json` + `de.json`

Add two new message keys:
- `auth_continue_with_google` — "Continue with Google" / "Mit Google fortfahren"
- `auth_or_divider` — "or" / "oder"

---

## Manual Setup (outside codebase)

### Google Cloud Console

1. Create an OAuth 2.0 client (Web application type).
2. Add authorised redirect URIs:
   - `http://localhost:5173/auth/callback` (local dev)
   - `https://<your-vercel-url>/auth/callback` (production)
3. Copy the Client ID and Client Secret.

### Supabase Dashboard

1. Authentication → Providers → Google → enable and paste Client ID and Secret.
2. Authentication → URL Configuration:
   - Set **Site URL** to your production URL (e.g. `https://<your-vercel-url>`)
   - Add to **Redirect URLs** allow-list:
     - `http://localhost:5173/auth/callback`
     - `https://<your-vercel-url>/auth/callback`

Without the Redirect URLs allow-list entries, Supabase will reject the OAuth redirect.

---

## What is NOT changing

- No new routes
- No database changes
- No changes to the session or RLS setup
- Magic link flow is untouched

---

## Testing

Manual only (no e2e test added — Google OAuth requires a real browser session with Google):

1. Visit `/auth/login` — Google button, "or" divider, and magic link form all visible
2. Click "Continue with Google" — redirected to Google consent screen
3. Complete Google sign-in — redirected back to `/auth/callback`, then to `/` (which redirects to club or `/clubs/new`)
4. Click "Continue with Google" then cancel on the Google screen — redirected back to `/auth/login`
