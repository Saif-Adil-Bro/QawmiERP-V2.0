import { workspace } from "@/lib/student-health/staff";
import { HealthError } from "@/lib/student-health/store";
import StudentHealthClient from "./StudentHealthClient";
export const dynamic = "force-dynamic";
export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; notify?: string }>;
}) {
  try {
    const [data, params] = await Promise.all([workspace(), searchParams]);
    return (
      <StudentHealthClient
        {...data}
        initialNew={params.new === "1"}
        initialNotify={params.notify}
      />
    );
  } catch (e) {
    return (
      <p role="alert" className="rounded-xl border p-5">
        {e instanceof HealthError
          ? e.message
          : "স্বাস্থ্য নথি লোড হয়নি। সংযোগ যাচাই করে আবার চেষ্টা করুন।"}
      </p>
    );
  }
}
