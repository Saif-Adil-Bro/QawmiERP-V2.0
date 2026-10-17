import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PortalShell from "./PortalShell";

export const dynamic = "force-dynamic";

/**
 * অভিভাবক/শিক্ষার্থী পোর্টালের লেআউট।
 *
 * ⛔ L-2 ফিক্স (ব্যাখ্যা ও হ্যান্ডলিং): Server Component (RSC) থেকে কুকি **লেখা যায় না** —
 * `@supabase/ssr` সেশন রিফ্রেশের সময় নতুন cookie সেট করতে চাইলে `setAll` ব্যর্থ হয়
 * (আমাদের `lib/supabase/server.ts`-এ সেটি try/catch-এ ধরা আছে)। অর্থাৎ প্রতি রিকোয়েস্টে
 * টোকেন রিফ্রেশের দায়িত্ব মূলত `middleware.ts`-এর ওপর — middleware cookie লিখতে পারে
 * (hard navigation) এবং soft navigation-এ `getClaims()` দিয়ে লোকাল যাচাই করে।
 *
 * তাই এখানে সতর্কভাবে আচরণ করা হয়: সেশন যাচাইয়ের ত্রুটি আর "সেশন নেই" — দুটোকে
 * আলাদা করে দেখা হয়; কেবল সত্যিই সেশন না থাকলে লগইন পেজে পাঠানো হয়, সাময়িক
 * নেটওয়ার্ক/রিফ্রেশ ত্রুটিতে ব্যবহারকারীকে অনর্থক লগআউট করা হয় না।
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession(); // কুকি-ভিত্তিক লোকাল সেশন (কোনো নেটওয়ার্ক কল নয়)

  if (!session) {
    // সেশনই নেই — পোর্টাল চালানো যাবে না
    redirect("/login");
  }

  // সেশন থাকলে সার্ভারের কাছে যাচাই (এখানে RSC-তে cookie রিফ্রেশ হবে না —
  // সেটি middleware-এর কাজ; তাই ত্রুটি এলেও সেশন থাকা পর্যন্ত এগোনো হয়)।
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user && userError) {
    console.warn(
      "Portal: সেশন আছে কিন্তু ব্যবহারকারী যাচাই করা গেল না (টোকেন রিফ্রেশ middleware-এর ওপর নির্ভরশীল):",
      userError.message
    );
  }

  const effectiveUser = user ?? session.user;

  if (!effectiveUser) {
    redirect("/login");
  }

  // Fetch user profile (RLS/মিসিং রো হলেও পোর্টাল যেন ক্র্যাশ না করে — userData null থাকবে)
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", effectiveUser.id)
    .maybeSingle();

  return (
    <PortalShell user={effectiveUser} userData={userData}>
      {children}
    </PortalShell>
  );
}
