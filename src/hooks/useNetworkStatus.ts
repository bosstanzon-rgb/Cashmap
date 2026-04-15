import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Simple network status hook using fetch-based connectivity check.
 * Returns isOnline boolean. Rechecks on app foreground.
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  const check = async () => {
    try {
      const res = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        cache: "no-cache",
        signal: AbortSignal.timeout(3000),
      });
      setIsOnline(res.status === 204 || res.ok);
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, []);

  return { isOnline };
};
