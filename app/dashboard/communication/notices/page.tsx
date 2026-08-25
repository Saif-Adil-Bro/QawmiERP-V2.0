import { createClient } from "@/lib/supabase/server";
import { addNotice, deleteNotice } from "@/app/actions/communication";
import { Bell, Trash2, PlusCircle } from "lucide-react";

export default async function NoticesPage() {
  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select(`
      *,
      classes ( name )
    `)
    .order("created_at", { ascending: false });

  const { data: classes } = await supabase.from("classes").select("id, name");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ডিজিটাল নোটিশ বোর্ড</h1>
          <p className="text-slate-500">ছাত্র, শিক্ষক এবং অভিভাবকদের জন্য নোটিশ প্রদান</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <PlusCircle className="w-5 h-5 mr-2 text-amber-600" />
            নতুন নোটিশ
          </h2>
          <form action={addNotice} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">শিরোনাম</label>
              <input type="text" name="title" required className="w-full p-2 border rounded-md" placeholder="নোটিশের শিরোনাম" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">প্রাপক (কাদের জন্য)</label>
              <select name="target_audience" className="w-full p-2 border rounded-md">
                <option value="All">সকলের জন্য</option>
                <option value="Teachers">শুধু শিক্ষকদের জন্য</option>
                <option value="Students">শুধু ছাত্রদের জন্য</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">বিস্তারিত</label>
              <textarea name="content" required rows={5} className="w-full p-2 border rounded-md" placeholder="নোটিশের বিস্তারিত অংশ..."></textarea>
            </div>
            <button type="submit" className="w-full bg-amber-600 text-white py-2 rounded-md hover:bg-amber-700 transition">
              প্রকাশ করুন
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {notices?.map((notice) => (
            <div key={notice.id} className="bg-white p-6 rounded-xl border shadow-sm relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="bg-amber-100 p-3 rounded-full text-amber-600 mt-1">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{notice.title}</h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1 mb-3">
                      <span>{new Date(notice.created_at).toLocaleDateString('bn-BD')}</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        notice.target_audience === 'Teachers' ? 'bg-indigo-100 text-indigo-700' :
                        notice.target_audience === 'Students' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {notice.target_audience === 'All' ? 'সকলের জন্য' : 
                         notice.target_audience === 'Teachers' ? 'শিক্ষক' : 'ছাত্র'}
                      </span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-wrap">{notice.content}</p>
                  </div>
                </div>
                
                <form action={async () => {
                  "use server";
                  await deleteNotice(notice.id);
                }}>
                  <button type="submit" className="text-red-500 hover:bg-red-50 p-2 rounded-md transition opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ))}

          {(!notices || notices.length === 0) && (
            <div className="bg-white p-8 text-center rounded-xl border border-dashed">
              <p className="text-slate-500">কোনো নোটিশ পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
