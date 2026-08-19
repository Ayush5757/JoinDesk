import jwt from "jsonwebtoken";
import "dotenv/config";

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
 * On success, attaches { id, email } to req.user.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
