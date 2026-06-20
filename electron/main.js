const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;

// Initialize notes folder in the local project directory
const notesDir = path.join(process.cwd(), 'notes');
if (!fs.existsSync(notesDir)) {
  fs.mkdirSync(notesDir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundMaterial: 'acrylic', // Enable native Windows 11 Acrylic material
    titleBarOverlay: false,        // Hide native OS window controls overlay
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist', 'index.html'));
  }
  // Intercept window.open calls (e.g. target="_blank" links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Intercept standard in-page navigation link clicks
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  // Handle maximize/unmaximize events to adjust layouts in maximize mode
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: mainWindow.isMaximized() });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for Note CRUD & Cryptography ---

// 1. Scan notes directory
ipcMain.handle('get-notes', async () => {
  try {
    if (!fs.existsSync(notesDir)) {
      return [];
    }
    const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.agna'));
    return files.map(file => {
      const filePath = path.join(notesDir, file);
      const stats = fs.statSync(filePath);
      const ext = path.extname(file);
      const name = path.basename(file, ext);
      
      let preview = '';
      const isEncrypted = ext === '.agna';
      
      if (!isEncrypted) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          preview = content.slice(0, 80).replace(/\n/g, ' ');
        } catch (e) {}
      } else {
        preview = '••••••••'; // Masked preview for locked notes
      }
      
      return {
        filename: file,
        title: name,
        isEncrypted,
        preview,
        mtime: stats.mtimeMs
      };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch (e) {
    console.error('Error scanning notes:', e);
    return [];
  }
});

// 2. Read standard note
ipcMain.handle('read-note', async (event, filename) => {
  try {
    const filePath = path.join(notesDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  } catch (e) {
    console.error('Error reading note:', e);
    return '';
  }
});

// 3. Save standard note
ipcMain.handle('write-note', async (event, filename, content) => {
  try {
    const filePath = path.join(notesDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e) {
    console.error('Error writing note:', e);
    return { success: false, error: e.message };
  }
});

// 4. Rename note
ipcMain.handle('rename-note', async (event, oldFilename, newFilename) => {
  try {
    const oldPath = path.join(notesDir, oldFilename);
    const newPath = path.join(notesDir, newFilename);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (e) {
    console.error('Error renaming note:', e);
    return { success: false, error: e.message };
  }
});

// 5. Delete note
ipcMain.handle('delete-note', async (event, filename) => {
  try {
    const filePath = path.join(notesDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (e) {
    console.error('Error deleting note:', e);
    return { success: false, error: e.message };
  }
});

// --- Encryption Handlers (AES-256-GCM using native node crypto) ---

// Derives key from password
function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

// 6. Encrypt note (Converts plaintext note to .agna format)
ipcMain.handle('encrypt-note', async (event, filename, password, content) => {
  try {
    const oldPath = path.join(notesDir, filename);
    const title = path.basename(filename, path.extname(filename));
    const newFilename = `${title}.agna`;
    const newPath = path.join(notesDir, newFilename);
    
    // Cryptography setup
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // GCM standard IV is 12 bytes
    const key = deriveKey(password, salt);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(content, 'utf-8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const encryptedData = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext
    };
    
    fs.writeFileSync(newPath, JSON.stringify(encryptedData, null, 2), 'utf-8');
    
    // Delete the original plaintext file if it existed
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
    
    return { success: true, newFilename };
  } catch (e) {
    console.error('Error encrypting note:', e);
    return { success: false, error: e.message };
  }
});

// 7. Check if password can decrypt the note
ipcMain.handle('decrypt-note-check', async (event, filename, password) => {
  try {
    const filePath = path.join(notesDir, filename);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);
    
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    const key = deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    return { success: true };
  } catch (e) {
    // Decrypt failed (wrong password)
    return { success: false, error: 'Incorrect password' };
  }
});

// 8. Decrypt note in memory (returns contents, never saves decrypted to disk)
ipcMain.handle('decrypt-note', async (event, filename, password) => {
  try {
    const filePath = path.join(notesDir, filename);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);
    
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    const key = deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    return { success: true, content: decrypted };
  } catch (e) {
    return { success: false, error: 'Incorrect password' };
  }
});

// 9. Save changes to already encrypted .agna file
ipcMain.handle('decrypt-and-save', async (event, filename, password, newContent) => {
  try {
    const filePath = path.join(notesDir, filename);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    // Setup new cryptography parameters to prevent IV reuse (re-encrypt with new IV/salt)
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(password, salt);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(newContent, 'utf-8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const encryptedData = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext
    };
    
    fs.writeFileSync(filePath, JSON.stringify(encryptedData, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    console.error('Error saving encrypted note:', e);
    return { success: false, error: e.message };
  }
});

// 10. Decrypt and convert note back to plaintext standard Markdown .md
ipcMain.handle('decrypt-to-plain', async (event, filename, password) => {
  try {
    const oldPath = path.join(notesDir, filename);
    const title = path.basename(filename, path.extname(filename));
    const newFilename = `${title}.md`;
    const newPath = path.join(notesDir, newFilename);
    
    // Decrypt content
    const rawData = fs.readFileSync(oldPath, 'utf-8');
    const data = JSON.parse(rawData);
    
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    const key = deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    // Save plaintext file
    fs.writeFileSync(newPath, decrypted, 'utf-8');
    
    // Remove .agna encrypted file
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
    
    return { success: true, newFilename };
  } catch (e) {
    console.error('Error unlocking note:', e);
    return { success: false, error: 'Incorrect password' };
  }
});

// 11. PDF Share and Shell helpers
ipcMain.handle('share-note-pdf', async (event, title, html, theme) => {
  try {
    const cssPath = path.join(process.cwd(), 'src', 'index.css');
    let cssContent = '';
    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    }
    
    // Inject index.css stylesheet into printable document to match preview styling exactly
    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${cssContent}
          
          body {
            background-color: ${theme === 'dark' ? '#1c1c1e' : '#ffffff'} !important;
            color: ${theme === 'dark' ? '#ffffff' : '#000000'} !important;
            padding: 40px !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          
          .markdown-preview {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
          
          /* Print optimizations */
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body class="theme-${theme}">
        <div class="markdown-preview">
          ${html}
        </div>
      </body>
      </html>
    `;
    
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
    
    const data = await printWindow.webContents.printToPDF({
      marginType: 'custom',
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5
      },
      printBackground: true,
      pageSize: 'A4'
    });
    
    printWindow.close();
    
    const pdfDir = path.join(app.getPath('documents'), 'Agna');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    
    const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, ' ') || 'Note';
    const pdfPath = path.join(pdfDir, `${sanitizedTitle}.pdf`);
    fs.writeFileSync(pdfPath, data);
    
    // Copy the file path to clipboard using PowerShell on Windows
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      const escapedPath = pdfPath.replace(/'/g, "''");
      exec(`powershell -Command "Set-Clipboard -Path '${escapedPath}'"`);
    }
    
    return { success: true, pdfPath };
  } catch (err) {
    console.error('PDF generation failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('show-item-in-folder', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// Window control listeners
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
