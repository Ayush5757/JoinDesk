import nodemailer from "nodemailer";
import "dotenv/config";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL } = process.env;

const isConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

// Built lazily so a missing/incomplete SMTP config never crashes the server
// on boot — it just falls back to logging the notification to the console.
// This keeps the "Special" feature simple to turn on later: fill in the
// SMTP_* vars in .env and it starts sending real emails, no code changes.
let transporter = null;
function getTransporter() {
  if (!isConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Notifies everyone `creator` has marked as "Special" that they've just
 * created a new desk. Fire-and-forget from the caller's point of view —
 * failures are logged, never thrown, so a broken mail server can't break
 * desk creation.
 *
 * @param {{ name: string }} creator
 * @param {{ title: string, id: string, topic: string, description?: string }} desk
 * @param {{ name: string, email: string }[]} recipients
 */
export async function notifySpecialUsersOfNewDesk(creator, desk, recipients) {
  if (!recipients?.length) return;

  const deskUrl = FRONTEND_URL ? FRONTEND_URL.split(",")[0].trim() : "http://localhost:3000";
  const subject = `${creator.name} just opened a new desk: ${desk.title}`;
  const description = desk.description?.trim();

  const text = (name) =>
    `Hi ${name},\n\n${creator.name} just created a new desk on JoinDesk: "${desk.title}" (${desk.topic}).` +
    (description ? `\n\n"${description}"` : "") +
    `\n\nJoin them here: ${deskUrl}\n\n— JoinDesk`;

  const html = (name) => `
    <div style="font-family:sans-serif;line-height:1.5;color:#111;max-width:480px">
      <p>Hi ${name},</p>
      <p><strong>${creator.name}</strong> just opened a new desk on JoinDesk — thought you'd want in on this one:</p>
      <div style="margin:14px 0;padding:14px 16px;border-left:3px solid #6d28d9;background:#f7f5ff;border-radius:8px">
        <p style="font-size:16px;font-weight:600;margin:0 0 4px">${desk.title}</p>
        <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.03em">${desk.topic}</p>
        ${description ? `<p style="margin:10px 0 0;color:#333;font-size:14px">${description}</p>` : ""}
      </div>
      <p><a href="${deskUrl}" style="display:inline-block;margin-top:6px;padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#c026d3);color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">Join the desk</a></p>
      <p style="margin-top:20px;color:#999;font-size:11px">You're getting this because ${creator.name} marked you as a special contact on JoinDesk.</p>
    </div>`;

  const client = getTransporter();

  if (!client) {
    console.log(
      `[email:notConfigured] Would notify ${recipients.length} special user(s) about new desk "${desk.title}" by ${creator.name}. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in .env to send real emails.`
    );
    return;
  }

  const results = await Promise.allSettled(
    recipients.map((r) =>
      client.sendMail({
        from: EMAIL_FROM || SMTP_USER,
        to: r.email,
        subject,
        text: text(r.name),
        html: html(r.name),
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Failed to email special user ${recipients[i].email}:`, r.reason);
    }
  });
}
