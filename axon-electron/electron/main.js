const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const path = require("node:path");
const { createSettingsStore } = require("./settingsStore");

const isDev = process.env.AXON_ELECTRON_DEV === "1" || !app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof createSettingsStore> | null} */
let store = null;

function getVoiceBackendUrl() {
  return (
    process.env.AXON_VOICE_BACKEND_URL ||
    store?.get("voiceBackendUrl") ||
    "http://127.0.0.1:8010"
  );
}

function resolveStartUrl() {
  if (isDev) {
    return process.env.AXON_DEV_URL || "http://127.0.0.1:5173";
  }
  return path.join(__dirname, "../../axon-frontend/dist/index.html");
}

function createWindow() {
  const kiosk = store.get("kiosk") !== false;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: kiosk,
    kiosk: kiosk && !isDev,
    autoHideMenuBar: true,
    backgroundColor: "#050508",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  const startUrl = resolveStartUrl();
  if (startUrl.startsWith("http")) {
    mainWindow.loadURL(startUrl);
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    mainWindow.loadFile(startUrl);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function applyAutoLaunch(enabled) {
  if (process.platform === "linux" && !app.isPackaged) {
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: isDev ? [path.resolve(__dirname, "..")] : [],
  });
}

app.whenReady().then(() => {
  store = createSettingsStore();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "geolocation" || permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });

  applyAutoLaunch(Boolean(store.get("autoLaunch")));

  ipcMain.handle("axon-shell:is-electron", () => true);
  ipcMain.handle("axon-shell:is-kiosk", () => Boolean(store.get("kiosk")));
  ipcMain.handle("axon-shell:set-kiosk", (_event, enabled) => {
    store.set("kiosk", Boolean(enabled));
    if (mainWindow) {
      mainWindow.setKiosk(Boolean(enabled) && !isDev);
      mainWindow.setFullScreen(Boolean(enabled));
    }
  });
  ipcMain.handle("axon-shell:get-auto-launch", () => Boolean(store.get("autoLaunch")));
  ipcMain.handle("axon-shell:set-auto-launch", (_event, enabled) => {
    store.set("autoLaunch", Boolean(enabled));
    applyAutoLaunch(Boolean(enabled));
    return Boolean(store.get("autoLaunch"));
  });
  ipcMain.handle("axon-voice:get-backend-url", () => getVoiceBackendUrl());
  ipcMain.handle("axon-voice:is-native", () => true);

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

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("[axon-electron] uncaughtException", error);
});
