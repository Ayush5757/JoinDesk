import { Loader2 } from "lucide-react";

/** A calm full-page spinner, so a page that is getting ready never looks blank or broken. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {label && <p className="text-xs font-medium">{label}</p>}
      </div>
    </div>
  );
}
