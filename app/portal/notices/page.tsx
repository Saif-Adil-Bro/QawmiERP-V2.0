import { createClient } from "@/lib/supabase/server";
import { Bell, Calendar, Tag, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ParentPortalNotices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">মাদরাসা নোটিশ ও জরুরি ঘোষণা</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            মাদরাসার ছুটি, পরীক্ষার তারিখ ও গুরুত্বপূর্ণ বিজ্ঞপ্তি এখানে দেখুন।
          </p>
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {notices && notices.length > 0 ? (
          notices.map((n) => (
            <div
              key={n.id}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{n.category || "সাধারণ নোটিশ"}</span>
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{n.created_at ? new Date(n.created_at).toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "-"}</span>
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900">{n.title}</h2>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{n.content}</p>
            </div>
          ))
        ) : (
          <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700">বর্তমানে কোন নতুন নোটিশ নেই</h4>
            <p className="text-xs text-slate-400 mt-1">মাদরাসা থেকে নতুন ঘোষণা দেওয়া হলে এখানে দেখতে পাবেন।</p>
          </div>
        )}
      </div>
    </div>
  );
}
