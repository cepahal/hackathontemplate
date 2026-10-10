# Local setup handoff

Owner: local_setup agent. Branch: `codex/hacknc-setup`.

The root commands operate on the canonical `finalfrontentbackend` app:

- `npm run setup` preserves existing env files, copies missing examples, installs the locked frontend with `npm ci`, creates a backend virtual environment if needed, and installs `requirements-dev.txt`.
- `npm run setup -- --dry-run` describes setup without changes. `--python <path>` or `PYTHON_BIN` selects Python; the installed Codex Python runtime is discovered automatically on this Windows host.
- `npm run doctor` inspects local configuration without external requests or printing credential values. Missing Supabase config is a failure. Optional integrations report missing variable names. A configured key does not establish account activation, credits, model access, or applied database migrations.
- `npm run dev` starts both servers on loopback and cleans up their process trees on shutdown. `npm run dev:frontend` starts public UI previews without requiring Supabase credentials; auth/API features still require real configuration. Browser secret keys are blocked in both modes.
- `npm run test:setup` runs 5 tests covering env parsing, placeholders, frontend secrets, mismatches, redaction, and the actual frontend optional-config helper. The frontend dependencies must be installed for the TypeScript-backed helper test.

On Node 24+, npm subprocesses use system certificate trust while keeping TLS verification enabled. Existing `NODE_OPTIONS` is inherited.

Verified: every owned `.mjs` passed `node --check`; 5 configuration tests passed; frontend lint and typecheck passed; root setup dry-run preserved existing env files; npm reported `strict-ssl=true` through the helper; compatible bundled Python discovery passed; doctor identified the actual missing credentials and imported installed backend runtime modules successfully. HTTP checks of `/dashboard`, `/settings`, and `/admin` returned 307 redirects to login with the original path preserved.

Public-preview auth fix: `src/lib/supabase/config.ts` now exposes one optional getter that returns null only when both public values are absent; partial config, invalid protocols, and secret keys still fail validation. The strict getter remains required by all actual Supabase clients. `src/proxy.ts` keeps absent-config requests signed-out and redirects protected paths. `src/lib/auth.ts` returns no current user when Supabase is absent, and the Navbar skips its client auth subscription in the same case. Configured sessions still use the existing refresh/client behavior.

Not verified by this agent: a complete install (main agent owns dependency installs), server startup/shutdown, refreshed browser rendering after the auth fix, live provider requests, Supabase authentication, or database migrations. An existing dev process served stale layout errors during source changes and a parallel build; main will restart it before checking `/ui`. No API credentials were created or inserted. Other agents' files were left unchanged.

Next: main agent should restart `npm run dev:frontend`, inspect `/ui` in a browser, and run the final build. Live configuration requires genuine project values and authorized provider/account access.
