import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { env } from "@/utils/env";
import { buildDeviceLinkUrl, isLocalhostOrigin } from "@/utils/publicMirrorUrl";
import { useDeviceLinkSession } from "./useDeviceLinkSession";

function useQrSize() {
  const [size, setSize] = useState(220);

  useEffect(() => {
    function updateSize() {
      const maxByHeight = Math.floor(window.innerHeight * 0.28);
      const maxByWidth = Math.floor(window.innerWidth * 0.28);
      const next = Math.min(240, maxByHeight, maxByWidth);
      setSize(Math.max(160, next));
    }

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return size;
}

export function DeviceLinkingScreen() {
  const { mirrorLinked, deviceCode, waiting, error, booting } = useDeviceLinkSession();
  const qrSize = useQrSize();

  if (mirrorLinked) {
    return null;
  }

  if (booting) {
    return (
      <div className="flex w-full items-center justify-center py-8">
        <p className="text-2xl text-glow">Generating device code...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full max-w-lg flex-col items-center justify-center px-4 py-8 text-center">
        <p className="mb-4 text-2xl text-error">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="glass-surface px-6 py-3 text-lg font-medium text-primary ring-glow transition-all hover:ring-glow-strong"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!deviceCode) return null;

  const linkUrl = buildDeviceLinkUrl(deviceCode.code);

  return (
    <div className="flex w-full max-w-lg flex-col items-center justify-center px-4 pb-8 pt-2 text-center">
      {waiting && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-caption text-primary">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Waiting for phone connection…
        </div>
      )}

      <h1 className="mb-3 text-subheading font-semibold text-glow sm:text-heading">
        Scan QR to Connect Axon
      </h1>

      <div
        className="mb-3 shrink-0 overflow-visible rounded-2xl bg-white p-4 shadow-[0_0_40px_rgba(255,255,255,0.12)]"
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

      <div className="mb-1 text-display-lg font-bold tracking-wider text-primary text-glow-strong">
        {deviceCode.code}
      </div>

      <p className="max-w-xs text-body text-text-secondary">
        Scan with your phone or enter the code manually
      </p>

      {isLocalhostOrigin() && !env.publicMirrorUrl && (
        <p className="mt-2 max-w-xs text-caption text-warning">
          Set VITE_PUBLIC_MIRROR_URL so the QR opens on your phone.
        </p>
      )}
    </div>
  );
}
