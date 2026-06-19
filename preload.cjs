const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  convertHeic: (arrayBuffer, quality) => ipcRenderer.invoke('convert-heic', { arrayBuffer, quality }),
});
