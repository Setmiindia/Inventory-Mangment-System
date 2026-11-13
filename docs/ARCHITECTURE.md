# ARCHITECTURE (2026-11-13)

## Big picture
```
Browser  ->  Hostinger (Next.js app in frontend/)  ->  Supabase "setmi-central" (Postgres + Auth + Storage)
                                                          schemas: core (shared people)  inventory  [crm, ... later]
```
- There is no separate API server. The Next.js server calls Supabase as the signed-in person (their token), so Row Level Security and the permission checks inside database functions apply to every call.
- The database is owned by the repository `setmi-central-db` (migrations, SQL tests, seed). This repository holds only the website. Never put database definitions here.

## Repositories
| Repository | Holds |
|---|---|
| `Inventory-Mangment-System` (this one) | `frontend/` website, `docs/` |
| `setmi-central-db` | every migration for every schema, SQL tests, seed |

## frontend/ layout
```
src/proxy.ts                       session refresh + redirect to /login (convenience only, not the security check)
src/app/login, forgot-password, reset-password, auth/callback    sign-in, password recovery, email-link target
src/app/(app)/layout.tsx           signed-in shell: top bar, menu, bottom bar are separate pieces; <Guard> blocks inactive users
src/app/(app)/<module>/            one folder per screen group (items, suppliers, locations, customers, stock, ...)
src/components/                    shared parts (page-header, streamed, setup-checklist, charts, badge, ...)
src/lib/auth.ts                    getCurrentUser (token checked locally with getClaims), requireUser/Admin/Permission, can()
src/lib/supabase/                  Supabase clients; default schema is `inventory`
src/lib/validation/                zod rules, one file per area
src/lib/i18n/                      English and Hindi texts
tests/                             node:test unit tests (npm test)
```

## Who may do what
1. Identity: `core.profiles` (central on/off, name, email). Inventory rights: `inventory.user_access` + `user_permissions` + `user_locations`. Usable only if both "active" flags are true.
2. Every page and server action calls `requireUser/requirePermission` first; the database checks again (RLS and function checks). Deny by default.
3. Secrets: only the two public Supabase values are used (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). No service-role key anywhere.

## Page rules (so the app stays fast)
- A page that reads the session or the database is wrapped with `streamed(...)` (`src/components/streamed.tsx`) so it streams inside `<Suspense>`.
- Menu, top bar and bottom bar read the cached `getShell()` in parallel with the page; the page never waits for them.
- Lists use one database function per screen (`*_page`) that returns the rows, the totals and the filter lists in one call.

## Fixed facts that surprise people
- Production build: `next build --webpack` + `next.config.mjs` + `postcss.config.mjs` (Hostinger's server cannot load Next's native compiler). Dev: Turbopack.
- The ledger (`stock_movements`) and stock entries are append-only on purpose; rows cannot be deleted.
- Stock quantity is not an Item field; it comes only from the ledger.
