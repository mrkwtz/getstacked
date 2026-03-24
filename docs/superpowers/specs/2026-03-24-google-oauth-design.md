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

### `src/lib/paraglide/messages/en.json` + `de.json`

Add one new key:
- `auth_continue_with_google` — "Continue with Google" / "Mit Google fortfahren"

### `src/routes/auth/callback/+server.ts`

No changes. The existing `exchangeCodeForSession` call handles both magic link and OAuth code exchanges.

---

## Manual Setup (outside codebase)

1. **Google Cloud Console** — create an OAuth 2.0 client, add `https://<your-vercel-url>/auth/callback` as an authorised redirect URI.
2. **Supabase dashboard** — Authentication → Providers → Google → paste Client ID and Secret.

These steps are not automated and must be done before testing.

---

## What is NOT changing

- No new routes
- No database changes
- No changes to the session or RLS setup
- Magic link flow is untouched

---

## Testing

Manual only (no e2e test added — Google OAuth requires a real browser session with Google):

1. Visit `/auth/login` — Google button and magic link form both visible
2. Click "Continue with Google" — redirected to Google consent screen
3. Complete Google sign-in — redirected back to `/auth/callback`, then to `/` (which redirects to club or `/clubs/new`)
