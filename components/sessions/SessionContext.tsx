"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AcademicSession } from "@/lib/sessions";
import {
  getAcademicSessions,
  getCurrentSession,
  setSelectedSessionCookie,
} from "@/app/actions/sessions";

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
  initialSessions = [],
  initialSelectedSessionId = null,
}: {
  children: React.ReactNode;
  initialSessions?: AcademicSession[];
  initialSelectedSessionId?: string | null;
}) {
  const [sessions, setSessions] = useState<AcademicSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId);
  const [isLoading, setIsLoading] = useState(initialSessions.length === 0);

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
