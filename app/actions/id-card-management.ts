"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata, getDefaultSessions, AcademicSession } from "@/lib/sessions";
import {
  StudentIDCard,
  IDCardStatus,
  IDCardTemplateConfig,
  IDCardAuditLog,
  DEFAULT_IDCARD_TEMPLATES,
  generateVerificationToken,
  formatCardNumber,
  normalizeStudentIdCode,
} from "@/lib/id-card-management";
import { revalidatePath } from "next/cache";

/**
 * Fetch all ID card data and metadata for a madrasa
 */
export async function getIdCardsData(filters?: {
  class_id?: string;
  session_id?: string;
  status?: string;
  search?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let cards: StudentIDCard[] = meta.id_cards || [];
    const templates: IDCardTemplateConfig[] = meta.id_card_templates || DEFAULT_IDCARD_TEMPLATES;
    const auditLogs: IDCardAuditLog[] = meta.id_card_audit_logs || [];

    // Auto check expired status on load and normalize IDs to consistent 480001 / QM-480001
    const todayStr = new Date().toISOString().split("T")[0];
    let isModified = false;
    cards = cards.map((card, idx) => {
      const stdCode = normalizeStudentIdCode(
        card.snapshot?.student_id_code || card.student_number || card.card_number || card.snapshot?.roll_number,
        idx + 1
      );
      const stdCardNum = `QM-${stdCode}`;
      let updatedStatus = card.status;
      if (card.status === "ACTIVE" && card.expiry_date && card.expiry_date < todayStr) {
        isModified = true;
        updatedStatus = "EXPIRED";
      }
      if (card.card_number !== stdCardNum || card.snapshot?.student_id_code !== stdCode || card.student_number !== stdCode) {
        isModified = true;
      }
      return {
        ...card,
        card_number: stdCardNum,
        student_number: stdCode,
        status: updatedStatus,
        snapshot: {
          ...card.snapshot,
          student_id_code: stdCode,
        },
      };
    });

    if (isModified) {
      meta.id_cards = cards;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    // Stats
    const stats = {
      total: cards.length,
      active: cards.filter((c) => c.status === "ACTIVE").length,
      expired: cards.filter((c) => c.status === "EXPIRED").length,
      lost: cards.filter((c) => c.status === "LOST").length,
      blocked: cards.filter((c) => c.status === "BLOCKED").length,
      reissued: cards.filter((c) => c.status === "REISSUED").length,
    };

    // Filter cards
    if (filters) {
      if (filters.session_id) {
        cards = cards.filter((c) => c.session_id === filters.session_id);
      }
      if (filters.status && filters.status !== "ALL") {
        cards = cards.filter((c) => c.status === filters.status);
      }
      if (filters.class_id) {
        cards = cards.filter((c) => c.snapshot?.class_name?.includes(filters.class_id!) || c.student_id === filters.class_id);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        cards = cards.filter(
          (c) =>
            c.card_number.toLowerCase().includes(q) ||
            c.snapshot.student_name.toLowerCase().includes(q) ||
            c.snapshot.student_id_code?.toLowerCase().includes(q) ||
            c.snapshot.roll_number?.toLowerCase().includes(q)
        );
      }
    }

    return {
      cards,
      templates,
      auditLogs,
      stats,
    };
  } catch (err) {
    console.error("Error in getIdCardsData:", err);
    return {
      cards: [],
      templates: DEFAULT_IDCARD_TEMPLATES,
      auditLogs: [],
      stats: { total: 0, active: 0, expired: 0, lost: 0, blocked: 0, reissued: 0 },
    };
  }
}

/**
 * Issue a new Student ID Card for a student
 */
export async function issueStudentIdCard(payload: {
  student_id: string;
  session_id?: string;
  template_id?: string;
  issue_date?: string;
  expiry_date?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    const meta = await getMadrasaMetadata(madrasaId);

    // Get student info
    const adminClient = await createAdminClient();
    const { data: student, error: studentErr } = await adminClient
      .from("students")
      .select("*, classes(name)")
      .eq("id", payload.student_id)
      .single();

    if (studentErr || !student) {
      return { error: "শিক্ষার্থীর তথ্য পাওয়া যায়নি। অনুগ্রহ করে প্রোফাইল চেক করুন।" };
    }

    // Required fields check
    if (!student.first_name || !student.class_id) {
      return {
        error: "ID Card তৈরি করার আগে Student Profile সম্পূর্ণ করুন। (নাম এবং জামাত বাধ্যতামূলক)",
        incomplete: true,
      };
    }

    // Session resolution
    const sessions: AcademicSession[] = meta.sessions || getDefaultSessions(madrasaId);
    let targetSession = sessions.find((s) => s.id === payload.session_id);
    if (!targetSession) {
      targetSession = sessions.find((s) => s.is_current) || sessions[0];
    }

    const cards: StudentIDCard[] = meta.id_cards || [];
    let counter = meta.id_card_counter || cards.length + 100;
    counter += 1;
    meta.id_card_counter = counter;

    const yearShort = targetSession?.academic_year?.split("-")?.[0]?.slice(-2) || new Date().getFullYear().toString().slice(-2);
    const rawStudentIdCode = normalizeStudentIdCode(
      student.student_id || student.id_number || (student.roll_number ? `480${String(student.roll_number).padStart(3, "0")}` : `${480000 + counter}`),
      counter
    );
    const cardNumber = formatCardNumber(yearShort, counter, rawStudentIdCode);
    const verificationId = generateVerificationToken();

    const today = payload.issue_date || new Date().toISOString().split("T")[0];
    // Default 1 year expiry
    const expiry = payload.expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0];

    // Deactivate previous ACTIVE card for same student and session
    cards.forEach((c) => {
      if (c.student_id === payload.student_id && c.session_id === targetSession?.id && c.status === "ACTIVE") {
        c.status = "REISSUED";
        c.status_reason = "নতুন কার্ড ইস্যু করা হয়েছে";
        c.updated_at = new Date().toISOString();
      }
    });

    const newCard: StudentIDCard = {
      id: `idcard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      madrasa_id: madrasaId,
      student_id: student.id,
      session_id: targetSession?.id || "default_session",
      card_number: cardNumber,
      student_number: rawStudentIdCode,
      issue_date: today,
      expiry_date: expiry,
      status: "ACTIVE",
      photo_url: student.photo_url || undefined,
      verification_id: verificationId,
      template_id: payload.template_id || "modern",
      issued_by: user.email?.split("@")[0] || "Admin",
      snapshot: {
        student_name: `${student.first_name} ${student.last_name || ""}`.trim(),
        student_id_code: rawStudentIdCode,
        roll_number: student.roll_number || "-",
        class_name: student.classes?.name || student.class_name || "অনির্ধারিত",
        session_name: targetSession?.name || "১৪৪৭-৪৮ হিজরি",
        father_name: student.father_name || "তথ্য নেই",
        parent_phone: student.parent_phone || "-",
        blood_group: student.blood_group || "-",
        date_of_birth: student.date_of_birth || "-",
        address: student.address || "-",
        photo_url: student.photo_url || undefined,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    cards.unshift(newCard);
    meta.id_cards = cards;

    // Audit log
    const auditLogs: IDCardAuditLog[] = meta.id_card_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "CREATED",
      user_name: user.email?.split("@")[0] || "Admin",
      student_id: student.id,
      card_number: cardNumber,
      details: `শিক্ষার্থী ${newCard.snapshot.student_name}-এর আইডি কার্ড তৈরিকৃত (সেশন: ${targetSession?.name})`,
      created_at: new Date().toISOString(),
    });
    meta.id_card_audit_logs = auditLogs;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/id-cards");
    revalidatePath(`/dashboard/students/${student.id}`);
    return { success: true, card: newCard };
  } catch (err: any) {
    console.error("Error issuing ID card:", err);
    return { error: err.message || "আইডি কার্ড তৈরি করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Bulk generate ID cards for a class/session
 */
export async function bulkGenerateIdCards(payload: {
  class_id?: string;
  session_id?: string;
  template_id?: string;
  issue_date?: string;
  expiry_date?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    const meta = await getMadrasaMetadata(madrasaId);

    const adminClient = await createAdminClient();
    let query = adminClient.from("students").select("*, classes(name)").eq("madrasa_id", madrasaId);
    if (payload.class_id && payload.class_id !== "ALL") {
      query = query.eq("class_id", payload.class_id);
    }
    const { data: students, error: studErr } = await query;

    if (studErr || !students || students.length === 0) {
      return { error: "বাছাইকৃত জামাতে কোনো শিক্ষার্থী পাওয়া যায়নি।" };
    }

    const sessions: AcademicSession[] = meta.sessions || getDefaultSessions(madrasaId);
    let targetSession = sessions.find((s) => s.id === payload.session_id);
    if (!targetSession) {
      targetSession = sessions.find((s) => s.is_current) || sessions[0];
    }

    const cards: StudentIDCard[] = meta.id_cards || [];
    let counter = meta.id_card_counter || cards.length + 100;
    const today = payload.issue_date || new Date().toISOString().split("T")[0];
    const expiry = payload.expiry_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0];
    const yearShort = targetSession?.academic_year?.split("-")?.[0]?.slice(-2) || new Date().getFullYear().toString().slice(-2);

    let createdCount = 0;
    const createdCards: StudentIDCard[] = [];

    for (const student of students) {
      // Check if student already has ACTIVE card for this session
      const existing = cards.find((c) => c.student_id === student.id && c.session_id === targetSession?.id && c.status === "ACTIVE");
      if (existing) continue; // Skip if already active

      counter += 1;
      const rawStudentIdCode = student.student_id || student.id_number || (student.roll_number ? `480${String(student.roll_number).padStart(3, "0")}` : `${480000 + counter}`);
      const cardNumber = formatCardNumber(yearShort, counter, rawStudentIdCode);
      const verificationId = generateVerificationToken();

      const newCard: StudentIDCard = {
        id: `idcard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        madrasa_id: madrasaId,
        student_id: student.id,
        session_id: targetSession?.id || "default_session",
        card_number: cardNumber,
        student_number: rawStudentIdCode,
        issue_date: today,
        expiry_date: expiry,
        status: "ACTIVE",
        photo_url: student.photo_url || undefined,
        verification_id: verificationId,
        template_id: payload.template_id || "modern",
        issued_by: user.email?.split("@")[0] || "Admin",
        snapshot: {
          student_name: `${student.first_name} ${student.last_name || ""}`.trim(),
          student_id_code: rawStudentIdCode,
          roll_number: student.roll_number || "-",
          class_name: student.classes?.name || student.class_name || "অনির্ধারিত",
          session_name: targetSession?.name || "১৪৪৭-৪৮ হিজরি",
          father_name: student.father_name || "তথ্য নেই",
          parent_phone: student.parent_phone || "-",
          blood_group: student.blood_group || "-",
          date_of_birth: student.date_of_birth || "-",
          address: student.address || "-",
          photo_url: student.photo_url || undefined,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      cards.unshift(newCard);
      createdCards.push(newCard);
      createdCount += 1;
    }

    meta.id_card_counter = counter;
    meta.id_cards = cards;

    // Audit log
    const auditLogs: IDCardAuditLog[] = meta.id_card_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "BULK_CREATED",
      user_name: user.email?.split("@")[0] || "Admin",
      student_id: "BULK",
      card_number: `BULK-${createdCount}`,
      details: `${createdCount} জন শিক্ষার্থীর জন্য এক সাথে আইডি কার্ড তৈরি করা হয়েছে। (সেশন: ${targetSession?.name})`,
      created_at: new Date().toISOString(),
    });
    meta.id_card_audit_logs = auditLogs;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/id-cards");
    return { success: true, count: createdCount, cards: createdCards };
  } catch (err: any) {
    console.error("Error bulk generating ID cards:", err);
    return { error: err.message || "বাল্ক আইডি কার্ড তৈরি করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Reissue Student ID Card (Marks old as REISSUED and generates new active card)
 */
export async function reissueStudentIdCard(cardId: string, reason?: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    const meta = await getMadrasaMetadata(madrasaId);
    const cards: StudentIDCard[] = meta.id_cards || [];

    const oldCardIndex = cards.findIndex((c) => c.id === cardId);
    if (oldCardIndex === -1) {
      return { error: "পুরানো আইডি কার্ড রেকর্ড পাওয়া যায়নি।" };
    }

    const oldCard = cards[oldCardIndex];
    // Mark old card REISSUED
    oldCard.status = "REISSUED";
    oldCard.status_reason = reason || "নতুন কার্ড রি-ইস্যু করা হয়েছে";
    oldCard.updated_at = new Date().toISOString();

    // Generate new card
    let counter = meta.id_card_counter || cards.length + 100;
    counter += 1;
    meta.id_card_counter = counter;

    const yearShort = new Date().getFullYear().toString().slice(-2);
    const cardNumber = formatCardNumber(yearShort, counter);
    const verificationId = generateVerificationToken();

    const today = new Date().toISOString().split("T")[0];
    const expiry = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0];

    const newCard: StudentIDCard = {
      ...oldCard,
      id: `idcard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      card_number: cardNumber,
      issue_date: today,
      expiry_date: expiry,
      status: "ACTIVE",
      verification_id: verificationId,
      status_reason: undefined,
      issued_by: user.email?.split("@")[0] || "Admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    cards.unshift(newCard);
    meta.id_cards = cards;

    // Audit log
    const auditLogs: IDCardAuditLog[] = meta.id_card_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "REISSUED",
      user_name: user.email?.split("@")[0] || "Admin",
      student_id: oldCard.student_id,
      card_number: cardNumber,
      details: `আইডি কার্ড ${oldCard.card_number} বাতিল করে নতুন রি-ইস্যুকৃত আইডি ${cardNumber} তৈরি করা হয়েছে। কারণ: ${reason || "রি-ইস্যু"}`,
      created_at: new Date().toISOString(),
    });
    meta.id_card_audit_logs = auditLogs;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/id-cards");
    revalidatePath(`/dashboard/students/${oldCard.student_id}`);
    return { success: true, newCard };
  } catch (err: any) {
    console.error("Error reissuing ID card:", err);
    return { error: err.message || "কার্ড রি-ইস্যু করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Update ID Card Status (LOST / BLOCKED / ACTIVE)
 */
export async function updateIdCardStatus(cardId: string, newStatus: IDCardStatus, reason?: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    const meta = await getMadrasaMetadata(madrasaId);
    const cards: StudentIDCard[] = meta.id_cards || [];

    const card = cards.find((c) => c.id === cardId);
    if (!card) return { error: "আইডি কার্ডটি পাওয়া যায়নি।" };

    const oldStatus = card.status;
    card.status = newStatus;
    card.status_reason = reason;
    card.updated_at = new Date().toISOString();

    // Audit log
    const auditLogs: IDCardAuditLog[] = meta.id_card_audit_logs || [];
    const actionType = newStatus === "LOST" ? "MARKED_LOST" : newStatus === "BLOCKED" ? "BLOCKED" : "UNBLOCKED";
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: actionType,
      user_name: user.email?.split("@")[0] || "Admin",
      student_id: card.student_id,
      card_number: card.card_number,
      details: `আইডি কার্ডের স্ট্যাটাস ${oldStatus} থেকে ${newStatus}-এ পরিবর্তন করা হয়েছে। কারণ: ${reason || "প্রযোজ্য নয়"}`,
      created_at: new Date().toISOString(),
    });
    meta.id_card_audit_logs = auditLogs;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/id-cards");
    return { success: true };
  } catch (err: any) {
    console.error("Error updating ID card status:", err);
    return { error: err.message || "স্ট্যাটাস পরিবর্তন করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Get active Digital ID card for student, or auto-issue if not exists
 */
export async function getStudentDigitalId(studentId: string) {
  try {
    const adminClient = await createAdminClient();
    const { data: student } = await adminClient
      .from("students")
      .select("*, classes(name)")
      .eq("id", studentId)
      .single();

    if (!student) return null;

    const madrasaId = student.madrasa_id;
    const meta = await getMadrasaMetadata(madrasaId);
    const cards: StudentIDCard[] = meta.id_cards || [];

    let activeCard = cards.find((c) => c.student_id === studentId && c.status === "ACTIVE");

    // If no active card exists, auto issue one for digital view
    if (!activeCard) {
      const issueRes = await issueStudentIdCard({ student_id: studentId });
      if (issueRes.card) {
        activeCard = issueRes.card;
      }
    }

    // Get madrasa info
    const { data: madrasa } = await adminClient
      .from("madrasas")
      .select("name, address, contact_phone")
      .eq("id", madrasaId)
      .single();

    return {
      card: activeCard || null,
      student,
      madrasaInfo: {
        name: madrasa?.name || "মাদরাসাতুল মুসলিমীন",
        address: madrasa?.address || "ঢাকা, বাংলাদেশ",
        phone: madrasa?.contact_phone || "01700000000",
      },
    };
  } catch (err) {
    console.error("Error fetching student digital ID:", err);
    return null;
  }
}

/**
 * Public QR Code Student Verification Action
 * Exposes ONLY safe public data for verification, without leaking sensitive guardian details.
 */
export async function verifyStudentIdCard(verificationId: string) {
  try {
    const adminClient = await createAdminClient();

    // We search all madrasas for the card matching this verification_id
    const { data: madrasas } = await adminClient
      .from("madrasas")
      .select("id, name, address, registration_no");

    if (!madrasas) {
      return {
        isValid: false,
        status: "INVALID",
        reason: "ভুল বা অকার্যকর কিউআর তথ্য।",
      };
    }

    let foundCard: StudentIDCard | null = null;
    let foundMadrasaName = "QawmiERP Madrasa";
    let foundMadrasaAddress = "";

    for (const m of madrasas) {
      if (m.registration_no && m.registration_no.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.registration_no);
          const cards: StudentIDCard[] = parsed.id_cards || [];
          const matched = cards.find((c) => c.verification_id === verificationId);
          if (matched) {
            foundCard = matched;
            foundMadrasaName = m.name || "মাদরাসা";
            foundMadrasaAddress = m.address || "";
            break;
          }
        } catch {}
      }
    }

    if (!foundCard) {
      return {
        isValid: false,
        status: "INVALID",
        reason: "এই কিউআর কোডের বিপরিতে কোনো ভ্যালিড শিক্ষার্থী আইডি কার্ড পাওয়া যায়নি।",
      };
    }

    // Expiry check
    const today = new Date().toISOString().split("T")[0];
    if (foundCard.status === "ACTIVE" && foundCard.expiry_date && foundCard.expiry_date < today) {
      foundCard.status = "EXPIRED";
    }

    if (foundCard.status !== "ACTIVE") {
      const statusMap: Record<string, string> = {
        EXPIRED: "কার্ডটির মেয়াদ শেষ হয়ে গেছে। (EXPIRED)",
        LOST: "কার্ডটি হারিয়ে যাওয়া হিসেবে রিপোর্টকৃত। (LOST)",
        BLOCKED: "আইডি কার্ডটি ব্লকড করা হয়েছে। (BLOCKED)",
        REISSUED: "কার্ডটি পূর্বে বাতিল করে নতুন আইডি রি-ইস্যু করা হয়েছে। (REISSUED)",
      };
      return {
        isValid: false,
        status: foundCard.status,
        reason: statusMap[foundCard.status] || foundCard.status_reason || "কার্ডটি সচল নয়।",
        cardNumber: foundCard.card_number,
        studentName: foundCard.snapshot.student_name,
        madrasaName: foundMadrasaName,
      };
    }

    // Return safe minimal public verification data (NO private phone/address leaked)
    return {
      isValid: true,
      status: "ACTIVE",
      student: {
        name: foundCard.snapshot.student_name,
        studentIdCode: foundCard.card_number,
        rollNumber: foundCard.snapshot.roll_number,
        className: foundCard.snapshot.class_name,
        sessionName: foundCard.snapshot.session_name,
        photoUrl: foundCard.snapshot.photo_url || foundCard.photo_url,
        issueDate: foundCard.issue_date,
        expiryDate: foundCard.expiry_date,
        madrasaName: foundMadrasaName,
        madrasaAddress: foundMadrasaAddress,
      },
      verifiedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("Error verifying QR card:", err);
    return {
      isValid: false,
      status: "ERROR",
      reason: "সার্ভার যাচাইকরণ ত্রুটি ঘটেছে।",
    };
  }
}
