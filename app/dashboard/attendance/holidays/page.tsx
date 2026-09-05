import { getAcademicHolidays } from "@/app/actions/holidays";
import { getClasses } from "@/app/actions/classes";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import HolidaysClient from "./HolidaysClient";
import Link from "next/link";
import { CalendarDays, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// Standard Qawmi Jamat names as fallback if database classes are not yet populated
const DEFAULT_QAWMI_CLASSES = [
  { id: "dawra", name: "দাওরায়ে হাদীস (মাস্টার্স)" },
  { id: "meshkat", name: "মেশকাত (ফযীলত)" },
  { id: "jalalain", name: "জালালাইন (সানাবিয়্যা উলইয়া)" },
  { id: "sharhe_bekaya", name: "শরহে বেকায়া" },
  { id: "hedaya", name: "হেদায়াতুন্নাহু" },
  { id: "kafiya", name: "কাফিয়া" },
  { id: "mizan", name: "মীযান ও মুনশাইব" },
  { id: "taisir", name: "তাইসীর ও ফার্সি" },
  { id: "hifz", name: "হিফজুল কুরআন বিভাগ" },
  { id: "najera", name: "নাজেরা বিভাগ" },
  { id: "nurani_3", name: "নূরানী ৩য় শ্রেণি" },
  { id: "nurani_2", name: "নূরানী ২য় শ্রেণি" },
  { id: "nurani_1", name: "নূরানী ১ম শ্রেণি" },
  { id: "maktab", name: "মক্তব ও শিশু শ্রেণি" },
];

export default async function AcademicHolidaysPage() {
  const [holidays, rawClasses, madrasaProfile] = await Promise.all([
    getAcademicHolidays(true), // include archived to allow filter toggle
    getClasses(),
    getMadrasaProfileWithLogo(),
  ]);

  // Ensure classes is a rich list
  const classes =
    rawClasses && rawClasses.length > 0
      ? rawClasses.map((c: any) => ({ id: c.id, name: c.name }))
      : DEFAULT_QAWMI_CLASSES;

  // Normalize madrasa info into flat structure
  const rawMadrasa = (madrasaProfile as any)?.madrasa || madrasaProfile || {};
  const weekendDays =
    Array.isArray(rawMadrasa.weekend_days) && rawMadrasa.weekend_days.length > 0
      ? rawMadrasa.weekend_days
      : Array.isArray(rawMadrasa.metadata?.weekend_days) && rawMadrasa.metadata.weekend_days.length > 0
      ? rawMadrasa.metadata.weekend_days
      : ["Friday"];

  const normalizedMadrasa = {
    ...rawMadrasa,
    id: rawMadrasa.id || "",
    name: rawMadrasa.name || "আল-মাদরাসাতুল ইসলামিয়া",
    address: rawMadrasa.address || "ঢাকা, বাংলাদেশ",
    phone: rawMadrasa.phone || rawMadrasa.contact_phone || "০১XXXXXXXXX",
    email: rawMadrasa.email || rawMadrasa.contact_email || "",
    registration_no: rawMadrasa.registration_no || rawMadrasa.reg_no || "১২৪৫/বি",
    established_year: rawMadrasa.established_year || "২০০২",
    principal_name: rawMadrasa.principal_name || "মুহতামিম / অধ্যক্ষ",
    logoUrl: (madrasaProfile as any)?.logoUrl || rawMadrasa.logo_url || "",
    signatureUrl: (madrasaProfile as any)?.signatureUrl || rawMadrasa.principal_signature_url || "",
    weekend_days: weekendDays,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/attendance" className="hover:text-emerald-600 transition">
              হাজিরা ও ছুটি
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">ছুটি ও অবকাশ ব্যবস্থাপনা</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-emerald-600" />
            ছুটি ও অবকাশ ব্যবস্থাপনা (Academic Holidays & Vacations)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            প্রথম সাময়িক, ঈদুল ফিতর, ঈদুল আযহা, রমজান ও অন্যান্য সাধারণ ছুটির তালিকা, নোটিশ ও পোর্টাল সমন্বয়
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/attendance"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            হাজিরা ড্যাশবোর্ড
          </Link>
        </div>
      </div>

      {/* Client Component */}
      <HolidaysClient
        initialHolidays={holidays}
        classes={classes}
        madrasaInfo={normalizedMadrasa}
        initialWeekendDays={weekendDays}
      />
    </div>
  );
}
