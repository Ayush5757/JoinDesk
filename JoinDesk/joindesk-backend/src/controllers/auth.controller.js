import jwt from "jsonwebtoken";
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const { GOOGLE_CLIENT_ID, JWT_SECRET } = process.env;
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/**
 * POST /api/auth/google
 * Body: { access_token }  (the token the frontend got back from the
 * Google Identity Services popup, after the user picked an account)
 *
 * Flow:
 *   1. Confirm the token was actually issued for OUR app (tokeninfo).
 *   2. Fetch the user's Google profile (userinfo) using that token.
 *   3. Upsert the user into public.users.
 *   4. Issue our own short-lived-ish JWT and hand it back.
 *
 * The frontend stores the returned `token` in localStorage['auth_token']
 * and sends it as `Authorization: Bearer <token>` on every future request.
 */
export async function googleLogin(req, res) {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: "access_token is required" });
    }

    // 1. Verify the token was issued for this app (defends against a token
    // minted for some other Google app being replayed here).
    if (GOOGLE_CLIENT_ID) {
      const tokenInfoRes = await fetch(`${GOOGLE_TOKENINFO_URL}?access_token=${access_token}`);
      if (!tokenInfoRes.ok) {
        return res.status(401).json({ error: "Invalid Google token" });
      }
      const tokenInfo = await tokenInfoRes.json();
      if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: "Google token was not issued for this app" });
      }
    }

    // 2. Fetch the profile.
    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    const profile = await profileRes.json();
    // profile: { sub, email, name, picture, email_verified, ... }

    // 3. Upsert the user, keyed on Google's stable account id.
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          google_id: profile.sub,
          name: profile.name || profile.email?.split("@")[0] || "Anonymous",
          email: profile.email,
          avatar_url: profile.picture || null,
        },
        { onConflict: "google_id" }
      )
      .select()
      .single();

    if (error) throw error;

    // 4. Issue our own session token.
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({ token, user });
  } catch (err) {
    console.error("googleLogin error:", err);
    return res.status(500).json({ error: "Google sign-in failed" });
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile row.
 */
export async function getMe(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    return res.status(200).json({ user: data });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}
