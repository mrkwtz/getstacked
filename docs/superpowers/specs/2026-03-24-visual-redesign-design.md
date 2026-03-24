# Visual Redesign Design Spec

## Goal

Redesign all pages of GetStacked with a dark-minimal, Supabase-inspired aesthetic. Full dark/light mode support, red accent color, left sidebar navigation, and shadcn-svelte as the component foundation.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Style direction | Dark & Minimal (Supabase-inspired) | Clean, typographic, high-contrast |
| Accent color | Red (`#dc2626`) | Card suit palette — red & black |
| Modes | Dark default + light toggle | User preference persisted in cookie |
| Navigation | Left sidebar + secondary top tab bar for sub-pages | Supabase dashboard pattern |
| Component library | shadcn-svelte | CSS variable theming, Svelte 5 support, no runtime overhead |

---

## Design System

### Tailwind v4 + CSS Custom Properties

This project uses **Tailwind v4** (CSS-first configuration, no `tailwind.config.js`).

Color tokens are defined as CSS custom properties and exposed to Tailwind via the `@theme` block in `src/app.css`:

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #0a0a0a;
  --card: #111111;
  --border: #1f1f1f;
  --foreground: #ffffff;
  --muted-foreground: #6b6b6b;
  --accent: #dc2626;
  --sidebar: #111111;
}

.light {
  --background: #fafafa;
  --card: #ffffff;
  --border: #e5e5e5;
  --foreground: #0a0a0a;
  --muted-foreground: #737373;
  --accent: #dc2626;
  --sidebar: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-foreground: var(--foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-sidebar: var(--sidebar);
}
```

This makes Tailwind utility classes like `bg-background`, `text-foreground`, `border-border`, `bg-accent`, `text-muted-foreground` available throughout the app. The `@custom-variant dark` enables `dark:` prefix utilities that activate when the `dark` class is on any ancestor element.

### Color Tokens

**Dark (default, `:root`):**
- `--background`: `#0a0a0a` — page background
- `--card`: `#111111` — surface/card background
- `--border`: `#1f1f1f` — borders, dividers
- `--foreground`: `#ffffff` — primary text
- `--muted-foreground`: `#6b6b6b` — secondary/placeholder text
- `--accent`: `#dc2626` — buttons, active states, highlights
- `--sidebar`: `#111111` — sidebar background

**Light (`.light` class on `<html>`):**
- `--background`: `#fafafa`
- `--card`: `#ffffff`
- `--border`: `#e5e5e5`
- `--foreground`: `#0a0a0a`
- `--muted-foreground`: `#737373`
- `--accent`: `#dc2626` (same)
- `--sidebar`: `#ffffff`

### Theme Toggle

**Server-side (avoids FOUC on initial load):**
- `src/routes/+layout.server.ts` reads the `theme` cookie and returns `{ theme: 'dark' | 'light' }` (defaults to `'dark'`)
- `src/routes/+layout.svelte` receives `data.theme` and sets `class={data.theme}` on the `<html>` element

**Client-side toggle (no server round-trip):**
- `ThemeToggle.svelte` has an `onclick` handler that:
  1. Reads the current class from `document.documentElement.classList`
  2. Toggles between `dark` and `light` on `document.documentElement`
  3. Writes the new value to `document.cookie` as `theme=dark` or `theme=light; path=/`

### Typography

- Font: system sans-serif stack (Tailwind default — Inter on most systems)
- Display numbers: `font-light` (weight 300)
- UI labels: `font-medium` (weight 500)
- Section labels: `uppercase tracking-widest text-xs text-muted-foreground`

### Component Library

**Installation:**
```bash
npx shadcn-svelte@latest init
npx shadcn-svelte@latest add button input label card table badge separator
```

Components are generated into `src/lib/components/ui/` as plain Svelte files. No runtime dependency — components are owned by this repo after install.

**Components used:**
- `Button` — variants: `default` (accent bg), `ghost` (transparent), `destructive`
- `Input` — text fields with consistent border/focus styling
- `Label` — form labels
- `Card`, `CardHeader`, `CardContent` — surface containers
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` — member lists
- `Badge` — role labels (admin/member)
- `Separator` — horizontal dividers

---

## Layout Architecture

### Root layout: `src/routes/+layout.svelte`

Reads `data.theme` (from `+layout.server.ts`) and applies it as a class on `<html>`. Wraps content in `<ParaglideJS>` as before.

```svelte
<svelte:head></svelte:head>
<!-- applied to <html> via svelte:element or class binding on wrapper -->
```

Because SvelteKit does not render `<html>` directly in `+layout.svelte`, apply the theme class via `document.documentElement.className` in a `$effect` on the client side, seeded from `data.theme` to match SSR output. The server passes `data.theme` and the HTML template (`src/app.html`) should have `class="%sveltekit.theme%"` — or simpler: use a `<svelte:head>` with an inline script `document.documentElement.className = '{data.theme}'` that runs before paint.

**Simplest approach:** In `src/app.html`, the `<html>` tag will have no class. The `+layout.svelte` uses a `$effect` to set `document.documentElement.className = data.theme` immediately on mount. The server-rendered value is passed as a `data-theme` attribute on `<body>` as a fallback for SSR, with the effect syncing on hydration. This avoids FOUC because the cookie is read server-side and the value is in the initial HTML.

**Concrete implementation in `+layout.svelte`:**
```svelte
<script lang="ts">
  const { data, children } = $props();
  $effect(() => {
    document.documentElement.className = data.theme;
  });
</script>
```

And in `src/app.html`:
```html
<html lang="en" class="dark">
```
The effect overrides this immediately with the actual value from the cookie.

### Club shell: `src/routes/[club]/+layout.svelte`

Replaces the current top navbar with a two-column layout:

```
┌─────────────────┬────────────────────────────┐
│   Sidebar       │   Content area              │
│   (200px fixed) │   (flex-1)                  │
│                 │                             │
│  GETSTACKED     │   {@render children()}      │
│  ──────────     │                             │
│  Club name      │                             │
│  ──────────     │                             │
│  • Dashboard    │                             │
│  • Members*     │                             │
│  • Settings*    │                             │
│    (* admin)    │                             │
│                 │                             │
│  [email][toggle]│                             │
└─────────────────┴────────────────────────────┘
```

Uses `<Sidebar>` component (see below). Content area: `<main class="flex-1 overflow-y-auto">{@render children()}</main>`.

### Sidebar component: `src/lib/components/Sidebar.svelte`

**Props:**
```typescript
{
  club: Club,           // club.name, club.slug
  member: ClubMember,   // for isAdmin() check
  currentPath: string   // $page.url.pathname for active state
}
```

Renders:
- Logo wordmark: "GETSTACKED"
- Club name section
- Nav items (Dashboard always; Members + Settings if admin)
- Active state: `bg-accent/10 border-l-2 border-accent text-foreground` vs inactive: `text-muted-foreground hover:text-foreground`
- Footer: truncated email + `<ThemeToggle />`

### Admin sub-nav layout: `src/routes/[club]/admin/+layout.svelte` (new file)

This is a **UI layout file** (not a server file). It wraps all `/admin/*` pages with a secondary tab bar at the top of the content area, then renders the page below it.

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  const { data, children } = $props();
  const base = `/${data.club.slug}/admin`;
</script>

<div class="flex flex-col h-full">
  <!-- Tab bar -->
  <div class="border-b border-border px-6 flex gap-0">
    <a href="{base}/members" class="tab" class:active={$page.url.pathname.startsWith(`${base}/members`)}>
      Members
    </a>
    <a href="{base}/settings" class="tab" class:active={$page.url.pathname.startsWith(`${base}/settings`)}>
      Settings
    </a>
  </div>
  <!-- Page content -->
  <div class="flex-1 p-6">
    {@render children()}
  </div>
</div>
```

Active tab style: `border-b-2 border-accent text-foreground`. Inactive: `text-muted-foreground`.

This layout receives `data.club` from the parent `[club]/+layout.server.ts` via SvelteKit's layout data inheritance.

---

## Pages

### Landing page — `src/routes/+page.svelte`

Minimal marketing page (no sidebar — public):

- Top bar: `GETSTACKED` wordmark left, `Sign in` ghost link + `Get started` red button right
- Hero centered: eyebrow label (i18n), large headline, short tagline, two CTAs ("Create your club" → `/auth/login`, "Sign in" → `/auth/login`)
- Background: `bg-background`, all text using token utilities

### Login page — `src/routes/auth/login/+page.svelte`

Centered card (no sidebar — public):

- Full-height page: `bg-background` with centered `Card`
- `GETSTACKED` wordmark + subtitle
- Google `Button` (ghost/outline variant with Google SVG icon)
- `Separator` with "or" label
- Email `Input` + "Send magic link" `Button` (default/accent variant)
- Success/error states: existing logic unchanged, only class styling updated

### Club dashboard — `src/routes/[club]/+page.svelte`

Inside the sidebar shell:

- Page title: "Dashboard" (`text-foreground font-semibold`)
- Stat cards row: Members / Games / Balance — `Card` components with muted uppercase label + large light-weight number; Balance in `text-accent` if positive
- "Next game" `Card`: date + member count with red dot indicator
- Placeholder content for future features (tournaments, leaderboard) uses `Card` with muted text

### Admin: Members — `src/routes/[club]/admin/members/+page.svelte`

Inside sidebar shell + admin sub-nav (rendered by `admin/+layout.svelte`):

- Page header row: "Members" title + `Badge` with count + "Invite member" `Button` (right-aligned)
- `Table`: columns Display Name, Role (`Badge` — red for admin, muted for member), Action ("Remove" destructive button, hidden for self and for admin rows)
- Invite form below table: `Input` for email, `Input` for display name, submit `Button`, error/success `<p>` messages

### Admin: Settings — `src/routes/[club]/admin/settings/+page.svelte`

Inside sidebar shell + admin sub-nav:

- Club name `Input` with `Label`
- Club slug `Input` with `Label`
- Save `Button`
- Error/success inline `<p>` messages

### Admin index redirect — `src/routes/[club]/admin/+page.svelte`

Convert from a nav list to a `redirect(303, ...)` via `+page.server.ts` (or keep as a `.svelte` that uses `goto` on mount). Simplest: add a `+page.server.ts` with a `load` that throws `redirect(303, \`/${params.club}/admin/members\`)`.

### Create club — `src/routes/clubs/new/+page.svelte`

Centered card (no sidebar):

- Matching card style as login page
- Club name `Input` + auto-slug preview
- "Create club" `Button`

### Accept invite — `src/routes/auth/accept-invite/+page.svelte`

Centered card:

- Display name `Input` + "Join club" `Button`
- Matching card style

---

## File Structure

| File | Action |
|---|---|
| `src/app.css` | CSS custom properties, `@theme` block, dark/light tokens |
| `src/app.html` | Add `class="dark"` default to `<html>` |
| `src/routes/+layout.svelte` | Apply theme class via `$effect`, seed from `data.theme` |
| `src/routes/+layout.server.ts` | New: read `theme` cookie, return `{ theme }` |
| `src/routes/+page.svelte` | Landing page redesign |
| `src/routes/auth/login/+page.svelte` | Login page redesign |
| `src/routes/auth/accept-invite/+page.svelte` | Accept invite card redesign |
| `src/routes/clubs/new/+page.svelte` | Create club card redesign |
| `src/routes/[club]/+layout.svelte` | Replace top nav with sidebar shell using `<Sidebar>` |
| `src/routes/[club]/+page.svelte` | Dashboard redesign |
| `src/routes/[club]/admin/+layout.svelte` | New: tab bar layout wrapping admin sub-pages |
| `src/routes/[club]/admin/+page.server.ts` | New: redirect to `/admin/members` |
| `src/routes/[club]/admin/members/+page.svelte` | Members page redesign |
| `src/routes/[club]/admin/settings/+page.svelte` | Settings page redesign |
| `src/lib/components/Sidebar.svelte` | New: sidebar component (props: club, member, currentPath) |
| `src/lib/components/ThemeToggle.svelte` | New: sun/moon toggle (onclick writes cookie + toggles html class) |
| `src/lib/components/ui/*` | shadcn-svelte generated components |

---

## Constraints

- All i18n strings continue to use Paraglide (`m.key()`) — no string literals in UI
- All server-side logic (load functions, form actions) is unchanged — only `.svelte` UI files are modified (exception: new `+layout.server.ts` for theme cookie, and admin redirect `+page.server.ts`)
- Svelte 5 runes syntax throughout (`$props()`, `$derived()`, `$state()`, `$effect()`)
- shadcn-svelte components are installed via CLI into `src/lib/components/ui/` — owned by repo after install
- Theme toggle requires no server round-trip: client writes cookie directly and toggles `document.documentElement.className`

---

## Out of Scope

- Animations / transitions (future)
- Mobile / responsive layout (future)
- New i18n keys beyond what already exists (new strings for toggle aria-label are acceptable)
