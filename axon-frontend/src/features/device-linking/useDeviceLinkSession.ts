import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WS_EVENTS } from "@/constants/wsEvents";
import { ROUTES } from "@/constants/routes";
import { deviceApi } from "@/services/deviceApi";
import { supabase } from "@/services/supabaseClient";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { DeviceCode } from "@/types/device";
import { acquireDeviceCode, clearActiveDeviceCode } from "@/features/device-linking/deviceCodeSession";
import { isMirrorLinked, MIRROR_LINKED_EVENT } from "@/utils/authToken";
import {
  applyMirrorLink,
  deviceStatusToLinkPayload,
  wsPayloadToLinkPayload,
} from "@/utils/mirrorLink";

const POLL_MS = 800;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function useDeviceLinkSession() {
  const navigate = useNavigate();
  const mirrorLinked = useAppStore((s) => s.mirrorLinked);
  const setDeviceLinkUiActive = useAppStore((s) => s.setDeviceLinkUiActive);
  const [deviceCode, setDeviceCode] = useState<DeviceCode | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const linkedRef = useRef(false);
  const deviceCodeRef = useRef<DeviceCode | null>(null);

  useEffect(() => {
    deviceCodeRef.current = deviceCode;
  }, [deviceCode]);

  useEffect(() => {
    setDeviceLinkUiActive(true);
    return () => setDeviceLinkUiActive(false);
  }, [setDeviceLinkUiActive]);

  const finishLink = useCallback(
    (payload: Parameters<typeof applyMirrorLink>[0]) => {
      if (linkedRef.current || isMirrorLinked()) return;
      linkedRef.current = true;
      const linkedDeviceCode = deviceCodeRef.current?.code ?? null;
      clearActiveDeviceCode();
      applyMirrorLink({ ...payload, linkedDeviceCode });
      setDeviceLinkUiActive(false);
      navigate(ROUTES.home, { replace: true });
    },
    [navigate, setDeviceLinkUiActive],
  );

  const tryCompleteFromStatus = useCallback(
    (status: Awaited<ReturnType<typeof deviceApi.checkDeviceStatus>>) => {
      if (status.status === "linked" && status.user_id && !status.mirror_token) {
        console.warn("[axon] Device linked but mirror_token missing — will retry on next poll");
      }
      const payload = deviceStatusToLinkPayload(status);
      if (payload) finishLink(payload);
    },
    [finishLink],
  );

  useEffect(() => {
    if (mirrorLinked || isMirrorLinked()) {
      setBooting(false);
      setDeviceLinkUiActive(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const result = await acquireDeviceCode();
        if (cancelled) return;

        if (result.alreadyLinked) {
          tryCompleteFromStatus(result.alreadyLinked);
          return;
        }

        setDeviceCode(result.code);
        setWaiting(true);
      } catch (err) {
        if (!cancelled) {
          console.error("[axon] device code bootstrap failed:", err);
          setError("Failed to generate device code");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [mirrorLinked, tryCompleteFromStatus, setDeviceLinkUiActive]);

  /** Sync UI when link completes via storage (poll / WS / Realtime). */
  useEffect(() => {
    const onLinked = () => {
      if (!isMirrorLinked() || linkedRef.current) return;
      linkedRef.current = true;
      setDeviceLinkUiActive(false);
      navigate(ROUTES.home, { replace: true });
    };

    window.addEventListener(MIRROR_LINKED_EVENT, onLinked);
    return () => window.removeEventListener(MIRROR_LINKED_EVENT, onLinked);
  }, [navigate, setDeviceLinkUiActive]);

  useEffect(() => {
    if (!deviceCode || mirrorLinked || linkedRef.current) return;

    const code = normalizeCode(deviceCode.code);
    let intervalId: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const status = await deviceApi.checkDeviceStatus(code);
        if (status.status === "linked") {
          tryCompleteFromStatus(status);
        } else if (status.status === "expired") {
          clearActiveDeviceCode();
          setError("Device code expired. Refresh to get a new QR code.");
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("[axon] device status poll failed:", err);
      }
    }

    void poll();
    intervalId = setInterval(poll, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deviceCode, mirrorLinked, tryCompleteFromStatus]);

  useEffect(() => {
    if (!deviceCode || mirrorLinked || linkedRef.current) return;

    const code = normalizeCode(deviceCode.code);

    return websocketClient.subscribe(WS_EVENTS.deviceLinked, (message) => {
      const raw = (message.payload ?? {}) as Record<string, unknown>;
      if (normalizeCode(String(raw.code ?? "")) !== code) return;
      const linkPayload = wsPayloadToLinkPayload(raw);
      if (linkPayload) finishLink(linkPayload);
    });
  }, [deviceCode, mirrorLinked, finishLink]);

  useEffect(() => {
    if (!deviceCode || mirrorLinked || linkedRef.current) return;

    const code = normalizeCode(deviceCode.code);

    const channel = supabase
      .channel(`axon-device-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "device_codes",
          filter: `code=eq.${code}`,
        },
        () => {
          void deviceApi.checkDeviceStatus(code).then(tryCompleteFromStatus);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deviceCode, mirrorLinked, tryCompleteFromStatus]);

  return {
    mirrorLinked: mirrorLinked || isMirrorLinked(),
    deviceCode,
    waiting,
    error,
    booting,
  };
}
