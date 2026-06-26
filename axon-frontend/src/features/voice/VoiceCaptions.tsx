import { cn } from "@/utils/cn";
import { nativeVoiceClient } from "@/features/voice/native/nativeVoiceClient";
import { useVoiceController } from "./useVoiceController";

function ConnectionDot({
  connected,
  streaming,
  state,
  micReady,
}: {
  connected: boolean;
  streaming: boolean;
  state: string;
  micReady: boolean;
}) {
  const isError = state === "idle" && !connected && micReady;
  const color = streaming
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
    : connected
      ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]"
      : isError
        ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
        : "bg-amber-400 animate-pulse";

  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", color)}
    />
  );
}

/**
 * Always-visible voice debug captions — connection, heard text, and replies.
 */
export function VoiceCaptions() {
  const {
    state,
    micReady,
    wakeActive,
    listenPhrase,
    transcript,
    reply,
    statusLine,
    backendConnected,
    audioStreaming,
    needsAudioUnlock,
  } = useVoiceController();

  const isListening = state === "listening";
  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";
  const showHeard = Boolean(transcript.trim());
  const showReply = Boolean(reply.trim());

  let modeHint = statusLine;
  if (!modeHint) {
    if (!micReady) modeHint = "Allow microphone access when prompted";
    else if (!backendConnected) modeHint = "Connecting to voice backend…";
    else if (needsAudioUnlock) modeHint = "Click anywhere once to enable wake word";
    else if (isListening) modeHint = "Recording — speak your command now";
    else if (isProcessing) modeHint = "Processing what you said…";
    else if (isSpeaking) modeHint = "Speaking response…";
    else if (wakeActive && audioStreaming)
      modeHint = `Listening for “${listenPhrase}” — say it now`;
    else if (wakeActive) modeHint = `Waiting for mic stream…`;
    else modeHint = `Say “${listenPhrase}” or tap the mic`;
  }

  return (
    <div
      className="w-full max-w-lg px-2"
      aria-live="polite"
      aria-atomic="false"
      role="log"
    >
      <div
        className={cn(
          "glass-surface rounded-2xl border border-content/10 px-4 py-3",
          "flex flex-col gap-2 text-left shadow-lg",
        )}
      >
        <div className="flex items-center gap-2 text-sm text-content">
          <ConnectionDot
            connected={backendConnected}
            streaming={audioStreaming}
            state={state}
            micReady={micReady}
          />
          <span className="font-medium leading-snug">{modeHint}</span>
        </div>

        {needsAudioUnlock && backendConnected && micReady && (
          <button
            type="button"
            onClick={() => void nativeVoiceClient.unlockAudio()}
            className="rounded-xl bg-amber-500/20 px-3 py-2 text-left text-sm text-amber-100 ring-1 ring-amber-400/40 transition hover:bg-amber-500/30"
          >
            Tap here to activate hands-free wake word (“{listenPhrase}”)
          </button>
        )}

        {audioStreaming && wakeActive && state === "idle" && (
          <p className="text-xs text-emerald-200/90">
            Mic streaming · say “{listenPhrase}”, then your command
          </p>
        )}

        {isListening && !showHeard && (
          <p className="text-sm text-primary/90 animate-pulse">
            🎤 Mic open — waiting for speech…
          </p>
        )}

        {showHeard && (
          <div className="rounded-xl bg-black/25 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-content-muted">
              You said
            </p>
            <p className="text-base leading-snug text-content">{transcript}</p>
          </div>
        )}

        {showReply && (
          <div className="rounded-xl bg-primary/10 px-3 py-2 ring-1 ring-primary/20">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary/80">
              Axon
            </p>
            <p className="text-base leading-snug text-content">{reply}</p>
          </div>
        )}

        {!micReady && (
          <p className="text-xs text-amber-200/90">
            Microphone not ready — check Windows privacy settings or tap the button above.
          </p>
        )}

        {micReady && !backendConnected && (
          <p className="text-xs text-amber-200/90">
            Voice backend offline — waiting for localhost:8010…
          </p>
        )}
      </div>
    </div>
  );
}
