const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");

/** @type {import("node:child_process").ChildProcess | null} */
let voiceProcess = null;
/** True when this Electron session spawned the backend (safe to kill on quit). */
let voiceProcessOwned = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Require phase 6+ so we never reuse an old voice-only backend missing music routes. */
function checkBackendCapabilities(url) {
  return httpGetJson(`${url}/api/v1/system/info`, 5000).then((data) => {
    if (!data) return false;
    const phase = Number(data.phase ?? 0);
    return phase >= 6;
  });
}

async function isBackendUsable(url) {
  const [voiceOk, capable] = await Promise.all([
    checkVoiceHealth(url),
    checkBackendCapabilities(url),
  ]);
  return voiceOk && capable;
}

function waitForHealth(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let pending = false;

    const tick = async () => {
      if (pending) return;
      pending = true;
      try {
        const healthy = await isBackendUsable(url);
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

/** PIDs listening on TCP port (Windows: 0.0.0.0:8010 and 127.0.0.1:8010 can differ). */
function listListeningPids(port) {
  const pids = new Set();
  const portSuffix = `:${port}`;

  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
      for (const line of output.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5 || parts[0] !== "TCP") continue;
        const localAddress = parts[1] || "";
        if (!localAddress.endsWith(portSuffix)) continue;
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
    } catch {
      /* ignore */
    }
    return pids;
  }

  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    for (const pid of output.split("\n")) {
      const trimmed = pid.trim();
      if (trimmed && /^\d+$/.test(trimmed)) pids.add(trimmed);
    }
  } catch {
    /* ignore */
  }
  return pids;
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid} /T`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    // eslint-disable-next-line no-console
    console.info(`[axon-electron] Freed port listener (PID ${pid})`);
    return true;
  } catch {
    return false;
  }
}

function stopOwnedVoiceProcess() {
  if (!voiceProcess || voiceProcess.exitCode !== null) {
    voiceProcess = null;
    voiceProcessOwned = false;
    return;
  }
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${voiceProcess.pid} /T`, { stdio: "ignore" });
    } else {
      voiceProcess.kill("SIGKILL");
    }
  } catch {
    try {
      voiceProcess.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
  voiceProcess = null;
  voiceProcessOwned = false;
}

/** True when nothing is bound to 127.0.0.1:port. */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

/** Kill every process listening on port; retry until bind test passes. */
async function ensurePortFree(port, { maxAttempts = 10 } = {}) {
  stopOwnedVoiceProcess();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pids = listListeningPids(port);
    if (pids.size === 0 && (await isPortAvailable(port))) {
      return true;
    }

    for (const pid of pids) {
      killPid(pid);
    }

    await sleep(900 + attempt * 200);

    if (pids.size === 0 && (await isPortAvailable(port))) {
      return true;
    }
  }

  const remaining = listListeningPids(port);
  if (remaining.size > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[axon-electron] Port ${port} still in use by PID(s): ${[...remaining].join(", ")}`,
    );
  }
  return false;
}

/** Prefer high ports — 8010 is often stuck with unkillable ghost listeners on Windows. */
const PORT_CANDIDATES = [18010, 18011, 18012, 18013, 8010, 8011, 8012, 8013];

async function tryStartOnPort(port) {
  const url = `http://127.0.0.1:${port}`;

  if (voiceProcess && voiceProcess.exitCode === null) {
    stopOwnedVoiceProcess();
  }

  if (await isBackendUsable(url)) {
    // eslint-disable-next-line no-console
    console.info(`[axon-electron] Reusing existing voice backend at ${url}`);
    const started = await httpPost(`${url}/api/v1/voice/start`);
    if (started) {
      // eslint-disable-next-line no-console
      console.info("[axon-electron] Voice pipeline restarted on reused backend");
    }
    return { ok: true, url, reused: true };
  }

  const voiceAlive = await checkVoiceHealth(url);
  if (voiceAlive && !(await checkBackendCapabilities(url))) {
    // eslint-disable-next-line no-console
    console.warn(
      `[axon-electron] Port ${port} has outdated backend (no music API) — skipping`,
    );
    throw new Error(`Port ${port} outdated`);
  }

  if (!(await isPortAvailable(port))) {
    const freed = await ensurePortFree(port, { maxAttempts: 2 });
    if (!freed) {
      throw new Error(`Port ${port} is still in use`);
    }
  }

  const backendDir = resolveBackendDir();
  const python = resolvePython(backendDir);

  const env = {
    ...process.env,
    AXON_VOICE_PORT: String(port),
    AXON_VOICE_LOCAL_MIC: "true",
    LOG_LEVEL: process.env.LOG_LEVEL || "INFO",
  };

  voiceProcessOwned = true;
  voiceProcess = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--ws-ping-interval",
      "30",
      "--ws-ping-timeout",
      "120",
      "--timeout-keep-alive",
      "75",
    ],
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
    if (await isBackendUsable(url)) {
      return { ok: true, url, reused: true };
    }
    stopOwnedVoiceProcess();
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
    if (await isBackendUsable(url)) {
      return { ok: true, url, reused: true };
    }
    throw new Error("Voice backend process exited during startup.");
  }

  return { ok: true, url, reused: false };
}

async function startVoiceServer(preferredPort = 18010) {
  const ports = [
    preferredPort,
    ...PORT_CANDIDATES.filter((candidate) => candidate !== preferredPort),
  ];

  let lastError = null;
  for (const port of ports) {
    try {
      // eslint-disable-next-line no-console
      console.info(`[axon-electron] Trying voice backend on port ${port}…`);
      return await tryStartOnPort(port);
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.warn(
        `[axon-electron] Port ${port} failed: ${error instanceof Error ? error.message : error}`,
      );
      stopOwnedVoiceProcess();
    }
  }

  throw lastError ?? new Error("Could not start voice backend on any port.");
}

function stopVoiceServer() {
  stopOwnedVoiceProcess();
}

module.exports = {
  startVoiceServer,
  stopVoiceServer,
  checkVoiceHealth,
  checkBackendCapabilities,
  isBackendUsable,
  ensurePortFree,
  listListeningPids,
};
