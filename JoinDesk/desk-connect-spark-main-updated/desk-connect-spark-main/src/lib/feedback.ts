import { api } from "./api";

export type FeedbackType = "suggestion" | "complaint";

export type FeedbackInput = {
  type: FeedbackType;
  message: string;
  /** Only used for complaints — the name of the person being reported. Optional. */
  reportedName?: string | undefined;
  /** Only used for complaints — the real desk id that person was in. Optional. */
  reportedDeskId?: string | undefined;
};

export async function submitFeedback(input: FeedbackInput) {
  const body: Record<string, unknown> = { type: input.type, message: input.message };
  if (input.type === "complaint" && input.reportedName?.trim()) {
    body["reported_name"] = input.reportedName.trim();
  }
  if (input.type === "complaint" && input.reportedDeskId?.trim()) {
    body["reported_desk_id"] = input.reportedDeskId.trim();
  }
  return api.post<{ feedback: unknown; autoBlocked: boolean }>("/api/feedback", body);
}

/**
 * WhatsApp is a separate, faster channel for urgent complaints/suggestions
 * — it never touches our backend/database, it just opens WhatsApp with a
 * pre-filled message to the JoinDesk team's number. Same two pieces of
 * complaint context (name + desk) as the website form, so the admin gets
 * everything they need in the WhatsApp message itself.
 */
const WHATSAPP_NUMBER = "919589857573"; // +91 95898 57573, in wa.me format (no "+", no spaces)

export function buildWhatsAppLink(input: {
  type: FeedbackType;
  message: string;
  reportedName?: string | undefined;
  reportedDeskTitle?: string | undefined;
}) {
  const lines: string[] = [];
  if (input.type === "complaint") {
    lines.push("*New JoinDesk complaint — need a fast response*");
    lines.push(`Person: ${input.reportedName?.trim() || "Not specified"}`);
    lines.push(`Desk: ${input.reportedDeskTitle?.trim() || "Not specified"}`);
    lines.push(`Details: ${input.message.trim() || "Not specified"}`);
  } else {
    lines.push("*New JoinDesk suggestion*");
    lines.push(input.message.trim() || "Not specified");
  }

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}
