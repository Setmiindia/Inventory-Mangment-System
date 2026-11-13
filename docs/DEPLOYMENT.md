# DEPLOYMENT (Hostinger, live since 2026-11-12)

## Setup (facts)
- hPanel > Websites > `inventory.setmiindia.com` (Web app, Business plan). Connected to GitHub `Setmiindia/Inventory-Mangment-System`, branch `main`.
- Root directory `frontend`, framework Next.js, Node 24, build command `npm run build`, output `.next`.
- Every push to `main` starts a deployment (about 3 minutes). Status: hPanel > Deployments. A failed build keeps the previous version running.
- Environment variables (hPanel > Environment variables) must exist BEFORE the build: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nothing secret is used.

## Why the build looks unusual
Hostinger's build server has an old Linux (glibc below 2.29), so Next.js 16's native compiler and Turbopack cannot load (first failed builds: `GLIBC_2.29 not found`, `Failed to load next.config.ts`). The fix: `next.config.mjs` (plain JavaScript), `npm run build` = `next build --webpack`, and `@tailwindcss/postcss` with `postcss.config.mjs`. Verified locally by forcing the WASM compiler (`NEXT_TEST_WASM=1`) on a clean `npm ci` copy.

## Before every push (do all four)
1. `npm run typecheck`, `npm run lint`, `npm test` in `frontend/`.
2. A production build on a clean copy: `NEXT_TEST_WASM=1 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npm run build`.
3. Database changes go first, from the `setmi-central-db` repository (apply the migration, run its SQL test). The website must keep working with BOTH the old and the new database for the minutes between the two steps.
4. After the push: watch the deployment in hPanel, open the live site, check login and one list page.

## Rollback
- Website: hPanel > Deployments > open an older "Completed" deployment > Redeploy.
- Database: migrations only go forward. Write a NEW migration that reverses a change. Take a manual export first. See `docs/ROLLBACK.md`.

## Supabase settings that only the owner can change (dashboard)
Auth > URL Configuration (Site URL `https://inventory.setmiindia.com`; Redirect URLs `https://inventory.setmiindia.com/**` and `http://localhost:3000/**`), Auth > Emails (Invite template link), Auth > Sign In (new sign-ups OFF), password rules, MFA, Data API > Exposed schemas (`inventory`), Storage policies for `item-files`, plan and backups.

## Security headers
Set in `next.config.mjs`: Content-Security-Policy (own scripts and the Supabase address only), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. If a new outside service is added (analytics, maps, fonts), add its address to the policy.
