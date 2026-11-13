# CLAUDE.md: SETMI INDIA Inventory Management System

Read `docs/HANDOVER.md` first in every session. Update it last.
Also read `AGENTS.md`: this Next.js version differs from older versions, and its docs are in `frontend/node_modules/next/dist/docs/`.

## Working style
- The owner is a beginner. Explain in simple Hinglish.
- Act as an honest senior architect and advisor, not a yes-man: before executing, check the decision; if it is wrong or risky (architecture, database, security, cost, business logic) STOP, say so plainly with a better option, then proceed once the owner decides. Name risks and costs BEFORE the decision.
- Never test on the live database with real-looking data and leave it there (the ledger cannot be cleaned). Prefer a test project.
- One approved task at a time. For each task: inspect, plan, wait for approval, implement, test, document, review the diff, report, then STOP.
- No hidden decisions. Unclear business rules go in `docs/ASSUMPTIONS.md`; do not turn them into DB constraints silently.
- Never claim something works, passed or is deployed without actual command output.
- Documentation describes actual code only, never intended code as done.

## Scope
- Built so far (see `docs/HANDOVER.md`): Item Master, barcodes, Excel import, locations, stock ledger, receiving, transfers, billing (ON/OFF switch), reports. The owner has asked for the whole system to be built; still ask before tax/GST, deployment, DNS or new paid services.
- Stock quantity and warehouse location are NOT Item Master fields.
- Keep existing Item Master field meanings (see `docs/DECISIONS.md`).

## Security rules
- Authorize every protected operation on the server. Deny by default.
- Supabase: Row Level Security on exposed tables, with tested policies.
- Never put the service-role key in client code or `NEXT_PUBLIC_*` variables.
- Never read, print or commit secrets. `.env*` must stay git-ignored.
- Validate input and uploaded files on the server.
- No new dependencies without approval; record them in `docs/DEPENDENCIES.md`.

## Needs explicit approval first
- Installing/upgrading dependencies, build or framework config changes
- Auth/authorization changes, DB schema or migrations (applied from `setmi-central-db`)
- Any external service access, deployment, DNS (`inventory.setmiindia.com`)
- Commit, push, or any history change. Never force-push.
- Deleting files

## Commands
Run inside `frontend/`: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`.
Database: the database is NOT in this repository. It is owned by the repository `setmi-central-db` (local `C:\dev\setmi\setmi-central-db`): every migration for every schema, SQL tests and seed. People are `core.profiles`; inventory tables are in schema `inventory`. Supabase is the backend (login, database, Row Level Security); there is no separate API server.
Read `docs/ARCHITECTURE.md` and `docs/DEPLOYMENT.md` before touching structure or deploying. Old history is in `docs/archive/` (do not treat it as current).
