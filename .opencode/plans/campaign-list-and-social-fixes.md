# Campaign list/NotFound/sort + social campaign write-path + TikTok run blockers

Approved scope: Phases A+B+C all at once. engagementMode derived from interaction types. TIKTOC sheet typo → user fixes manually.

## Root causes (verified with live probes)

1. Server data is fine — force-refreshed rr02 bundle contains all 13 campaigns incl. `CMP-27DC17F6`; `getCampaign` returns the row. Bug is client-side staleness.
2. `updateAppData(setAppData)` (campaign/page.tsx:375, :265) uses `forceRefresh=false` → served from 30s `_lastAppDataCache` (auth.ts:225) → overwrites the fresh auto-merge (auth.ts:685-707) with a pre-create bundle.
3. Detail page reads only appData (`[campaignId]/page.tsx:66-74`, effect :348-355); stale → "Campaign Not Found" (:390). No `getCampaign` fallback.
4. No sort in `transformCampaignData` (campaign/page.tsx:226).
5. `accounts=["[]"` ] bug: `objectToFormData` JSON-stringifies arrays; GAS comma-splits (CAMPAIGN.js:187-189) → `"[]".split(",")=["[]"]`. Non-empty arrays also corrupted. Hits rows 10/13/14.
6. `updateCampaign` replaces the whole settings cell (CAMPAIGN.js:563-578); `buildStrategyContext` omits accounts/platform/projectId/engagementMode → editing wipes them.
7. Social gaps on all 14 sheet rows: engagementMode missing (F1), platform="" (F6), settings.userId never written (F4 — engine quota execute-campaign/route.js:256,1052 no-ops), executeStaged never in create whitelist (F2).

## Phase A — WebFixx frontend

### A1. `utils/auth.ts` — updateAppData bypasses client cache
- `_fetchAppDataLite(token, forceRefresh, skipClientCache=false)`: skip `_lastAppDataCache` READ when `skipClientCache` (still write cache after fetch).
- `updateAppData` (:518) → `_fetchAppDataLite(token, forceRefresh, true)`.
- Effect: post-save reads Flask cache (recached/invalidated by the mutation itself at externalapis_handler.py:525-532) → fast + fresh. `getAppDataLite` fast path (auth.ts:656) keeps client cache → no 429 regression.
- campaign/page.tsx `handleRefreshData` (:265) → `updateAppData(setAppData, true)` (explicit refresh = full force, consistent with dashboard).

### A2. Detail page fallback (`app/campaign/[campaignId]/page.tsx`)
- Extract row→Campaign mapper from `findCampaign` (:66-139) into helper.
- Load effect (:348-355): if `findCampaign()` null → `getCampaign` via securedApi → build Campaign from `response.data` (flattened row: campaignId/context/createdOn/fileUrl/settings/sn/stats/status/type/updatedOn/userId — probe-verified) → setCampaign (+fetchCSV if fileUrl); only on failure → "Campaign Not Found".

### A3. Latest-first (`app/campaign/page.tsx`)
- After map in `transformCampaignData` (:222): sort by `created_at` DESC, tie-break `updated_at` DESC.

## Phase B — write-path + social content

### B4. accountIds transport
- frontend campaign/page.tsx:360 → `accountIds: (newCampaign.accounts || []).join(',')`.
- GAS CAMPAIGN.js normalize (:186-190): if string starts with `[` → JSON.parse to array; else comma-split; then filter junk (`id && !id.startsWith('[') && !id.startsWith('"')`).

### B5. updateCampaign merge (F3)
- GAS CAMPAIGN.js:563-578 → parse existing settings cell, `{...existing, ...JSON.parse(incoming)}`, write merged.
- buildStrategyContext (campaign/page.tsx:273-311) → add `accounts`, `platform`, `projectId`, `engagementMode` (create path picks fields explicitly, extras harmless).

### B6. social producers
- `engagementMode: ((campaign.socialInteractionTypes || []).length > 0)` in buildStrategyContext (derived — user choice).
- platform: CampaignModal onSave (:1525 draft, :1563 running) → derive from first selected account's `type` in accountsList (lowercase: tiktok/twitter/instagram/facebook/whatsapp…) → formData.platform.
- GAS CAMPAIGN.js settingsData (:240-296): add `executeStaged: parsedStrategy.executeStaged ?? true`, `engagementMode: parsedStrategy.engagementMode === true`, `userId: params.userId || ''` (frontend already sends userId at :363).

### B7. validation (`app/utils/campaignValidators.ts:338-342`)
- Social branch: add `socialKeywords.length > 0 || fileUrl` requirement (engine throws at execute-campaign:864-866 on empty keywords).

## Phase C — engine TikTok blockers

### C8. F6 platform resolution (`src/app/campaign/execute-campaign/route.js`)
- `getSocialProfileCookies` (:165-191): platform chain = cookie row category/platform (if non-empty) → hub row `type` (lookup by profileId=submissionId) → `""`.
- Call site (:920): `platform = profileData.platform || settings.platform || "twitter"`.

### C9. F5 verify-session TikTok (`src/app/socials/verify-session/route.js` — LinkedIn-only today)
- Accept `body.platform`; dispatch: `linkedin` → existing; `tiktok` → load `https://www.tiktok.com/` with cookies, logged-in detection via real TikTok `data-e2e` indicators (+ content heuristics fallback); else generic.
- Caller chain: dashboard `handleVerify` (dashboard/page.tsx:353) derive platform from `item.type` or first `socials[].platform` → `authApi.verifySession(browserId, category, platform)` (auth.ts:492) → GAS `verifySession` forwards platform to engine (locate GAS fn during impl; also check `verify-social-login-lite` target).

### C10. F8 TikTok search-interact selectors (`src/app/socials/search-interact/platforms.js:198-209`)
- Replace synthetic `data-testid` selectors with real TikTok `data-e2e` selectors (search input, like, comment, comment box, comment submit, close). Replace `button:has-text('Send')` (Playwright-only) with Puppeteer-compatible selector. Config-only — existing workflows reference `${selectors.*}`.

### C11. Intake stamping (cookie-api-login route.js final sheet update)
- Add `updateData.platform = platform` (and `category` if column exists) on login completion so cookie rows stop being platform-empty.

## Verification
1. WebFixx: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Engine: build via temp copy + junctioned node_modules (established pattern); GAS: syntax check.
3. Probe scripts (read-only sheet reads): fresh bundle contains new campaign; create ONE test social draft → inspect settings contents (accounts/platform/engagementMode/userId/executeStaged) → delete after.
4. Manual: create social draft → appears FIRST in list; detail opens (no Not Found); Continue Setup round-trip preserves accounts/platform; sort matches createdOn DESC.
5. Commit + push all three repos; Dokploy redeploy (rides along pending UpgradePlanModal fix).

## Out of scope / deferred
- TIKTOC→TIKTOK sheet typo (user fixes manually).
- F9 single-run UI, F10/F11.
- Old corrupted `["[]""] rows (drafts; re-save via Continue Setup after fix rewrites accounts).

## Conventions / environment
- Probe pattern: PS here-string `$js = @' … '@; node -e $js`, workdir = engine dir (googleapis), no `"` inside JS (use \x22), wrap in `(async()=>{})()`.
- Engine read-only probes vs repo edits; `.env` values never logged; secrets via raw.web||raw + GOOGLE_DRIVE_REFRESH_TOKEN.
- no clasp-push; deploy via Dokploy env/redeploy only when asked (part of this plan's step 5).
