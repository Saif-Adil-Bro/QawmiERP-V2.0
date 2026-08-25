import { createClient } from "@/lib/supabase/server";
import { addDonor, deleteDonor } from "@/app/actions/zakat";
import { Users, Trash2, PlusCircle } from "lucide-react";

export default async function DonorsPage() {
  const supabase = await createClient();
  const { data: donors } = await supabase
    .from("donors")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">দাতাদের তালিকা</h1>
          <p className="text-slate-500">যাকাত ও অনুদান প্রদানকারীদের তথ্য</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <PlusCircle className="w-5 h-5 mr-2 text-blue-600" />
            নতুন দাতা যুক্ত করুন
          </h2>
          <form action={addDonor} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">নাম</label>
              <input type="text" name="name" required className="w-full p-2 border rounded-md" placeholder="দাতার নাম" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">মোবাইল নম্বর</label>
              <input type="text" name="phone" className="w-full p-2 border rounded-md" placeholder="০১৭..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ঠিকানা</label>
              <input type="text" name="address" className="w-full p-2 border rounded-md" placeholder="ঠিকানা" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">দাতার ধরন</label>
              <select name="donor_type" className="w-full p-2 border rounded-md">
                <option value="General">সাধারণ (General)</option>
                <option value="Zakat">যাকাত দাতা (Zakat)</option>
                <option value="Lillah">লিল্লাহ (Lillah)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition">
              যুক্ত করুন
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-700">নাম</th>
                  <th className="p-4 font-semibold text-slate-700">যোগাযোগ</th>
                  <th className="p-4 font-semibold text-slate-700">ধরন</th>
                  <th className="p-4 font-semibold text-slate-700 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {donors?.map((donor) => (
                  <tr key={donor.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-800">{donor.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{donor.phone || "-"}</div>
                      <div className="text-xs text-slate-500">{donor.address}</div>
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        donor.donor_type === 'Zakat' ? 'bg-amber-100 text-amber-700' :
                        donor.donor_type === 'Lillah' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {donor.donor_type}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <form action={async () => {
                        "use server";
                        await deleteDonor(donor.id);
                      }}>
                        <button type="submit" className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition" title="মুছে ফেলুন">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!donors || donors.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      কোনো দাতার তথ্য পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
