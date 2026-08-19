import { useState } from "react";
import { Info, Link as LinkIcon } from "lucide-react";
import { Modal } from "./Modal";

export type NewDeskInput = { title: string; description: string; meetLink: string };

export function CreateDeskModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewDeskInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("");
    setDescription("");
    setMeetLink("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!title.trim()) return setError("Please add a topic title for your desk.");
    if (!/^https?:\/\/(meet\.google\.com|.+)\/.+/i.test(meetLink.trim()))
      return setError("Enter a valid meeting link, e.g. https://meet.google.com/abc-defg-hij");
    onCreate({ title: title.trim(), description: description.trim(), meetLink: meetLink.trim() });
    reset();
  };

  const field =
    "w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-soft";

  return (
    <Modal open={open} onClose={handleClose}>
      <h2 className="pr-8 text-xl font-bold tracking-tight">Create a Focus Desk</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Launch a new desk for others to discover and join your Google Meet.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Topic Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Anatomy & Pharmacology or Reactjs Coding"
            className={"mt-1.5 " + field}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What are you working on or hoping to achieve?"
            className={"mt-1.5 resize-none " + field}
          />
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
          Note: This desk stays active for 3 hours to keep the platform fresh and clutter-free. Ensure
          your Google Meet link is active!
        </p>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          onClick={handleClose}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
        >
          Launch Desk
        </button>
      </div>
    </Modal>
  );
}
