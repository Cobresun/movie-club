# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

This is a Vue 3 + Netlify Functions app. The single dev command `netlify dev` starts both the Vite frontend (port 5173) and the serverless functions backend, proxied together on **port 8888**.

### Running the app

```bash
netlify dev --no-open
```

Requires a `.env` file (git-ignored) with secrets populated from environment variables. The `.env` is needed by scripts that use `--env-file=.env` (migrations, DB utilities). When secrets are injected as process env vars (as in Cloud Agent VMs), `netlify dev` will use those directly and log "Ignored .env file env var" messages — this is normal.

### Key commands

See `CLAUDE.md` and `package.json` scripts for the full list. Quick reference:

| Task | Command |
|------|---------|
| Dev server | `netlify dev --no-open` |
| Type-check | `npm run type-check` |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Format | `npm run format` |

### Gotchas

- **Netlify CLI must be installed globally** (`npm install -g netlify-cli`). It is not a project dependency.
- The `.env` file must be created from injected secrets before running migration scripts or DB utilities (they use `tsx --env-file=.env`). For `netlify dev`, process env vars suffice.
- ESLint runs with `--max-warnings 0` so any warning is a failure.
- `vue-tsc` (type-check) takes ~6s; ESLint takes ~40s. Plan accordingly.
- The backend uses `ensure()` calls that throw at startup if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are missing.
- There is no Docker or local database to manage. CockroachDB is a remote managed service connected via `DATABASE_URL`.
