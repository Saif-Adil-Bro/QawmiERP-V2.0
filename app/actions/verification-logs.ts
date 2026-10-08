"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { StudentCertificate } from "@/lib/certificates";
import { StudentIDCard } from "@/lib/id-card-management";

export interface VerificationHistoryEntry {
  verified_at: string;
  status: string;
  ip_or_device?: string;
}

export interface DocumentVerificationStats {
  id: string;
  doc_type: "ID_CARD" | "CERTIFICATE";
  doc_number: string;
  doc_title: string;
  student_name: string;
  student_id_code?: string;
  class_name?: string;
  roll_number?: string;
  total_verifications: number;
  last_verified_at: string | null;
  status: string;
  issue_date?: string;
  expiry_date?: string;
  photo_url?: string;
  verification_history: VerificationHistoryEntry[];
  verify_url: string;
}

export interface VerificationLogItem {
  id: string;
  madrasa_id: string;
  doc_type: "ID_CARD" | "CERTIFICATE";
  doc_number: string;
  doc_title: string;
  student_name: string;
  student_id_code?: string;
  class_name?: string;
  roll_number?: string;
  verified_at: string;
  status: string;
  verification_count: number;
}

export interface VerificationAuditSummary {
  totalVerifications: number;
  totalVerifiedDocuments: number;
  totalCardsVerified: number;
  totalCertsVerified: number;
  documents: DocumentVerificationStats[];
  recentLogs: VerificationLogItem[];
  mostVerifiedDoc: DocumentVerificationStats | null;
}

/**
 * Fetch all verification audit data and logs for the active madrasa
 */
export async function getVerificationAuditData(filters?: {
  doc_type?: "ALL" | "ID_CARD" | "CERTIFICATE";
  search?: string;
  only_verified?: boolean;
}): Promise<VerificationAuditSummary> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) {
      return {
        totalVerifications: 0,
        totalVerifiedDocuments: 0,
        totalCardsVerified: 0,
        totalCertsVerified: 0,
        documents: [],
        recentLogs: [],
        mostVerifiedDoc: null,
      };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    const certs: StudentCertificate[] = meta.certificates || [];
    const idCards: StudentIDCard[] = meta.id_cards || [];
    const storedLogs: VerificationLogItem[] = meta.verification_logs || [];

    const documents: DocumentVerificationStats[] = [];

    // Process ID Cards
    for (const card of idCards) {
      const count = card.verification_count || 0;
      documents.push({
        id: card.id,
        doc_type: "ID_CARD",
        doc_number: card.card_number,
        doc_title: "স্টুডেন্ট ডিজিটাল আইডি কার্ড",
        student_name: card.snapshot.student_name,
        student_id_code: card.student_number || card.card_number,
        class_name: card.snapshot.class_name,
        roll_number: card.snapshot.roll_number,
        total_verifications: count,
        last_verified_at: card.last_verified_at || null,
        status: card.status,
        issue_date: card.issue_date,
        expiry_date: card.expiry_date,
        photo_url: card.photo_url || card.snapshot.photo_url,
        verification_history: (card.verification_logs || []) as VerificationHistoryEntry[],
        verify_url: `/verify/${card.verification_id}`,
      });
    }

    // Process Certificates
    for (const cert of certs) {
      const count = cert.verification_count || 0;
      documents.push({
        id: cert.id,
        doc_type: "CERTIFICATE",
        doc_number: cert.certificate_number,
        doc_title: cert.certificate_type_title || "অফিশিয়াল সনদপত্র",
        student_name: cert.snapshot.student_name,
        student_id_code: cert.snapshot.student_id_code,
        class_name: cert.snapshot.class_name,
        roll_number: cert.snapshot.roll_number,
        total_verifications: count,
        last_verified_at: cert.last_verified_at || null,
        status: cert.status,
        issue_date: cert.issue_date,
        expiry_date: cert.expiry_date,
        photo_url: cert.snapshot.photo_url,
        verification_history: (cert.verification_logs || []) as VerificationHistoryEntry[],
        verify_url: `/verify/certificate/${cert.verification_token}`,
      });
    }

    // Calculate metrics
    let totalVerifications = 0;
    let totalCardsVerified = 0;
    let totalCertsVerified = 0;

    for (const d of documents) {
      totalVerifications += d.total_verifications;
      if (d.total_verifications > 0) {
        if (d.doc_type === "ID_CARD") totalCardsVerified++;
        if (d.doc_type === "CERTIFICATE") totalCertsVerified++;
      }
    }

    // Sort documents: verified ones first (by most verified then latest verified)
    documents.sort((a, b) => {
      if (b.total_verifications !== a.total_verifications) {
        return b.total_verifications - a.total_verifications;
      }
      if (b.last_verified_at && a.last_verified_at) {
        return new Date(b.last_verified_at).getTime() - new Date(a.last_verified_at).getTime();
      }
      return b.last_verified_at ? 1 : -1;
    });

    const mostVerifiedDoc = documents.length > 0 && documents[0].total_verifications > 0 ? documents[0] : null;

    // Filter documents based on options
    let filteredDocs = documents;
    if (filters?.only_verified) {
      filteredDocs = filteredDocs.filter((d) => d.total_verifications > 0);
    }
    if (filters?.doc_type && filters.doc_type !== "ALL") {
      filteredDocs = filteredDocs.filter((d) => d.doc_type === filters.doc_type);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      filteredDocs = filteredDocs.filter(
        (d) =>
          d.doc_number.toLowerCase().includes(q) ||
          d.student_name.toLowerCase().includes(q) ||
          (d.student_id_code && d.student_id_code.toLowerCase().includes(q)) ||
          (d.roll_number && d.roll_number.toLowerCase().includes(q)) ||
          (d.class_name && d.class_name.toLowerCase().includes(q))
      );
    }

    return {
      totalVerifications,
      totalVerifiedDocuments: totalCardsVerified + totalCertsVerified,
      totalCardsVerified,
      totalCertsVerified,
      documents: filteredDocs,
      recentLogs: storedLogs.slice(0, 50),
      mostVerifiedDoc,
    };
  } catch (err) {
    console.error("Error in getVerificationAuditData:", err);
    return {
      totalVerifications: 0,
      totalVerifiedDocuments: 0,
      totalCardsVerified: 0,
      totalCertsVerified: 0,
      documents: [],
      recentLogs: [],
      mostVerifiedDoc: null,
    };
  }
}
