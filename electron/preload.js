const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNotes: () => ipcRenderer.invoke('get-notes'),
  readNote: (filename) => ipcRenderer.invoke('read-note', filename),
  writeNote: (filename, content) => ipcRenderer.invoke('write-note', filename, content),
  renameNote: (oldFilename, newFilename) => ipcRenderer.invoke('rename-note', oldFilename, newFilename),
  deleteNote: (filename) => ipcRenderer.invoke('delete-note', filename),
  
  // Encryption handlers
  encryptNote: (filename, password, content) => ipcRenderer.invoke('encrypt-note', filename, password, content),
  decryptNoteCheck: (filename, password) => ipcRenderer.invoke('decrypt-note-check', filename, password),
  decryptNote: (filename, password) => ipcRenderer.invoke('decrypt-note', filename, password),
  decryptAndSave: (filename, password, content) => ipcRenderer.invoke('decrypt-and-save', filename, password, content),
  decryptToPlain: (filename, password) => ipcRenderer.invoke('decrypt-to-plain', filename, password),
  onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', (event, state) => callback(state)),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // PDF sharing and folder shell access
  shareNotePdf: (title, html, theme) => ipcRenderer.invoke('share-note-pdf', title, html, theme),
  showItemInFolder: (path) => ipcRenderer.send('show-item-in-folder', path)
});
