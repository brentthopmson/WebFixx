# Plan: silent dev logging + portable profile roots (+ launcher diagnosis notes)

Context: multi-server routing (Tasks A/B1/B2/C) is done, verified, and deployed
(`clasp push` + engine commits `9698fbe`, `9f910ba`). This plan covers the two
remaining code items the user approved, plus notes on the Contabo launcher issue.

---

## Task 1 — separate `dev:silent` script

**Goal:** a quiet local dev command that silences console output without touching
the default `npm run dev` behavior.

### Files

`C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\API\offline-headless-webfixx\package.json`

- `"scripts"` (:5-11): add
  `"dev:silent": "cross-env NODE_ENV=development LOG_LEVEL=warn next dev"`.
  Leave `"dev": "next dev"` unchanged.
- `"devDependencies"` (:44-52): add `"cross-env": "^7.0.3"` (not currently
  installed; needed so the env vars are set on Windows **and** Linux).

### Why this works (no `logger.js` change)

`src/utils/logger.js`:
- `LOG_LEVEL` default is `info` in dev / `warn` in prod (:9); an explicit
  `LOG_LEVEL=warn` is honored regardless of env.
- `shouldLog()` gates **both** console output and file writes per level
  (:13-15, :68-90, :95-105), so `LOG_LEVEL=warn` suppresses all `logger.info`
  noise at the source.
- File writes stay dev-only (`isDev` still true) — unchanged behavior.
- Note: any `console.log`/`console.warn` **not** routed through `logger` still
  prints. Out of scope; `dev:silent` only guarantees logger-based silence.

### Optional (same task, default off)

Respect a `LOG_FILE_DISABLED=1` env var in the dev-only truncation block
(:22-36) and the append path (:39-41) so a dev can stop writing log files too.
Not wired into `dev:silent` unless requested.

### Verify

- `npm install` (adds `cross-env`).
- Build still succeeds; `npx jest` baseline unchanged (14/15 suites, 233 pass).
- Smoke: `npm run dev:silent` shows warnings/errors only; `npm run dev`
  unchanged.

---

## Task 2 — portable profile roots (`/tmp` → `os.tmpdir()`)

**Goal:** replace hardcoded POSIX `/tmp/...` with a platform-aware base so
Windows (dev/launcher hosts) and Linux (containers) both resolve correctly.
**Linux behavior is byte-identical** (`os.tmpdir() === '/tmp'` there).

### New shared helper

`src/utils/paths.js` (new, tiny):

- `PROFILE_ROOT = process.env.WEBFIXX_PROFILE_ROOT || path.join(os.tmpdir(), 'users_data')`
- `STAGING_ROOT = process.env.STAGING_ROOT || path.join(os.tmpdir(), 'webfixx_uploading')`

`STAGING_ROOT` keeps its existing `process.env.STAGING_ROOT` override priority
(already honored in the route files). Env overrides are the safety valve: a
deployed box can pin the old absolute path if needed.

### Sites to edit (all confirmed via grep)

| File | Code hits (non-comment) |
|---|---|
| `src\utils\writeQueue.js` | `:35` `JOURNAL_PATH = path.join('/tmp','users_data','.write_queue.json')` |
| `src\app\api\googledrive.mjs` | `:264` `parent`, `:474` `sourceDir` fallback |
| `src\app\emails\cookie\cookie-api-login\route.js` | `_PROFILE_ROOT` `:63`, `buildUserDataDir` `:114`, `resolveUserDataDir` `:127,:130,:134`, `STAGING_ROOT` `:152`, `parent` `:2777,:6738`, `writerSeg` `:6745` |
| `src\app\emails\cookie\cookie-api-login copy\route.js` | same pattern (`:62,:113,:126,:129,:133,:151,:2157,:5927,:5934`) |
| `src\app\emails copy\cookie\cookie-api-login\route.js` | same pattern (`:63,:114,:127,:130,:134,:152,:2777,:6738,:6745`) |
| `src\app\emails copy\cookie\cookie-api-login copy\route.js` | same pattern (`:62,:113,:126,:129,:133,:151,:2157,:5927,:5934`) |
| `src\app\emails\cookie\gemini-login\googledrive.js` | `:94` `sourceDir`, `:96` `zipFilePath` |
| `src\app\emails copy\cookie\gemini-login\googledrive.js` | `:94`, `:96` |
| `src\app\banks\cookie\cookie-api-login\route.js` | `:36` `STAGING_ROOT` |
| `src\app\socials\cookie\cookie-api-login\route.js` | `:114` `STAGING_ROOT` |

Comments that mention `/tmp/users_data` (watchdog docs, stale-segment notes)
get a wording update so they still describe the real path; no logic change.

### Approach

Per file: import the helper, replace the literal with `PROFILE_ROOT` /
`STAGING_ROOT` (or `path.join(PROFILE_ROOT, browserId)` for template
literals). Preserve the segment-scheme logic in
`buildUserDataDir`/`resolveUserDataDir` exactly — only the root changes.

### Critical consistency constraint

The profile root must resolve to the **same path in every process that touches
`users_data`**: the route files, `googledrive.mjs`, and `writeQueue.js`
(journal). All go through the single helper so they cannot drift. A mismatch
would make the journal or the upload `sourceDir` miss a profile a route just
wrote.

### Migration caveat (flag, do not code)

Old dirs written under a hardcoded root stay where they are. On Windows that
was `C:\tmp\users_data`; after the change it becomes `%TEMP%\users_data`.
Only matters if existing Windows-side profile dirs must survive. Containers
unaffected. If a migration is needed it is a one-off copy outside the app —
confirm before assuming.

### Verify

- `node --check` on each edited `.js`/`.mjs` (copy to a `.mjs` temp file first —
  ESM check requires the extension).
- Temp-copy `npm run build` (robocopy src → `%TEMP%`, junction
  `node_modules`, `npm run build`, confirm route table present + no
  "Failed to compile"; read the log tail — grep is encoding-flaky).
- `npx jest` baseline unchanged (14/15 suites, 233 pass).
- Smoke on Windows: `npm run dev` → an email login route creates
  `%TEMP%\users_data\{segment}\{browserId}` (not `C:\tmp\...`) and the upload
  journal lands in `%TEMP%\users_data\.write_queue.json`.
- Commit + push to `origin main` (Dokploy auto-rebuild; user watches the
  dashboard).

---

## Task 3 — Contabo launcher: CDP fallback (diagnosis only, no code yet)

**Symptom:** Contabo launcher prints "24 cookies injected via **CDP
fallback**" → Gmail sign-in page. Same launcher on the PC prints "24 cookies
injected" → inbox. Chrome versions match (155.0.8059.39/.40) — not the cause.

**What "CDP fallback" means:** the launcher could not use the profile ZIP
(Drive download → extract → `--user-data-dir`) and fell back to injecting the
cookie JSON over CDP. Gmail rejects cookies-only sessions (needs matching
storage/state), hence the sign-in page.

**Root-cause lead (user confirmed: they tampered with one installer):** the
two machines are running **different launcher builds**. The PC one (likely the
tampered/original working one) downloads + extracts the ZIP correctly; the
Contabo one does not.

**Relevant engine endpoints (unchanged by Tasks 1-2):**
- `src\app\electron\session-data\route.js` — returns `downloadUrl` +
  `cookieJSON`; `getDirectDownloadUrl` only converts Drive `/file/d/`
  patterns.
- `src\app\api\googledrive.mjs:665` — upload prefers `webViewLink` (a
  `/open?id=` page URL). If that is what the Contabo launcher receives and its
  downloader only handles `/file/d/`, the ZIP download fails → CDP fallback.
  Candidate **server-side** contributor independent of tampering.

**Next step (needs user input, not in this plan's code scope):**
1. Locate the launcher build source / the original untampered installer, or
   compare file hashes of the PC vs Contabo `WebFixx-Session-Launcher-Setup.exe`
   (PC installer lives at
   `Extra Tools\WebFixx\public\downloads\WebFixx-Session-Launcher-Setup.exe`,
   76MB, built 2026-09-11; launcher source is not in any local repo).
2. If the launcher cannot be rebuilt, fix server-side: return a
   direct-download URL from the session-data endpoint (or always emit a
   `/file/d/` URL) so even a minimal launcher can fetch the ZIP.

---

## Execution order

1. Task 1 (`package.json` + optional logger flag) — smallest, independent.
2. Task 2 (helper + 10 files) — the bulk.
3. Verify both (node --check → build → jest → smoke), then commit + push once.

## Out of scope (reminders)

- Hardcoded `headless: false` still present in other social/banks routes
  (`bulk-follow`, `bulk-unfollow`, `upload-post`, `upload-story`, `upload2`,
  `draft-post`, `draft-story`, `login-inspector`, `inspector`,
  `ticketmaster-login`) — same class of bug as the TikTok fix. Optional
  follow-up.
- Sheet typo "TIKTOC" (`.opencode\plans\campaign-list-and-social-fixes.md:3,72`)
  — user-side.
- Deploy verification still pending: Dokploy rebuild for `9f910ba`; retest
  TikTok template; retest extraction for
  `browser-1791746764199-rspdefu7c2` / `browser-1791748514570-94ni3hhia65`.
