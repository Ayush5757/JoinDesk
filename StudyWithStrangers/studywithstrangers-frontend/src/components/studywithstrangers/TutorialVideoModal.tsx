import { Modal } from "./Modal";
import { VideoEmbed } from "./VideoEmbed";

/**
 * The welcome video, opened on purpose from the "How it works" button. Closable, with normal controls, and it
 * starts playing as soon as it opens.
 */
export function TutorialVideoModal({ open, url, onClose }: { open: boolean; url: string; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} wide>
      <h2 className="pr-10 text-xl font-bold tracking-tight">How StudyWithStrangers works</h2>
      <div className="mt-4 overflow-hidden rounded-2xl">
        <VideoEmbed url={url} autoPlay />
      </div>
    </Modal>
  );
}
