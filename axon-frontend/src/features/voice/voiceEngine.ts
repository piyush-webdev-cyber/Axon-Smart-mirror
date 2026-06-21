/** Imperative bridge between MicButton and the voice pipeline hook. */

interface VoiceEngineHandlers {
  wake: () => void;
  cancel: () => void;
  unlock: () => Promise<boolean>;
}

let handlers: VoiceEngineHandlers | null = null;

export function registerVoiceEngine(next: VoiceEngineHandlers | null): void {
  handlers = next;
}

export function triggerVoiceWake(): void {
  handlers?.wake();
}

export function triggerVoiceCancel(): void {
  handlers?.cancel();
}

export async function triggerVoiceUnlock(): Promise<boolean> {
  if (!handlers) return false;
  return handlers.unlock();
}
