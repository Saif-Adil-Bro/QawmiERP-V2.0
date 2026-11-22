"use client";
import { useOfflineChildHifz } from "@/hooks/useOfflinePortalData";
import { StudentReport } from "./Report";
import type { HifzBundle } from "@/lib/hifz-utils";
export default function FamilyReport({
  bundle,
  studentId,
}: {
  bundle: HifzBundle;
  studentId: string;
}) {
  const offline = useOfflineChildHifz(studentId);
  return <StudentReport bundle={offline || bundle} studentId={studentId} />;
}
