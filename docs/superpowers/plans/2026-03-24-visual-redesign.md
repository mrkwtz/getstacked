# Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all GetStacked pages with a dark-minimal, Supabase-inspired aesthetic — red accent, dark/light mode toggle, left sidebar navigation, and shadcn-svelte components.

**Architecture:** Install shadcn-svelte for accessible UI components, set up a CSS custom property token system in `app.css` for dark/light theming (toggled via a class on `<html>`), replace the current top navbar with a left sidebar, and restyle every page using the new token utilities. Server-side theme cookie reading prevents flash of unstyled content on initial load.

**Tech Stack:** SvelteKit 2 · Svelte 5 (runes) · Tailwind CSS v4 · shadcn-svelte · Paraglide JS (i18n) · TypeScript · Vitest

---

## File Map

| File | Change |
|---|---|
| `src/app.css` | CSS tokens, `@theme` block, dark/light palettes |
| `src/app.html` | Add `class="dark"` default to `<html>` |
| `src/routes/+layout.svelte` | Apply theme class from `data.theme` via `$effect` |
| `src/routes/+layout.server.ts` | NEW — read `theme` cookie, return `{ theme }` |
| `src/routes/+page.svelte` | Landing page redesign |
| `src/routes/auth/login/+page.svelte` | Login page redesign |
| `src/routes/auth/accept-invite/+page.svelte` | Accept invite card redesign |
| `src/routes/clubs/new/+page.svelte` | Create club card redesign |
| `src/routes/[club]/+layout.svelte` | Replace top nav with sidebar shell |
| `src/routes/[club]/+page.svelte` | Dashboard redesign |
| `src/routes/[club]/admin/+layout.svelte` | NEW — admin tab bar sub-nav |
| `src/routes/[club]/admin/+page.server.ts` | NEW — redirect to `/admin/members` |
| `src/routes/[club]/admin/members/+page.svelte` | Members page redesign |
| `src/routes/[club]/admin/settings/+page.svelte` | Settings page redesign |
| `src/lib/components/Sidebar.svelte` | NEW — sidebar component |
| `src/lib/components/ThemeToggle.svelte` | NEW — sun/moon toggle |
| `src/lib/components/ui/*` | NEW — shadcn-svelte generated components |
| `tests/unit/theme.test.ts` | NEW — unit test for theme cookie parsing |

---

## Task 1: Design system — CSS tokens + app.html

**Files:**
- Modify: `src/app.css`
- Modify: `src/app.html`

- [ ] **Step 1: Update `src/app.html` to default to dark class**

```html
<!doctype html>
<html lang="en" class="dark">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

- [ ] **Step 2: Replace `src/app.css` with token system**

```css
@import 'tailwindcss';

/* Enable dark: prefix via class strategy */
@custom-variant dark (&:where(.dark, .dark *));

/* Dark palette (default) */
:root {
  --background: #0a0a0a;
  --foreground: #ffffff;
  --card: #111111;
  --card-foreground: #ffffff;
  --border: #1f1f1f;
  --input: #1f1f1f;
  --muted: #1a1a1a;
  --muted-foreground: #6b6b6b;
  --accent: #dc2626;
  --accent-foreground: #ffffff;
  --sidebar: #111111;
  --radius: 0.5rem;
}

/* Light palette */
.light {
  --background: #fafafa;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --border: #e5e5e5;
  --input: #e5e5e5;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #dc2626;
  --accent-foreground: #ffffff;
  --sidebar: #ffffff;
}

/* Expose tokens as Tailwind utilities */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-sidebar: var(--sidebar);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

/* Base styles */
* {
  border-color: var(--border);
}

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 3: Verify the token system works**

Run: `npm run dev`

Open the app. It should be mostly broken visually (old pages still use hardcoded `gray-*` classes) but the page body background should be `#0a0a0a`. No console errors from CSS parsing.

- [ ] **Step 4: Commit**

```bash
git add src/app.css src/app.html
git commit -m "feat: add CSS token system for dark/light theme"
```

---

## Task 2: Install shadcn-svelte

**Files:**
- Modify: `package.json` (via CLI)
- Create: `src/lib/components/ui/` (via CLI)
- Modify: `src/app.css` (CLI may add/overwrite — see step 3)

> **Note:** shadcn-svelte requires Node 18+. Run `node --version` to confirm.

- [ ] **Step 1: Run the shadcn-svelte init command**

```bash
npx shadcn-svelte@latest init
```

When prompted, answer:
- **Style:** Default (or New York — either works, we'll override the CSS)
- **Base color:** (any — we'll override)
- **CSS variables:** Yes
- **Where is your global CSS file?** `src/app.css`
- **TypeScript:** Yes

The CLI will add dependencies (`bits-ui`, `clsx`, `tailwind-variants`) and may rewrite parts of `src/app.css`.

- [ ] **Step 2: Restore our custom CSS tokens**

After init, `src/app.css` will have been rewritten with shadcn's default palette. Replace its contents with our custom token system from Task 1 Step 2 **plus** any `@import` lines shadcn added (e.g., `tw-animate-css` if present — keep that import if added).

If shadcn added `@import "tw-animate-css";`, keep it. The final `src/app.css` should look like:

```css
@import 'tailwindcss';
/* keep any additional @import lines shadcn added */

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #0a0a0a;
  --foreground: #ffffff;
  --card: #111111;
  --card-foreground: #ffffff;
  --border: #1f1f1f;
  --input: #1f1f1f;
  --muted: #1a1a1a;
  --muted-foreground: #6b6b6b;
  --accent: #dc2626;
  --accent-foreground: #ffffff;
  --sidebar: #111111;
  --radius: 0.5rem;
}

.light {
  --background: #fafafa;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --border: #e5e5e5;
  --input: #e5e5e5;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #dc2626;
  --accent-foreground: #ffffff;
  --sidebar: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-sidebar: var(--sidebar);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

* {
  border-color: var(--border);
}

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 3: Add the specific components we need**

```bash
npx shadcn-svelte@latest add button input label card table badge separator
```

This creates files in `src/lib/components/ui/` — do not edit them.

- [ ] **Step 4: Verify components installed**

```bash
ls src/lib/components/ui/
```

Expected: directories/files for `button`, `input`, `label`, `card`, `table`, `badge`, `separator`.

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: install shadcn-svelte with custom token palette"
```

---

## Task 3: Theme infrastructure — server load + root layout

**Files:**
- Create: `src/routes/+layout.server.ts`
- Modify: `src/routes/+layout.svelte`
- Create: `tests/unit/theme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/theme.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// We'll import this helper once we create it
import { parseTheme } from '../../src/routes/+layout.server';

describe('parseTheme', () => {
  it('returns dark by default when cookie is missing', () => {
    expect(parseTheme(undefined)).toBe('dark');
  });
  it('returns dark for "dark"', () => {
    expect(parseTheme('dark')).toBe('dark');
  });
  it('returns light for "light"', () => {
    expect(parseTheme('light')).toBe('light');
  });
  it('returns dark for unexpected values', () => {
    expect(parseTheme('invalid')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- theme
```

Expected: FAIL — `parseTheme` not found.

- [ ] **Step 3: Create `src/routes/+layout.server.ts`**

```typescript
import type { LayoutServerLoad } from './$types';

export function parseTheme(value: string | undefined): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark';
}

export const load: LayoutServerLoad = async ({ cookies }) => {
  return { theme: parseTheme(cookies.get('theme')) };
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- theme
```

Expected: 4/4 PASS.

- [ ] **Step 5: Update `src/routes/+layout.svelte`**

Replace with:

```svelte
<script lang="ts">
  import '../app.css';
  import { ParaglideJS } from '@inlang/paraglide-sveltekit';
  import { i18n } from '$lib/i18n';

  const { data, children } = $props();

  $effect(() => {
    document.documentElement.className = data.theme;
  });
</script>

<ParaglideJS {i18n}>
  {@render children()}
</ParaglideJS>
```

- [ ] **Step 6: Verify no flash of unstyled content**

Run: `npm run dev`

Open the app in a browser that has no `theme` cookie. The page background should be `#0a0a0a` (dark). Open DevTools → Application → Cookies, add `theme=light`, reload. Background should become `#fafafa`.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests pass including the new theme tests.

- [ ] **Step 8: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/+layout.svelte tests/unit/theme.test.ts
git commit -m "feat: add theme cookie infrastructure with dark/light mode support"
```

---

## Task 4: ThemeToggle + Sidebar components

**Files:**
- Create: `src/lib/components/ThemeToggle.svelte`
- Create: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Create `src/lib/components/ThemeToggle.svelte`**

```svelte
<script lang="ts">
  let isDark = $state(true);

  $effect(() => {
    isDark = document.documentElement.classList.contains('dark');
  });

  function toggle() {
    isDark = !isDark;
    const next = isDark ? 'dark' : 'light';
    document.documentElement.className = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }
</script>

<button
  onclick={toggle}
  class="w-7 h-7 rounded-md border border-border bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
  aria-label="Toggle theme"
>
  {#if isDark}
    <!-- Sun icon: currently dark, click to go light -->
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  {:else}
    <!-- Moon icon: currently light, click to go dark -->
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  {/if}
</button>
```

- [ ] **Step 2: Create `src/lib/components/Sidebar.svelte`**

The sidebar receives `club`, `member`, and `currentPath`. It shows admin-only links (Members, Settings) only to admin members using the existing `isAdmin()` helper.

```svelte
<script lang="ts">
  import { isAdmin } from '$lib/members';
  import ThemeToggle from './ThemeToggle.svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { club, member, currentPath } = $props<{
    club: Club;
    member: ClubMember;
    currentPath: string;
  }>();

  const clubPath = $derived(`/${club.slug}`);

  function isActive(path: string, exact = false): boolean {
    if (exact) return currentPath === path;
    return currentPath === path || currentPath.startsWith(path + '/');
  }
</script>

<aside class="w-[200px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0">
  <!-- Logo -->
  <div class="px-4 py-4 border-b border-border">
    <span class="font-extrabold text-sm tracking-tight text-foreground">GETSTACKED</span>
  </div>

  <!-- Club name -->
  <div class="px-4 py-3 border-b border-border">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Club</p>
    <p class="text-sm font-medium text-foreground truncate">{club.name}</p>
  </div>

  <!-- Nav items -->
  <nav class="flex-1 p-2 flex flex-col gap-0.5">
    <a
      href={clubPath}
      class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
        isActive(clubPath, true) || (currentPath === clubPath)
          ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }"
    >
      Dashboard
    </a>

    {#if isAdmin(member)}
      <a
        href="{clubPath}/admin/members"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/members`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        Members
      </a>
      <a
        href="{clubPath}/admin/settings"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
          isActive(`${clubPath}/admin/settings`)
            ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }"
      >
        Settings
      </a>
    {/if}
  </nav>

  <!-- Footer: display name + theme toggle -->
  <div class="px-3 py-3 border-t border-border flex items-center justify-between gap-2">
    <span class="text-xs text-muted-foreground truncate">{member.display_name}</span>
    <ThemeToggle />
  </div>
</aside>
```

- [ ] **Step 3: Verify the components compile**

Run: `npm run check`

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ThemeToggle.svelte src/lib/components/Sidebar.svelte
git commit -m "feat: add Sidebar and ThemeToggle components"
```

---

## Task 5: Club shell layout

**Files:**
- Modify: `src/routes/[club]/+layout.svelte`

This replaces the current top navbar with the full sidebar shell. After this task, all `/[club]/*` pages will render inside the sidebar layout.

- [ ] **Step 1: Replace `src/routes/[club]/+layout.svelte`**

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();
</script>

<div class="flex min-h-screen bg-background">
  <Sidebar club={data.club} member={data.member} currentPath={page.url.pathname} />
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
```

- [ ] **Step 2: Verify the layout renders**

Run: `npm run dev`

Log in and navigate to your club. You should see the sidebar on the left with the club name and navigation links. The content area should show the current page (even if unstyled). The theme toggle in the sidebar footer should switch between dark and light.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/+layout.svelte
git commit -m "feat: replace top navbar with sidebar shell layout"
```

---

## Task 6: Admin sub-nav layout + redirect

**Files:**
- Create: `src/routes/[club]/admin/+layout.svelte`
- Create: `src/routes/[club]/admin/+page.server.ts`

- [ ] **Step 1: Create `src/routes/[club]/admin/+layout.svelte`**

This wraps all `/admin/*` pages with a tab bar. It inherits `data.club` from the parent `[club]/+layout.server.ts` automatically via SvelteKit's layout data inheritance.

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();

  const base = $derived(`/${data.club.slug}/admin`);
</script>

<div class="flex flex-col h-full">
  <!-- Sub-nav tab bar -->
  <div class="border-b border-border px-6 flex">
    <a
      href="{base}/members"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/members`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      Members
    </a>
    <a
      href="{base}/settings"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/settings`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      Settings
    </a>
  </div>

  <!-- Page content -->
  <div class="flex-1 p-6">
    {@render children()}
  </div>
</div>
```

- [ ] **Step 2: Create `src/routes/[club]/admin/+page.server.ts`**

Redirect `/[club]/admin` to `/[club]/admin/members` so the old admin index page no longer shows.

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  throw redirect(303, `/${params.club}/admin/members`);
};
```

- [ ] **Step 3: Verify the sub-nav renders**

Run: `npm run dev`

Navigate to `/{club}/admin/members`. You should see the tab bar at the top with "Members" highlighted in red. Click "Settings" — the tab switches, and the page changes.

- [ ] **Step 4: Verify the redirect**

Navigate to `/{club}/admin` directly. It should immediately redirect to `/{club}/admin/members`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/[club]/admin/+layout.svelte src/routes/[club]/admin/+page.server.ts
git commit -m "feat: add admin sub-nav layout and index redirect"
```

---

## Task 7: Landing page

**Files:**
- Modify: `src/routes/+page.svelte`

The landing page has no sidebar. It uses a simple top bar + centered hero.

- [ ] **Step 1: Replace `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
  <!-- Top bar -->
  <header class="border-b border-border px-6 py-4 flex items-center">
    <span class="font-extrabold text-sm tracking-tight">GETSTACKED</span>
    <div class="ml-auto flex items-center gap-3">
      <a href="/auth/login" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        {m.auth_sign_in()}
      </a>
      <a
        href="/auth/login"
        class="bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors"
      >
        {m.get_started()}
      </a>
    </div>
  </header>

  <!-- Hero -->
  <main class="flex-1 flex flex-col items-center justify-center px-6 text-center">
    <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
      {m.landing_eyebrow()}
    </p>
    <h1 class="text-4xl font-bold tracking-tight leading-tight mb-4">
      {m.app_name()}
    </h1>
    <p class="text-muted-foreground text-lg max-w-sm leading-relaxed mb-8">
      {m.landing_tagline()}
    </p>
    <div class="flex gap-3">
      <a
        href="/auth/login"
        class="bg-accent text-accent-foreground font-medium px-5 py-2.5 rounded-md hover:bg-accent/90 transition-colors"
      >
        {m.get_started()}
      </a>
      <a
        href="/auth/login"
        class="border border-border text-muted-foreground font-medium px-5 py-2.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        {m.auth_sign_in()}
      </a>
    </div>
  </main>
</div>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, open `/` in the browser while logged out. You should see the GETSTACKED wordmark in the top bar, the hero centered, and both buttons. Toggle the theme — it should switch between dark and light cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: redesign landing page"
```

---

## Task 8: Login page

**Files:**
- Modify: `src/routes/auth/login/+page.svelte`

The login page is a centered card on the bare background (no sidebar).

- [ ] **Step 1: Replace `src/routes/auth/login/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { form } = $props<{
    form: { sent?: boolean; errorKey?: string; errorMessage?: string } | null;
  }>();
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <!-- Card -->
    <div class="bg-card border border-border rounded-xl p-8">
      <!-- Header -->
      <div class="text-center mb-6">
        <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
        <p class="text-sm text-muted-foreground">{m.auth_sign_in()}</p>
      </div>

      <!-- Google -->
      <form method="POST" action="?/google" use:enhance>
        <button
          type="submit"
          class="w-full flex items-center justify-center gap-2.5 bg-muted border border-border text-foreground text-sm font-medium px-4 py-2.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {m.auth_continue_with_google()}
        </button>
      </form>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-5">
        <div class="flex-1 h-px bg-border"></div>
        <span class="text-xs text-muted-foreground">{m.auth_or_divider()}</span>
        <div class="flex-1 h-px bg-border"></div>
      </div>

      <!-- Magic link -->
      {#if form?.sent}
        <p class="text-sm text-foreground text-center">{m.auth_check_email()}</p>
      {:else}
        <form method="POST" action="?/magic_link" use:enhance class="flex flex-col gap-3">
          <div>
            <label for="email" class="block text-xs font-medium text-muted-foreground mb-1.5">
              {m.auth_email_label()}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {#if form?.errorKey === 'invalid_email'}
            <p class="text-xs text-accent">{m.auth_invalid_email()}</p>
          {:else if form?.errorKey}
            <p class="text-xs text-accent">{form.errorMessage ?? m.auth_invalid_email()}</p>
          {/if}

          <button
            type="submit"
            class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
          >
            {m.auth_magic_link_button()}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, open `/auth/login`. The card should appear centered. Test Google button and magic link form still work functionally (they use the existing server actions which are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth/login/+page.svelte
git commit -m "feat: redesign login page"
```

---

## Task 9: Club dashboard

**Files:**
- Modify: `src/routes/[club]/+page.svelte`

The dashboard is inside the sidebar shell. It shows stat cards and a "next game" placeholder.

- [ ] **Step 1: Replace `src/routes/[club]/+page.svelte`**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, ClubMember } from '$lib/types';

  const { data } = $props<{ data: { club: Club; member: ClubMember } }>();
</script>

<div class="p-6 flex flex-col gap-6">
  <h1 class="text-lg font-semibold text-foreground">{m.club_home_welcome({ club_name: data.club.name })}</h1>

  <!-- Stat cards -->
  <div class="grid grid-cols-3 gap-4">
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Members</p>
      <p class="text-3xl font-light text-foreground">—</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Games</p>
      <p class="text-3xl font-light text-foreground">—</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Balance</p>
      <p class="text-3xl font-light text-accent">—</p>
    </div>
  </div>

  <!-- Next game placeholder -->
  <div class="bg-card border border-border rounded-lg p-4">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Next game</p>
    <p class="text-sm text-muted-foreground">{m.club_home_placeholder()}</p>
  </div>
</div>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, navigate to your club home. The sidebar should be visible with "Dashboard" active in red. Stat cards should appear in a 3-column grid.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/+page.svelte
git commit -m "feat: redesign club dashboard"
```

---

## Task 10: Admin members page

**Files:**
- Modify: `src/routes/[club]/admin/members/+page.svelte`

This page is inside the sidebar + admin sub-nav. It lists members in a table and includes an invite form.

- [ ] **Step 1: Replace `src/routes/[club]/admin/members/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { ClubMember } from '$lib/types';

  const { data, form } = $props<{
    data: { members: ClubMember[] };
    form: { invited?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-base font-semibold text-foreground">{m.members_title()}</h1>
      <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
        {data.members.length}
      </span>
    </div>
  </div>

  <!-- Member table -->
  <div class="bg-card border border-border rounded-lg overflow-hidden">
    <!-- Table header -->
    <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Role</span>
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground"></span>
    </div>

    {#if data.members.length === 0}
      <p class="px-4 py-4 text-sm text-muted-foreground">{m.members_empty()}</p>
    {:else}
      {#each data.members as member}
        <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{member.display_name}</span>
          <span class="text-xs font-medium {member.role === 'admin' ? 'text-accent' : 'text-muted-foreground'}">
            {member.role}
          </span>
          <div class="flex justify-end">
            {#if member.role !== 'admin'}
              <form method="POST" action="?/remove_member" use:enhance>
                <input type="hidden" name="user_id" value={member.user_id} />
                <button
                  type="submit"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {m.members_remove()}
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Invite form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.members_invite_title()}</h2>
    <form method="POST" action="?/invite_member" use:enhance class="flex flex-col gap-3 max-w-sm">
      <div>
        <label for="email" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.members_invite_email()}
        </label>
        <input
          id="email" name="email" type="email" required
          placeholder="member@example.com"
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div>
        <label for="display_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.members_invite_display_name()}
        </label>
        <input
          id="display_name" name="display_name" type="text" required
          placeholder="Poker Pete"
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
      {#if form?.invited}
        <p class="text-xs text-green-500">{m.members_invited_success()}</p>
      {/if}

      <button
        type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
      >
        {m.members_invite_button()}
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 2: Verify visually and functionally**

Run: `npm run dev`, navigate to `/{club}/admin/members`. The tab bar should show "Members" active in red. The member list should render in the table. Try removing a member and inviting one to confirm the actions still work.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/members/+page.svelte
git commit -m "feat: redesign admin members page"
```

---

## Task 11: Admin settings + remaining pages

**Files:**
- Modify: `src/routes/[club]/admin/settings/+page.svelte`
- Modify: `src/routes/clubs/new/+page.svelte`
- Modify: `src/routes/auth/accept-invite/+page.svelte`

- [ ] **Step 1: Replace `src/routes/[club]/admin/settings/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data, form } = $props<{
    data: { club: Club };
    form: { saved?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="max-w-sm flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.settings_title()}</h1>

  <form method="POST" use:enhance class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    <div>
      <label for="name" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.club_name_label()}
      </label>
      <input
        id="name" name="name" type="text" required value={data.club.name}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>
    <div>
      <label for="slug" class="block text-xs font-medium text-muted-foreground mb-1.5">
        {m.club_slug_label()}
      </label>
      <input
        id="slug" name="slug" type="text" required value={data.club.slug}
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
      />
    </div>

    {#if form?.errorKey}
      <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
    {/if}
    {#if form?.saved}
      <p class="text-xs text-green-500">{m.settings_saved()}</p>
    {/if}

    <button
      type="submit"
      class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.settings_save()}
    </button>
  </form>
</div>
```

- [ ] **Step 2: Replace `src/routes/clubs/new/+page.svelte`**

Preserve all existing script logic (slug auto-generation). Only update the template markup.

```svelte
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
```

- [ ] **Step 3: Replace `src/routes/auth/accept-invite/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{ data: { club: { name: string; slug: string } } }>();
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="bg-card border border-border rounded-xl p-8 text-center">
      <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
      <h1 class="text-base font-semibold text-foreground mt-4 mb-2">{m.invite_title()}</h1>
      <p class="text-sm text-muted-foreground mb-6">{m.invite_body({ club_name: data.club.name })}</p>
      <form method="POST" use:enhance>
        <button
          type="submit"
          class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.invite_join_button()}
        </button>
      </form>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify all three pages**

Run: `npm run dev`:
- Navigate to `/clubs/new` — card layout, slug auto-generates as you type
- Navigate to `/{club}/admin/settings` — form with club name and slug
- The accept invite page is only accessible via a real invite link — visually verify it matches the card style of the other pages

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/[club]/admin/settings/+page.svelte src/routes/clubs/new/+page.svelte src/routes/auth/accept-invite/+page.svelte
git commit -m "feat: redesign settings, create club, and accept invite pages"
```

---

## Final verification

- [ ] **Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Run a full visual pass**

`npm run dev` and visit each page in order:
1. `/` — landing page (dark + light)
2. `/auth/login` — login card
3. `/{club}` — dashboard with sidebar
4. `/{club}/admin/members` — member table + invite form + sub-nav
5. `/{club}/admin/settings` — settings form + sub-nav
6. `/clubs/new` — create club card
7. Toggle theme on each page — verify all pages look correct in both modes

- [ ] **Check for TypeScript errors**

```bash
npm run check
```

Expected: no errors.
