import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Network status hook. Defaults to online and only shows offline
 * when a check definitively fails. Uses your own Supabase URL as the
 * probe — avoids false positives from blocked Google URLs.
 * Shows offline banner only after 2 consecutive failures.
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const failCount = useRef(0);

  const check = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      // Probe our own Supabase — if this works, we have internet
      await fetch("https://xclsnfqjwjaatmvvxpea.supabase.co/health", {
        method: "HEAD",
        cache: "no-cache",
        signal: controller.signal,
      });
      clearTimeout(timer);
      failCount.current = 0;
      setIsOnline(true);
    } catch {
      clearTimeout(timer);
      failCount.current += 1;
      // Only show offline after 2 consecutive failures to avoid false positives
      if (failCount.current >= 2) {
        setIsOnline(false);
      }
    }
  };

  useEffect(() => {
    // Delay initial check by 2s so app finishes loading first
    const initialDelay = setTimeout(() => void check(), 2000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        failCount.current = 0;
        setIsOnline(true); // Optimistically online when app comes to foreground
        setTimeout(() => void check(), 1000);
      }
    });
    return () => {
      clearTimeout(initialDelay);
      sub.remove();
    };
  }, []);

  return { isOnline };
};
