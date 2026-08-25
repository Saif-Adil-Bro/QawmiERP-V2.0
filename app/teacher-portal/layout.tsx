import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, BookOpen, User } from "lucide-react";
import { logout } from "@/app/actions/auth";
import TeacherNav from "./TeacherNav";

export default async function TeacherPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's role and details
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-4 bg-slate-950 flex items-center justify-center">
          <BookOpen className="w-6 h-6 mr-2 text-white" />
          <span className="text-xl font-bold text-white tracking-tight">Teacher Portal</span>
        </div>
        
        {/* Dynamic Navigation */}
        <TeacherNav />

        <div className="p-4 bg-slate-950">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold mr-3">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{userData?.full_name || 'Teacher'}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <form action={logout}>
            <button className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
