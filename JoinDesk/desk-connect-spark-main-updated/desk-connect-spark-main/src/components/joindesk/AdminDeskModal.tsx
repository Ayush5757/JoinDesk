import { useEffect, useState } from "react";
import { Info, Link as LinkIcon, Sparkles } from "lucide-react";
import { Modal } from "@/components/joindesk/Modal";
import { topics, type Desk } from "@/lib/joindesk";

export type AdminDeskFormValues = {
  title: string;
  description: string;
  meetLink: string;
  topic: string;
  isSpecial: boolean;
};

export function AdminDeskModal({
  open,
  desk,
  onClose,
  onSave,
}: {
  open: boolean;
  /** null = creating a new desk, otherwise editing this one */
  desk: Desk | null;
  onClose: () => void;
  onSave: (values: AdminDeskFormValues) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [topic, setTopic] = useState("Research");
  const [isSpecial, setIsSpecial] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (desk) {
      setTitle(desk.title);
      setDescription(desk.description);
      setMeetLink(desk.meetLink);
      setTopic(desk.topic);
      setIsSpecial(desk.isSpecial);
    } else {
      setTitle("");
      setDescription("");
      setMeetLink("");
      setTopic("Research");
      setIsSpecial(true);
    }
    setError("");
  }, [open, desk]);

  const field =
    "w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-soft";

  const submit = async () => {
    if (!title.trim()) return setError("Please add a title.");
    if (!/^https?:\/\/(meet\.google\.com|.+)\/.+/i.test(meetLink.trim()))
      return setError("Enter a valid meeting link, e.g. https://meet.google.com/abc-defg-hij");

    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        meetLink: meetLink.trim(),
        topic,
        isSpecial,
      });
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="pr-8 text-xl font-bold tracking-tight">
        {desk ? "Edit Desk" : "Create Desk"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Admin Panel — full control over this desk.</p>

      <button
        type="button"
        onClick={() => setIsSpecial((v) => !v)}
        className={
          "mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors " +
          (isSpecial ? "border-special/40 bg-special-soft" : "border-border bg-muted/40")
        }
      >
        <span className="flex items-center gap-2.5">
          <Sparkles className={"h-4 w-4 " + (isSpecial ? "text-special" : "text-muted-foreground")} />
          <span>
            <span className="block text-sm font-semibold">Mark as Special Desk</span>
            <span className="block text-xs text-muted-foreground">
              Never expires · hides your name/avatar (shows "JoinDesk" instead)
            </span>
          </span>
        </span>
        <span
          className={
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
            (isSpecial ? "bg-special-gradient" : "bg-border")
          }
        >
          <span
            className={
              "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform " +
              (isSpecial ? "translate-x-6" : "translate-x-1")
            }
          />
        </span>
      </button>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Topic Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={"mt-1.5 " + field} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={"mt-1.5 resize-none " + field}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Category</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className={"mt-1.5 " + field}>
            {topics
              .filter((t) => t !== "All Desks")
              .map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Google Meet Link *</label>
          <div className="relative mt-1.5">
            <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className={field + " pl-11"}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-2xl bg-info-soft p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-info">
          When your Google Meet link expires (usually monthly), come back and edit this desk with
          the new link — nothing else about it changes.
        </p>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-full bg-special-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Saving…" : desk ? "Save Changes" : "Create Desk"}
        </button>
      </div>
    </Modal>
  );
}
