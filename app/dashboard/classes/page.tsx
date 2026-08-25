import { getClasses } from "@/app/actions/classes";
import ClassesClient from "./ClassesClient";

export default async function ClassesPage() {
  const classes = await getClasses();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">জামাত ব্যবস্থাপনা ও প্রমোশন পোর্টাল</h1>
          <p className="text-xs text-slate-500 mt-1">মাদরাসার জামাতসমূহ, তাদের ক্রমবিন্যাস এবং শিক্ষার্থীদের প্রমোশন এক জায়গায় পরিচালনা করুন।</p>
        </div>
      </div>

      <ClassesClient initialClasses={classes as any} />
    </div>
  );
}

