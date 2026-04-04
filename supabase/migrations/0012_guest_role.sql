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
