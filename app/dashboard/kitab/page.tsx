import { getKitabStudents } from "@/app/actions/kitab";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default async function KitabPage() {
  const students = await getKitabStudents();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">কিতাব ট্র্যাকিং</h1>
          <p className="text-slate-500 text-sm">শিক্ষার্থীদের দৈনন্দিন কিতাব পাঠ এবং পারফরম্যান্স পরিচালনা করুন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {students.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p>কোনো কিতাব বিভাগের শিক্ষার্থী পাওয়া যায়নি।</p>
            <p className="text-sm mt-1">শিক্ষার্থী যুক্ত করুন এবং তাদের ক্লাস "কিতাব" সম্পর্কিত নির্ধারণ করুন।</p>
            <Link href="/dashboard/students/new" className="inline-block mt-4 text-blue-600 hover:underline">
              নতুন শিক্ষার্থী
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">রোল নম্বর</th>
                  <th className="px-6 py-4 font-medium">শিক্ষার্থীর নাম</th>
                  <th className="px-6 py-4 font-medium">ক্লাস</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">{student.roll_number || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {student.class_name || 'অনির্ধারিত'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/kitab/${student.id}`}
                        className="inline-flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md"
                      >
                        <span>লগ দেখুন</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
