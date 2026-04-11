# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (port 5173)
npm run build            # Production build (Vercel adapter, Node 24.x)
npm run check            # Svelte type checking

npm test                 # Run all unit tests (vitest)
npx vitest run tests/unit/seating.test.ts          # Run a single test file
npx vitest run -t "test name pattern"              # Run tests matching name

npm run test:e2e         # Playwright e2e tests (starts dev server automatically)
npx playwright test tests/e2e/auth.test.ts         # Single e2e file
```

## Architecture

**Stack:** SvelteKit + Svelte 5 (runes mode) + Supabase + Tailwind CSS v4 + Paraglide JS (i18n). Deployed on Vercel.

**App purpose:** Poker club management — clubs, players, tournaments (with blind/prize structures, seating, rebalancing).

### Routing & Auth

- Routes are under `src/routes/[club]/admin/...` where `[club]` is the club slug
- `[club]/+layout.ts` loads the club and current player, redirects to login if unauthenticated, errors if not a member
- `[club]/admin/+layout.ts` gates admin-only pages via `isAdmin(player)`
- Auth uses Supabase magic links; session is established in `hooks.server.ts` via `safeGetSession()`

### Supabase Clients (important)

Three server-side clients in `src/lib/server/supabase.ts`:
- **`createAnonClient(cookies)`** — for auth operations (signIn, exchangeCode)
- **`createUserClient(accessToken)`** — RLS-respecting queries with the user's token
- **`createServiceClient()`** — bypasses RLS, for admin operations on Vercel where `locals.supabase` doesn't resolve `auth.uid()` for RLS

Browser client in `src/lib/supabase.ts`. Root layout (`+layout.ts`) creates a universal Supabase client passed through page data.

### Data Model

Database types are generated in `src/lib/types.ts` (Supabase CLI output + manual convenience types). Key tables: `clubs`, `players`, `tournaments`, `tournament_players`, `tournament_tables`, `blind_structures`, `prize_structures`, `club_invites`.

Players belong to a club and have a `role` (`admin` | `member`). Tournaments have a `status` (`registration` | `running` | `finished`).

### Business Logic (pure functions, testable)

- `src/lib/seating.ts` — seat draw, auto-seating, rebalance suggestions, table break logic
- `src/lib/tournaments.ts` — prize pool calculation, payout distribution, payout validation
- `src/lib/players.ts` — display name, admin check
- `src/lib/clubs.ts` — slug validation

### i18n

Uses Paraglide JS with cookie-based language detection (EN + DE). Messages in `src/lib/paraglide/messages/`. Import from `$lib/paraglide/messages.js`. Language is detected from `Accept-Language` header with cookie override; set in `hooks.server.ts`.

### UI Components

Shadcn-svelte style components in `src/lib/components/ui/` (button, card, input, label, table, badge, separator). Uses `tailwind-variants` and `tailwind-merge` via `src/lib/utils.ts`.

## Conventions

- **TDD always:** Write a failing test first, verify it fails, then implement the minimal code to make it pass
- **Svelte 5 runes syntax** throughout: `$props()`, `$state()`, `$derived()`, `{@render children()}`
- **Use service client** for server-side DB queries on Vercel; `locals.supabase` does not resolve `auth.uid()` for RLS
- Unit tests live in `tests/unit/`, e2e in `tests/e2e/`
- Test environment is jsdom; tests use vitest globals (no explicit imports needed for `describe`, `it`, `expect`)
