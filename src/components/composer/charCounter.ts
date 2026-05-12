/**
 * Helpers that turn an `effectiveLength` value into the bits the UI needs
 * to render the character counter (color + ring fraction).
 *
 * Pulled out of the composer so other surfaces (inline composer, reply box)
 * can render the same visual.
 */
import { MAX_LENGTH } from "@/lib/post-text";

export function charCounterState(effectiveLength: number) {
  const remaining = MAX_LENGTH - effectiveLength;
  const fraction = Math.min(1, Math.max(0, effectiveLength / MAX_LENGTH));

  // Match X's color thresholds.
  let tone: "muted" | "warn" | "danger";
  if (remaining < 0) tone = "danger";
  else if (remaining <= 20) tone = "warn";
  else tone = "muted";

  return { remaining, fraction, tone };
}
