import { useEffect, useRef } from "react";

export function useAutoRefresh(enabled: boolean, intervalMs: number, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      fnRef.current();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
}
