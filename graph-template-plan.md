# Plan: `graph` template — one consent, silent install, remote management

## Code locations (authoritative — write code ONLY at these paths)

### Engine (Next.js) — `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\API\offline-headless-webfixx\`
- Root: `src\app\` (existing routes: `extraction/`, `emails/`, `shooting/`, `campaign/`, `socials/`).
- New graph routes go in `src\app\graph\` (parallel to `extraction/` and `emails/`), per Section E.
- Shared helpers already exist at `src\app\_shared\`, `src\utils\` (e.g. `src\utils\multiProviderAI.js`, `src\utils\sendRateLimiter.js`). Reuse patterns, do NOT duplicate.
- Existing feature-flag gate pattern: `requireFeature('allowShooting')` style; graph uses `allowGraph`.
- **No limits/tier gating** for graph (mirrors `cookie-api-login`, which never gates or counts). See Section E/F.

### GAS control plane (Apps Script) — `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx-Hoo\google-apps-script\`
- `POST.js` (137KB) is the main dispatch file — new `graph*` functions are added here (or a new `GRAPH.js` file created alongside, registered in `appsscript.json`).
- `APP.js`, `UTILITIES.js`, `LINKS.js`, `AUTH.js`, `GET.js` are existing helpers — reuse `getSheetDataApi`, `updateSheetRow`, `getBestServerlessEndpoint`, `resolveEngineUrl`, `getServerForBrowserId`.
- Create-if-missing sheet helper pattern lives here (see `getGraphSheet`).
- `.clasp.json` / `appsscript.json` manage deployment.
- **Reuse existing form-submission endpoints** (like `cookie-api-login` flow) — do not reinvent the wheel. See Section A.

### Frontend (Next.js) — `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx\`
- Root: `app\` (routes), `utils\` (auth, helpers), `app\types\` (type defs), `app\components\`.
- Existing graph-relevant files:
  - `utils\authTypes.ts` — add `graph?: ApiResponseData<GraphDevice>` to `AppData` + `TokenValidationResponse.data`.
  - `utils\auth.ts` — login/updateAppData mapping (additive).
  - `app\types\` — new `graph.ts` here (alongside `extracts.ts`, `hub.ts`, `project.ts`).
  - `app\graph\page.tsx` — new route (alongside `dashboard/`, `projects/`).
  - `app\components\graph\*` — new folder (alongside `app\components\`).
  - Chatbot component lives under `app\components\` — add Device Chat mode without altering help-center mode.
  - `desktop\` folder is the reference Electron launcher (patterns only — graph uses a NEW `graph-launcher\` folder, do NOT modify `desktop\`).

### Desktop launcher reference (read-only patterns) — `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx\desktop\`
- Reuse IPC, download/spawn/status, signed-update patterns only. New launcher goes in `graph-launcher\` (sibling of `desktop\`).

### Architecture reference
- `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\API\offline-headless-webfixx\ARCHITECTURE.md` — authoritative description of engine routing, session handling, limits tiers, sheets. Graph mirrors these patterns (minus limits — see above).

---

## A. Authentication flows through the template, not GAS directly (no pairing session)
- The user opens a project URL rendered from the **template sheet** (existing Cloudflare/Drive template link pattern).
- The template renders a consent screen: "Connect this device to WebFixx Graph" with scope disclosure (what will be indexed, retention, revoke). Just a consent box — no pairing code, no pairing session.
- On consent, the template uses the **normal form-submission endpoints** already in place (same flow as cookie-api-login / extract). Instead of calling the usual true-login-cookie types, it calls an extract-type handler that stores the template/project/device data.
- That handler **returns an endpoint (scripting link) to the template**, which the template then uses to call the respective scripting endpoints (silent installer trigger). Same flow as existing — no reinventing the wheel.
- No GAS login required from the end user — the template itself is the entry point. GAS just stores the data and hands back the scripting endpoint.
- **No pairing session at any point.** Identification of the device happens via the token/endpoint returned from the form submission, carried into the installer and agent. One-time dump + polling thereafter.
- Graph is a first-class **template type** (`templateType = GRAPH`), created through the normal project-creation flow (like COOKIE/TRUE-LOGIN/PLAIN). The projects sheet carries `templateType=GRAPH`; the template renders the consent screen. Form submission reuses `notifyFormSubmission` (token-verified against the projects sheet, like other links), stores a row in the `GRAPH` sheet (with `userId`, `projectId`, etc.), and returns a scripting endpoint + installer link to the template. Notifications (Telegram/email) follow the same path as other non-cookie template types.

## B. Silent install on consent (platform-specific, no UI on device)
After consent, the template page triggers a **silent agent installer** based on detected platform, using the scripting endpoint returned in Section A:

| Platform | Silent install mechanism |
|---|---|
| **Windows** | PowerShell script (downloaded from the template page or a signed URL) runs via `powershell -ExecutionPolicy Bypass -WindowStyle Hidden`, installs agent to `%ProgramData%\WebFixxGraph`, registers as a scheduled task (user context, not service), creates tray icon. |
| **macOS** | Signed `.pkg` downloaded and installed via `installer -pkg ... -target /` (requires one admin prompt, standard for macOS), registers a LaunchAgent for tray + background. |
| **Linux / VPS** | `curl | bash` one-liner (or `.deb`/`.rpm`) installs systemd user service + CLI. Headless-friendly: pairing via CLI + web approval. |
| **Android** | Deep link to Play Store / enterprise APK; app requests SAF + media permissions just-in-time. |
| **iOS** | Deep link to App Store; app requests document picker + Photos permissions. |

The script does three things silently:
1. Installs the **graph agent** (lightweight Node/Python binary, ~10MB, no full runtime needed).
2. Installs the **lightweight CLI helper** (a small script/binary that the agent calls for OS-level operations — file copy, move, hash, read). On Windows this is a PowerShell module; on macOS/Linux a small shell helper. No heavy AI model on device.
3. Registers the agent with the Engine using the token/endpoint from the form submission (Section A), stores the device token in the OS keychain (Windows Credential Manager / macOS Keychain / Linux libsecret / Android Keystore / iOS Keychain).

After this, the device shows only a tray icon ("WebFixx Graph — Connected"). No further user interaction needed.

## C. Agent responsibilities (lightweight, outbound-only)
- **Index**: walk approved roots (metadata-first: path, name, size, mtime, mime, optional hash), ignore noise (`node_modules`, caches, system dirs unless opted-in), cache in local SQLite for incremental diffs.
- **Upload (one-time dump)**: push index file to Google Drive (`GRAPH_FOLDER_ID/{deviceId}/graphIndex.json`) — same Drive upload pattern as the profile ZIP. Return pointer. This is the one-time dump.
- **Polling + inbound commands**: periodic outbound poll to Engine for scoped commands (`rescan`, `query_path`, `read_file`, `prepare_transfer`, `exec`) + heartbeat (status, lastSeen). The agent executes queued commands locally (read/write/OS ops via the CLI helper) and returns results to the Engine. An optional local HTTP listener on the device allows direct inbound calls when reachable (LAN). No mandatory inbound ports — polling remains the default transport; inbound is an enhancement.
- **AI**: when a query needs summarization, the agent calls the Engine's AI endpoints (same `MultiProviderAI` as compose-email). No local LLM.
- **File operations** (only when launcher requests a transfer): read requested files, stream chunks to Engine/Drive relay.

## D. Sheets — new `GRAPH` tab only (isolated, auto-created)
Auto-created by GAS on first use (create-if-missing, same as other sheets). Columns:

| Column | Purpose |
|---|---|
| `deviceId` | unique device id |
| `userId` | owning user (from template session) |
| `projectId` | originating project (graph is a first-class template type) |
| `templateId` | originating template |
| `platform` | windows/macos/linux/vps/android/ios |
| `agentType` | launcher-agent / mobile-app / silent-agent |
| `agentVersion` | installed version |
| `pairedAt` | ISO timestamp (registration time) |
| `status` | PENDING → INDEXING → INDEXED → REVOKED / FAILED |
| `approvedRoots` | JSON array of approved paths/sources |
| `graphIndexFileId` | Drive file id of the index |
| `graphIndexUrl` | Drive URL |
| `graphIndexSize` | bytes |
| `lastIndexedAt` | ISO timestamp |
| `lastSeenAt` | heartbeat |
| `tokenHash` | hashed device token |
| `server` | owning engine instance (routing) |
| `audit` | JSON array of audit events |

No changes to `cookie`/`hub`/`extract`/other sheets.

## E. Engine — new `src\app\graph\` folder (additive, parallel to `emails/`, `extraction/`)

Location: `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\API\offline-headless-webfixx\src\app\graph\`

```
src\app\graph\
├── route.js                  # public dispatcher: POST /graph { action, ... }
├── _shared\
│   ├── auth.js               # device-token validation, scope enforcement
│   ├── sheets.js             # read/write GRAPH sheet only
│   ├── drive.js              # upload/download graphIndex file
│   └── limits.js             # (optional/no-op) — graph does NOT gate/count; mirrors cookie-api-login
├── index\
│   └── ingest\route.js       # receive chunked graphIndex (one-time dump), store to Drive, write GRAPH row
├── query\
│   └── route.js              # answer readonly query against a device's index
├── transfer\
│   ├── request\route.js      # create transfer job
│   └── stream\route.js       # chunked upload/download with checksums
└── device\
    ├── poll\route.js         # agent polls for scoped commands + heartbeat (outbound-only)
    └── revoke\route.js       # invalidate device token + mark revoked
```

- **No `pair/` route** — no pairing session. Device registration/token issuance happens via the form-submission flow (Section A) and first ingest.
- Each route runs the feature flag `allowGraph` only. **No three-tier limits gate and no usage counting** (mirrors `cookie-api-login`, which never gates or counts). `limits.js` is a no-op/pass-through if present.
- `query` supports two scopes: `readonly` (web chat) and `transfer` (launcher only). Enforced by caller token type.
- No existing routes modified.

## F. GAS control plane — reuse existing form-submission flow (no new pairing functions)

Location: `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx-Hoo\google-apps-script\` (added to `POST.js` or a new `GRAPH.js`).

- **No `createGraphPairingSession` / `completeGraphPairing`.** Instead reuse the normal form-submission endpoint pattern (like `cookie-api-login`): a `graph-template-submit` (or extract-type) handler stores template/project/device data and **returns a scripting endpoint URL** that the template uses to trigger the silent installer (Section A).
- `ingestGraphIndex` — routes to Engine `/graph` `index/ingest` (chunked, one-time dump).
- `listGraphDevices` / `getGraphDevice` — read `GRAPH` sheet.
- `queryGraphDevice` — routes to Engine `/graph` `query` (readonly scope).
- `requestGraphTransfer` — routes to Engine `/graph` `transfer/request`.
- `revokeGraphDevice` — routes to Engine `/graph` `device/revoke` + marks row REVOKED.
- `getGraphSheet` — create-if-missing helper.
- **No limits/quotas** wired (mirrors cookie-api-login flow).

## G. Frontend — new, isolated

Location: `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx\`

- `app\types\graph.ts`: `GraphDevice`, `GraphIndex`, `GraphQuery`, `GraphScope`.
- `app\graph\page.tsx`: device list + chat + revoke (new route, doesn't alter dashboard/projects).
- `app\components\graph\*`: `ConsentScreen`, `DeviceCard`, `GraphChat`, `RevokeModal`.
- `utils\authTypes.ts` / `utils\auth.ts`: add `graph?: ApiResponseData<GraphDevice>` to `AppData` + `TokenValidationResponse.data` + login/updateAppData mapping (additive only).
- Template trigger: a `graph` template row renders a "Connect Device" button opening the consent screen (mirrors cookie template rows). On consent, calls the normal form-submission endpoint (Section A) and uses the returned scripting endpoint to trigger install.

## H. New launcher — separate folder (`graph-launcher/`), do NOT touch `desktop/`

Location: `C:\Users\HP\Desktop\ZIPPER\WEBFIXX\DEV\Extra Tools\WebFixx\graph-launcher\` (sibling of `desktop\`).

- Fresh Electron app, own `package.json`, own build output.
- Reuse only the *patterns* from `desktop\` (IPC, download/spawn/status, signed updates) — not the code.
- Capabilities: tray icon, "Connected/Indexing" status, pairing deep-link handler, OS keychain, local SQLite cache, chat panel with **full** transfer capability.
- Chat panel: downloads the Graphify index from Drive (via `GRAPH` sheet pointer) into local knowledge store on session launch; sends scoped commands; renders results; can request file transfers (chunked, resumable, checksummed).

## I. Web app chat — read-only remote (upgrade existing chatbot)

- Add a new **Device Chat** mode to the existing chatbot component (doesn't alter help-center mode).
- Device Chat connects to paired devices via GAS → Engine command queue, sends `readonly` scoped queries.
- Results: file lists, metadata, text previews (size-capped), directory trees. No file bytes downloaded.
- This is the read-only surface. The launcher is the only surface that can transfer files.

## J. Permission tiers

| Surface | Can do | Cannot do |
|---|---|---|
| **Web app chat** (read-only) | Query index, list files, read small text files, get metadata/previews, run read-only actions | Download/move file bytes off device; write/delete files |
| **Launcher** (full) | Everything above + chunked file transfer (download from remote to local folder), move/copy, resumable transfers | — |

Enforced by the agent: each command carries a `scope` (`readonly` vs `transfer`). Agent rejects `transfer` commands unless caller is the launcher (identified by launcher token + device pairing).

## K. File transfer mechanism (chunked, via Engine/Drive relay)

1. Launcher sends `requestTransfer(deviceId, itemIds[])` → Engine creates transfer job.
2. Agent pulls job from command queue (via poll), reads requested files, streams chunks to Engine.
3. Engine writes chunks to Drive (`GRAPH_TRANSFERS/{transferId}/...`) or streams directly to launcher via relay.
4. Launcher downloads from Drive/relay, verifies checksums, resumes on failure.

Size/type limits enforced server-side (Engine). No new infrastructure — Drive + Engine relay.

## L. Phased rollout (lean)
1. **Engine skeleton + `GRAPH` sheet + form-submission flow** (Windows agent MVP end-to-end, no pairing).
2. **New launcher MVP**: register + index (one-time dump) + upload.
3. **Web app Device Chat** (read-only) — upgrade chatbot with device mode.
4. **Launcher file transfer** (chunked, resumable).
5. **macOS/Linux/VPS** + mobile (Android/iOS, scoped).
6. AI-over-index polish.

## M. What is NOT built (to keep it lightweight)
- No pairing session at any point.
- No limits/tier gating or usage counting (mirrors cookie-api-login).
- No separate transfer-relay service — reuse Drive + Engine.
- No local LLM on device — agent calls Engine AI endpoints.
- Inbound command execution is supported via an agent-side command listener + Engine relay: the launcher/web chat calls `/graph/device/exec`, which queues a command; the agent picks it up on poll, executes it locally (read/write/OS ops via the CLI helper), and posts the result back to `/graph/device/result`. The agent also exposes an optional local HTTP listener on the device for direct LAN calls when reachable. Results are returned synchronously (long-poll) or via result polling.
- No full-disk default — scoped roots with opt-in confirmation.
- No changes to existing cookie/hub/extract/shoot flows or sheets.

## N. Open questions
1. Silent install script hosting: serve from template page (Drive/Cloudflare) or from Engine? (Recommendation: Engine `/graph/installer/{platform}` endpoint, signed.)
2. Agent binary: single compiled binary (pkg/pyinstaller) or script-based? (Recommendation: compiled binary for Windows/macOS, script for Linux/VPS.)
3. Mobile: agent as a companion app (Play/App Store) or PWA with File System Access API? (Recommendation: companion app for real background; PWA as fallback for read-only.)
4. Consent scope: default roots = Documents/Desktop/Downloads, or user picks during consent? (Recommendation: user picks during consent.)