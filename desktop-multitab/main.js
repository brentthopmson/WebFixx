const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const extractZip = require('extract-zip');
const WebSocket = require('ws');

let API_BASE = 'https://webfixx-hoo-oamupo-e98ced-157-173-204-24.sslip.io/api';
const SESSION_DIR = path.join(app.getPath('temp'), 'webfixx-sessions');
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
    width: 480,
    height: 320,
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

async function launchSession(browserId, token) {
  lastSessionParams = { browserId, token };
  let chromeProcess = null;
  let wsClient = null;

  try {
    sendStatus('connecting', 'Validating session...');

    const validateRes = await fetch(`${API_BASE}/electron/session-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserId, token }),
    });

    if (!validateRes.ok) {
      const err = await validateRes.json();
      sendStatus('error', err.error || 'Failed to get session data');
      return;
    }

    const { downloadUrl, platformUrl, platformUrls, email, domain, cookieJSON, accountCookieJSON, driveCookieJSON, browserIdentity } = await validateRes.json();

    if (!downloadUrl) {
      sendStatus('error', 'No saved browser profile found for this session');
      return;
    }

    const destDir = path.join(SESSION_DIR, browserId);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const zipPath = path.join(SESSION_DIR, `${browserId}.zip`);
    sendStatus('downloading', 'Starting download...');

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

    try {
      await extractZip(zipPath, { dir: destDir });
    } catch (extractErr) {
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
    fs.unlinkSync(zipPath);

    const browser = findBrowser();
    if (!browser) {
      sendStatus('error', 'No supported browser found (Chrome, Edge, or Brave)');
      return;
    }

    if (cookieJSON && cookieJSON.length > 0) {
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
        '--remote-debugging-port=0',
        'about:blank',
      ];

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

        for (let i = 0; i < 20; i++) {
          try {
            const resp = await fetch(`${httpBase}/json`);
            const targets = await resp.json();
            const page = targets.find(t => t.type === 'page');
            if (page && page.webSocketDebuggerUrl) {
              pageWsUrl = page.webSocketDebuggerUrl;
              break;
            }
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

        let msgId = 1;
        const sendCDP = (method, params = {}) => {
          return new Promise((resolve, reject) => {
            const id = msgId++;
            const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000);
            const handler = (data) => {
              const msg = JSON.parse(data.toString());
              if (msg.id === id) {
                clearTimeout(timeout);
                wsClient.off('message', handler);
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
              }
            };
            wsClient.on('message', handler);
            wsClient.send(JSON.stringify({ id, method, params }));
          });
        };

        await sendCDP('Network.enable');

        // Combine all cookies across all tabs (cookieJSON + accountCookieJSON + driveCookieJSON)
        const allCookiesToInject = [];
        const seenCookies = new Set();
        const appendCookies = (list) => {
          if (Array.isArray(list)) {
            for (const c of list) {
              if (!c || !c.name) continue;
              const k = `${c.name}|${c.domain || ''}|${c.path || '/'}`;
              if (!seenCookies.has(k)) {
                seenCookies.add(k);
                allCookiesToInject.push(c);
              }
            }
          }
        };
        appendCookies(cookieJSON);
        appendCookies(accountCookieJSON);
        appendCookies(driveCookieJSON);

        let cookiesSet = 0;
        let cookiesFailed = 0;
        for (const cookie of allCookiesToInject) {
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

          try {
            const result = await sendCDP('Network.setCookie', cdpCookie);
            if (result && result.success) cookiesSet++;
            else cookiesFailed++;
          } catch (e) {
            cookiesFailed++;
          }
        }

        // Determine all target URLs to automatically open in Chrome
        let targetUrls = [];
        if (Array.isArray(platformUrls) && platformUrls.length > 0) {
          targetUrls = platformUrls;
        } else if (domain && (domain.includes('google') || domain.includes('gmail'))) {
          targetUrls = [
            'https://mail.google.com/mail/u/0/#inbox',
            'https://myaccount.google.com/payments-and-subscriptions?utm_source=OGB&utm_medium=app',
            'https://drive.google.com/drive/u/0/home'
          ];
        } else if (platformUrl) {
          targetUrls = [platformUrl];
        } else {
          targetUrls = ['about:blank'];
        }

        // Tab 1: Navigate existing page
        sendStatus('launching', `Opening Tab 1/3 (Gmail Inbox) in ${browser.name}...`);
        await sendCDP('Page.navigate', { url: targetUrls[0] });

        // Tabs 2+: Automatically open in new tabs via CDP Target.createTarget
        for (let i = 1; i < targetUrls.length; i++) {
          const tabUrl = targetUrls[i];
          const tabLabel = tabUrl.includes('payments-and-subscriptions') ? 'Wallet & Subscriptions' : (tabUrl.includes('drive.google.com') ? 'Google Drive' : `Tab ${i + 1}`);
          sendStatus('launching', `Opening Tab ${i + 1}/${targetUrls.length} (${tabLabel})...`);
          try {
            await sendCDP('Target.createTarget', { url: tabUrl });
            await sleep(1000);
          } catch (tabErr) {
            console.error(`Failed to create tab ${tabUrl}: ${tabErr.message}`);
          }
        }

        await sleep(3000);

        if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
        wsClient = null;

        if (chromeProcess) {
          chromeProcess.unref();
          chromeProcess = null;
        }

        sendStatus('success', `Session opened in ${browser.name}! (${cookiesSet} cookies injected)`);
    } else {
      sendStatus('launching', `Opening ${domain || 'session'} in ${browser.name}...`);

      const chromeArgs = [
        `--user-data-dir=${destDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
      ];

      let fallbackUrls = (Array.isArray(platformUrls) && platformUrls.length > 0) ? platformUrls : (platformUrl ? [platformUrl] : []);
      if (fallbackUrls.length === 0 && domain && (domain.includes('google') || domain.includes('gmail'))) {
        fallbackUrls = [
          'https://mail.google.com/mail/u/0/#inbox',
          'https://myaccount.google.com/payments-and-subscriptions?utm_source=OGB&utm_medium=app',
          'https://drive.google.com/drive/u/0/home'
        ];
      }
      for (const u of fallbackUrls) {
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
    if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
    if (chromeProcess) chromeProcess.kill();
  }
}

function parseProtocolUrl(url) {
  try {
    const parsed = new URL(url);
    const browserId = parsed.searchParams.get('browserId');
    const token = parsed.searchParams.get('token');
    const api = parsed.searchParams.get('api');
    if (api) API_BASE = decodeURIComponent(api);
    return { browserId, token };
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
    const url = argv.find((a) => a.startsWith('webfixx-multi://') || a.startsWith('webfixx://'));
    if (url) {
      const params = parseProtocolUrl(url);
      if (params && params.browserId && params.token) {
        launchSession(params.browserId, params.token);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    mainWindow.webContents.on('did-finish-load', () => {
      const url = process.argv.find((a) => a.startsWith('webfixx-multi://') || a.startsWith('webfixx://'));
      if (url) {
        const params = parseProtocolUrl(url);
        if (params && params.browserId && params.token) {
          launchSession(params.browserId, params.token);
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

ipcMain.on('close-app', () => {
  if (downloadAbortController) downloadAbortController.abort();
  app.quit();
});

ipcMain.on('retry-session', () => {
  if (lastSessionParams) {
    launchSession(lastSessionParams.browserId, lastSessionParams.token);
  }
});
