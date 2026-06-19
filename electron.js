import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import convert from 'heic-convert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

// Register IPC handler to convert HEIC images natively
ipcMain.handle('convert-heic', async (event, { arrayBuffer, quality }) => {
  const inputBuffer = Buffer.from(arrayBuffer);
  const qVal = typeof quality === 'number' ? quality : 0.85;

  // 1. Try macOS native 'sips' converter if running on macOS for GPU-level color profile and HDR decoding
  if (process.platform === 'darwin') {
    const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}_${Math.random().toString(36).substring(7)}.heic`);
    const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);

    try {
      await fs.promises.writeFile(tempInputPath, inputBuffer);
      const sipsQuality = Math.round(qVal * 100);
      
      // Use sips to natively convert HEIC to JPEG
      await execPromise(`sips -s format jpeg -s formatOptions ${sipsQuality} "${tempInputPath}" --out "${tempOutputPath}"`);
      const resultBuffer = await fs.promises.readFile(tempOutputPath);

      // Clean up temp files asynchronously
      fs.promises.unlink(tempInputPath).catch(() => {});
      fs.promises.unlink(tempOutputPath).catch(() => {});

      return new Uint8Array(resultBuffer);
    } catch (sipsErr) {
      console.warn('macOS native sips conversion failed, falling back to node heic-convert library...', sipsErr);
      // Clean up temp files if created
      fs.promises.unlink(tempInputPath).catch(() => {});
      fs.promises.unlink(tempOutputPath).catch(() => {});
    }
  }

  // 2. Fallback to heic-convert library inside Node.js 64-bit environment (unbound by browser memory restrictions)
  try {
    const outputBuffer = await convert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: qVal
    });
    return new Uint8Array(outputBuffer);
  } catch (err) {
    console.error('Electron main process HEIC conversion failed:', err);
    throw new Error(err?.message || String(err));
  }
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "Chronos Pro Studio",
    backgroundColor: "#f8fafc",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
  });

  // Load from Vite dev server during development, or static dist folder in production
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_DEV_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    // Open the DevTools automatically in development mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Open external links in default external web browser instead of opening in Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Enable sandboxing globally for best security practice
app.enableSandbox();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
