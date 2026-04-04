# Guest Role Design

**Date:** 2026-04-04  
**Status:** Approved

## Summary

Add a third member role `guest` to the `members` table. Guests are occasional players who don't have a formal club membership: they have no member number and cannot create a user account or log into GetStacked.

---

## Database

### Migration

1. Make `member_number` nullable:
   ```sql
   ALTER TABLE members ALTER COLUMN member_number DROP NOT NULL;
   ```

2. Add role check constraint (valid values: `admin`, `member`, `guest`):
   ```sql
   ALTER TABLE members ADD CONSTRAINT members_role_check
     CHECK (role IN ('admin', 'member', 'guest'));
   ```

3. Enforce that guests cannot be linked to a user account:
   ```sql
   ALTER TABLE members ADD CONSTRAINT members_guest_no_user
     CHECK (role != 'guest' OR user_id IS NULL);
   ```

4. Enforce that non-guests always have a member number:
   ```sql
   ALTER TABLE members ADD CONSTRAINT members_member_has_number
     CHECK (role = 'guest' OR member_number IS NOT NULL);
   ```

### Type changes (`src/lib/types.ts`)

- `member_number` in Row/Insert/Update: `number` → `number | null`
- `Role`: `'admin' | 'member'` → `'admin' | 'member' | 'guest'`

---

## Business Logic (`src/lib/members.ts`)

Two new helpers:

- `isGuest(member)` — returns `member.role === 'guest'`
- `isLastAdmin(members, targetId)` — returns `true` if `targetId` is the only member with `role === 'admin'` in the provided list; used to guard role changes away from `admin`

No changes to seating or tournament logic — guests participate in tournaments identically to regular members.

---

## Members List Page (`src/routes/[club]/admin/members/+page.svelte`)

- `role` field added to the list query and data type
- **Member number column**: guests show a `—` placeholder
- **Role column** added to the table with badges:
  - `admin` → accent-colored badge
  - `member` → neutral/no badge
  - `guest` → muted "Guest" badge
- **Add Member modal**: gains a Role selector (radio or select, default: `member`). When `guest` is selected, the member number field is hidden.

---

## Member Detail Page (`src/routes/[club]/admin/members/[id]/+page.svelte`)

### View mode

- Member number field: hidden for guests
- Account linking / invite section: hidden for guests (the DB constraint `members_guest_no_user` acts as a safety net, but the UI never exposes the action)
- Role displayed as a badge

### Edit mode

- **Role selector** (dropdown: `admin` / `member` / `guest`) added to the edit form
- Switching to `guest`: member number field disappears
- Switching from `guest` to `member`/`admin`: member number field appears and is required
- **Last-admin guard**: if the role is changed away from `admin`, the form checks whether this member is the last admin in the club. If so, save is blocked with the error: *"At least one admin must remain in the club."*

### Page loader (`src/routes/[club]/admin/members/[id]/+page.ts`)

- Load the club's admin count alongside the target member so the last-admin guard is available without an extra round-trip on save.

---

## Constraints & Rules Summary

| Rule | Enforced by |
|------|------------|
| Guest has no `member_number` | DB constraint + UI hides the field |
| Guest has no `user_id` | DB constraint + UI hides invite section |
| Non-guest always has `member_number` | DB constraint + UI requires field |
| At least one admin per club | Application logic (client-side guard on role change) |
| Role values limited to `admin/member/guest` | DB check constraint |
