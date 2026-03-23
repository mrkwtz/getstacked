# Poker Club Manager — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

A multi-tenant web app for managing real-life poker clubs. Club admins can manage members, create and run tournaments, track prize pools, and display a live tournament overview on a big screen at events. Members can view their stats, history, and club leaderboards.

---

## Architecture

**Frontend/Backend:** SvelteKit (full-stack — SSR + API routes, single deployment)
**Styling:** TailwindCSS
**Platform:** Supabase (Postgres + Auth + Realtime + Row Level Security)
**Hosting:** Vercel (managed); exit strategy to any Node.js host or self-hosted via Docker
**Offline:** PWA with service worker — the tournament display screen remains functional if the connection drops mid-event

### Multi-Tenancy

Every table carries a `club_id` foreign key. Supabase Row Level Security policies enforce club isolation at the database level. Clubs are identified in URLs by a slug: `/<club-slug>/...`.

### Offline Display Strategy

The display screen (`/[club]/tournaments/[id]/display`) is cached by a service worker. When online, it subscribes to Supabase Realtime for live updates. If the connection drops, the cached page continues to run — the blind timer keeps ticking client-side. State re-syncs automatically when the connection restores.

---

## Data Model

### clubs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| slug | text | URL identifier, unique |
| name | text | |
| settings | jsonb | Club-level config |
| created_at | timestamptz | |

### club_members
| Column | Type | Notes |
|--------|------|-------|
| club_id | uuid | FK → clubs |
| user_id | uuid | FK → auth.users |
| role | text | `admin` \| `member` |
| display_name | text | |
| joined_at | timestamptz | |

### tournament_formats
Reusable format templates per club.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| name | text | e.g. "Deep Stack Rebuy" |
| type | text | `freezeout` \| `rebuy` \| `bounty` \| `pko` \| `sitgo` \| `shootout` |
| config | jsonb | Type-specific settings (rebuy cost, cap, bounty amount, etc.) |

Adding a new format requires: adding the type enum value, defining its config schema, and implementing a SvelteKit format handler module — no schema migration needed for the config.

### blind_structures
Reusable blind level templates per club.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| name | text | e.g. "Standard 15min" |
| levels | jsonb | Array of `{ small, big, ante, duration_minutes }` |

### prize_structures
Reusable payout templates per club.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| name | text | |
| payouts | jsonb | Array of `{ position, percentage }` |

### tournaments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| club_id | uuid | FK → clubs |
| name | text | |
| date | date | |
| format_id | uuid | FK → tournament_formats |
| blind_structure_id | uuid | FK → blind_structures |
| prize_structure_id | uuid | FK → prize_structures |
| buy_in | numeric | Base buy-in amount |
| status | text | `draft` \| `active` \| `finished` |
| state | jsonb | Live running state (current level, timer, chip counts, etc.) — broadcast via Realtime |
| display_public | boolean | If true, display screen is viewable without login |
| created_at | timestamptz | |

### tournament_players
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tournament_id | uuid | FK → tournaments |
| member_id | uuid | FK → club_members |
| rebuys | integer | Default 0 |
| addons | integer | Default 0 |
| finish_position | integer | Null while still playing |
| eliminated_at | timestamptz | |
| prize_amount | numeric | Calculated at finish |

---

## Application Routes

### Public / Auth
| Route | Description |
|-------|-------------|
| `/` | Landing — sign in or create a club |
| `/auth/login` | Email + magic link login |
| `/auth/accept-invite` | New member accepts club invite |

### Member views (mobile-optimized)
| Route | Description |
|-------|-------------|
| `/[club]` | Club home — upcoming tournaments, recent results |
| `/[club]/leaderboard` | Club-wide standings and stats |
| `/[club]/tournaments` | Tournament history list |
| `/[club]/tournaments/[id]` | Tournament results and recap |
| `/[club]/tournaments/[id]/leaderboard` | Live standings during a running tournament; final results when finished |
| `/[club]/profile` | Personal stats and history |

### Admin (desktop-first)
| Route | Description |
|-------|-------------|
| `/[club]/admin` | Dashboard — overview and quick actions |
| `/[club]/admin/members` | Invite, manage, remove members |
| `/[club]/admin/tournaments/new` | Create tournament |
| `/[club]/admin/tournaments/[id]/run` | Run live tournament — register players, record eliminations, control timer |
| `/[club]/admin/formats` | Manage format templates |
| `/[club]/admin/blind-structures` | Manage blind structure templates |
| `/[club]/admin/prize-structures` | Manage prize payout templates |
| `/[club]/admin/settings` | Club settings |

### Display Screen (PWA + offline)
| Route | Description |
|-------|-------------|
| `/[club]/tournaments/[id]/display` | Full-screen big-screen view. Access controlled by `display_public` flag — public if enabled, requires club member login if not. |

---

## Live Tournament Flow

1. **Setup** — Admin creates a tournament, picks a format template, blind structure, and prize structure. Sets buy-in amount.
2. **Registration** — Admin registers players from the member list. Prize pool is calculated live as players are added.
3. **Running** — Timer starts. Admin records eliminations, rebuys, and chip counts from the run screen. Display screen updates live via Supabase Realtime. Timer auto-advances blind levels.
4. **Finish** — Admin records final positions. App calculates prize payouts from the prize structure. Results are posted to club leaderboard and member stats.

### Admin Run Screen
Controls: start/pause/advance timer, record elimination, record rebuy/add-on, update chip counts, toggle display public, end tournament.

Live state panel (mirrors display screen): current blind + timer, players remaining, prize pool (updates with rebuys), chip leaderboard, recent eliminations, average stack.

### Display Screen Elements
- Blind level countdown timer (large, prominent) + current and next blind levels
- Players remaining count
- Average chip stack
- Chip leaderboard (top N)
- Prize pool + payout breakdown
- Recent eliminations feed

---

## Responsive Design

- **Member-facing pages** — mobile-first, fully functional on small screens
- **Admin pages** — desktop-first; functional but not optimized for mobile
- **Display screen** — designed for TV/large screen; not intended for mobile

---

## MVP Scope (v1)

**In scope:**
- Club creation and member invites
- Freezeout and Rebuy tournament formats
- Reusable blind structure templates
- Reusable prize structure templates
- Reusable tournament format templates
- Live tournament run screen
- Display screen (PWA, offline-capable)
- Club-wide leaderboard and member stats
- Tournament leaderboard (live during event, final results after)

**Deferred to later releases:**
- Bounty, PKO, Sit & Go, Shootout formats
- Multiple poker variants (Omaha, etc.)
- Table and seat assignment
- Guest players (non-members)
- Public club page
- Export results (PDF / CSV)
