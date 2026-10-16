import "dotenv/config";

/**
 * How long a normal desk stays listed after it is created (or reused).
 * .env: DESK_LIFESPAN_HOURS (default 24). Special desks never expire.
 */
export function getDeskConfig() {
  const h = Number(process.env.DESK_LIFESPAN_HOURS);
  return { lifespanHours: Number.isFinite(h) && h > 0 ? h : 24 };
}

/** ISO time before which a normal desk counts as expired. */
export function deskCutoffIso(now = Date.now()) {
  return new Date(now - getDeskConfig().lifespanHours * 3_600_000).toISOString();
}
