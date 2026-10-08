import { getAdmissionApplications } from "@/app/actions/admissions";
import { getClasses } from "@/app/actions/students";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import AdmissionsClient from "./AdmissionsClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function AdmissionsPage() {
  const [applications, classes, madrasa] = await Promise.all([
    getAdmissionApplications(),
    getClasses(),
    getMadrasaInfo(),
  ]);

  return (
    <PermissionGuard permission="student.view">
      <AdmissionsClient
        initialApplications={applications || []}
        classes={classes || []}
        madrasaInfo={madrasa}
      />
    </PermissionGuard>
  );
}
