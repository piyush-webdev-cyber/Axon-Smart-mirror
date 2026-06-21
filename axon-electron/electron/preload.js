const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("axonShell", {
  isElectron: true,
  isKiosk: () => ipcRenderer.invoke("axon-shell:is-kiosk"),
  setKiosk: (enabled) => ipcRenderer.invoke("axon-shell:set-kiosk", enabled),
  getAutoLaunch: () => ipcRenderer.invoke("axon-shell:get-auto-launch"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("axon-shell:set-auto-launch", enabled),
  getVoiceBackendUrl: () => ipcRenderer.invoke("axon-voice:get-backend-url"),
});

contextBridge.exposeInMainWorld("axonVoice", {
  isNativeEngine: () => true,
  getVoiceBackendUrl: () => ipcRenderer.invoke("axon-voice:get-backend-url"),
});
