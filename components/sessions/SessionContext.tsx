"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AcademicSession } from "@/lib/sessions";
import {
  getAcademicSessions,
  getCurrentSession,
  setSelectedSessionCookie,
} from "@/app/actions/sessions";

// IMPORTANT: this must be a stable, module-level reference — not an inline
// "[]" default parameter. Every call to SessionProvider() without an
// explicit initialSessions prop (which is how DashboardShell renders it:
// <SessionProvider>{children}</SessionProvider>, no props) re-evaluates an
// inline "[]" default on EVERY render, producing a brand new array
// reference each time even though it's logically still empty. Since the
// effect below depends on initialSessions by reference, that made the
// effect think its dependency changed on every single render, re-running
// fetchSessions() forever: fetch -> state update -> re-render -> new []
// -> effect fires again -> fetch again, in an infinite loop throttled only
// by network latency (this is what showed up as a request "racing"/looping
// every 1-2 seconds and was competing for bandwidth with real navigation
// clicks on a slow connection). Using this shared constant keeps the
// reference identical across renders, so the dependency comparison is
// stable and the effect only runs when initialSessions is genuinely a new
// (server-supplied) array.
const EMPTY_SESSIONS: AcademicSession[] = [];

interface SessionContextType {
  sessions: AcademicSession[];
  currentSession: AcademicSession | null;
  selectedSession: AcademicSession | null;
  selectedSessionId: string | null;
  isArchived: boolean;
  isLoading: boolean;
  changeSelectedSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
  children,
  initialSessions = EMPTY_SESSIONS,
  initialSelectedSessionId = null,
}: {
  children: React.ReactNode;
  initialSessions?: AcademicSession[];
  initialSelectedSessionId?: string | null;
}) {
  const [sessions, setSessions] = useState<AcademicSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId);
  const [isLoading, setIsLoading] = useState(initialSessions.length === 0);
  // Defense-in-depth against the reference-identity bug fixed above: even
  // if some future caller passes a fresh array on every render again, this
  // ref ensures the initial client-side fetch only ever fires once per
  // mount instead of looping.
  const hasFetchedRef = React.useRef(false);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAcademicSessions();
      setSessions(data);

      // Determine selected session if not set or invalid
      if (data.length > 0) {
        setSelectedSessionId((prev) => {
          if (prev && data.some((s) => s.id === prev)) {
            return prev;
          }
          const curr = data.find((s) => s.is_current) || data[0];
          return curr ? curr.id : null;
        });
      }
    } catch (err) {
      console.error("Error loading sessions in provider:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSessions.length === 0) {
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;
      fetchSessions();
    } else if (!selectedSessionId && initialSessions.length > 0) {
      const curr = initialSessions.find((s) => s.is_current) || initialSessions[0];
      setSelectedSessionId(curr.id);
    }
  }, [fetchSessions, initialSessions, selectedSessionId]);

  const currentSession = sessions.find((s) => s.is_current) || sessions[0] || null;
  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) || currentSession || null;

  const isArchived = selectedSession?.status === "ARCHIVED";

  const changeSelectedSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    try {
      await setSelectedSessionCookie(sessionId);
      if (typeof window !== "undefined") {
        localStorage.setItem("qawmi_selected_session_id", sessionId);
      }
    } catch (err) {
      console.error("Error setting session cookie:", err);
    }
  };

  const refreshSessions = async () => {
    await fetchSessions();
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        selectedSession,
        selectedSessionId: selectedSession?.id || null,
        isArchived,
        isLoading,
        changeSelectedSession,
        refreshSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
