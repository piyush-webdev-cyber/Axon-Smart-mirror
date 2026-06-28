const { contextBridge, ipcRenderer } = require("electron");

function readVoiceBackendUrl() {
  const arg = process.argv.find((entry) => entry.startsWith("--axon-voice-url="));
  if (arg) {
    try {
      return decodeURIComponent(arg.slice("--axon-voice-url=".length)).replace(/\/$/, "");
    } catch {
      return arg.slice("--axon-voice-url=".length).replace(/\/$/, "");
    }
  }
  return "http://127.0.0.1:18010";
}

const voiceBackendUrl = readVoiceBackendUrl();
const voiceApiBase = `${voiceBackendUrl}/api/v1`;
const voiceWsUrl = `${voiceBackendUrl.replace(/^http/, "ws")}/api/v1/ws`;

contextBridge.exposeInMainWorld("axonRuntime", {
  voiceBackendUrl,
  voiceApiBase,
  voiceWsUrl,
});

contextBridge.exposeInMainWorld("axonShell", {
  isElectron: true,
  getLanOrigin: () => ipcRenderer.invoke("axon-shell:get-lan-origin"),
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
