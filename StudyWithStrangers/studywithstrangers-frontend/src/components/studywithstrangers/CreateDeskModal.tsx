import { useRef, useState } from "react";
import { Info, Link as LinkIcon, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export type NewDeskInput = { title: string; subject: string; description: string; meetLink: string };

// A few one-tap starting points. People type their own words for anything else.
const SUBJECT_IDEAS = ["Exam preparation", "Physics", "Chemistry", "Biology", "Maths", "Computer Science"];

export function CreateDeskModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  // return false (or throw) if it failed, so the form keeps what was typed
  onCreate: (input: NewDeskInput) => Promise<boolean | void> | boolean | void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const subjectInput = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setSubject("");
    setDescription("");
    setMeetLink("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) return setError("Please add a topic title for your desk.");
    if (!subject.trim()) return setError("Tell us the subject or field (e.g. Biology, Physics, Computer Science).");
    if (/^exam preparation:?$/i.test(subject.trim())) return setError('Which exam? For example "Exam preparation: JEE" or just "JEE preparation".');
    if (!/^https?:\/\/.+\..+/i.test(meetLink.trim()))
      return setError("Enter a valid meeting link, e.g. https://meet.google.com/abc-defg-hij or https://zoom.us/j/123456789");
    setSaving(true);
    try {
      const ok = await onCreate({
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        meetLink: meetLink.trim(),
      });
      if (ok !== false) reset(); // clear the form only once it really worked
    } catch {
      /* the caller shows the error; the form keeps what was typed */
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-soft";

  return (
    <Modal open={open} onClose={handleClose}>
      <h2 className="pr-8 text-xl font-bold tracking-tight">Create a Focus Desk</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Launch a new desk for others to discover and join your call — Google Meet, Zoom, Microsoft
        Teams, or anything else.
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
          <label className="text-xs font-semibold text-muted-foreground">Subject / Field *</label>
          <input
            ref={subjectInput}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={60}
            placeholder="e.g., JEE preparation, Biology, Computer Science"
            className={"mt-1.5 " + field}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUBJECT_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  setSubject(idea === "Exam preparation" ? "Exam preparation: " : idea);
                  subjectInput.current?.focus();
                }}
                className={
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors " +
                  (subject.trim().toLowerCase().replace(/:$/, "") === idea.toLowerCase()
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-card hover:bg-muted")
                }
              >
                {idea}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Tell us in a few words what you're studying or preparing for. Examples: "JEE preparation", "NEET Biology",
            "UPSC", "Class 12 Physics", "Computer Science", "Spoken English". People find your desk by searching this.
          </p>
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
          <label className="text-xs font-semibold text-muted-foreground">Meeting Link *</label>
          <div className="relative mt-1.5">
            <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/…"
              className={field + " pl-11"}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Paste a link from any platform — Google Meet, Zoom, Microsoft Teams, Skype, Webex, or
            anything else people can click to join your call.
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-2xl bg-info-soft p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-info">
          This desk stays active for 3 hours, then it leaves the list. You can reuse it from your profile for another
          3 hours any time. Make sure your meeting link is active!
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
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Launching…" : "Launch Desk"}
        </button>
      </div>
    </Modal>
  );
}
