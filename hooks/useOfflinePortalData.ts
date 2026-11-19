"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDb } from "@/lib/offlineDb";

/**
 * Reactive live queries from Dexie IndexedDB for Student / Guardian / Teacher portals.
 * Automatically updates UI whenever initialFullSync() or backgroundSync() updates local tables.
 */
export function useOfflinePortalSnapshot() {
  const data = useLiveQuery(async () => {
    if (typeof window === "undefined") return null;
    const db = getOfflineDb();
    const [
      profiles,
      students,
      classes,
      attendance,
      fees,
      examResults,
      hifzLogs,
      kitabLogs,
      notices,
      routines,
      academicCalendar,
      homework,
    ] = await Promise.all([
      db.portalProfiles.toArray(),
      db.students.toArray(),
      db.classes.toArray(),
      db.attendance.toArray(),
      db.fees.toArray(),
      db.examResults.toArray(),
      db.hifzLogs.toArray(),
      db.kitabLogs.toArray(),
      db.notices.toArray(),
      db.routines.toArray(),
      db.academicCalendar.toArray(),
      db.homework.toArray(),
    ]);

    return {
      profile: profiles[0] || null,
      students,
      classes,
      attendance,
      fees,
      examResults,
      hifzLogs,
      kitabLogs,
      notices,
      routines,
      academicCalendar,
      homework,
    };
  }, []);

  return data ?? null;
}
