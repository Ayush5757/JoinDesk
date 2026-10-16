import "dotenv/config";

const bool = (v, d) => (v === undefined || v === "" ? d : ["1", "true", "yes", "on"].includes(String(v).toLowerCase()));
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);

/**
 * Random Chat settings, all from .env:
 *   RANDOM_CHAT_ENABLED  true/false   master kill switch (default true)
 *   RANDOM_CHAT_PAID     true/false   only the STARTING value of the "Random chat needs a subscription"
 *                                     switch. Once you save Payments in the admin panel, the panel decides.
 *   RANDOM_ICE_SERVERS   optional JSON, e.g. a TURN server later:
 *                        [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:x","username":"u","credential":"p"}]
 *   RANDOM_AUTO_RESTRICT_REPORTS  how many different people must report someone (7 days) before
 *                                 they're paused from matching until an admin reviews (default 3)
 */
export function getRandomConfig() {
  const e = process.env;
  let iceServers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (e.RANDOM_ICE_SERVERS) {
    try {
      const parsed = JSON.parse(e.RANDOM_ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length) iceServers = parsed;
    } catch {
      console.error("RANDOM_ICE_SERVERS is not valid JSON, using the default STUN servers.");
    }
  }
  return {
    enabled: bool(e.RANDOM_CHAT_ENABLED, true),
    paid: bool(e.RANDOM_CHAT_PAID, false),
    iceServers,
    autoRestrictReports: Math.max(1, num(e.RANDOM_AUTO_RESTRICT_REPORTS, 3)),
  };
}
