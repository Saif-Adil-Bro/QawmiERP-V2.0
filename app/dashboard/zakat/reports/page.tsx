import { createClient } from "@/lib/supabase/server";
import { FileText, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default async function ZakatReportsPage() {
  const supabase = await createClient();
  const { data: donations } = await supabase.from("donations").select("amount, donation_type");

  let totalZakat = 0;
  let totalLillah = 0;
  let totalFitra = 0;
  let totalGeneral = 0;

  donations?.forEach(d => {
    const amount = Number(d.amount);
    if (d.donation_type === 'Zakat') totalZakat += amount;
    else if (d.donation_type === 'Lillah') totalLillah += amount;
    else if (d.donation_type === 'Fitra') totalFitra += amount;
    else totalGeneral += amount;
  });

  const totalFund = totalZakat + totalLillah + totalFitra + totalGeneral;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">যাকাত ফান্ড রিপোর্ট</h1>
          <p className="text-slate-500">যাকাত ও অনুদানের বিস্তারিত আর্থিক রিপোর্ট</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-amber-100 p-3 rounded-lg">
            <Wallet className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">যাকাত ফান্ড</p>
            <h3 className="text-xl font-bold text-slate-800">৳ {totalZakat.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-indigo-100 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">লিল্লাহ বোর্ডিং</p>
            <h3 className="text-xl font-bold text-slate-800">৳ {totalLillah.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-rose-100 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">ফিতরা</p>
            <h3 className="text-xl font-bold text-slate-800">৳ {totalFitra.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="bg-emerald-100 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">সাধারণ অনুদান</p>
            <h3 className="text-xl font-bold text-slate-800">৳ {totalGeneral.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">মোট সংগৃহীত ফান্ড</h2>
        <div className="flex items-end space-x-2">
          <span className="text-4xl font-bold text-slate-800">৳ {totalFund.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
