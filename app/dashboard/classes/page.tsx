import { getClasses, getTeachersForClassAssignment } from "@/app/actions/classes";
import ClassesClient from "./ClassesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClassesPage() {
  const [classes, teachers] = await Promise.all([
    getClasses(),
    getTeachersForClassAssignment(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">জামাত ও শ্রেণি ব্যবস্থাপনা</h1>
          <p className="text-xs text-slate-500 mt-1">
            মাদরাসার জামাতসমূহ, তাদের শ্রেণি জিম্মাদার শিক্ষক নির্বাচন, ক্রমবিন্যাস ও শিক্ষার্থী প্রমোশন পোর্টাল
          </p>
        </div>
      </div>

      <ClassesClient
        initialClasses={classes as any}
        availableTeachers={teachers || []}
      />
    </div>
  );
}
