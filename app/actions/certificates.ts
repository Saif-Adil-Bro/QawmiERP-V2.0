"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession, getDefaultSessions } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import {
  StudentCertificate,
  CertificateStatus,
  CertificateSnapshot,
  CertificateTypeConfig,
  CertificateTemplateConfig,
  CertificateAuditLog,
  MadrasaCertificateMetadata,
  DEFAULT_CERTIFICATE_TYPES,
  DEFAULT_CERTIFICATE_TEMPLATES,
  generateCertificateToken,
  formatCertificateNumber,
  normalizeStudentIdCode,
} from "@/lib/certificates";

/**
 * Get all certificates data, types, templates, audit logs, and stats
 */
export async function getCertificatesData(options?: {
  class_id?: string;
  type_id?: string;
  status?: string;
  search?: string;
}) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) {
      return {
        certificates: [],
        types: DEFAULT_CERTIFICATE_TYPES,
        templates: DEFAULT_CERTIFICATE_TEMPLATES,
        auditLogs: [],
        stats: { total: 0, issued: 0, pending: 0, revoked: 0, reissued: 0 },
      };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    let certificates: StudentCertificate[] = meta.certificates || [];
    let types: CertificateTypeConfig[] = meta.certificate_types || DEFAULT_CERTIFICATE_TYPES;
    let templates: CertificateTemplateConfig[] = meta.certificate_templates || DEFAULT_CERTIFICATE_TEMPLATES;
    let auditLogs: CertificateAuditLog[] = meta.certificate_audit_logs || [];

    // Normalize IDs to standard format (e.g. CERT-480001 / 480001)
    let isModified = false;
    certificates = certificates.map((cert, idx) => {
      const stdCode = normalizeStudentIdCode(
        cert.snapshot?.student_id_code || cert.certificate_number || cert.snapshot?.roll_number,
        idx + 1
      );
      const prefix = meta.certificate_prefix || "CERT";
      const stdCertNum = `${prefix}-${stdCode}`;
      if (cert.certificate_number !== stdCertNum || cert.snapshot?.student_id_code !== stdCode) {
        isModified = true;
      }
      return {
        ...cert,
        certificate_number: stdCertNum,
        snapshot: {
          ...cert.snapshot,
          student_id_code: stdCode,
        },
      };
    });

    if (isModified) {
      meta.certificates = certificates;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    // Filter by options
    if (options?.status && options.status !== "ALL") {
      certificates = certificates.filter((c) => c.status === options.status);
    }
    if (options?.type_id && options.type_id !== "ALL") {
      certificates = certificates.filter((c) => c.certificate_type_id === options.type_id);
    }
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      certificates = certificates.filter(
        (c) =>
          c.certificate_number.toLowerCase().includes(q) ||
          c.snapshot.student_name.toLowerCase().includes(q) ||
          c.snapshot.student_id_code.toLowerCase().includes(q) ||
          c.snapshot.roll_number?.toLowerCase().includes(q)
      );
    }

    // Compute stats
    const allCerts: StudentCertificate[] = meta.certificates || [];
    const stats = {
      total: allCerts.length,
      issued: allCerts.filter((c) => c.status === "ISSUED").length,
      pending: allCerts.filter((c) => c.status === "PENDING_APPROVAL" || c.status === "DRAFT").length,
      revoked: allCerts.filter((c) => c.status === "REVOKED" || c.status === "VOIDED").length,
      reissued: allCerts.filter((c) => c.status === "REISSUED").length,
    };

    return {
      certificates,
      types,
      templates,
      auditLogs,
      stats,
    };
  } catch (err) {
    console.error("Error fetching certificates data:", err);
    return {
      certificates: [],
      types: DEFAULT_CERTIFICATE_TYPES,
      templates: DEFAULT_CERTIFICATE_TEMPLATES,
      auditLogs: [],
      stats: { total: 0, issued: 0, pending: 0, revoked: 0, reissued: 0 },
    };
  }
}

/**
 * Issue a certificate for a student
 */
export async function issueStudentCertificate(payload: {
  student_id: string;
  certificate_type_id: string;
  template_id?: string;
  purpose?: string;
  additional_statement?: string;
  issue_date?: string;
  expiry_date?: string;
  status?: CertificateStatus;
  
  // Custom fields
  dues_status?: "CLEARED" | "HAS_DUES";
  dues_amount?: number;
  library_status?: "CLEARED" | "PENDING";
  hostel_status?: "CLEARED" | "PENDING";
  conduct_grade?: string;
  reason_for_leaving?: string;
  last_attendance_date?: string;
  hifz_para_completed?: string;
  exam_result?: {
    exam_title?: string;
    gpa?: string;
    grade?: string;
    total_marks?: string;
    position?: string;
  };

  mohtamim_signature?: boolean;
  principal_signature?: boolean;
  teacher_signature?: boolean;
  show_seal?: boolean;
}) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) {
      return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };
    }

    const authUser = await getAuthUser();
    const operatorName = authUser?.email?.split("@")[0] || "Admin Staff";

    const supabase = await createClient();
    const madrasaInfo = await getMadrasaInfo();

    // Fetch Student Record
    const { data: student, error: stErr } = await supabase
      .from("students")
      .select("*, classes(name)")
      .eq("id", payload.student_id)
      .single();

    if (stErr || !student) {
      return { error: "শিক্ষার্থীর ডাটাবেজ তথ্য পাওয়া যায়নি।" };
    }

    // Metadata
    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    const types: CertificateTypeConfig[] = meta.certificate_types || DEFAULT_CERTIFICATE_TYPES;
    const auditLogs: CertificateAuditLog[] = meta.certificate_audit_logs || [];
    let counter = (meta.certificate_counter || 0) + 1;
    const prefix = meta.certificate_prefix || "CERT";

    // Target Certificate Type
    const certType = types.find((t) => t.id === payload.certificate_type_id) || types[0];

    // Current Session
    const sessions: AcademicSession[] = meta.sessions || getDefaultSessions(madrasaId);
    const currentSession = sessions.find((s) => s.is_current) || sessions[0];

    const yearShort = new Date().getFullYear().toString();
    const rawStudentIdCode = normalizeStudentIdCode(
      student.student_id || student.id_number || (student.roll_number ? `480${String(student.roll_number).padStart(3, "0")}` : `${480000 + counter}`),
      counter
    );
    const certNumber = formatCertificateNumber(prefix, yearShort, counter, rawStudentIdCode);
    const verificationToken = generateCertificateToken();

    // Snapshot
    const snapshot: CertificateSnapshot = {
      student_name: `${student.first_name} ${student.last_name || ""}`.trim(),
      student_id_code: rawStudentIdCode,
      father_name: student.father_name || "—",
      mother_name: student.mother_name || "—",
      guardian_name: student.guardian_name || student.father_name || "—",
      class_name: student.classes?.name || "জামাতভুক্ত নয়",
      roll_number: student.roll_number ? String(student.roll_number) : "—",
      session_name: currentSession ? currentSession.name : "১৪৪৭-৪৮ হিজরি",
      hijri_year: currentSession ? currentSession.hijri_year : "১৪৪৭-৪৮",
      academic_year: currentSession ? currentSession.academic_year : "২০২৬-২৭",
      admission_date: student.created_at ? new Date(student.created_at).toISOString().split("T")[0] : "—",
      leaving_date: payload.last_attendance_date || new Date().toISOString().split("T")[0],
      date_of_birth: student.date_of_birth || "—",
      address: student.address || "—",
      madrasa_name: madrasaInfo?.name || "মাদ্রাসাতুল মুসলিমীন",
      madrasa_address: madrasaInfo?.address || "ঢাকা, বাংলাদেশ",
      madrasa_phone: madrasaInfo?.phone || "—",
      principal_name: madrasaInfo?.principal_name || "",
      photo_url: student.photo_url || undefined,
    };

    const initialStatus: CertificateStatus =
      payload.status || (certType.requires_approval ? "PENDING_APPROVAL" : "ISSUED");

    const now = new Date().toISOString();
    const issueDateStr = payload.issue_date || new Date().toISOString().split("T")[0];

    const newCert: StudentCertificate = {
      id: `cert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      madrasa_id: madrasaId,
      student_id: student.id,
      session_id: currentSession ? currentSession.id : "default_session",
      certificate_type_id: certType.id,
      certificate_type_title: certType.title_bn,
      template_id: payload.template_id || certType.default_template_id || "classic",
      certificate_number: certNumber,
      verification_token: verificationToken,
      issue_date: issueDateStr,
      expiry_date: payload.expiry_date || undefined,
      status: initialStatus,
      purpose: payload.purpose || "দাপ্তরিক প্রয়োজন",
      additional_statement: payload.additional_statement || "",
      
      dues_status: payload.dues_status || "CLEARED",
      dues_amount: payload.dues_amount || 0,
      library_status: payload.library_status || "CLEARED",
      hostel_status: payload.hostel_status || "CLEARED",
      conduct_grade: payload.conduct_grade || "উত্তম",
      reason_for_leaving: payload.reason_for_leaving || "",
      last_attendance_date: payload.last_attendance_date || "",
      hifz_para_completed: payload.hifz_para_completed || "",
      exam_result: payload.exam_result,

      mohtamim_signature: payload.mohtamim_signature ?? true,
      principal_signature: payload.principal_signature ?? true,
      teacher_signature: payload.teacher_signature ?? true,
      show_seal: payload.show_seal ?? true,

      issued_by: operatorName,
      snapshot: snapshot,
      created_at: now,
      updated_at: now,
    };

    // Audit Log
    const newLog: CertificateAuditLog = {
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "CREATED",
      user_name: operatorName,
      certificate_id: newCert.id,
      certificate_number: certNumber,
      student_name: snapshot.student_name,
      details: `সনদপত্র '${certType.title_bn}' (${certNumber}) জেনারেট করা হয়েছে।`,
      created_at: now,
    };

    // Save
    meta.certificates = [newCert, ...certs];
    meta.certificate_counter = counter;
    meta.certificate_audit_logs = [newLog, ...auditLogs];

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "সনদ ডাটা সংরক্ষণ করা সম্ভব হয়নি।" };
    }

    return { success: true, certificate: newCert };
  } catch (err: any) {
    console.error("Error issuing certificate:", err);
    return { error: err.message || "সনদ তৈরির সময়ে অভ্যন্তরীণ সমস্যা হয়েছে।" };
  }
}

/**
 * Bulk generate certificates for a class or selection
 */
export async function bulkGenerateCertificates(payload: {
  class_id?: string;
  certificate_type_id: string;
  template_id?: string;
  issue_date?: string;
}) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const supabase = await createClient();
    let query = supabase.from("students").select("*, classes(name)");
    if (payload.class_id && payload.class_id !== "ALL") {
      query = query.eq("class_id", payload.class_id);
    }
    const { data: studentList, error } = await query;
    if (error || !studentList || studentList.length === 0) {
      return { error: "কোনো শিক্ষার্থী পাওয়া যায়নি।" };
    }

    let createdCount = 0;
    const generatedCerts: StudentCertificate[] = [];

    for (const student of studentList) {
      const res = await issueStudentCertificate({
        student_id: student.id,
        certificate_type_id: payload.certificate_type_id,
        template_id: payload.template_id,
        issue_date: payload.issue_date,
      });
      if (res.success && res.certificate) {
        createdCount++;
        generatedCerts.push(res.certificate);
      }
    }

    return { success: true, count: createdCount, certificates: generatedCerts };
  } catch (err: any) {
    console.error("Error bulk generating certificates:", err);
    return { error: err.message || "বাল্ক সনদ তৈরি ব্যর্থ হয়েছে।" };
  }
}

/**
 * Approve pending certificate
 */
export async function approveCertificate(certificateId: string) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const authUser = await getAuthUser();
    const operatorName = authUser?.email?.split("@")[0] || "Mohtamim";

    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    const target = certs.find((c) => c.id === certificateId);

    if (!target) return { error: "সনদপত্র রেকর্ড পাওয়া যায়নি।" };

    target.status = "ISSUED";
    target.approved_by = operatorName;
    target.updated_at = new Date().toISOString();

    const auditLogs: CertificateAuditLog[] = meta.certificate_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "APPROVED",
      user_name: operatorName,
      certificate_id: target.id,
      certificate_number: target.certificate_number,
      student_name: target.snapshot.student_name,
      details: `সনদপত্র ${target.certificate_number} কর্তৃপক্ষের দ্বারা অনুমোদিত ও অফিশিয়ালি ইস্যু হয়েছে।`,
      created_at: new Date().toISOString(),
    });

    meta.certificates = certs;
    meta.certificate_audit_logs = auditLogs;
    await saveMadrasaMetadata(madrasaId, meta);

    return { success: true, certificate: target };
  } catch (err: any) {
    return { error: err.message || "সনদ অনুমোদন ব্যর্থ হয়েছে।" };
  }
}

/**
 * Revoke certificate
 */
export async function revokeCertificate(certificateId: string, reason: string) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const authUser = await getAuthUser();
    const operatorName = authUser?.email?.split("@")[0] || "Admin";

    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    const target = certs.find((c) => c.id === certificateId);

    if (!target) return { error: "সনদপত্র রেকর্ড পাওয়া যায়নি।" };

    const now = new Date().toISOString();
    target.status = "REVOKED";
    target.revoked_reason = reason || "ভুল তথ্যের কারণে অথবা বাতিল অনুরোধের প্রেক্ষিতে।";
    target.revoked_at = now;
    target.revoked_by = operatorName;
    target.updated_at = now;

    const auditLogs: CertificateAuditLog[] = meta.certificate_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "REVOKED",
      user_name: operatorName,
      certificate_id: target.id,
      certificate_number: target.certificate_number,
      student_name: target.snapshot.student_name,
      details: `সনদপত্র ${target.certificate_number} বাতিল (Revoked) করা হয়েছে। কারণ: ${target.revoked_reason}`,
      created_at: now,
    });

    meta.certificates = certs;
    meta.certificate_audit_logs = auditLogs;
    await saveMadrasaMetadata(madrasaId, meta);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সনদ বাতিল করা সম্ভব হয়নি।" };
  }
}

/**
 * Delete a certificate permanently
 */
export async function deleteCertificate(certificateId: string) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const authUser = await getAuthUser();
    const operatorName = authUser?.email?.split("@")[0] || "Admin";

    const meta = await getMadrasaMetadata(madrasaId);
    let certs: StudentCertificate[] = meta.certificates || [];
    const target = certs.find((c) => c.id === certificateId);

    if (!target) return { error: "সনদপত্র রেকর্ড পাওয়া যায়নি।" };

    meta.certificates = certs.filter((c) => c.id !== certificateId);

    const auditLogs: CertificateAuditLog[] = meta.certificate_audit_logs || [];
    auditLogs.unshift({
      id: `log_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "DELETED",
      user_name: operatorName,
      certificate_id: certificateId,
      certificate_number: target.certificate_number,
      student_name: target.snapshot.student_name,
      details: `সনদপত্র ${target.certificate_number} রেকর্ডটি মুছে ফেলা হয়েছে।`,
      created_at: new Date().toISOString(),
    });

    meta.certificate_audit_logs = auditLogs;
    await saveMadrasaMetadata(madrasaId, meta);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সনদপত্র মুছে ফেলা সম্ভব হয়নি।" };
  }
}

/**
 * Reissue certificate
 */
export async function reissueCertificate(certificateId: string, reason: string) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    const target = certs.find((c) => c.id === certificateId);

    if (!target) return { error: "সনদপত্র রেকর্ড পাওয়া যায়নি।" };

    // 1. Revoke existing card
    const revokeRes = await revokeCertificate(certificateId, `রি-ইস্যুর কারণে পুরানো সনদ বাতিল (${reason || "পুনরায় প্রদান"})`);
    if (revokeRes.error) return { error: revokeRes.error };

    // 2. Issue new certificate for student
    const issueRes = await issueStudentCertificate({
      student_id: target.student_id,
      certificate_type_id: target.certificate_type_id,
      template_id: target.template_id,
      purpose: target.purpose,
      additional_statement: target.additional_statement,
      dues_status: target.dues_status,
      dues_amount: target.dues_amount,
      library_status: target.library_status,
      hostel_status: target.hostel_status,
      conduct_grade: target.conduct_grade,
      reason_for_leaving: target.reason_for_leaving,
      last_attendance_date: target.last_attendance_date,
      hifz_para_completed: target.hifz_para_completed,
      exam_result: target.exam_result,
      status: "ISSUED",
    });

    if (issueRes.error || !issueRes.certificate) {
      return { error: issueRes.error || "নতুন সনদ জেনারেট ব্যর্থ হয়েছে।" };
    }

    // Link records
    const updatedMeta = await getMadrasaMetadata(madrasaId);
    const updatedCerts: StudentCertificate[] = updatedMeta.certificates || [];

    const oldCert = updatedCerts.find((c) => c.id === certificateId);
    const newCert = updatedCerts.find((c) => c.id === issueRes.certificate?.id);

    if (oldCert && newCert) {
      oldCert.status = "REISSUED";
      oldCert.reissued_to_id = newCert.id;
      newCert.reissued_from_id = oldCert.id;

      await saveMadrasaMetadata(madrasaId, updatedMeta);
    }

    return { success: true, newCertificate: newCert };
  } catch (err: any) {
    return { error: err.message || "রি-ইস্যু প্রক্রিয়া ব্যর্থ হয়েছে।" };
  }
}

/**
 * Update certificate template configurations
 */
export async function saveCertificateTemplates(templates: CertificateTemplateConfig[]) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    meta.certificate_templates = templates;

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "টেমপ্লেট সেটিং সংরক্ষণ হয়নি।" };

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "টেমপ্লেট আপডেট ব্যর্থ হয়েছে।" };
  }
}

/**
 * Public Verification API for QR Code scanner
 */
export async function verifyCertificateByToken(tokenOrNumber: string) {
  try {
    const supabase = await createAdminClient();
    const { data: madrasas } = await supabase.from("madrasas").select("id, name, registration_no");

    if (!madrasas || madrasas.length === 0) {
      return { isValid: false, reason: "মাদরাসা তথ্যভান্ডার পাওয়া যায়নি।" };
    }

    const q = tokenOrNumber.trim();

    for (const m of madrasas) {
      if (!m.registration_no || !m.registration_no.startsWith("{")) continue;
      try {
        const meta: MadrasaCertificateMetadata = JSON.parse(m.registration_no);
        const certs: StudentCertificate[] = meta.certificates || [];
        const found = certs.find((c) => c.verification_token === q || c.certificate_number === q);

        if (found) {
          const isRevoked = found.status === "REVOKED" || found.status === "VOIDED";
          const isReissued = found.status === "REISSUED";
          const isPending = found.status === "PENDING_APPROVAL" || found.status === "DRAFT";

          if (isRevoked) {
            return {
              isValid: false,
              status: found.status,
              reason: `এই সনদপত্রটি কর্তৃপক্ষ দ্বারা বাতিল (REVOKED) করা হয়েছে। কারণ: ${found.revoked_reason || "অনির্দিষ্ট"}`,
              certificateNumber: found.certificate_number,
              studentName: found.snapshot.student_name,
              madrasaName: found.snapshot.madrasa_name,
            };
          }

          if (isReissued) {
            return {
              isValid: false,
              status: found.status,
              reason: `এই সনদটির পরিবর্তে নতুন একটি সনদ রি-ইস্যু করা হয়েছে। আগের এই সনদটি অকার্যকর।`,
              certificateNumber: found.certificate_number,
              studentName: found.snapshot.student_name,
              madrasaName: found.snapshot.madrasa_name,
            };
          }

          if (isPending) {
            return {
              isValid: false,
              status: found.status,
              reason: `সনদটি এখনো কর্তৃপক্ষের চূড়ান্ত অনুমোদনের অপেক্ষায় রয়েছে।`,
              certificateNumber: found.certificate_number,
              studentName: found.snapshot.student_name,
              madrasaName: found.snapshot.madrasa_name,
            };
          }

          // Check Expiry if exists
          if (found.expiry_date) {
            const expDate = new Date(found.expiry_date);
            if (expDate < new Date()) {
              return {
                isValid: false,
                status: "EXPIRED",
                reason: `সনদটির মেয়াদ ${found.expiry_date} তারিখে উত্তীর্ণ হয়ে গেছে।`,
                certificateNumber: found.certificate_number,
                studentName: found.snapshot.student_name,
                madrasaName: found.snapshot.madrasa_name,
              };
            }
          }

          // Valid return
          return {
            isValid: true,
            status: found.status,
            certificate: {
              certificateNumber: found.certificate_number,
              typeTitle: found.certificate_type_title,
              issueDate: found.issue_date,
              purpose: found.purpose,
              studentName: found.snapshot.student_name,
              studentIdCode: found.snapshot.student_id_code,
              fatherName: found.snapshot.father_name,
              className: found.snapshot.class_name,
              rollNumber: found.snapshot.roll_number,
              sessionName: found.snapshot.session_name,
              madrasaName: found.snapshot.madrasa_name,
              madrasaAddress: found.snapshot.madrasa_address,
              photoUrl: found.snapshot.photo_url,
            },
            verifiedAt: new Date().toISOString(),
          };
        }
      } catch (err) {
        // continue
      }
    }

    return { isValid: false, reason: "প্রদত্ত টোকেন বা নম্বরের কোনো সনদপত্র পাওয়া যায়নি।" };
  } catch (err: any) {
    console.error("Error verifying certificate:", err);
    return { isValid: false, reason: "যাচাইকরণের সময় সার্ভার ত্রুটি ঘটেছে।" };
  }
}

/**
 * Get all certificates for a single student (for profile detail & student portal)
 */
export async function getStudentCertificates(studentId: string) {
  try {
    const madrasaId = await getAuthMadrasaId();
    if (!madrasaId) return [];

    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    return certs.filter((c) => c.student_id === studentId);
  } catch (err) {
    console.error("Error getting student certificates:", err);
    return [];
  }
}
