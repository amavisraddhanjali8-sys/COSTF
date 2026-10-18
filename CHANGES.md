# Changes

## Run
1. Install PostgreSQL and create a database `inno_cost`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
   Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (first admin). If not set, a random password is printed once.
3. `npm install` then `npm run dev`

## Test
Start the server, then run with ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_CODE set:
`node tests/roles.mjs`, `node tests/workflows.mjs`, `python3 tests/route-check.py`

## Do after deploy
- Delete `data/` from git history (it held a database and `security.json`).
- Change every password and the admin secret code. The old ones were public.
