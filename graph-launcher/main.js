const { app, BrowserWindow } = require('electron');

let win = null;

function createWindow() {
  win = new BrowserWindow({ width: 900, height: 700, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadURL('data:text/html,<h1>WebFixx Graph Launcher</h1><p>Connected.</p>');
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => { app.quit(); });