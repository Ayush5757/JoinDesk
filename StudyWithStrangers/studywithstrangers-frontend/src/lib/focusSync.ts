/**
 * Decides what the Focus Timer should tell the tracker, so a person's study time is counted
 * only while a study round is really running:
 *   running study round                       -> "study"  (tracker: study time is counted)
 *   break round, paused timer, or reset timer -> "pause"  (tracker: counted as a break)
 * It only asks for a call when something CHANGED, and never sends a pointless "pause" at the very start.
 */
export type Wanted = "study" | "pause";

export function nextSyncAction(
  last: Wanted | null,
  running: boolean,
  phase: "work" | "break" | "longBreak",
): { wanted: Wanted; call: boolean } {
  const wanted: Wanted = running && phase === "work" ? "study" : "pause";
  if (last === wanted) return { wanted, call: false };
  if (last === null && wanted === "pause") return { wanted, call: false }; // nothing is running yet, nothing to pause
  return { wanted, call: true };
}
