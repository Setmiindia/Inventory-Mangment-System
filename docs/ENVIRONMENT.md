# ENVIRONMENT

| Name | Public or secret | Where set | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | local `frontend/.env.local`; hPanel > Environment variables | Supabase project URL (`https://mgqzhjvasjbbiybbbahq.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public by design | same | Supabase publishable key. Safe in the browser because RLS protects the data |

No secret variable is used. A service-role key is NOT used anywhere in the code. Never write values in this file.

Rules:
- `NEXT_PUBLIC_*` variables are visible in the browser and are written into the app when it is built, so on Hostinger they must be set BEFORE the build.
- The Supabase service-role key must never use `NEXT_PUBLIC_` and must never reach client code.
- `.env*` is git-ignored.
- Local and live currently use the SAME Supabase project (`setmi-central`). Create a separate test project before doing risky work.
