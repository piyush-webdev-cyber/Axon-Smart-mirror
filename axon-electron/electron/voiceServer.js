const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

/** @type {import("node:child_process").ChildProcess | null} */
let voiceProcess = null;
/** True when this Electron session spawned the backend (safe to kill on quit). */
let voiceProcessOwned = false;

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

function httpGetJson(pathname, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(pathname, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function httpPost(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname,
        method: "POST",
        headers: { "Content-Length": "0" },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      },
    );
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function checkVoiceHealth(url) {
  return httpGetJson(`${url}/api/v1/voice/ready`, 5000).then((data) => {
    return Boolean(data && data.ok === true);
  });
}

function waitForHealth(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let pending = false;

    const tick = async () => {
      if (pending) return;
      pending = true;
      try {
        const healthy = await checkVoiceHealth(url);
        if (healthy) {
          resolve(true);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error("Voice backend did not become ready in time."));
          return;
        }
        setTimeout(tick, 1500);
      } finally {
        pending = false;
      }
    };

    void tick();
  });
}

function freePort(port) {
  if (process.platform !== "win32") return;

  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of output.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      if (voiceProcess && String(voiceProcess.pid) === pid) continue;
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        // eslint-disable-next-line no-console
        console.info(`[axon-electron] Freed port ${port} (PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* port already free */
  }
}

async function startVoiceServer(port = 8010) {
  const url = `http://127.0.0.1:${port}`;

  if (voiceProcess && voiceProcess.exitCode === null) {
    return { ok: true, url, reused: !voiceProcessOwned };
  }

  if (await checkVoiceHealth(url)) {
    // eslint-disable-next-line no-console
    console.info(`[axon-electron] Reusing existing voice backend at ${url}`);
    return { ok: true, url, reused: true };
  }

  freePort(port);

  const backendDir = resolveBackendDir();
  const python = resolvePython(backendDir);

  const env = {
    ...process.env,
    AXON_VOICE_PORT: String(port),
  };

  voiceProcessOwned = true;
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
    voiceProcessOwned = false;
  });

  try {
    await waitForHealth(url);
  } catch (error) {
    if (await checkVoiceHealth(url)) {
      return { ok: true, url, reused: true };
    }
    throw error;
  }

  const started = await httpPost(`${url}/api/v1/voice/start`);
  if (started) {
    // eslint-disable-next-line no-console
    console.info("[axon-electron] Voice pipeline + local mic started via POST /voice/start");
  } else {
    // eslint-disable-next-line no-console
    console.warn("[axon-electron] POST /voice/start failed — frontend WS may still bootstrap");
  }

  if (voiceProcess && voiceProcess.exitCode !== null) {
    if (await checkVoiceHealth(url)) {
      return { ok: true, url, reused: true };
    }
    throw new Error("Voice backend process exited during startup.");
  }

  return { ok: true, url, reused: false };
}

function stopVoiceServer() {
  if (!voiceProcess || !voiceProcessOwned) return;
  voiceProcess.kill();
  voiceProcess = null;
  voiceProcessOwned = false;
}

module.exports = {
  startVoiceServer,
  stopVoiceServer,
  checkVoiceHealth,
};
