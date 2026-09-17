"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getFeeMetadata } from "./fee-management";

export interface UniversalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: "student" | "receipt" | "donor" | "library" | "academic" | "action" | "navigation";
  categoryLabel: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

export async function searchUniversalCommand(query: string): Promise<UniversalSearchResultItem[]> {
  const cleanQuery = (query || "").trim().toLowerCase();
  if (!cleanQuery) return [];

  const results: UniversalSearchResultItem[] = [];

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const madrasaId = await getAuthMadrasaId(supabase);

    // 1. Fetch Students
    try {
      const { data: students } = await adminClient
        .from("students")
        .select("id, first_name, last_name, roll_number, parent_phone, classes(name)")
        .eq("madrasa_id", madrasaId)
        .limit(200);

      (students || []).forEach((s: any) => {
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim().toLowerCase();
        const roll = String(s.roll_number || "").toLowerCase();
        const phone = String(s.parent_phone || "").toLowerCase();
        const className = String(s.classes?.name || "").toLowerCase();

        if (
          fullName.includes(cleanQuery) ||
          roll.includes(cleanQuery) ||
          phone.includes(cleanQuery) ||
          className.includes(cleanQuery)
        ) {
          results.push({
            id: `student-${s.id}`,
            title: `${s.first_name} ${s.last_name || ""}`,
            subtitle: `রোল: ${s.roll_number || "—"} | জামাত: ${s.classes?.name || "অনির্দিষ্ট"} | মোবা: ${s.parent_phone || "—"}`,
            category: "student",
            categoryLabel: "শিক্ষার্থী",
            href: `/dashboard/students/${s.id}`,
            badge: s.classes?.name,
            badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          });
        }
      });
    } catch (stdErr) {
      console.warn("Universal search students error:", stdErr);
    }

    // 2. Fetch Metadata (Fee receipts, Donors, Mahfils, Library)
    try {
      const meta = await getMadrasaMetadata(madrasaId);
      const feeMeta = await getFeeMetadata(madrasaId);

      // 2a. Fee Payments / Receipts
      const payments = feeMeta.payments || [];
      payments.forEach((p: any) => {
        const recNo = String(p.receipt_no || p.id || "").toLowerCase();
        const stdName = String(p.student_name || "").toLowerCase();
        const roll = String(p.roll_number || "").toLowerCase();
        const billingPeriod = String(p.allocations?.[0]?.billing_period || "").toLowerCase();

        if (
          recNo.includes(cleanQuery) ||
          stdName.includes(cleanQuery) ||
          roll.includes(cleanQuery) ||
          billingPeriod.includes(cleanQuery)
        ) {
          results.push({
            id: `payment-${p.id}`,
            title: `রসিদ নং: ${p.receipt_no || p.id}`,
            subtitle: `শিক্ষার্থী: ${p.student_name || "—"} | পরিমাণ: ৳${Number(p.total_amount_received || 0).toLocaleString("en-IN")} | তারিখ: ${p.payment_date || "—"}`,
            category: "receipt",
            categoryLabel: "ফি রসিদ",
            href: `/dashboard/accounting`,
            badge: `৳${p.total_amount_received || 0}`,
            badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
          });
        }
      });

      // 2b. Donors & Zakat Receipts
      const donors = meta.donors || [];
      donors.forEach((d: any) => {
        const dName = String(d.name || "").toLowerCase();
        const dPhone = String(d.phone || "").toLowerCase();
        const dAddress = String(d.address || "").toLowerCase();
        const dType = String(d.donor_type || "").toLowerCase();

        if (
          dName.includes(cleanQuery) ||
          dPhone.includes(cleanQuery) ||
          dAddress.includes(cleanQuery) ||
          dType.includes(cleanQuery)
        ) {
          results.push({
            id: `donor-${d.id}`,
            title: d.name,
            subtitle: `ফোন: ${d.phone || "—"} | ঠিকানা: ${d.address || "—"} | ধরন: ${d.donor_type || "সাধারণ দাতা"}`,
            category: "donor",
            categoryLabel: "দাতা ও শুভাকাঙ্ক্ষী",
            href: `/dashboard/fundraising/donors`,
            badge: d.donor_type || "সম্মানিত দাতা",
            badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
          });
        }
      });

      // 2c. Library Books
      const books = meta.library_books || [];
      books.forEach((b: any) => {
        const bTitle = String(b.title || b.name || "").toLowerCase();
        const bAuthor = String(b.author || "").toLowerCase();
        const bCode = String(b.accession_no || b.code || "").toLowerCase();

        if (bTitle.includes(cleanQuery) || bAuthor.includes(cleanQuery) || bCode.includes(cleanQuery)) {
          results.push({
            id: `book-${b.id || bCode}`,
            title: b.title || b.name,
            subtitle: `লেখক: ${b.author || "—"} | কিতাব কোড: ${b.accession_no || b.code || "—"}`,
            category: "library",
            categoryLabel: "কুতুবখানা ও কিতাব",
            href: `/dashboard/library`,
            badge: "কিতাব",
            badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
          });
        }
      });
    } catch (metaErr) {
      console.warn("Universal search metadata error:", metaErr);
    }

    // 3. Classes & Subjects
    try {
      const { data: classes } = await adminClient
        .from("classes")
        .select("id, name, arabic_name")
        .eq("madrasa_id", madrasaId);

      (classes || []).forEach((c: any) => {
        const cName = String(c.name || "").toLowerCase();
        const cAr = String(c.arabic_name || "").toLowerCase();

        if (cName.includes(cleanQuery) || cAr.includes(cleanQuery)) {
          results.push({
            id: `class-${c.id}`,
            title: c.name,
            subtitle: `আরবি নাম: ${c.arabic_name || "—"} | জামাত ও সিলেবাস ব্যবস্থাপনা`,
            category: "academic",
            categoryLabel: "জামাত (শ্রেণি)",
            href: `/dashboard/classes`,
            badge: "জামাত",
            badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
          });
        }
      });
    } catch (classErr) {
      console.warn("Universal search classes error:", classErr);
    }
  } catch (globalErr) {
    console.error("Global search error:", globalErr);
  }

  // Limit to top 25 results to maintain instantaneous UI response
  return results.slice(0, 25);
}
