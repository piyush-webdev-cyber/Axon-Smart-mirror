/**
 * REST API base for photos, gallery, and other authenticated mirror features.
 * Resolved at request time — not frozen at module load.
 *
 * Device linking + photos share Railway when using hosted Vercel links.
 * Electron voice stays on local :8010 via env.apiBaseUrl / axonVoice.
 */

import { env } from "./env";
import { RAILWAY_API_BASE, usesHostedDeviceLink } from "./deviceLinkConfig";

export function restApiBase(): string {
  if (usesHostedDeviceLink()) {
    return RAILWAY_API_BASE;
  }
  return env.apiBaseUrl;
}
