"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the device currently has a network connection.
 *
 * The editor keeps working fully offline; only GitHub sync and the AI
 * assistant need the internet, and they use this to disable their actions and
 * explain why instead of failing with a confusing network error.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
