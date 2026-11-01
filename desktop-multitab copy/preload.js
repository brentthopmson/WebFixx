const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSessionStatus: (callback) => {
    ipcRenderer.on('session-status', (_event, data) => callback(data));
  },
  onSessionLog: (callback) => {
    ipcRenderer.on('session-log', (_event, data) => callback(data));
  },
  closeApp: () => ipcRenderer.send('close-app'),
  closeWindow: () => ipcRenderer.send('close-app'),
  retrySession: () => ipcRenderer.send('retry-session'),
  retryLaunch: () => ipcRenderer.send('retry-session'),
});
