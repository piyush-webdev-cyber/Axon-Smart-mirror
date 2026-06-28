/**
 * REST API base for photos, gallery, music, and other mirror features.
 * Resolved at request time — not frozen at module load.
 */

import { mirrorApiBase } from "./apiRouting";

export function restApiBase(): string {
  return mirrorApiBase();
}
