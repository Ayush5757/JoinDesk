import { api } from "./api";

export type FeedbackType = "suggestion" | "complaint";

export type FeedbackInput = {
  type: FeedbackType;
  message: string;
  /** Only used for complaints — the User ID visible in a profile page's URL. */
  reportedUserId?: string | undefined;
};

export async function submitFeedback(input: FeedbackInput) {
  const body: Record<string, unknown> = { type: input.type, message: input.message };
  if (input.type === "complaint" && input.reportedUserId?.trim()) {
    body["reported_user_id"] = input.reportedUserId.trim();
  }
  return api.post<{ feedback: unknown; autoBlocked: boolean }>("/api/feedback", body);
}
