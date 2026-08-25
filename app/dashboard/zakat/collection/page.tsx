import { createClient } from "@/lib/supabase/server";
import { addDonation, deleteDonation } from "@/app/actions/zakat";
import { HeartHandshake, Trash2, PlusCircle } from "lucide-react";

export default async function ZakatCollectionPage() {
  const supabase = await createClient();
  const { data: donors } = await supabase.from("donors").select("id, name, phone").order("name");
  
  const { data: donations } = await supabase
    .from("donations")
    .select(`
      *,
      donors (
        name,
        phone
      )
    `)
    .order("donation_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">যাকাত ও অনুদান সংগ্রহ</h1>
          <p className="text-slate-500">নতুন যাকাত ও অনুদান গ্রহণ এবং রসিদ প্রদান</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <PlusCircle className="w-5 h-5 mr-2 text-emerald-600" />
            নতুন কালেকশন যুক্ত করুন
          </h2>
          <form action={addDonation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">দাতা নির্বাচন করুন (ঐচ্ছিক)</label>
              <select name="donor_id" className="w-full p-2 border rounded-md">
                <option value="">-- দাতা নির্বাচন --</option>
                {donors?.map(donor => (
                  <option key={donor.id} value={donor.id}>{donor.name} {donor.phone ? `(${donor.phone})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">পরিমাণ (৳)</label>
              <input type="number" name="amount" required min="1" className="w-full p-2 border rounded-md" placeholder="যেমন: 5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">খাত (Type)</label>
              <select name="donation_type" className="w-full p-2 border rounded-md" required>
                <option value="Zakat">যাকাত (Zakat)</option>
                <option value="Lillah">লিল্লাহ বোর্ডিং (Lillah)</option>
                <option value="Fitra">ফিতরা (Fitra)</option>
                <option value="General">সাধারণ অনুদান (General)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">তারিখ</label>
              <input type="date" name="donation_date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">রসিদ নম্বর (ঐচ্ছিক)</label>
              <input type="text" name="receipt_no" className="w-full p-2 border rounded-md" placeholder="রসিদ নম্বর" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">নোট</label>
              <input type="text" name="notes" className="w-full p-2 border rounded-md" placeholder="সংক্ষিপ্ত বিবরণ" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition">
              সংগ্রহ করুন
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-700">তারিখ ও রসিদ</th>
                  <th className="p-4 font-semibold text-slate-700">দাতার নাম</th>
                  <th className="p-4 font-semibold text-slate-700">খাত</th>
                  <th className="p-4 font-semibold text-slate-700">পরিমাণ</th>
                  <th className="p-4 font-semibold text-slate-700 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {donations?.map((donation) => (
                  <tr key={donation.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-800">{new Date(donation.donation_date).toLocaleDateString('bn-BD')}</div>
                      {donation.receipt_no && <div className="text-xs text-slate-500">রসিদ: {donation.receipt_no}</div>}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">
                        {donation.donors?.name || "অজ্ঞাত দাতা"}
                      </div>
                      <div className="text-xs text-slate-500">{donation.notes}</div>
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        donation.donation_type === 'Zakat' ? 'bg-amber-100 text-amber-700' :
                        donation.donation_type === 'Lillah' ? 'bg-indigo-100 text-indigo-700' :
                        donation.donation_type === 'Fitra' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {donation.donation_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">৳ {donation.amount.toLocaleString()}</div>
                    </td>
                    <td className="p-4 text-right">
                      <form action={async () => {
                        "use server";
                        await deleteDonation(donation.id);
                      }}>
                        <button type="submit" className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition" title="মুছে ফেলুন">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!donations || donations.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      কোনো কালেকশন পাওয়া যায়নি
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
