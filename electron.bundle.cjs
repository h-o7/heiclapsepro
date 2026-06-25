// electron.cjs
var { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
var path = require("path");
var fs = require("fs");
var os = require("os");
var { exec } = require("child_process");
var { promisify } = require("util");
var convert = require("heic-convert");
var execPromise = promisify(exec);
ipcMain.handle("convert-heic", async (event, { arrayBuffer, quality }) => {
  const inputBuffer = Buffer.from(arrayBuffer);
  const qVal = typeof quality === "number" ? quality : 0.85;
  if (process.platform === "darwin") {
    const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}_${Math.random().toString(36).substring(7)}.heic`);
    const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
    try {
      await fs.promises.writeFile(tempInputPath, inputBuffer);
      const sipsQuality = Math.round(qVal * 100);
      await execPromise(`sips -s format jpeg -s formatOptions ${sipsQuality} "${tempInputPath}" --out "${tempOutputPath}"`);
      const resultBuffer = await fs.promises.readFile(tempOutputPath);
      fs.promises.unlink(tempInputPath).catch(() => {
      });
      fs.promises.unlink(tempOutputPath).catch(() => {
      });
      return new Uint8Array(resultBuffer);
    } catch (sipsErr) {
      console.warn("macOS native sips conversion failed, falling back to node heic-convert library...", sipsErr);
      fs.promises.unlink(tempInputPath).catch(() => {
      });
      fs.promises.unlink(tempOutputPath).catch(() => {
      });
    }
  }
  try {
    const outputBuffer = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: qVal
    });
    return new Uint8Array(outputBuffer);
  } catch (err) {
    console.error("Electron main process HEIC conversion failed:", err);
    throw new Error(err?.message || String(err));
  }
});
ipcMain.handle("select-directory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Export Directory",
    buttonLabel: "Select Folder",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});
ipcMain.handle("save-files-to-directory", async (event, { directory, files }) => {
  try {
    for (const file of files) {
      const filePath = path.join(directory, file.name);
      const buffer = Buffer.from(file.arrayBuffer);
      await fs.promises.writeFile(filePath, buffer);
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to save files natively:", err);
    return { success: false, error: err?.message || String(err) };
  }
});
var mainWindow = null;
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
      preload: path.join(__dirname, "preload.cjs")
    },
    autoHideMenuBar: true
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_DEV_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.enableSandbox();
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
