"use client";

import { useAuth } from "@/lib/auth";
import type { LeadPriorityMode } from "@/lib/ai/lead-priority";
import { loadUserPrefs, saveUserPrefs } from "@/lib/user-prefs";
import { useEffect, useState } from "react";

/** Preferencia de orden de cola de leads, por usuario (localStorage). */
export function useLeadPriorityMode() {
  const { user } = useAuth();
  const [mode, setMode] = useState<LeadPriorityMode>(
    () => loadUserPrefs(user?.id).leadPriorityMode,
  );

  useEffect(() => {
    setMode(loadUserPrefs(user?.id).leadPriorityMode);
  }, [user?.id]);

  function setLeadPriorityMode(next: LeadPriorityMode) {
    setMode(next);
    if (!user?.id) return;
    const prefs = loadUserPrefs(user.id);
    saveUserPrefs(user.id, { ...prefs, leadPriorityMode: next });
  }

  return { mode, setLeadPriorityMode };
}
