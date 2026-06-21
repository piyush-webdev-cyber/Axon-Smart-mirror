/** Camera capture pipeline with countdown, upload, and WebSocket events. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WS_EVENTS } from "@/constants/wsEvents";
import { ROUTES } from "@/constants/routes";
import { photoApi } from "@/services/photoApi";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { CameraState } from "@/store/slices/cameraSlice";

const COUNTDOWN_SECONDS = 3;
const VIDEO_READY_TIMEOUT_MS = 10_000;

function emit(event: string, payload: Record<string, unknown> = {}) {
  websocketClient.send(event, payload);
}

async function waitForVideoReady(
  video: HTMLVideoElement | null,
  timeoutMs = VIDEO_READY_TIMEOUT_MS,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (video && video.videoWidth > 0 && video.readyState >= 2) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return Boolean(video && video.videoWidth > 0);
}

export function useCameraCapture() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureInProgressRef = useRef(false);
  const cameraStateRef = useRef<CameraState>("idle");
  const voiceCaptureHandledRef = useRef(false);

  const pendingVoiceCapture = useAppStore((s) => s.pendingVoiceCapture);
  const clearPendingVoiceCapture = useAppStore((s) => s.clearPendingVoiceCapture);
  const setCameraState = useAppStore((s) => s.setCameraState);
  const cameraState = useAppStore((s) => s.cameraState);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setVideoReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => undefined);
      }
      setError(null);
    } catch {
      setError("Failed to access camera. Please check permissions.");
      setCameraState("error");
    }
  }, [setCameraState]);

  useEffect(() => {
    captureInProgressRef.current = false;
    voiceCaptureHandledRef.current = false;
    void startCamera();
    return () => {
      clearCountdownTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [clearCountdownTimer, startCamera]);

  const onVideoReady = useCallback(() => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      setVideoReady(true);
    }
  }, []);

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      setCameraState("uploading");
      emit(WS_EVENTS.photoUploadStarted, {});

      try {
        const file = new File([blob], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        await photoApi.uploadPhoto(file, null);
        emit(WS_EVENTS.photoUploadCompleted, {});
        setCameraState("success");
        setSuccessMessage("Photo Saved Successfully");
        setTimeout(() => {
          setSuccessMessage(null);
          setCameraState("idle");
          captureInProgressRef.current = false;
          void startCamera();
        }, 3000);
      } catch (err) {
        captureInProgressRef.current = false;
        const message =
          err instanceof Error ? err.message : "Failed to save photo. Please try again.";
        setError(message);
        setCameraState("error");
      }
    },
    [setCameraState, startCamera],
  );

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      captureInProgressRef.current = false;
      setError("Camera not ready. Please try again.");
      setCameraState("error");
      return;
    }

    const ready = await waitForVideoReady(video);
    if (!ready) {
      captureInProgressRef.current = false;
      setError("Camera preview did not start in time. Please retry.");
      setCameraState("error");
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      captureInProgressRef.current = false;
      setError("Capture failed.");
      setCameraState("error");
      return;
    }

    setCameraState("capturing");
    emit(WS_EVENTS.photoCaptureCompleted, {});

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    streamRef.current?.getTracks().forEach((track) => track.stop());

    canvas.toBlob(
      (blob) => {
        if (blob) void uploadBlob(blob);
        else {
          captureInProgressRef.current = false;
          setError("Capture failed.");
          setCameraState("error");
        }
      },
      "image/jpeg",
      0.85,
    );
  }, [setCameraState, uploadBlob]);

  const beginCaptureSequence = useCallback(async () => {
    if (captureInProgressRef.current) return;

    const state = cameraStateRef.current;
    if (state !== "idle" && state !== "error") return;

    captureInProgressRef.current = true;
    setError(null);
    setSuccessMessage(null);
    clearCountdownTimer();

    const ready = await waitForVideoReady(videoRef.current);
    if (!ready) {
      captureInProgressRef.current = false;
      setError("Waiting for camera… Allow camera access and try again.");
      setCameraState("error");
      return;
    }

    setCameraState("countdown");
    emit(WS_EVENTS.photoCaptureStarted, {});
    setCountdown(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdownTimer();
        setCountdown(null);
        void captureFrame();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  }, [captureFrame, clearCountdownTimer, setCameraState]);

  const runCountdown = useCallback(() => {
    void beginCaptureSequence();
  }, [beginCaptureSequence]);

  // Voice: one-shot — only when pendingVoiceCapture flips to true.
  useEffect(() => {
    if (!pendingVoiceCapture) {
      voiceCaptureHandledRef.current = false;
      return;
    }
    if (voiceCaptureHandledRef.current) return;
    voiceCaptureHandledRef.current = true;

    let cancelled = false;

    const pollForCapture = async () => {
      clearPendingVoiceCapture();

      for (let attempt = 0; attempt < 50 && !cancelled; attempt += 1) {
        const ready = videoReady || (await waitForVideoReady(videoRef.current, 400));
        if (ready && !cancelled) {
          await beginCaptureSequence();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!cancelled) {
        captureInProgressRef.current = false;
        setError("Camera preview did not start. Allow camera access and try again.");
        setCameraState("error");
      }
    };

    void pollForCapture();
    return () => {
      cancelled = true;
    };
  }, [
    pendingVoiceCapture,
    videoReady,
    clearPendingVoiceCapture,
    beginCaptureSequence,
    setCameraState,
  ]);

  const cancel = useCallback(() => {
    clearCountdownTimer();
    captureInProgressRef.current = false;
    voiceCaptureHandledRef.current = false;
    clearPendingVoiceCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    navigate(ROUTES.home);
  }, [clearCountdownTimer, clearPendingVoiceCapture, navigate]);

  return {
    videoRef,
    canvasRef,
    cameraState,
    countdown,
    error,
    successMessage,
    videoReady,
    onVideoReady,
    runCountdown,
    cancel,
    retry: () => {
      captureInProgressRef.current = false;
      voiceCaptureHandledRef.current = false;
      setError(null);
      setCameraState("idle");
      void startCamera();
    },
  };
}
