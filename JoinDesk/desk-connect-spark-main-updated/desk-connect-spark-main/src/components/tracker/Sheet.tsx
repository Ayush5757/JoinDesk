import type { ReactNode } from "react";

/**
 * Soft centred card on a blurred backdrop. `onClose` is optional on purpose:
 * leave it out for steps that must be completed (e.g. saving yesterday's
 * progress) and tapping outside simply does nothing.
 */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: (() => void) | undefined }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/30 p-4 backdrop-blur-md duration-200 animate-in fade-in sm:items-center">
      {onClose && <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />}
      <div className="relative w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-glow duration-300 animate-in zoom-in-95 slide-in-from-bottom-4">
        {children}
      </div>
    </div>
  );
}
