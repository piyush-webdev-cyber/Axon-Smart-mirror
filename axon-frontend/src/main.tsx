import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { logAxonEnv } from "@/utils/env";
import { deviceApiBase, deviceWsUrl } from "@/utils/deviceApiBase";
import { usesHostedDeviceLink } from "@/utils/deviceLinkConfig";
import { getPublicMirrorOrigin } from "@/utils/publicMirrorUrl";
import "@/styles/globals.css";

logAxonEnv();
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.info("[axon] Device link transport", {
    deviceApiBase: deviceApiBase(),
    deviceWsUrl: deviceWsUrl(),
    hostedDeviceLink: usesHostedDeviceLink(),
    linkOrigin: getPublicMirrorOrigin(),
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
