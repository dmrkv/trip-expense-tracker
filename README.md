# Tripsplit — Trip Expense Tracker

A local-first, mobile-first split-the-bill app, similar in spirit to Splitwise.
All data lives in your browser&rsquo;s IndexedDB; nothing is uploaded.
Cross-device sync (encrypted remote blob) is on the roadmap.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **React Router** for routing
- **Zustand** for ephemeral UI state (toasts, modals)
- **Dexie** (IndexedDB) for persistent data with a versioned schema
- **Tailwind CSS** with a Splitwise-like teal accent (`#5bc5a7`)
- **vite-plugin-pwa** with a minimal manifest for an installable feel

## Features

- Multiple **trips** (groups) with avatar, description, default currency
- **Members** per trip
- **Expenses** with title, date, amount + currency, payer, category and split
  - Equal split fully implemented; exact / percent / shares are UI placeholders
- **Balances** computed per-currency (no silent FX) with greedy settlement suggestions
- **Transfers** stored in the same ledger (UI placeholder for direct entry)
- **JSON export / import** for unencrypted backups
- Mobile-first responsive shell with bottom navigation and safe-area support
- PWA-ready manifest and service worker

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to ./dist
npm run preview  # serve the build locally
npm run lint     # ESLint
```

## Deploy to Netlify

The repo includes a `netlify.toml` and a `public/_redirects` file. Just point
Netlify at this repo:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect `/* → /index.html` is preconfigured.

## Data model (Dexie v1)

| Table       | Columns                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| `groups`    | id, name, description?, avatarDataUrl?, defaultCurrency, createdAt, updatedAt           |
| `members`   | id, groupId, displayName, sortOrder                                                      |
| `expenses`  | id, groupId, title, description?, date, amountMinor, currency, paidByMemberId, splitMode, splitJson, categoryKey?, iconKey?, createdAt |
| `transfers` | id, groupId, fromMemberId, toMemberId, amountMinor, currency, date, note?, createdAt    |

Money is always stored as **integer minor units** (e.g. cents) keyed against an
ISO-4217 currency code. Splits are persisted as a strongly-typed JSON payload
in `splitJson` so they can evolve without further schema migrations.

Schema bumps live in [`src/db.ts`](./src/db.ts) — never repurpose an existing
version number; instead add a new `.version(N).stores({…}).upgrade(…)` call.

## Roadmap

- Cross-device sync via encrypted remote blob (e.g. user-supplied passphrase
  that gates an end-to-end-encrypted JSON snapshot stored on a small backend).
- Multi-currency conversion with editable rate history.
- Exact / percent / shares splits and edit-expense flow.
- Native transfers UI (settlements that mark balances as paid).
- Recurring expenses and per-trip currency rounding rules.

## License

MIT — see [LICENSE](./LICENSE).
