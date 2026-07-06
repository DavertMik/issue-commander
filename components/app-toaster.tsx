"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/hooks/use-app-store";
import { themeById } from "@/lib/themes";

const noop = () => () => {};

/** True after hydration, false on the server / during the initial hydration render. */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Sonner toaster wired to the active app theme. Toast colors come from the `--popover*`
 * CSS variables (see ui/sonner.tsx), so this only needs to hand sonner the light/dark
 * mode for its own base styling.
 *
 * The store seeds the theme from localStorage synchronously, so before hydration we
 * render the SSR default ("dark") to avoid a mismatch, then switch to the real mode.
 */
export function AppToaster() {
  const hydrated = useHydrated();
  const mode = useAppStore((s) => themeById(s.theme).mode);
  return <Toaster position="bottom-right" theme={hydrated ? mode : "dark"} />;
}
