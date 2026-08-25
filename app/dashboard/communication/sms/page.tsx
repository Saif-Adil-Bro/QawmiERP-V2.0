import { createClient } from "@/lib/supabase/server";
import { sendSMS } from "@/app/actions/communication";
import { Send, Users } from "lucide-react";

export default async function SMSPage() {
  const supabase = await createClient();
  const { data: students } = await supabase.from("students").select("id, first_name, last_name, parent_phone").order("first_name");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">এসএমএস (SMS) পাঠানো</h1>
          <p className="text-slate-500">ছাত্রদের অভিভাবক বা শিক্ষকদের কাছে মেসেজ পাঠান</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Send className="w-5 h-5 mr-2 text-blue-600" />
            নতুন মেসেজ পাঠান
          </h2>
          <form action={sendSMS} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">প্রাপক নির্বাচন করুন (নাম ও নম্বর)</label>
              <select name="recipient_name" className="w-full p-2 border rounded-md" required>
                <option value="">-- নির্বাচন করুন --</option>
                {students?.map((student) => (
                  <option key={student.id} value={`${student.first_name} ${student.last_name}`}>
                    {student.first_name} {student.last_name} {student.parent_phone ? `(${student.parent_phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">মোবাইল নম্বর</label>
              <input type="text" name="recipient_phone" required className="w-full p-2 border rounded-md" placeholder="০১৭..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">মেসেজের ধরন</label>
              <select name="message_type" className="w-full p-2 border rounded-md" required>
                <option value="Attendance">হাজিরা (Attendance)</option>
                <option value="Result">ফলাফল (Result)</option>
                <option value="Fee">ফি বকেয়া (Fee Due)</option>
                <option value="Notice">সাধারণ নোটিশ (General Notice)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">মেসেজ</label>
              <textarea name="message" required rows={4} className="w-full p-2 border rounded-md" placeholder="আপনার মেসেজ লিখুন..."></textarea>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition flex justify-center items-center">
              <Send className="w-4 h-4 mr-2" />
              এসএমএস পাঠান
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
           <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
             টেমপ্লেট (Templates)
           </h2>
           <div className="space-y-4">
             <div className="p-4 border rounded-md bg-slate-50 cursor-pointer hover:border-blue-300">
                <p className="font-semibold text-slate-700 mb-1">অনুপস্থিতি (Absence)</p>
                <p className="text-sm text-slate-600">সম্মানিত অভিভাবক, আপনার সন্তান আজ মাদ্রাসায় উপস্থিত হয়নি। দয়া করে যোগাযোগ করুন। - QawmiERP</p>
             </div>
             <div className="p-4 border rounded-md bg-slate-50 cursor-pointer hover:border-blue-300">
                <p className="font-semibold text-slate-700 mb-1">বকেয়া ফি (Due Fee)</p>
                <p className="text-sm text-slate-600">সম্মানিত অভিভাবক, আপনার সন্তানের চলতি মাসের বেতন বকেয়া রয়েছে। দয়া করে দ্রুত পরিশোধ করুন।</p>
             </div>
             <div className="p-4 border rounded-md bg-slate-50 cursor-pointer hover:border-blue-300">
                <p className="font-semibold text-slate-700 mb-1">পরীক্ষার ফলাফল (Exam Result)</p>
                <p className="text-sm text-slate-600">আপনার সন্তানের সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে। মাদ্রাসায় এসে সংগ্রহ করার অনুরোধ রইলো।</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
