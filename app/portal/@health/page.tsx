import { getPortalStudentData } from "@/lib/portal-data";
import { familyHealth } from "@/lib/student-health/portal";
import { ScopedFamilyHealth } from "@/components/student-health/FamilyHealthPanel";
export const dynamic = "force-dynamic";
// A parallel slot, not a tenant-wide layout query: searchParams always identify
// the same selected child as the page, even when entering a deep link directly.
export default async function HealthSlot({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const data = await getPortalStudentData((await searchParams).student_id);
  if (!data?.child) return null;
  const { adminClient, madrasaId, meta, child, user } = data,
    owner = `${madrasaId}:${user.id}`;
  const health = await familyHealth(
    adminClient,
    madrasaId,
    child.id,
    meta,
  ).catch(() => null);
  return (
    <ScopedFamilyHealth
      key={`${owner}:${child.id}`}
      owner={owner}
      childId={child.id}
      name={[child.first_name, child.last_name].filter(Boolean).join(" ")}
      health={health}
    />
  );
}
