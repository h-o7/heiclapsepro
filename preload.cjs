const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  convertHeic: (arrayBuffer, quality) => ipcRenderer.invoke('convert-heic', { arrayBuffer, quality }),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveFilesToDirectory: (directory, files) => ipcRenderer.invoke('save-files-to-directory', { directory, files }),
});
