import { getAdmissionApplications } from "@/app/actions/admissions";
import { getClasses } from "@/app/actions/students";
import AdmissionsClient from "./AdmissionsClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function AdmissionsPage() {
  const [applications, classes] = await Promise.all([
    getAdmissionApplications(),
    getClasses(),
  ]);

  return (
    <PermissionGuard permission="student.view">
      <AdmissionsClient
        initialApplications={applications || []}
        classes={classes || []}
      />
    </PermissionGuard>
  );
}
