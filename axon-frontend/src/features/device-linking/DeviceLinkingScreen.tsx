import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { storeMirrorAuth } from "@/utils/authToken";
import { deviceApi } from "../../services/deviceApi";
import type { DeviceCode, DeviceStatus } from "../../types/device";

const POLL_INTERVAL = 3000; // Poll every 3 seconds

function useQrSize() {
  const [size, setSize] = useState(220);

  useEffect(() => {
    function updateSize() {
      // Fit QR inside the center column (sidebar + header/footer reserved).
      const maxByHeight = Math.floor(window.innerHeight * 0.34);
      const maxByWidth = Math.floor(window.innerWidth * 0.28);
      const next = Math.min(260, maxByHeight, maxByWidth);
      setSize(Math.max(180, next));
    }

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return size;
}

export function DeviceLinkingScreen() {
  const [deviceCode, setDeviceCode] = useState<DeviceCode | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const qrSize = useQrSize();

  // Create device code on mount
  useEffect(() => {
    async function createCode() {
      try {
        const code = await deviceApi.createDeviceCode();
        setDeviceCode(code);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to generate device code");
        setIsLoading(false);
      }
    }
    createCode();
  }, []);

  // Poll for device status
  useEffect(() => {
    if (!deviceCode) return;

    let intervalId: NodeJS.Timeout;

    async function checkStatus() {
      try {
        const statusData = await deviceApi.checkDeviceStatus(deviceCode.code);
        setStatus(statusData);

        // If linked, we're done
        if (statusData.status === "linked") {
          clearInterval(intervalId);
        }

        // If expired, show error
        if (statusData.status === "expired") {
          clearInterval(intervalId);
          setError("Device code has expired. Please refresh.");
        }
      } catch (err) {
        console.error("Failed to check device status:", err);
      }
    }

    // Check immediately
    checkStatus();

    // Then poll
    intervalId = setInterval(checkStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [deviceCode]);

  // If linked, redirect to home
  useEffect(() => {
    if (status?.status === "linked" && status.user_id) {
      if (status.display_name) {
        localStorage.setItem("axon_display_name", status.display_name);
      }
      if (status.mirror_token) {
        storeMirrorAuth(status.user_id, status.mirror_token);
      }
      window.location.href = "/";
    }
  }, [status]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl text-glow">Generating device code...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full items-center justify-center py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl text-error">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="glass-surface px-6 py-3 text-lg font-medium text-primary ring-glow transition-all hover:ring-glow-strong"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!deviceCode) return null;

  const linkUrl = `${window.location.origin}/link/${deviceCode.code}`;

  return (
    <div className="flex w-full max-w-lg flex-col items-center justify-center px-4 py-2 text-center">
      <h1 className="mb-4 text-subheading font-semibold text-glow sm:mb-6 sm:text-heading">
        Scan QR to Connect Axon
      </h1>

      {/* High-contrast QR on white — required for reliable phone scanning */}
      <div
        className="mb-4 shrink-0 overflow-visible rounded-2xl bg-white p-4 shadow-[0_0_40px_rgba(255,255,255,0.12)] sm:mb-6 sm:p-5"
        style={{ width: qrSize + 32, height: qrSize + 32 }}
      >
        <QRCodeSVG
          value={linkUrl}
          size={qrSize}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#000000"
          className="block h-auto w-full"
        />
      </div>

      <div className="mb-2 text-display-lg font-bold tracking-wider text-primary text-glow-strong">
        {deviceCode.code}
      </div>

      <p className="text-body text-text-secondary">
        Scan with your phone or enter the code manually
      </p>

      {status?.status === "pending" && (
        <div className="mt-4 flex items-center justify-center gap-2 text-caption text-text-secondary sm:mt-6">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Waiting for connection...
        </div>
      )}

      {status?.status === "linked" && (
        <div className="mt-4 flex items-center justify-center gap-2 text-caption text-success sm:mt-6">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          Connected! Loading...
        </div>
      )}
    </div>
  );
}
