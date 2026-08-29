import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "avatars";

/**
 * Uploads a profile picture buffer to the "avatars" Supabase Storage bucket
 * and returns its public URL. The bucket must exist and be public — see
 * README.md "Avatar uploads" section for the one-time setup.
 *
 * @param {string} userId
 * @param {Buffer} buffer
 * @param {string} mimeType e.g. "image/png"
 */
export async function uploadAvatar(userId, buffer, mimeType) {
  const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
