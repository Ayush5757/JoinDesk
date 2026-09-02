import jwt from "jsonwebtoken";
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const { JWT_SECRET } = process.env;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Copy .env.example to .env and fill it in.");
}

/**
 * Verifies the bearer token sent by the frontend as:
 *   Authorization: Bearer <token>
 *
 * That token is OUR OWN JWT (issued by POST /api/auth/google after we
 * verify the user's Google login), not a Google or Supabase token. It's
 * the same value the frontend stores in localStorage['auth_token'].
 *
 * On success, attaches { id, email } to req.user. Also re-checks
 * `is_blocked` on every request so a user an admin just blocked is cut off
 * immediately (not just on their next login) — the frontend treats this
 * 403 as "show the blocked screen, don't let them use anything".
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("is_blocked")
      .eq("id", decoded.id)
      .maybeSingle();

    if (userRow?.is_blocked) {
      return res.status(403).json({ error: "blocked", blocked: true });
    }

    req.user = { id: decoded.id, email: decoded.email, isAdmin: Boolean(decoded.isAdmin) };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/**
 * Guards Admin Panel routes. The bearer token here is still OUR OWN JWT,
 * but one specifically minted by POST /api/admin/unlock after the correct
 * admin password was entered (see admin.controller.js) — it carries an
 * extra `isAdmin: true` claim on top of the normal { id, email }. A
 * regular login token will never have that claim, so this can't be
 * bypassed just by being logged in.
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = { id: decoded.id, email: decoded.email, isAdmin: true };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired admin session" });
  }
}

/**
 * Like requireAuth, but never rejects the request. If a valid bearer token
 * is present, req.user is populated; otherwise req.user is null and the
 * request continues as an anonymous visitor.
 *
 * Used on routes that are public but behave differently when we know who's
 * asking — e.g. GET /api/desks needs to hide desks from users the creator
 * has blocked, but must still work for a logged-out visitor.
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
  } catch (err) {
    req.user = null;
  }
  next();
}
