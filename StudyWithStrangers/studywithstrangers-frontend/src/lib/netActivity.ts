/**
 * Counts the requests that are in flight right now. The thin progress bar at the top of the screen listens
 * to this, so ANY action that talks to the server (even one we forgot to put a spinner on) shows that
 * something is happening instead of looking frozen.
 */
let pending = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function subscribePending(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const getPending = () => pending;

/**
 * Same as fetch, but visible to the progress bar. Pass `silent` for background work (settings, polling)
 * that should never make the page look like it is loading.
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  silent = false,
): Promise<Response> {
  if (silent) return fetch(input, init);
  pending += 1;
  notify();
  try {
    return await fetch(input, init);
  } finally {
    pending -= 1;
    notify();
  }
}
