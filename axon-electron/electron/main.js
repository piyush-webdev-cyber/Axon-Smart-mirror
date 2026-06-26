const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const os = require("node:os");
const path = require("node:path");
const { createSettingsStore } = require("./settingsStore");
const { startVoiceServer, stopVoiceServer } = require("./voiceServer");

const isDev = process.env.AXON_ELECTRON_DEV === "1" || !app.isPackaged;

function getLanOrigin(port = 5173) {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }
  return null;
}

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

  mainWindow.webContents.on("did-finish-load", () => {
    const lan = isDev ? getLanOrigin(Number(process.env.AXON_VITE_PORT || 5173)) : null;
    if (lan) {
      void mainWindow?.webContents.executeJavaScript(
        `window.__AXON_LAN_ORIGIN__ = ${JSON.stringify(lan)};`,
      );
    }
    void mainWindow?.webContents.executeJavaScript(`
      (async () => {
        try {
          if (typeof window.__axonUnlockVoiceAudio === "function") {
            await window.__axonUnlockVoiceAudio();
          }
        } catch (_) { /* needs user gesture */ }
      })();
    `);
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

app.whenReady().then(async () => {
  store = createSettingsStore();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "geolocation" || permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === "geolocation" || permission === "media";
  });

  applyAutoLaunch(Boolean(store.get("autoLaunch")));

  ipcMain.handle("axon-shell:get-lan-origin", () => {
    if (!isDev) return null;
    return getLanOrigin(Number(process.env.AXON_VITE_PORT || 5173));
  });

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

  const voicePort = Number(process.env.AXON_VOICE_PORT || 8010);
  const voiceUrl =
    process.env.AXON_VOICE_BACKEND_URL ||
    store?.get("voiceBackendUrl") ||
    `http://127.0.0.1:${voicePort}`;

  if (process.env.AXON_VOICE_AUTOSTART !== "0") {
    try {
      const result = await startVoiceServer(voicePort);
      // eslint-disable-next-line no-console
      console.info(
        `[axon-electron] Voice backend ready at ${voiceUrl}${result.reused ? " (reused)" : ""}`,
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[axon-electron] Failed to start voice backend:", error);
    }
  }

  ipcMain.handle("axon-voice:get-backend-url", () => getVoiceBackendUrl());
  ipcMain.handle("axon-voice:is-native", () => true);
  ipcMain.handle("axon-voice:is-backend-ready", async () => {
    const { checkVoiceHealth } = require("./voiceServer");
    return checkVoiceHealth(getVoiceBackendUrl());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopVoiceServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopVoiceServer();
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("[axon-electron] uncaughtException", error);
});
