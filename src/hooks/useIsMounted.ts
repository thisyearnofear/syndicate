"use client";

/**
 * useIsMounted
 *
 * Returns `false` during SSR and the first client (hydration) render, then
 * `true` for every render after hydration — the same contract as the classic
 * `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`
 * pattern, but without the effect, the extra render, or the lint suppression
 * that the old pattern required.
 *
 * Implemented with `useSyncExternalStore`: the store never changes, so the
 * client snapshot (`true`) is returned immediately after hydration and the
 * server snapshot (`false`) is used for SSR, which also makes it
 * hydration-mismatch safe.
 *
 * Usage:
 *   const mounted = useIsMounted();
 *   if (!mounted) return null; // or gate portals/modals/hydration-only UI
 */

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export default useIsMounted;
