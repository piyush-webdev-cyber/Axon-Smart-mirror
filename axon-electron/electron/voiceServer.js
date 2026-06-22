const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

/** @type {import("node:child_process").ChildProcess | null} */
let voiceProcess = null;

function resolveBackendDir() {
  return path.resolve(__dirname, "../../axon-backend");
}

function resolvePython(backendDir) {
  const venvPython =
    process.platform === "win32"
      ? path.join(backendDir, ".venv", "Scripts", "python.exe")
      : path.join(backendDir, ".venv", "bin", "python");

  if (fs.existsSync(venvPython)) return venvPython;
  return process.platform === "win32" ? "python" : "python3";
}

function waitForHealth(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${url}/api/v1/voice/status`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(3000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Voice backend did not become ready in time."));
        return;
      }
      setTimeout(tick, 800);
    };

    tick();
  });
}

async function startVoiceServer(port = 8010) {
  if (voiceProcess) return { ok: true, url: `http://127.0.0.1:${port}` };

  const backendDir = resolveBackendDir();
  const python = resolvePython(backendDir);
  const url = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    AXON_VOICE_PORT: String(port),
  };

  voiceProcess = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: backendDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  voiceProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[voice-backend] ${chunk}`);
  });
  voiceProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[voice-backend] ${chunk}`);
  });

  voiceProcess.on("exit", (code) => {
    // eslint-disable-next-line no-console
    console.warn(`[axon-electron] voice backend exited (${code ?? "signal"})`);
    voiceProcess = null;
  });

  await waitForHealth(url);
  return { ok: true, url };
}

function stopVoiceServer() {
  if (!voiceProcess) return;
  voiceProcess.kill();
  voiceProcess = null;
}

module.exports = {
  startVoiceServer,
  stopVoiceServer,
};
