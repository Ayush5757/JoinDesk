import { useEffect, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { getSigningIn, preloadGoogleSignIn, subscribeSigningIn } from "@/lib/auth";

/**
 * Shown on top of any page while signing in, from the click until the account is ready, so the screen never
 * looks frozen. Also warms up Google's sign-in script as soon as the app opens.
 */
export function SigningInOverlay() {
  const busy = useSyncExternalStore(subscribeSigningIn, getSigningIn, () => false);

  useEffect(() => {
    preloadGoogleSignIn();
  }, []);

  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/70 backdrop-blur-sm duration-200 animate-in fade-in">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold shadow-glow">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}
