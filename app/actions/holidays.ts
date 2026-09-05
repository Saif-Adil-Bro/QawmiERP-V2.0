"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicHoliday, HOLIDAY_CATEGORIES } from "@/lib/sessions";

/**
 * Automatically syncs a holiday notice with the public.notices table
 * so that guardians and teachers see it instantly in their portals.
 */
async function syncHolidayNotice(holiday: AcademicHoliday, madrasaId: string) {
  try {
    const admin = await createAdminClient();
    const noticeTag = `[HOLIDAY_REF:${holiday.id}]`;

    if (!holiday.publish_to_portal || holiday.is_archived) {
      // If holiday is archived or unpublished, deactivate the notice
      await admin
        .from("notices")
        .update({ is_active: false })
        .eq("madrasa_id", madrasaId)
        .ilike("content", `%${noticeTag}%`);
      return;
    }

    const noticeTitle = `ছুটির বিজ্ঞপ্তি: ${holiday.title}`;
    const noticeContent = `এতদ্বারা সম্মানিত অভিভাবক, শিক্ষক ও শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, "${holiday.title}" উপলক্ষে আগামী ${holiday.start_date} হতে ${holiday.end_date} পর্যন্ত মোট ${holiday.total_days || 1} দিন মাদরাসার যাবতীয় পাঠদান কার্যক্রম বন্ধ থাকবে।${holiday.reopen_date ? `\n\nছুটি শেষে মাদরাসা পুনরায় খোলার তারিখ: ${holiday.reopen_date} খ্রিষ্টাব্দ (সকাল ৮:০০ ঘটিকা)` : ""}${holiday.description ? `\n\nবিশেষ নির্দেশনাবলী: ${holiday.description}` : ""}\n\nছুটিকালীন সময়ে শিক্ষার্থীদের নিয়মিত পাঁচ ওয়াক্ত নামায আদায়, কুরআন তিলাওয়াত ও পড়াশোনা বজায় রাখার জন্য অভিভাবকদের বিশেষভাবে অনুরোধ করা হলো।\n\n${noticeTag}`;

    const { data: existingNotices } = await admin
      .from("notices")
      .select("id")
      .eq("madrasa_id", madrasaId)
      .ilike("content", `%${noticeTag}%`)
      .limit(1);

    if (existingNotices && existingNotices.length > 0) {
      await admin
        .from("notices")
        .update({
          title: noticeTitle,
          content: noticeContent,
          target_audience: "All",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingNotices[0].id);
    } else {
      await admin
        .from("notices")
        .insert({
          madrasa_id: madrasaId,
          title: noticeTitle,
          content: noticeContent,
          target_audience: "All",
          is_active: true,
        });
    }
  } catch (syncErr) {
    console.warn("syncHolidayNotice warning:", syncErr);
  }
}

/**
 * Permanently removes synced holiday notice from the public.notices table
 */
async function deleteHolidayNotice(holidayId: string, madrasaId: string) {
  try {
    const admin = await createAdminClient();
    const noticeTag = `[HOLIDAY_REF:${holidayId}]`;
    await admin
      .from("notices")
      .delete()
      .eq("madrasa_id", madrasaId)
      .ilike("content", `%${noticeTag}%`);
  } catch (err) {
    console.warn("deleteHolidayNotice warning:", err);
  }
}

/**
 * Calculates total inclusive days between start and end date
 */
function calculateDays(start: string, end: string): number {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  } catch {
    return 1;
  }
}

/**
 * Computes status of a holiday based on current date
 */
function computeHolidayStatus(startDate: string, endDate: string): "upcoming" | "ongoing" | "completed" {
  const today = new Date().toISOString().split("T")[0];
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "ongoing";
}

/**
 * Fetch all holidays for current madrasa
 */
export async function getAcademicHolidays(includeArchived = false) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return [];

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return [];

    const meta = await getMadrasaMetadata(madrasaId);
    let holidays = meta.academic_holidays || [];

    if (!includeArchived) {
      holidays = holidays.filter((h) => !h.is_archived);
    }

    // Sort by start_date descending (newest first)
    return holidays
      .map((h) => ({
        ...h,
        total_days: h.total_days || calculateDays(h.start_date, h.end_date),
        status: computeHolidayStatus(h.start_date, h.end_date),
      }))
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  } catch (err) {
    console.error("getAcademicHolidays error:", err);
    return [];
  }
}

/**
 * Get a single holiday by ID
 */
export async function getAcademicHolidayById(id: string) {
  try {
    const holidays = await getAcademicHolidays(true);
    return holidays.find((h) => h.id === id) || null;
  } catch (err) {
    console.error("getAcademicHolidayById error:", err);
    return null;
  }
}

/**
 * Create a new academic holiday / vacation
 */
export async function createAcademicHoliday(payload: Omit<AcademicHoliday, "id" | "created_at" | "total_days">) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    if (!payload.title?.trim()) {
      return { error: "ছুটির শিরোনাম অবশ্যই প্রদান করতে হবে।" };
    }
    if (!payload.start_date || !payload.end_date) {
      return { error: "শুরু ও শেষ তারিখ সঠিকভাবে নির্ধারণ করুন।" };
    }
    if (payload.start_date > payload.end_date) {
      return { error: "শেষ তারিখ অবশ্যই শুরু তারিখের সমান বা পরবর্তী হতে হবে।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.academic_holidays) {
      meta.academic_holidays = [];
    }

    const { data: userData } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const creatorName = userData?.full_name || userData?.email || "কর্তৃপক্ষ";
    const totalDays = calculateDays(payload.start_date, payload.end_date);

    const newHoliday: AcademicHoliday = {
      id: `hol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: payload.title.trim(),
      category: payload.category || "general",
      start_date: payload.start_date,
      end_date: payload.end_date,
      total_days: totalDays,
      reopen_date: payload.reopen_date || undefined,
      applicable_to: payload.applicable_to || "all",
      applicable_classes: payload.applicable_classes || [],
      description: payload.description?.trim() || "",
      notice_number: payload.notice_number?.trim() || "",
      publish_to_portal: payload.publish_to_portal !== false,
      created_at: new Date().toISOString(),
      created_by: creatorName,
      is_archived: false,
    };

    meta.academic_holidays.push(newHoliday);

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "ছুটির তথ্য সংরক্ষণ করা সম্ভব হয়নি।" };
    }

    // Auto-sync notice with public.notices table for Guardian & Student Portal
    await syncHolidayNotice(newHoliday, madrasaId);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/holidays");
    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/communication/notices");
    revalidatePath("/portal/holidays");
    revalidatePath("/portal/notices");
    revalidatePath("/portal/leave");
    revalidatePath("/portal", "layout");

    return { success: true, holiday: newHoliday };
  } catch (err: any) {
    console.error("createAcademicHoliday error:", err);
    return { error: err.message || "ছুটি তৈরিতে ত্রুটি হয়েছে।" };
  }
}

/**
 * Update an existing academic holiday
 */
export async function updateAcademicHoliday(id: string, payload: Partial<AcademicHoliday>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.academic_holidays) {
      return { error: "ছুটির তালিকা পাওয়া যায়নি।" };
    }

    const index = meta.academic_holidays.findIndex((h) => h.id === id);
    if (index === -1) {
      return { error: "ছুটির রেকর্ডটি খুঁজে পাওয়া যায়নি।" };
    }

    const existing = meta.academic_holidays[index];
    const startDate = payload.start_date || existing.start_date;
    const endDate = payload.end_date || existing.end_date;

    if (startDate > endDate) {
      return { error: "শেষ তারিখ অবশ্যই শুরু তারিখের সমান বা পরবর্তী হতে হবে।" };
    }

    const totalDays = calculateDays(startDate, endDate);

    meta.academic_holidays[index] = {
      ...existing,
      ...payload,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      updated_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "আপডেট সংরক্ষণ করা সম্ভব হয়নি।" };
    }

    // Auto-sync notice update with public.notices table
    await syncHolidayNotice(meta.academic_holidays[index], madrasaId);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/holidays");
    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/communication/notices");
    revalidatePath("/portal/holidays");
    revalidatePath("/portal/notices");
    revalidatePath("/portal/leave");
    revalidatePath("/portal", "layout");

    return { success: true, holiday: meta.academic_holidays[index] };
  } catch (err: any) {
    console.error("updateAcademicHoliday error:", err);
    return { error: err.message || "আপডেটে ত্রুটি হয়েছে।" };
  }
}

/**
 * Delete a holiday permanently
 */
export async function deleteAcademicHoliday(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.academic_holidays) return { success: true };

    meta.academic_holidays = meta.academic_holidays.filter((h) => h.id !== id);

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "মুছে ফেলা সম্ভব হয়নি।" };
    }

    // Remove notice from public.notices table
    await deleteHolidayNotice(id, madrasaId);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/holidays");
    revalidatePath("/dashboard/communication/notices");
    revalidatePath("/portal/holidays");
    revalidatePath("/portal/notices");
    revalidatePath("/portal", "layout");

    return { success: true };
  } catch (err: any) {
    console.error("deleteAcademicHoliday error:", err);
    return { error: err.message || "মুছে ফেলতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Archive a holiday
 */
export async function archiveAcademicHoliday(id: string) {
  return updateAcademicHoliday(id, { is_archived: true });
}

/**
 * Restore an archived holiday
 */
export async function restoreAcademicHoliday(id: string) {
  return updateAcademicHoliday(id, { is_archived: false });
}

/**
 * Seed Default Common Qawmi Holidays for the Current Year
 */
export async function seedDefaultQawmiHolidays(year?: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা খুঁজে পাওয়া যায়নি।" };

    const currentYear = year || new Date().getFullYear().toString();
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.academic_holidays) {
      meta.academic_holidays = [];
    }

    const defaultList: Omit<AcademicHoliday, "id" | "created_at" | "total_days">[] = [
      {
        title: "পবিত্র ঈদুল ফিতর ও রমজানুল মুবারকের অবকাশ",
        category: "ramadan",
        start_date: `${currentYear}-03-15`,
        end_date: `${currentYear}-04-10`,
        reopen_date: `${currentYear}-04-11`,
        applicable_to: "all",
        description: "পবিত্র মাহে রমজান ও ঈদুল ফিতর উপলক্ষে মাদরাসার সকল বিভাগের শিক্ষা কার্যক্রম বন্ধ থাকবে।",
        notice_number: `মাদ/ছুটি/${currentYear}/০১`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "প্রথম সাময়িক পরীক্ষা সমাপ্তি পরবর্তী অবকাশ",
        category: "exam_vacation",
        start_date: `${currentYear}-05-10`,
        end_date: `${currentYear}-05-16`,
        reopen_date: `${currentYear}-05-17`,
        applicable_to: "all",
        description: "প্রথম সাময়িক পরীক্ষা সুষ্ঠুভাবে সমাপ্ত হওয়ায় সকল জামাতের শিক্ষার্থীদের ছুটি ঘোষণা করা হলো।",
        notice_number: `মাদ/ছুটি/${currentYear}/০২`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "পবিত্র ঈদুল আযহা ও কুরবানির দীর্ঘ ছুটি",
        category: "eid_vacation",
        start_date: `${currentYear}-06-05`,
        end_date: `${currentYear}-06-18`,
        reopen_date: `${currentYear}-06-19`,
        applicable_to: "all",
        description: "পবিত্র ঈদুল আযহা ও কুরবানি উপলক্ষে মাদরাসা বন্ধ থাকবে। নির্ধারিত তারিখে উপস্থিত হওয়া বাধ্যতামূলক।",
        notice_number: `মাদ/ছুটি/${currentYear}/০৩`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "পবিত্র আশুরা ও মহররম ছুটি",
        category: "religious",
        start_date: `${currentYear}-07-06`,
        end_date: `${currentYear}-07-07`,
        reopen_date: `${currentYear}-07-08`,
        applicable_to: "all",
        description: "পবিত্র আশুরা উপলক্ষে মাদরাসা বন্ধ থাকবে।",
        notice_number: `মাদ/ছুটি/${currentYear}/০৪`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "দ্বিতীয় সাময়িক / ষান্মাসিক পরীক্ষা পরবর্তী ছুটি",
        category: "exam_vacation",
        start_date: `${currentYear}-09-12`,
        end_date: `${currentYear}-09-18`,
        reopen_date: `${currentYear}-09-19`,
        applicable_to: "all",
        description: "দ্বিতীয় সাময়িক পরীক্ষা সমাপনের পর শিক্ষার্থীদের ছুটি প্রদান করা হলো।",
        notice_number: `মাদ/ছুটি/${currentYear}/০৫`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "জাতীয় বিজয় দিবস ছুটি",
        category: "national",
        start_date: `${currentYear}-12-16`,
        end_date: `${currentYear}-12-16`,
        reopen_date: `${currentYear}-12-17`,
        applicable_to: "all",
        description: "১৬ই ডিসেম্বর মহান বিজয় দিবস উপলক্ষে মাদরাসার সাধারণ ছুটি থাকবে।",
        notice_number: `মাদ/ছুটি/${currentYear}/০৬`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
      {
        title: "বার্ষিক পরীক্ষা সমাপ্তি ও শিক্ষাবর্ষ সমাপনী ছুটি",
        category: "exam_vacation",
        start_date: `${currentYear}-12-20`,
        end_date: `${currentYear}-12-31`,
        reopen_date: `${Number(currentYear) + 1}-01-01`,
        applicable_to: "all",
        description: "বার্ষিক পরীক্ষা ও ফলাফল ঘোষণার পর শিক্ষাবর্ষের সমাপনী অবকাশ।",
        notice_number: `মাদ/ছুটি/${currentYear}/০৭`,
        publish_to_portal: true,
        created_by: "স্বয়ংক্রিয় প্রিসেট",
        is_archived: false,
      },
    ];

    const addedHolidays: AcademicHoliday[] = [];
    for (const item of defaultList) {
      const totalDays = calculateDays(item.start_date, item.end_date);
      const hol: AcademicHoliday = {
        ...item,
        id: `hol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        total_days: totalDays,
        created_at: new Date().toISOString(),
      };
      meta.academic_holidays.push(hol);
      addedHolidays.push(hol);
    }

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "ডিফল্ট ছুটি যুক্ত করা সম্ভব হয়নি।" };

    // Sync all seeded holidays with notices table
    for (const hol of addedHolidays) {
      await syncHolidayNotice(hol, madrasaId);
    }

    revalidatePath("/dashboard/attendance/holidays");
    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/communication/notices");
    revalidatePath("/portal/holidays");
    revalidatePath("/portal/notices");
    revalidatePath("/portal", "layout");

    return {
      success: true,
      message: `${defaultList.length}টি কওমি মাদরাসার প্রচলিত ছুটির তালিকা সফলভাবে যুক্ত ও নোটিশে প্রকাশ করা হয়েছে!`,
    };
  } catch (err: any) {
    console.error("seedDefaultQawmiHolidays error:", err);
    return { error: err.message || "ডিফল্ট ছুটি তৈরিতে ত্রুটি।" };
  }
}

/**
 * Check if a specific date is a registered holiday or weekend
 */
export async function checkHolidayForDate(dateStr: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { isHoliday: false, isWeekend: false, holiday: null };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { isHoliday: false, isWeekend: false, holiday: null };

    const meta = await getMadrasaMetadata(madrasaId);
    const holidays = meta.academic_holidays || [];

    // Find active holiday covering dateStr
    const matchedHoliday = holidays.find(
      (h) => !h.is_archived && dateStr >= h.start_date && dateStr <= h.end_date
    );

    // Check weekly weekend
    const dateObj = new Date(dateStr);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[dateObj.getDay()];
    const weekendDays = meta.weekend_days || ["Friday"];
    const isWeekend = weekendDays.includes(currentDayName);

    return {
      isHoliday: Boolean(matchedHoliday),
      isWeekend,
      holiday: matchedHoliday || null,
      dayName: currentDayName,
    };
  } catch (err) {
    console.error("checkHolidayForDate error:", err);
    return { isHoliday: false, isWeekend: false, holiday: null };
  }
}

/**
 * Public/Portal fetch holidays for parents and students
 */
export async function getPublicHolidaysForPortal(madrasaId?: string) {
  try {
    const supabase = await createClient();
    let targetMadrasaId = madrasaId;

    if (!targetMadrasaId) {
      const user = await getAuthUser(supabase);
      if (user) {
        targetMadrasaId = (await getAuthMadrasaId(supabase, user)) || undefined;
      }
    }

    if (!targetMadrasaId) {
      const admin = await createAdminClient();
      const { data: firstM } = await admin.from("madrasas").select("id").limit(1).single();
      targetMadrasaId = firstM?.id;
    }

    if (!targetMadrasaId) return [];

    const meta = await getMadrasaMetadata(targetMadrasaId);
    const holidays = (meta.academic_holidays || [])
      .filter((h) => !h.is_archived && h.publish_to_portal !== false)
      .map((h) => ({
        ...h,
        total_days: h.total_days || calculateDays(h.start_date, h.end_date),
        status: computeHolidayStatus(h.start_date, h.end_date),
      }))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    return holidays;
  } catch (err) {
    console.error("getPublicHolidaysForPortal error:", err);
    return [];
  }
}
