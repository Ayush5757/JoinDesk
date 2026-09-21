import { api } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";

/** Public — anyone logged in can read the current site-wide notice. */
export async function getAnnouncement() {
  const { message } = await api.get<{ message: string | null }>("/api/announcement");
  return message;
}

/** Admin-only — sets or clears (pass "") the notice banner. */
export function adminSetAnnouncement(message: string) {
  return adminApi.patch<{ message: string | null }>("/api/admin/announcement", { message });
}
