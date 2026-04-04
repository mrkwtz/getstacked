# Guest Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `guest` role to the `members` table — guests have no member number, cannot link a user account, and are visually distinguished with a badge in all member UIs.

**Architecture:** DB migration makes `member_number` nullable and adds constraints enforcing guest rules. TypeScript types, business logic helpers, and all member-related UI pages are updated to handle the three roles (`admin`, `member`, `guest`). No changes to tournament or seating logic.

**Tech Stack:** SvelteKit + Svelte 5 (runes), Supabase (Postgres), TypeScript, Tailwind CSS v4, Paraglide JS (i18n via `messages/en.json` + `messages/de.json`, compiled with `npm run build`)

**Spec:** `docs/superpowers/specs/2026-04-04-guest-role-design.md`

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/0012_guest_role.sql` | New — DB migration |
| `src/lib/types.ts` | Modify — `member_number` nullable, `Role` updated |
| `src/lib/members.ts` | Modify — add `isGuest`, `isLastAdmin` helpers |
| `tests/unit/members.test.ts` | Modify — tests for new helpers |
| `messages/en.json` | Modify — add role labels + last-admin error string |
| `messages/de.json` | Modify — same in German |
| `src/routes/[club]/admin/members/+page.ts` | Modify — add `role` to select query |
| `src/routes/[club]/admin/members/+page.svelte` | Modify — role badge column, guest number display, role selector in add modal |
| `src/routes/[club]/admin/members/[id]/+page.ts` | Modify — load `clubMembers` (id + role) for last-admin guard |
| `src/routes/[club]/admin/members/[id]/+page.svelte` | Modify — role badge, hide invite/number for guests, role selector + last-admin guard in edit |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Modify — null-safe `member_number` display |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/0012_guest_role.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0012_guest_role.sql` with this content:

```sql
-- 0012_guest_role.sql
-- Add guest role: make member_number nullable, add role and guest constraints.

-- 1. Allow member_number to be null (guests have no membership number)
ALTER TABLE members ALTER COLUMN member_number DROP NOT NULL;

-- 2. Restrict role column to valid values
ALTER TABLE members ADD CONSTRAINT members_role_check
  CHECK (role IN ('admin', 'member', 'guest'));

-- 3. Guests cannot be linked to a user account
ALTER TABLE members ADD CONSTRAINT members_guest_no_user
  CHECK (role != 'guest' OR user_id IS NULL);

-- 4. Non-guests must always have a member number
ALTER TABLE members ADD CONSTRAINT members_member_has_number
  CHECK (role = 'guest' OR member_number IS NOT NULL);
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push
```

If running locally with `supabase start`:
```bash
supabase migration up
```

Expected: Migration applies without errors. Verify in your Supabase dashboard or psql that the constraints exist and `member_number` is now nullable.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_guest_role.sql
git commit -m "feat: add guest role DB migration"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update `member_number` to nullable and expand `Role`**

In `src/lib/types.ts`, make three changes:

**Change 1** — `Row` type (around line 84):
```ts
// Before:
member_number: number
// After:
member_number: number | null
```

**Change 2** — `Insert` type (around line 101):
```ts
// Before:
member_number: number
// After:
member_number?: number | null
```

**Change 3** — `Update` type (around line 118):
```ts
// Before:
member_number?: number
// After:
member_number?: number | null
```

**Change 4** — `Role` type (around line 552):
```ts
// Before:
export type Role = 'admin' | 'member';
// After:
export type Role = 'admin' | 'member' | 'guest';
```

- [ ] **Step 2: Verify type-checking passes**

```bash
npm run check
```

Expected: Type errors may appear in other files (fixed in later tasks). For now, note any errors — they are expected and will be resolved task by task. Zero _new_ errors should come from `types.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: make member_number nullable, add guest to Role type"
```

---

## Task 3: Business Logic Helpers + Tests

**Files:**
- Modify: `src/lib/members.ts`
- Modify: `tests/unit/members.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/members.test.ts` (after the existing `isAdmin` describe block):

```ts
describe('isGuest', () => {
  it('returns true for guest role', () => {
    expect(isGuest({ role: 'guest' } as any)).toBe(true);
  });

  it('returns false for member role', () => {
    expect(isGuest({ role: 'member' } as any)).toBe(false);
  });

  it('returns false for admin role', () => {
    expect(isGuest({ role: 'admin' } as any)).toBe(false);
  });
});

describe('isLastAdmin', () => {
  const members = [
    { id: '1', role: 'admin' },
    { id: '2', role: 'member' },
    { id: '3', role: 'guest' },
  ] as any[];

  it('returns true when target is the only admin', () => {
    expect(isLastAdmin(members, '1')).toBe(true);
  });

  it('returns false when there are multiple admins', () => {
    const twoAdmins = [
      { id: '1', role: 'admin' },
      { id: '2', role: 'admin' },
    ] as any[];
    expect(isLastAdmin(twoAdmins, '1')).toBe(false);
  });

  it('returns false when target is not an admin', () => {
    expect(isLastAdmin(members, '2')).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isLastAdmin([], '1')).toBe(false);
  });
});
```

Also update the import at the top of the test file:
```ts
import { displayName, isAdmin, isGuest, isLastAdmin } from '$lib/members';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/members.test.ts
```

Expected: FAIL — `isGuest is not a function`, `isLastAdmin is not a function`

- [ ] **Step 3: Implement the helpers**

In `src/lib/members.ts`, add after `isAdmin`:

```ts
export function isGuest(member: Pick<Member, 'role'>): boolean {
  return member.role === 'guest';
}

export function isLastAdmin(members: Pick<Member, 'id' | 'role'>[], targetId: string): boolean {
  const admins = members.filter((m) => m.role === 'admin');
  return admins.length === 1 && admins[0].id === targetId;
}
```

The import at the top of `members.ts` already has `import type { Member } from './types';` — no change needed.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/members.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/members.ts tests/unit/members.test.ts
git commit -m "feat: add isGuest and isLastAdmin helpers"
```

---

## Task 4: i18n Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add English strings**

Add to `messages/en.json` after the last `member_` key (around line 187):

```json
"member_role_label": "Role",
"member_role_admin": "Admin",
"member_role_member": "Member",
"member_role_guest": "Guest",
"member_last_admin_error": "At least one admin must remain in the club."
```

- [ ] **Step 2: Add German strings**

Add to `messages/de.json` after the last `member_` key (same position):

```json
"member_role_label": "Rolle",
"member_role_admin": "Admin",
"member_role_member": "Mitglied",
"member_role_guest": "Gast",
"member_last_admin_error": "Es muss mindestens ein Admin im Club bleiben."
```

- [ ] **Step 3: Compile Paraglide output**

```bash
npm run build
```

Expected: Build succeeds. The new message functions (`m.member_role_label()` etc.) are now available in `src/lib/paraglide/messages/`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json src/lib/paraglide/
git commit -m "feat: add i18n strings for guest role"
```

---

## Task 5: Members List — Loader

**Files:**
- Modify: `src/routes/[club]/admin/members/+page.ts`

- [ ] **Step 1: Add `role` to the select query**

In `src/routes/[club]/admin/members/+page.ts`, change the select string:

```ts
// Before:
.select('id, first_name, last_name, nickname, user_id, member_number, created_at')

// After:
.select('id, first_name, last_name, nickname, user_id, member_number, role, created_at')
```

The full file after the change:

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, user_id, member_number, role, created_at')
    .eq('club_id', club.id)
    .order('member_number');

  return { members: members ?? [] };
};
```

- [ ] **Step 2: Check types**

```bash
npm run check
```

Expected: No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/members/+page.ts
git commit -m "feat: include role in members list query"
```

---

## Task 6: Members List — UI

**Files:**
- Modify: `src/routes/[club]/admin/members/+page.svelte`

This task has several sub-changes to the same file. Make them all before committing.

- [ ] **Step 1: Update the data type to include `role` and nullable `member_number`**

In the `$props()` block (around line 6), update the `members` type:

```ts
// Before:
members: {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  user_id: string | null;
  member_number: number;
  created_at: string;
}[];

// After:
members: {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  user_id: string | null;
  member_number: number | null;
  role: string;
  created_at: string;
}[];
```

- [ ] **Step 2: Fix `nextMemberNumber` to handle null values**

```ts
// Before:
function nextMemberNumber(): number {
  if (data.members.length === 0) return 1;
  return Math.max(...data.members.map((mem: { member_number: number }) => mem.member_number)) + 1;
}

// After:
function nextMemberNumber(): number {
  const numbers = data.members
    .map((mem) => mem.member_number)
    .filter((n): n is number => n !== null);
  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
}
```

- [ ] **Step 3: Add `role` state variable to the Add Member modal**

After the existing state declarations (around line 41), add:

```ts
let role = $state<'admin' | 'member' | 'guest'>('member');
```

In `openModal()`, reset the new field:

```ts
// Add inside openModal():
role = 'member';
```

- [ ] **Step 4: Update the SortKey type**

The `member_number` sort must now handle nulls gracefully. The existing `localeCompare(String(av), ...)` already handles this (null → "null" string, which sorts consistently). No logic change needed, but update the type annotation if it references `member_number: number` explicitly.

In the `sortedMembers` derived, the existing code is already generic enough — no change needed.

- [ ] **Step 5: Add a Role column header to the table**

After the existing `created_at` `<th>` (around line 184), add a new `<th>` before the dot indicator column:

```svelte
<th class="px-4 py-2.5 text-left font-normal">
  <span class="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
    {m.member_role_label()}
  </span>
</th>
```

- [ ] **Step 6: Update the member number `<td>` to handle nulls, add role badge `<td>`**

Replace the member number `<td>` (around line 192):

```svelte
<!-- Before: -->
<td class="px-4 py-3 text-xs text-muted-foreground">{member.member_number}</td>

<!-- After: -->
<td class="px-4 py-3 text-xs text-muted-foreground">
  {#if member.member_number !== null}
    {member.member_number}
  {:else}
    <span class="text-muted-foreground/30">—</span>
  {/if}
</td>
```

After the `created_at` `<td>` (around line 196), add the role badge `<td>` (before the dot indicator `<td>`):

```svelte
<td class="px-4 py-3">
  {#if member.role === 'guest'}
    <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{m.member_role_guest()}</span>
  {:else if member.role === 'admin'}
    <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">{m.member_role_admin()}</span>
  {/if}
</td>
```

- [ ] **Step 7: Add role selector to the Add Member modal**

In the modal form grid (after the `member_number` field, around line 378), add a role selector field:

```svelte
<!-- Role -->
<div class="flex flex-col gap-1 col-span-2">
  <label for="role" class="block text-xs font-medium text-muted-foreground mb-1">
    {m.member_role_label()}
  </label>
  <select
    id="role"
    bind:value={role}
    class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
  >
    <option value="member">{m.member_role_member()}</option>
    <option value="admin">{m.member_role_admin()}</option>
    <option value="guest">{m.member_role_guest()}</option>
  </select>
</div>
```

Wrap the member number field to only show when role is not guest. Find the member number block (around line 366) and wrap it:

```svelte
{#if role !== 'guest'}
  <!-- Member number -->
  <div class="flex flex-col gap-1">
    <label for="memberNumber" class="block text-xs font-medium text-muted-foreground mb-1">
      {m.member_member_number_label()}
    </label>
    <input
      id="memberNumber"
      type="number"
      bind:value={memberNumber}
      min="1"
      class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
    />
  </div>
{/if}
```

- [ ] **Step 8: Update `handleSave` to include role and omit member_number for guests**

```ts
// Before (inside handleSave):
const { error } = await supabase.from('members').insert({
  club_id: data.club.id,
  first_name: firstName.trim(),
  last_name: lastName.trim(),
  nickname: nickname.trim() || null,
  birthday: birthday || null,
  country: country.trim() || null,
  city: city.trim() || null,
  phone: phone.trim() || null,
  address: address.trim() || null,
  notes: notes.trim() || null,
  created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
  member_number: memberNumber,
});

// After:
const { error } = await supabase.from('members').insert({
  club_id: data.club.id,
  role,
  first_name: firstName.trim(),
  last_name: lastName.trim(),
  nickname: nickname.trim() || null,
  birthday: birthday || null,
  country: country.trim() || null,
  city: city.trim() || null,
  phone: phone.trim() || null,
  address: address.trim() || null,
  notes: notes.trim() || null,
  created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
  ...(role !== 'guest' && { member_number: memberNumber }),
});
```

- [ ] **Step 9: Verify type-checking**

```bash
npm run check
```

Expected: No errors from this file.

- [ ] **Step 10: Commit**

```bash
git add src/routes/[club]/admin/members/+page.svelte src/routes/[club]/admin/members/+page.ts
git commit -m "feat: add guest role support to members list page"
```

---

## Task 7: Member Detail — Loader

**Files:**
- Modify: `src/routes/[club]/admin/members/[id]/+page.ts`

- [ ] **Step 1: Load club members (id + role) for the last-admin guard**

Replace the entire file:

```ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const [{ data: member }, { data: pendingInvite }, { data: clubMembers }] = await Promise.all([
    supabase
      .from('members')
      .select('*')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single(),
    supabase
      .from('club_invites')
      .select('id')
      .eq('club_id', club.id)
      .eq('member_id', params.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
    supabase
      .from('members')
      .select('id, role')
      .eq('club_id', club.id),
  ]);

  if (!member) throw error(404, 'Member not found');

  return {
    targetMember: member,
    pendingInviteId: pendingInvite?.id ?? null,
    clubMembers: clubMembers ?? [],
  };
};
```

- [ ] **Step 2: Check types**

```bash
npm run check
```

Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/members/[id]/+page.ts
git commit -m "feat: load club members for last-admin guard in detail page"
```

---

## Task 8: Member Detail — View Mode

**Files:**
- Modify: `src/routes/[club]/admin/members/[id]/+page.svelte`

- [ ] **Step 1: Update the data type and add import**

In the `$props()` block (around line 8), update the type:

```ts
// Before:
const { data } = $props<{
  data: {
    club: { id: string; slug: string };
    currentMember: Member;
    targetMember: Member;
    pendingInviteId: string | null;
  };
}>();

// After:
const { data } = $props<{
  data: {
    club: { id: string; slug: string };
    currentMember: Member;
    targetMember: Member;
    pendingInviteId: string | null;
    clubMembers: { id: string; role: string }[];
  };
}>();
```

Add `isGuest, isLastAdmin` to the import from `$lib/members` (around line 4):

```ts
// Before:
import { displayName } from '$lib/members';

// After:
import { displayName, isGuest, isLastAdmin } from '$lib/members';
```

- [ ] **Step 2: Hide the member number sub-heading for guests**

The header shows `#{mem.member_number}` (around line 186). Wrap it:

```svelte
<!-- Before: -->
<p class="text-xs text-muted-foreground mt-0.5">#{mem.member_number}</p>

<!-- After: -->
{#if !isGuest(mem)}
  <p class="text-xs text-muted-foreground mt-0.5">#{mem.member_number}</p>
{/if}
```

- [ ] **Step 3: Add a role badge next to the name in view mode**

After the header `<h1>` (around line 185), inside the header's left `<div>`:

```svelte
<h1 class="text-base font-semibold text-foreground">{displayName(mem)}</h1>
{#if mem.role === 'guest'}
  <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium mt-0.5 inline-block">{m.member_role_guest()}</span>
{:else if mem.role === 'admin'}
  <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium mt-0.5 inline-block">{m.member_role_admin()}</span>
{/if}
{#if !isGuest(mem)}
  <p class="text-xs text-muted-foreground mt-0.5">#{mem.member_number}</p>
{/if}
```

- [ ] **Step 4: Hide the member number field in the details card for guests**

In the detail card grid (around line 264), wrap the member number `<div>`:

```svelte
<!-- Before: -->
<!-- Member number -->
<div>
  <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
  ...
</div>

<!-- After: -->
{#if !isGuest(mem)}
  <!-- Member number -->
  <div>
    <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
    {#if mode === 'view'}
      <p class="text-foreground">{mem.member_number}</p>
    {:else}
      <input
        type="number"
        bind:value={memberNumber}
        min="1"
        class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.memberNumber ? 'border-destructive' : ''}"
      />
      {#if errors.memberNumber}
        <p class="text-xs text-destructive mt-0.5">{errors.memberNumber}</p>
      {/if}
    {/if}
  </div>
{/if}
```

- [ ] **Step 5: Hide the account linking section for guests**

The account linking section starts with `{#if mode === 'view'}` (around line 404). Change its condition:

```svelte
<!-- Before: -->
{#if mode === 'view'}
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
    ...account linking content...
  </div>
{/if}

<!-- After: -->
{#if mode === 'view' && !isGuest(mem)}
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
    ...account linking content...
  </div>
{/if}
```

- [ ] **Step 6: Check types**

```bash
npm run check
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/[club]/admin/members/[id]/+page.svelte
git commit -m "feat: hide member number and invite section for guests in detail view"
```

---

## Task 9: Member Detail — Edit Mode + Last-Admin Guard

**Files:**
- Modify: `src/routes/[club]/admin/members/[id]/+page.svelte`

- [ ] **Step 1: Add `role` state and initialize it in `startEdit`**

Add a `role` state variable after the existing state declarations (around line 34):

```ts
let role = $state<'admin' | 'member' | 'guest'>('member');
```

In `startEdit()`, initialize it:

```ts
// Add inside startEdit():
role = mem.role as 'admin' | 'member' | 'guest';
```

Also update `memberNumber` initialization for guests (member_number is now nullable):

```ts
// Before:
memberNumber = mem.member_number;

// After:
memberNumber = mem.member_number ?? 0;
```

- [ ] **Step 2: Add last-admin derived value**

After the `inviteUrl` derived (around line 42), add:

```ts
const memberIsLastAdmin = $derived(
  isLastAdmin(data.clubMembers, data.targetMember.id)
);
```

- [ ] **Step 3: Update `validate` to require member_number for non-guests**

```ts
// Before:
function validate(): boolean {
  const e: Record<string, string> = {};
  if (!firstName.trim()) e.firstName = m.error_required();
  if (!lastName.trim()) e.lastName = m.error_required();
  errors = e;
  return Object.keys(e).length === 0;
}

// After:
function validate(): boolean {
  const e: Record<string, string> = {};
  if (!firstName.trim()) e.firstName = m.error_required();
  if (!lastName.trim()) e.lastName = m.error_required();
  if (role !== 'guest' && !memberNumber) e.memberNumber = m.error_required();
  if (data.targetMember.role === 'admin' && role !== 'admin' && memberIsLastAdmin) {
    e.role = m.member_last_admin_error();
  }
  errors = e;
  return Object.keys(e).length === 0;
}
```

- [ ] **Step 4: Update `handleSave` to persist the role and handle nullable member_number**

```ts
// Before (inside handleSave):
const { error: dbError } = await supabase
  .from('members')
  .update({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    nickname: nickname.trim() || null,
    birthday: birthday || null,
    country: country.trim() || null,
    city: city.trim() || null,
    phone: phone.trim() || null,
    address: address.trim() || null,
    notes: notes.trim() || null,
    created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
    member_number: memberNumber,
  })
  .eq('id', data.targetMember.id);

// After:
const { error: dbError } = await supabase
  .from('members')
  .update({
    role,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    nickname: nickname.trim() || null,
    birthday: birthday || null,
    country: country.trim() || null,
    city: city.trim() || null,
    phone: phone.trim() || null,
    address: address.trim() || null,
    notes: notes.trim() || null,
    created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
    member_number: role !== 'guest' ? memberNumber : null,
  })
  .eq('id', data.targetMember.id);
```

- [ ] **Step 5: Add the role selector field to the edit form**

In the edit form grid (after the nickname field, around line 260 in the edit branch), add a role selector. Place it after the nickname field and before the member number field:

```svelte
<!-- Role (edit mode only) -->
<div class="col-span-2">
  <p class="text-xs text-muted-foreground mb-0.5">{m.member_role_label()}</p>
  <select
    bind:value={role}
    class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.role ? 'border-destructive' : ''}"
  >
    <option value="member">{m.member_role_member()}</option>
    <option value="admin">{m.member_role_admin()}</option>
    <option value="guest">{m.member_role_guest()}</option>
  </select>
  {#if errors.role}
    <p class="text-xs text-destructive mt-0.5">{errors.role}</p>
  {/if}
</div>
```

The role selector should only appear in edit mode. Since Task 8 already wraps the member number field in `{#if !isGuest(mem)}`, you need to change that to use the reactive `role` state instead of the static `mem.role`, so it responds to the selector:

```svelte
<!-- Change the member number wrapper condition from: -->
{#if !isGuest(mem)}

<!-- To (in edit mode context): -->
{#if mode === 'view' ? !isGuest(mem) : role !== 'guest'}
```

Or more cleanly, split the view/edit rendering of member number:

In view mode (inside the details card, `{#if mode === 'view'}` branch):
```svelte
{#if !isGuest(mem)}
  <div>
    <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
    <p class="text-foreground">{mem.member_number}</p>
  </div>
{/if}
```

In edit mode (`{:else}` branch of `mode === 'view'`), show member number only when role is not guest:
```svelte
{#if role !== 'guest'}
  <div>
    <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
    <input
      type="number"
      bind:value={memberNumber}
      min="1"
      class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.memberNumber ? 'border-destructive' : ''}"
    />
    {#if errors.memberNumber}
      <p class="text-xs text-destructive mt-0.5">{errors.memberNumber}</p>
    {/if}
  </div>
{/if}
```

- [ ] **Step 6: Check types**

```bash
npm run check
```

Expected: All type errors resolved. Zero errors total.

- [ ] **Step 7: Commit**

```bash
git add src/routes/[club]/admin/members/[id]/+page.svelte
git commit -m "feat: add role selector and last-admin guard to member edit form"
```

---

## Task 10: Fix Nullable member_number in Tournament Display

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Make member_number display null-safe**

At line 793, find:

```svelte
{player.nickname || `${player.first_name} ${player.last_name}`} #{player.member_number}
```

Change to:

```svelte
{player.nickname || `${player.first_name} ${player.last_name}`}{player.member_number != null ? ` #${player.member_number}` : ''}
```

- [ ] **Step 2: Check types**

```bash
npm run check
```

Expected: Zero errors.

- [ ] **Step 3: Run all unit tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/[id]/+page.svelte"
git commit -m "fix: null-safe member_number display in tournament player selector"
```

---

## Done

All tasks complete. The guest role is fully implemented:
- DB enforces the constraints
- UI hides member number and invite section for guests
- Add member modal lets admin choose role (member number hidden for guest)
- Member detail edit lets admin change role with last-admin guard
- Tournament player selector handles null member numbers
