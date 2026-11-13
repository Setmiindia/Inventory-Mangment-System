# HANDOVER (current state only)

Read this first. Keep it SHORT: it says what is true today, what is open, and what to do next. The long diary of everything built until 2026-11-13 is in `docs/archive/HANDOVER-HISTORY-to-2026-11-13.md` (history, not instructions: it still mentions removed things such as the Express backend and the `profiles` table).

## What this repository is
The Inventory Management System (IMS) website for SETMI INDIA: Next.js app in `frontend/`. The database is NOT here: it lives in the central database repository `setmi-central-db` (schema `inventory`, identity in `core`). See `docs/ARCHITECTURE.md`.

## Where things run (2026-11-13)
| What | Where |
|---|---|
| Live site | https://inventory.setmiindia.com (Hostinger Business plan, Node.js web app, root directory `frontend`, Node 24, deploys on every push to `main`, about 3 minutes) |
| Database, login, storage | Supabase project `setmi-central` (`mgqzhjvasjbbiybbbahq`, FREE plan, region Tokyo) |
| Code | GitHub `Setmiindia/Inventory-Mangment-System`, branch `main` |
| Local copy | `C:\dev\setmi\inventory-management-system` (moved out of OneDrive on 2026-11-13; the old OneDrive copy may still exist, do not use it) |

## How the pieces connect (facts)
- People: `core.profiles` (central, one row per login, `is_active`), inventory rights in `inventory.user_access` (`is_active`, `is_admin`, role, department), permissions in `inventory.user_permissions`, places in `inventory.user_locations`. A person can use inventory only if BOTH `is_active` flags are true.
- Invite flow: Users & Roles > Add User saves an invite (no email is sent). The owner then makes the login in Supabase (Authentication > Users > Add user > Send invitation) with the same email. When the login is created, `core.handle_new_user` makes the core profile and `inventory.handle_new_staff` applies the invite (permissions, department, places, switches the person on).
- The frontend uses schema `inventory` by default (`frontend/src/lib/supabase/server.ts`), checks the session token locally with `getClaims` and reads the person with the database function `inventory.my_profile()`.
- Production build is `next build --webpack` with `next.config.mjs` and `@tailwindcss/postcss`, because Hostinger's build server cannot load Next's native compiler. `npm run dev` uses Turbopack. See `docs/DEPLOYMENT.md`.

## Open items (in priority order)
1. **Backups / plan:** Supabase FREE has no daily backup and pauses after 7 days idle. Decide on a paid plan; until then export manually. (owner decision, costs money)
2. **No test database:** development and live share one database. Create a second Supabase project for testing (Mumbai region), then stop testing on live.
3. **Supabase dashboard settings** (owner): Auth > URL Configuration (Site URL = https://inventory.setmiindia.com, Redirect URLs also `https://inventory.setmiindia.com/**` and `http://localhost:3000/**`); Auth > Emails > Invite template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`; password rules; MFA for admins.
4. **Storage policies** for the `item-files` bucket do not exist (uploads of product photos fail); `storage.objects` policies must be made in the dashboard.
5. **Real data:** import the ~390 SKUs and opening stock from the old shop sheet (see `docs/archive/REFERENCE-SHOP-SHEET.md`). Opening stock should use Scan count; Stock In has no "Opening stock" reason (needs a database change).
6. **Leftovers from testing on live:** archived product `ZZ-TEST-IO` and 2 ledger rows (SE-000044/045) cannot be deleted (the ledger is append-only on purpose).
7. **Not yet polished:** Purchase Orders, Goods Inward, Import Shipments, Quality Check, Transfers, Physical Count, Sales Orders, Picking, Dispatch, Returns, Billing, Reports, Dashboard, Users & Roles. Phone-size layout of every page is untested.
8. **Speed:** layout split and `getClaims` are done; database distance (Tokyo) remains the main cost.

## Rules for AI sessions
`CLAUDE.md` and `AGENTS.md` in the repository root. Short version: owner is a beginner and wants plain Hinglish; act as an honest senior advisor, challenge wrong decisions before executing; one approved task at a time; no dependencies, migrations, deploys or pushes without the owner's yes; never claim something works without command output; update this file last.
