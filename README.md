# Tripsplit — Trip Expense Tracker

A local-first, mobile-first split-the-bill app, similar in spirit to Splitwise.
Trips live in your browser&rsquo;s IndexedDB; **optional** Supabase backup adds an
anonymous-by-default session plus magic-link email so you can restore on another device.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **React Router** for routing
- **Zustand** for ephemeral UI state (toasts, modals)
- **Dexie** (IndexedDB) for persistent data with a versioned schema
- **Supabase** (optional) for anonymous auth + email OTP + Postgres sync with RLS
- **Tailwind CSS** with a Splitwise-like teal accent (`#5bc5a7`)
- **vite-plugin-pwa** with a minimal manifest for an installable feel

## Features

- Multiple **trips** (groups) with avatar, description, default currency
- **Members** per trip
- **Expenses** with title, date, amount + currency, payer, category and split
  - Equal split fully implemented; exact / percent / shares are UI placeholders
- **Balances** computed per-currency (no silent FX) with greedy settlement suggestions
- **Transfers** stored in the same ledger (UI placeholder for direct entry)
- **JSON export / import** for unencrypted backups (unchanged hash-based trip links)
- **Optional cloud backup** — bidirectional sync by `updated_at` when env vars are set
- Mobile-first responsive shell with bottom navigation and safe-area support
- PWA-ready manifest and service worker

## Getting started

```bash
npm install
cp .env.example .env   # optional — fill Supabase keys or leave unset for local-only
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to ./dist (no env vars required)
npm run preview  # serve the build locally
npm run lint     # ESLint
```

### Optional Supabase cloud backup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers**: enable **Anonymous sign-ins** and **Email** (magic link / OTP). Disable passwords if you want magic-link only.
3. **Authentication → URL configuration**: add redirect URLs:
   - `http://localhost:5173/**` (and your dev port if different)
   - Production: `https://travelsp.netlify.app/**` (adjust to your deployed origin)
4. Copy **Project URL** and **anon public** key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Open the SQL editor (or Supabase CLI) and run the migration in [`supabase/migrations/001_initial.sql`](./supabase/migrations/001_initial.sql).

**Anonymous → email linking:** Completing the magic link on the **same browser profile** lets Supabase merge the anonymous user into the permanent email identity (see [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-anonymous#link-an-email--phone-identity)). Signing out starts a **new** anonymous session; older cloud rows remain tied to the previous account until you sign in with that email again.

**Build without env:** If the two `VITE_*` variables are unset, the app stays **local-only** and Settings shows a short banner explaining how to configure sync.

## Deploy to Netlify

The repo includes a `netlify.toml` and a `public/_redirects` file. Just point
Netlify at this repo:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect `/* → /index.html` is preconfigured.

Add the same production URL under Supabase Auth redirect URLs.

## Data model (Dexie)

| Table       | Columns                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| `groups`    | id, name, description?, avatarDataUrl?, defaultCurrency, createdAt, updatedAt           |
| `members`   | id, groupId, displayName, sortOrder, updatedAt                                           |
| `expenses`  | id, groupId, title, description?, date, amountMinor, currency, paidByMemberId, splitMode, splitJson, categoryKey?, iconKey?, createdAt, updatedAt |
| `transfers` | id, groupId, fromMemberId, toMemberId, amountMinor, currency, date, note?, createdAt, updatedAt |

Money is always stored as **integer minor units** (e.g. cents) keyed against an
ISO-4217 currency code. Splits are persisted as a strongly-typed JSON payload
in `splitJson` so they can evolve without further schema migrations.

Schema bumps live in [`src/db.ts`](./src/db.ts) — never repurpose an existing
version number; instead add a new `.version(N).stores({…}).upgrade(…)` call.

## Remote schema (Supabase)

Tables: `trips` (flat columns mirroring a group), `trip_members`, `trip_expenses`, `trip_transfers` with **JSONB payloads** (`schemaVersion: 1` + entity fields) and `updated_at` for last-write-wins sync. **RLS** restricts rows to `trips.owner_id = auth.uid()` with child tables gated via join to `trips`.

## Collaborative trips (not done)

Sync is **single-writer per Supabase user** (owner = `auth.uid()`). True shared trips (multiple editors, invites, split ownership) would need shared trip membership, role-based RLS, conflict policies beyond per-row `updated_at`, and likely server-side merge or CRDTs.

## Roadmap

- Multi-currency conversion with editable rate history.
- Exact / percent / shares splits and edit-expense flow.
- Native transfers UI (settlements that mark balances as paid).
- Recurring expenses and per-trip currency rounding rules.
- Shared / collaborative trips with proper multi-user RLS.

## License

MIT — see [LICENSE](./LICENSE).
