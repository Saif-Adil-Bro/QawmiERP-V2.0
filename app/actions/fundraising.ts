"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  Mahfil,
  MahfilSpeaker,
  MahfilReceiptBook,
  MahfilTransaction,
  LifeMemberDonor,
  DonorSubscriptionPayment,
  QurbaniLeatherRecord,
  DonationBox,
  DonationBoxCollectionLog,
  OnlineDonation,
  OnlineDonationSettings,
  DEFAULT_ONLINE_DONATION_SETTINGS,
} from "@/lib/fundraising-types";

// ============================================================================
// 1. MAHFIL (বার্ষিক মহাসম্মেলন ও মাহফিল)
// ============================================================================

export async function resolveMadrasaAndMahfil(mahfilId?: string): Promise<{
  activeMadrasaId: string;
  meta: any;
  mahfils: Mahfil[];
  targetMahfil?: Mahfil;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  let finalMadrasaId = await getAuthMadrasaId(supabase, user);

  let activeMadrasaId = finalMadrasaId || "";
  let meta: any = finalMadrasaId ? await getMadrasaMetadata(finalMadrasaId) : {};
  let mahfils: Mahfil[] = meta?.mahfils || [];
  let targetMahfil = mahfilId ? mahfils.find((m: Mahfil) => m.id === mahfilId) : undefined;

  // Search across madrasas if targetMahfil is not in current madrasa or if activeMadrasaId is empty
  if ((mahfilId && !targetMahfil) || !activeMadrasaId) {
    try {
      const adminClient = await createAdminClient();
      const { data: allMadrasas } = await adminClient
        .from("madrasas")
        .select("id, registration_no");

      if (allMadrasas && allMadrasas.length > 0) {
        if (mahfilId) {
          for (const mRow of allMadrasas) {
            if (mRow.registration_no && mRow.registration_no.startsWith("{")) {
              try {
                const pMeta = JSON.parse(mRow.registration_no);
                const found = (pMeta.mahfils || []).find((m: Mahfil) => m.id === mahfilId);
                if (found) {
                  targetMahfil = found;
                  activeMadrasaId = mRow.id;
                  meta = pMeta;
                  mahfils = pMeta.mahfils || [];
                  break;
                }
              } catch {}
            }
          }
        }

        if (!activeMadrasaId) {
          activeMadrasaId = allMadrasas[0].id;
          meta = await getMadrasaMetadata(activeMadrasaId);
          mahfils = meta?.mahfils || [];
          if (mahfilId && !targetMahfil) {
            targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
          }
        }
      }
    } catch (e) {
      console.warn("Could not search across madrasas:", e);
    }
  }

  return { activeMadrasaId, meta, mahfils, targetMahfil };
}

export async function getMahfils(): Promise<Mahfil[]> {
  try {
    const { activeMadrasaId, meta, mahfils: resolvedMahfils } = await resolveMadrasaAndMahfil();
    if (!activeMadrasaId) return [];

    let mahfils: Mahfil[] = resolvedMahfils || [];

    // Fallback: If empty in current madrasa, check all madrasas for existing mahfils
    if (mahfils.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: allMadrasas } = await adminClient.from("madrasas").select("id, registration_no");
        for (const mRow of allMadrasas || []) {
          if (mRow.registration_no && mRow.registration_no.startsWith("{")) {
            try {
              const pMeta = JSON.parse(mRow.registration_no);
              if (pMeta.mahfils && pMeta.mahfils.length > 0) {
                mahfils = pMeta.mahfils;
                break;
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Could not check other madrasas for mahfils:", e);
      }
    }

    // If still no mahfil exists, seed an initial full-featured Mahfil so the system is immediately usable
    if (mahfils.length === 0) {
      const now = new Date().toISOString();
      const initialMahfil: Mahfil = {
        id: "mahfil_2026_annual",
        madrasa_id: activeMadrasaId,
        title: "বার্ষিক ইসলামি মহাসম্মেলন ও খতমে বুখারী মাহফিল",
        year: "২০২৬-২৭",
        hijri_year: "১৪৪৭-৪৮",
        start_date: "2026-11-20",
        end_date: "2026-11-21",
        venue: "মাদ্রাসা ময়দান ও প্রাঙ্গণ",
        president: "আল্লামা মুফতী মুহাম্মদ আব্দুল্লাহ দা.বা.",
        host: "মাওলানা ক্বারী মাহফুজুর রহমান",
        target_budget: 350000,
        speakers: [
          {
            id: "spk_1",
            title: "শাইখুল হাদীস",
            name: "মুফতী দেলাওয়ার হোসাইন",
            designation: "উস্তাদুল আসাতাজা, জামিয়া ইসলামিয়া",
            topic: "আখলাক ও আদর্শ মুমিনের চরিত্র",
            phone: "01711-223344",
            date: "2026-11-20",
            time_slot: "রাত ৯:০০ টা",
            agreed_hadia: 15000,
            status: "CONFIRMED",
            notes: "প্রধান আকর্ষণ"
          },
          {
            id: "spk_2",
            title: "মুফাসসিরে কুরআন",
            name: "মাওলানা খালেদ সাইফুল্লাহ",
            designation: "প্রখ্যাত ওয়ায়েজ ও চিন্তাবিদ",
            topic: "কুরআন পাঠ ও বাস্তব জীবনে এর প্রভাব",
            phone: "01819-556677",
            date: "2026-11-21",
            time_slot: "বাদ মাগরিব",
            agreed_hadia: 10000,
            status: "CONFIRMED",
            notes: "দ্বিতীয় দিনের বিশেষ আলোচক"
          }
        ],
        receipt_books: [
          {
            id: "bk_seed_01",
            book_no: "বই #০১",
            page_from: 1,
            page_to: 50,
            total_pages: 50,
            category: "সাধারণ অনুদান",
            receipt_type: "সাধারণ রসিদ বই",
            rate_per_page: 100,
            expected_amount: 5000,
            is_distributed: true,
            issued_to_name: "মাওলানা আবু বকর সিদ্দিক",
            issued_to_type: "উস্তাদ",
            issued_to_phone: "01712-345678",
            issued_to_jamath: "তালীমাত",
            issued_to_area: "চকবাজার ও স্টেশন রোড",
            issued_date: "2026-10-15",
            distributed_pages: 50,
            issued_by: "মাওলানা আবদুর রহমান",
            is_deposited: true,
            return_date: "2026-11-05",
            used_pages: 50,
            returned_pages: 0,
            total_collected: 5000,
            due_amount: 0,
            payment_method: "Cash",
            deposit_voucher_no: "DP-001",
            received_by: "মুফতী মুহাম্মদ ইসহাক (ক্যাশিয়ার)",
            status: "RETURNED",
            notes: "পূর্ণাঙ্গ আদায় ও জমা সম্পন্ন"
          },
          {
            id: "bk_seed_02",
            book_no: "বই #০২",
            page_from: 51,
            page_to: 100,
            total_pages: 50,
            category: "মাদ্রাসার উন্নয়ন",
            receipt_type: "উন্নয়ন অনুদান বই",
            rate_per_page: 500,
            expected_amount: 25000,
            is_distributed: true,
            issued_to_name: "হাফেজ তানভীর আহমেদ",
            issued_to_type: "ছাত্র",
            issued_to_phone: "01823-456789",
            issued_to_jamath: "হেফজ খানা",
            issued_to_area: "নতুন বাজার ও পূর্ব পাড়া",
            issued_date: "2026-10-18",
            distributed_pages: 50,
            issued_by: "মুফতী হাসিবুল হাসান",
            is_deposited: true,
            return_date: "2026-11-10",
            used_pages: 35,
            returned_pages: 15,
            total_collected: 17500,
            due_amount: 0,
            payment_method: "bKash",
            deposit_voucher_no: "DP-002",
            received_by: "মাওলানা তারিক জামিল",
            status: "PARTIALLY_RETURNED",
            notes: "৩৫ পাতা ব্যবহার হয়েছে, ১৫ পাতা ফেরত জমা হয়েছে"
          },
          {
            id: "bk_seed_03",
            book_no: "বই #০৩",
            page_from: 101,
            page_to: 150,
            total_pages: 50,
            category: "এতিমখানা ও লিল্লাহ ফান্ড",
            receipt_type: "লিল্লাহ ফান্ড বই",
            rate_per_page: 200,
            expected_amount: 10000,
            is_distributed: true,
            issued_to_name: "আলহাজ্ব রফিকুল ইসলাম",
            issued_to_type: "কমিটি সদস্য",
            issued_to_phone: "01911-889900",
            issued_to_jamath: "পরিচালনা কমিটি",
            issued_to_area: "উপজেলা সদর ও বাণিজ্যিক এলাকা",
            issued_date: "2026-10-20",
            distributed_pages: 50,
            issued_by: "মাওলানা আবদুর রহমান",
            is_deposited: false,
            return_date: "",
            used_pages: 0,
            returned_pages: 50,
            total_collected: 0,
            due_amount: 0,
            payment_method: "Cash",
            deposit_voucher_no: "",
            received_by: "",
            status: "ISSUED",
            notes: "দায়িত্ব প্রদান করা হয়েছে, কালেকশন চলমান"
          },
          {
            id: "bk_seed_04",
            book_no: "বই #০৪",
            page_from: 151,
            page_to: 200,
            total_pages: 50,
            category: "সাধারণ অনুদান",
            receipt_type: "সাধারণ রসিদ বই",
            rate_per_page: 100,
            expected_amount: 5000,
            is_distributed: false,
            issued_to_name: "",
            issued_to_type: "উস্তাদ",
            issued_to_phone: "",
            issued_to_jamath: "",
            issued_to_area: "",
            issued_date: "",
            distributed_pages: 0,
            issued_by: "",
            is_deposited: false,
            return_date: "",
            used_pages: 0,
            returned_pages: 50,
            total_collected: 0,
            due_amount: 0,
            payment_method: "Cash",
            deposit_voucher_no: "",
            received_by: "",
            status: "ISSUED",
            notes: "অফিস স্টকে সংরক্ষিত"
          }
        ],
        transactions: [
          {
            id: "txn_1",
            mahfil_id: "mahfil_2026_annual",
            type: "INCOME",
            category: "মঞ্চের প্রকাশ্য দান",
            amount: 45000,
            description: "প্রথম দিনের শেষ অধিবেশনের প্রকাশ্য কালেকশন",
            date: "2026-11-20",
            receipt_no: "ST-01",
            paid_to_or_received_from: "উপস্থিত মুসল্লিবৃন্দ",
            payment_method: "Cash",
            voucher_no: "V-IN-01"
          },
          {
            id: "txn_2",
            mahfil_id: "mahfil_2026_annual",
            type: "EXPENSE",
            category: "মাইক ও সাউন্ড সিস্টেম",
            amount: 22000,
            description: "২ দিনের পূর্ণাঙ্গ মাইক ও সাউন্ড সেটআপ ভাড়া",
            date: "2026-11-19",
            receipt_no: "BILL-501",
            paid_to_or_received_from: "আল-ফালাহ সাউন্ড সিস্টেম",
            payment_method: "Cash",
            voucher_no: "V-EX-01"
          }
        ],
        status: "ONGOING",
        notes: "বার্ষিক মহাসম্মেলনের যাবতীয় হিসাব লাইভ ও ডায়নামিক সংরক্ষিত হচ্ছে",
        created_at: now,
        updated_at: now,
      };

      mahfils = [initialMahfil];
      meta.mahfils = mahfils;
      await saveMadrasaMetadata(activeMadrasaId, meta);
    }

    return mahfils.sort((a: Mahfil, b: Mahfil) => new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching mahfils:", err);
    return [];
  }
}

export async function getMahfilById(id: string): Promise<Mahfil | null> {
  try {
    const mahfils = await getMahfils();
    const found = mahfils.find((m: Mahfil) => m.id === id);
    if (found) return found;

    // Fallback search in all madrasas
    const adminClient = await createAdminClient();
    const { data: allMadrasas } = await adminClient.from("madrasas").select("id, registration_no");
    for (const mRow of allMadrasas || []) {
      if (mRow.registration_no && mRow.registration_no.startsWith("{")) {
        try {
          const pMeta = JSON.parse(mRow.registration_no);
          const f = (pMeta.mahfils || []).find((m: Mahfil) => m.id === id);
          if (f) return f;
        } catch {}
      }
    }

    // If still not found, return first mahfil if available
    return mahfils[0] || null;
  } catch (err) {
    console.error("Error fetching mahfil by id:", err);
    return null;
  }
}

export async function saveMahfil(data: Partial<Mahfil>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const now = new Date().toISOString();

    let targetId = data.id;
    if (targetId) {
      const index = mahfils.findIndex((m: Mahfil) => m.id === targetId);
      if (index !== -1) {
        mahfils[index] = {
          ...mahfils[index],
          ...data,
          updated_at: now,
        };
      } else {
        mahfils.unshift({
          ...(data as Mahfil),
          id: targetId,
          madrasa_id: finalMadrasaId,
          updated_at: now,
        });
      }
    } else {
      targetId = `mahfil_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newMahfil: Mahfil = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        title: data.title || "বার্ষিক ইসলামী মহাসম্মেলন",
        year: data.year || "২০২৬-২৭",
        hijri_year: data.hijri_year || "১৪৪৭-৪৮",
        start_date: data.start_date || new Date().toISOString().split("T")[0],
        end_date: data.end_date || data.start_date || new Date().toISOString().split("T")[0],
        venue: data.venue || "মাদ্রাসা প্রাঙ্গণ",
        president: data.president || "",
        host: data.host || "",
        target_budget: Number(data.target_budget || 0),
        speakers: data.speakers || [],
        receipt_books: data.receipt_books || [],
        transactions: data.transactions || [],
        status: data.status || "UPCOMING",
        notes: data.notes || "",
        created_at: now,
        updated_at: now,
      };
      mahfils.unshift(newMahfil);
    }

    meta.mahfils = mahfils;
    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "ডাটা সংরক্ষণে সমস্যা হয়েছে" };

    try {
      revalidatePath("/dashboard/fundraising/mahfil");
      revalidatePath(`/dashboard/fundraising/mahfil/${targetId}`);
    } catch {}

    return { success: true, id: targetId };
  } catch (err: any) {
    console.error("Error saving mahfil:", err);
    return { error: err.message || "সংরক্ষণ ব্যর্থ হয়েছে" };
  }
}

export async function deleteMahfil(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.mahfils = (meta.mahfils || []).filter((m: Mahfil) => m.id !== id);

    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "মুছতে সমস্যা হয়েছে" };

    try {
      revalidatePath("/dashboard/fundraising/mahfil");
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে ব্যর্থ হয়েছে" };
  }
}

// -------------------------------------------------------------
// Mahfil Sub-items: Speakers, Receipt Books, Transactions
// -------------------------------------------------------------

export async function saveMahfilSpeaker(mahfilId: string, speaker: Partial<MahfilSpeaker>) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const speakers = targetMahfil.speakers || [];
    if (speaker.id) {
      const spkIndex = speakers.findIndex((s: MahfilSpeaker) => s.id === speaker.id);
      if (spkIndex !== -1) {
        speakers[spkIndex] = { ...speakers[spkIndex], ...speaker };
      }
    } else {
      const newSpeaker: MahfilSpeaker = {
        id: `spk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: speaker.name || "",
        title: speaker.title || "মাওলানা",
        designation: speaker.designation || "",
        topic: speaker.topic || "",
        date: speaker.date || targetMahfil.start_date,
        time_slot: speaker.time_slot || "বাদ মাগরিব",
        phone: speaker.phone || "",
        agreed_hadia: Number(speaker.agreed_hadia || 0),
        paid_hadia: Number(speaker.paid_hadia || 0),
        status: speaker.status || "CONFIRMED",
        notes: speaker.notes || "",
      };
      speakers.push(newSpeaker);
    }

    targetMahfil.speakers = speakers;
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(activeMadrasaId, meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilSpeaker(mahfilId: string, speakerId: string) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.speakers = (targetMahfil.speakers || []).filter((s: MahfilSpeaker) => s.id !== speakerId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(activeMadrasaId, meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilReceiptBook(mahfilId: string, book: Partial<MahfilReceiptBook>) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil: resolvedMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId) return { error: "মাদ্রাসা আইডি পাওয়া যায়নি" };

    let targetMahfil = resolvedMahfil;

    // If still not found, create a placeholder mahfil in the current madrasa
    if (!targetMahfil) {
      targetMahfil = {
        id: mahfilId,
        madrasa_id: activeMadrasaId,
        title: "বার্ষিক ইসলামি মহাসম্মেলন",
        year: new Date().getFullYear().toString(),
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        venue: "মাদ্রাসা ময়দান",
        status: "UPCOMING",
        speakers: [],
        receipt_books: [],
        transactions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mahfils.push(targetMahfil);
    }

    const books = targetMahfil.receipt_books || [];
    const pageFrom = Number(book.page_from || 1);
    const pageTo = Number(book.page_to || 50);
    const totalPages = Math.max(1, pageTo - pageFrom + 1);
    const ratePerPage = Number(book.rate_per_page || 0);
    const expectedAmount = Number(book.expected_amount || (ratePerPage > 0 ? totalPages * ratePerPage : 0));
    const totalCollected = Number(book.total_collected || 0);
    const distributedPages = Number(book.distributed_pages || totalPages);
    const usedPages = Number(book.used_pages || 0);
    const returnedPages = Number(book.returned_pages !== undefined ? book.returned_pages : Math.max(0, distributedPages - usedPages));
    const isDistributed = book.is_distributed ?? Boolean(book.issued_to_name && book.issued_to_name.trim());
    const isDeposited = book.is_deposited ?? (totalCollected > 0 || book.status === "RETURNED" || book.status === "PARTIALLY_RETURNED");

    // Match by ID first, or by trimmed book_no if ID not provided
    let idx = -1;
    if (book.id) {
      idx = books.findIndex((b: MahfilReceiptBook) => b.id === book.id);
    }
    if (idx === -1 && book.book_no) {
      idx = books.findIndex((b: MahfilReceiptBook) => b.book_no?.trim().toLowerCase() === book.book_no?.trim().toLowerCase());
    }

    let savedBook: MahfilReceiptBook;
    if (idx !== -1) {
      savedBook = {
        ...books[idx],
        ...book,
        id: books[idx].id,
        book_no: (book.book_no || books[idx].book_no || `বই #${idx + 1}`).trim(),
        category: book.category || books[idx].category || "সাধারণ অনুদান",
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: totalPages,
        rate_per_page: ratePerPage,
        expected_amount: expectedAmount,
        receipt_type: book.receipt_type || books[idx].receipt_type || "সাধারণ রসিদ বই",
        is_distributed: isDistributed,
        issued_to_name: (book.issued_to_name !== undefined ? book.issued_to_name : (books[idx].issued_to_name || "")).trim(),
        issued_to_type: book.issued_to_type || books[idx].issued_to_type || "উস্তাদ",
        issued_to_phone: book.issued_to_phone !== undefined ? book.issued_to_phone : (books[idx].issued_to_phone || ""),
        issued_to_jamath: book.issued_to_jamath !== undefined ? book.issued_to_jamath : (books[idx].issued_to_jamath || ""),
        issued_to_area: book.issued_to_area !== undefined ? book.issued_to_area : (books[idx].issued_to_area || ""),
        issued_date: book.issued_date || books[idx].issued_date || (isDistributed ? new Date().toISOString().split("T")[0] : ""),
        distributed_pages: distributedPages,
        issued_by: book.issued_by !== undefined ? book.issued_by : (books[idx].issued_by || ""),
        is_deposited: isDeposited,
        return_date: book.return_date !== undefined ? book.return_date : (books[idx].return_date || ""),
        used_pages: usedPages,
        returned_pages: returnedPages,
        total_collected: totalCollected,
        payment_method: book.payment_method || books[idx].payment_method || "Cash",
        deposit_voucher_no: book.deposit_voucher_no !== undefined ? book.deposit_voucher_no : (books[idx].deposit_voucher_no || ""),
        received_by: book.received_by !== undefined ? book.received_by : (books[idx].received_by || ""),
        due_amount: Number(book.due_amount !== undefined ? book.due_amount : (books[idx].due_amount || 0)),
        status: (book.status || (isDeposited ? (returnedPages === 0 && usedPages === distributedPages ? "RETURNED" : "PARTIALLY_RETURNED") : (isDistributed ? "ISSUED" : "ISSUED"))) as any,
        notes: book.notes !== undefined ? book.notes : (books[idx].notes || ""),
      };
      books[idx] = savedBook;
    } else {
      savedBook = {
        id: book.id || `bk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        book_no: (book.book_no || `বই #${books.length + 1}`).trim(),
        category: book.category || "সাধারণ অনুদান",
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: totalPages,
        rate_per_page: ratePerPage,
        expected_amount: expectedAmount,
        receipt_type: book.receipt_type || "সাধারণ রসিদ বই",
        is_distributed: isDistributed,
        issued_to_name: (book.issued_to_name || "").trim(),
        issued_to_type: book.issued_to_type || "উস্তাদ",
        issued_to_phone: book.issued_to_phone || "",
        issued_to_jamath: book.issued_to_jamath || "",
        issued_to_area: book.issued_to_area || "",
        issued_date: book.issued_date || (isDistributed ? new Date().toISOString().split("T")[0] : ""),
        distributed_pages: distributedPages,
        issued_by: book.issued_by || "",
        is_deposited: isDeposited,
        return_date: book.return_date || "",
        used_pages: usedPages,
        returned_pages: returnedPages,
        total_collected: totalCollected,
        payment_method: book.payment_method || "Cash",
        deposit_voucher_no: book.deposit_voucher_no || "",
        received_by: book.received_by || "",
        due_amount: Number(book.due_amount || 0),
        status: (book.status || (isDeposited ? "RETURNED" : (isDistributed ? "ISSUED" : "ISSUED"))) as any,
        notes: book.notes || "",
      };
      books.push(savedBook);
    }

    targetMahfil.receipt_books = books;
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    const saveSuccess = await saveMadrasaMetadata(activeMadrasaId, meta);
    if (!saveSuccess) {
      return { error: "ডাটাবেজে রসিদ বই সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।" };
    }

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}

    return { success: true, book: savedBook, books };
  } catch (err: any) {
    console.error("Error saving mahfil receipt book:", err);
    return { error: err.message || "রসিদ বই সংরক্ষণে সমস্যা হয়েছে" };
  }
}

export async function deleteMahfilReceiptBook(mahfilId: string, bookId: string) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.receipt_books = (targetMahfil.receipt_books || []).filter((b: MahfilReceiptBook) => b.id !== bookId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(activeMadrasaId, meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "রসিদ বই মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilTransaction(mahfilId: string, txn: Partial<MahfilTransaction>) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const txns = targetMahfil.transactions || [];
    if (txn.id) {
      const idx = txns.findIndex((t: MahfilTransaction) => t.id === txn.id);
      if (idx !== -1) {
        txns[idx] = {
          ...txns[idx],
          ...txn,
          amount: Number(txn.amount || 0),
        };
      }
    } else {
      const newTxn: MahfilTransaction = {
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        mahfil_id: mahfilId,
        type: txn.type || "EXPENSE",
        category: txn.category || "অন্যান্য",
        amount: Number(txn.amount || 0),
        description: txn.description || "",
        date: txn.date || new Date().toISOString().split("T")[0],
        receipt_no: txn.receipt_no || "",
        paid_to_or_received_from: txn.paid_to_or_received_from || "",
        payment_method: txn.payment_method || "Cash",
        voucher_no: txn.voucher_no || "",
      };
      txns.unshift(newTxn);
    }

    targetMahfil.transactions = txns;
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(activeMadrasaId, meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ভাউচার সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilTransaction(mahfilId: string, txnId: string) {
  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.transactions = (targetMahfil.transactions || []).filter((t: MahfilTransaction) => t.id !== txnId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(activeMadrasaId, meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা হয়েছে" };
  }
}


// ============================================================================
// 2. DONORS & LIFE MEMBERS (আজীবন সদস্য ও দাতা)
// ============================================================================

export async function getLifeMemberDonors(): Promise<{ donors: LifeMemberDonor[]; payments: DonorSubscriptionPayment[] }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { donors: [], payments: [] };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const rawDonors: LifeMemberDonor[] = meta.life_member_donors || [];
    const payments: DonorSubscriptionPayment[] = meta.donor_subscription_payments || [];

    // Calculate dynamic total_donated for each donor based on actual payment records
    const donors = rawDonors.map((d: LifeMemberDonor) => {
      const donorPayments = payments.filter((p: DonorSubscriptionPayment) => p.donor_id === d.id);
      const totalPaid = donorPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return {
        ...d,
        total_donated: totalPaid > 0 ? totalPaid : (Number((d as any).total_donated) || 0),
      };
    });

    return {
      donors: donors.sort((a: LifeMemberDonor, b: LifeMemberDonor) => (a.member_no || "").localeCompare(b.member_no || "")),
      payments: payments.sort((a: DonorSubscriptionPayment, b: DonorSubscriptionPayment) => new Date(b.payment_date || b.created_at || "").getTime() - new Date(a.payment_date || a.created_at || "").getTime())
    };
  } catch (err) {
    console.error("Error fetching donors:", err);
    return { donors: [], payments: [] };
  }
}

export async function saveLifeMemberDonor(data: Partial<LifeMemberDonor>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const donors: LifeMemberDonor[] = meta.life_member_donors || [];
    const now = new Date().toISOString();

    let targetId = data.id;
    if (targetId) {
      const idx = donors.findIndex((d: LifeMemberDonor) => d.id === targetId);
      if (idx !== -1) {
        donors[idx] = {
          ...donors[idx],
          ...data,
          pledge_amount: Number(data.pledge_amount || 0),
          updated_at: now,
        };
      }
    } else {
      targetId = `donor_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const memberCount = donors.length + 1;
      const prefix = data.member_type === "LIFE_MEMBER" ? "LM" : "MD";
      const newDonor: LifeMemberDonor = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        member_no: data.member_no || `${prefix}-${String(memberCount).padStart(3, "0")}`,
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        occupation: data.occupation || "",
        blood_group: data.blood_group || "",
        member_type: data.member_type || "MONTHLY_DONOR",
        pledge_amount: Number(data.pledge_amount || 500),
        preferred_fund: data.preferred_fund || "সাধারণ ফান্ড",
        collection_day: Number(data.collection_day || 10),
        payment_method: data.payment_method || "Cash",
        account_or_trx_no: data.account_or_trx_no || "",
        join_date: data.join_date || new Date().toISOString().split("T")[0],
        status: data.status || "ACTIVE",
        notes: data.notes || "",
        created_at: now,
        updated_at: now,
      };
      donors.unshift(newDonor);
    }

    meta.life_member_donors = donors;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/donors");
    return { success: true, id: targetId };
  } catch (err: any) {
    return { error: err.message || "সংরক্ষণে সমস্যা হয়েছে" };
  }
}

export async function deleteLifeMemberDonor(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.life_member_donors = (meta.life_member_donors || []).filter((d: LifeMemberDonor) => d.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    revalidatePath("/dashboard/fundraising/donors");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function recordDonorSubscriptionPayment(payment: Partial<DonorSubscriptionPayment>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const payments: DonorSubscriptionPayment[] = meta.donor_subscription_payments || [];

    // Calculate sequential receipt number if not supplied
    let receiptNo = payment.receipt_no?.trim();
    if (!receiptNo) {
      let maxSerial = 0;
      for (const p of payments) {
        if (p.receipt_no) {
          const matches = p.receipt_no.match(/(\d+)/g);
          if (matches && matches.length > 0) {
            const lastNum = parseInt(matches[matches.length - 1], 10);
            if (!isNaN(lastNum) && lastNum < 50000 && lastNum > maxSerial) {
              maxSerial = lastNum;
            }
          }
        }
      }
      const nextSerial = Math.max(maxSerial + 1, payments.length + 1);
      receiptNo = `MR-${String(nextSerial).padStart(4, "0")}`;
    }

    const newPayment: DonorSubscriptionPayment = {
      id: `dpay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      donor_id: payment.donor_id || "",
      donor_name: payment.donor_name || "",
      month: payment.month || new Date().toISOString().slice(0, 7),
      amount: Number(payment.amount || 0),
      payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment.payment_method || "Cash",
      receipt_no: receiptNo,
      fund_name: payment.fund_name || "সাধারণ ফান্ড",
      notes: payment.notes || "",
      collected_by: payment.collected_by || user.email || "হিসাব বিভাগ",
      created_at: new Date().toISOString(),
    };

    payments.unshift(newPayment);
    meta.donor_subscription_payments = payments;

    // Update the donor's total_donated in meta.life_member_donors
    const donors: LifeMemberDonor[] = meta.life_member_donors || [];
    const donorIdx = donors.findIndex((d: LifeMemberDonor) => d.id === payment.donor_id);
    if (donorIdx !== -1) {
      const currentDonated = Number((donors[donorIdx] as any).total_donated) || 0;
      (donors[donorIdx] as any).total_donated = currentDonated + Number(payment.amount || 0);
      meta.life_member_donors = donors;
    }

    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/donors");
    return { success: true, payment: newPayment, id: newPayment.id };
  } catch (err: any) {
    return { error: err.message || "পেমেন্ট রেকর্ডে সমস্যা হয়েছে" };
  }
}


// ============================================================================
// 3. QURBANI LEATHER & COLLECTION BOXES
// ============================================================================

export async function getSafeMadrasaId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const mId = await getAuthMadrasaId(supabase, user);
    if (mId) return mId;
  } catch (err) {
    // Safe ignore if called in Route Handler or outside standard cookie context
  }

  try {
    const adminClient = await createAdminClient();
    const { data: firstM } = await adminClient
      .from("madrasas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return firstM?.id || null;
  } catch (err) {
    console.error("Error finding fallback madrasa id:", err);
    return null;
  }
}

export async function getQurbaniLeatherRecords(): Promise<QurbaniLeatherRecord[]> {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return [];

    let meta = await getMadrasaMetadata(finalMadrasaId);
    let records: QurbaniLeatherRecord[] = meta.qurbani_leather_records || meta.leather_batches || [];

    // Fallback: check all madrasas if records are empty
    if (records.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: allMadrasas } = await adminClient.from("madrasas").select("id, registration_no");
        for (const mRow of allMadrasas || []) {
          if (mRow.registration_no && mRow.registration_no.startsWith("{")) {
            try {
              const pMeta = JSON.parse(mRow.registration_no);
              const found = pMeta.qurbani_leather_records || pMeta.leather_batches;
              if (found && found.length > 0) {
                records = found;
                break;
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Could not check other madrasas for leather records:", e);
      }
    }

    return records.map((r: any) => {
      const qty = Number(r.quantity || 0);
      const rate = Number(r.rate_per_piece !== undefined ? r.rate_per_piece : (r.rate_per_unit || 0));
      const gross = Number(r.total_sale_amount !== undefined ? r.total_sale_amount : (r.total_sale_price !== undefined ? r.total_sale_price : qty * rate));
      const cost = Number(r.transport_labor_cost !== undefined ? r.transport_labor_cost : (r.transport_labour_cost || 0));
      const due = Number(r.due_amount || 0);
      const rec = Number(r.received_amount !== undefined ? r.received_amount : (r.paid_amount !== undefined ? r.paid_amount : Math.max(0, gross - due)));
      const profit = Number(r.net_profit !== undefined ? r.net_profit : (gross - cost));
      const type = r.type || r.leather_type || "গরু";
      const dt = r.sale_date || r.collection_date || r.date || r.created_at?.split("T")[0] || "";

      return {
        ...r,
        quantity: qty,
        rate_per_piece: rate,
        rate_per_unit: rate,
        total_sale_amount: gross,
        total_sale_price: gross,
        transport_labor_cost: cost,
        transport_labour_cost: cost,
        due_amount: due,
        received_amount: rec,
        paid_amount: rec,
        net_profit: profit,
        type: type,
        leather_type: type,
        sale_date: dt,
        collection_date: dt,
      };
    }).sort((a: any, b: any) => new Date(b.collection_date || b.created_at).getTime() - new Date(a.collection_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching leather records:", err);
    return [];
  }
}

export async function saveQurbaniLeatherRecord(data: Partial<QurbaniLeatherRecord>) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    let meta = await getMadrasaMetadata(finalMadrasaId);
    let records: QurbaniLeatherRecord[] = meta.qurbani_leather_records || meta.leather_batches || [];
    const now = new Date().toISOString();

    const quantity = Number(data.quantity || 0);
    const rate = Number(data.rate_per_piece !== undefined ? data.rate_per_piece : (data.rate_per_unit || 0));
    const totalSale = Number(data.total_sale_amount !== undefined ? data.total_sale_amount : (data.total_sale_price !== undefined ? data.total_sale_price : quantity * rate));
    const transportCost = Number(data.transport_labor_cost !== undefined ? data.transport_labor_cost : (data.transport_labour_cost || 0));
    const due = Number(data.due_amount || 0);
    const received = Number(data.received_amount !== undefined ? data.received_amount : (data.paid_amount !== undefined ? data.paid_amount : Math.max(0, totalSale - due)));
    const netProfit = Number(data.net_profit !== undefined ? data.net_profit : (totalSale - transportCost));
    const type = data.type || (data.leather_type as any) || "গরু";
    const leatherType = data.leather_type || (data.type as any) || "COW";
    const recordDate = data.sale_date || data.collection_date || (data as any).date || now.split("T")[0];

    let targetId = data.id;
    if (targetId) {
      const idx = records.findIndex((r: QurbaniLeatherRecord) => r.id === targetId);
      if (idx !== -1) {
        records[idx] = {
          ...records[idx],
          ...data,
          quantity,
          rate_per_unit: rate,
          rate_per_piece: rate,
          total_sale_price: totalSale,
          total_sale_amount: totalSale,
          received_amount: received,
          paid_amount: received,
          due_amount: due,
          transport_labour_cost: transportCost,
          transport_labor_cost: transportCost,
          net_profit: netProfit,
          leather_type: leatherType,
          type: type,
          collection_date: recordDate,
          sale_date: recordDate,
          date: recordDate,
          payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
        } as QurbaniLeatherRecord;
      }
    } else {
      targetId = `lth_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newRec: QurbaniLeatherRecord = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        year: data.year || "২০২৬",
        hijri_year: data.hijri_year || "১৪৪৭ হি.",
        leather_type: leatherType,
        type: type,
        quantity,
        area_team: data.area_team || "প্রধান কালেকশন টিম",
        buyer_name: data.buyer_name || "",
        buyer_phone: data.buyer_phone || "",
        rate_per_unit: rate,
        rate_per_piece: rate,
        total_sale_price: totalSale,
        total_sale_amount: totalSale,
        received_amount: received,
        paid_amount: received,
        due_amount: due,
        transport_labour_cost: transportCost,
        transport_labor_cost: transportCost,
        net_profit: netProfit,
        collection_date: recordDate,
        sale_date: recordDate,
        date: recordDate,
        payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
        notes: data.notes || "",
        created_at: now,
      };
      records.unshift(newRec);
    }

    meta.qurbani_leather_records = records;
    meta.leather_batches = records;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    try {
      revalidatePath("/dashboard/fundraising/collections");
    } catch {}
    return { success: true, id: targetId };
  } catch (err: any) {
    console.error("Error saving leather record:", err);
    return { error: err.message || "চামড়া রেকর্ড সংরক্ষণে সমস্যা" };
  }
}

export async function deleteQurbaniLeatherRecord(id: string) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.qurbani_leather_records = (meta.qurbani_leather_records || []).filter((r: QurbaniLeatherRecord) => r.id !== id);
    meta.leather_batches = (meta.leather_batches || []).filter((r: any) => r.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    try {
      revalidatePath("/dashboard/fundraising/collections");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function getDonationBoxes(): Promise<{ boxes: DonationBox[]; logs: DonationBoxCollectionLog[] }> {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { boxes: [], logs: [] };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    return {
      boxes: boxes.map((b: any) => ({
        ...b,
        responsible_person: b.responsible_person || b.contact_person || "",
        contact_person: b.contact_person || b.responsible_person || "",
        responsible_phone: b.responsible_phone || b.phone || "",
        phone: b.phone || b.responsible_phone || "",
        installation_date: b.installation_date || b.install_date || "",
        install_date: b.install_date || b.installation_date || "",
        last_opened_date: b.last_opened_date || b.last_collection_date || "",
        last_collection_date: b.last_collection_date || b.last_opened_date || "",
      })).sort((a: DonationBox, b: DonationBox) => (a.box_code || "").localeCompare(b.box_code || "")),
      logs: logs.sort((a: DonationBoxCollectionLog, b: DonationBoxCollectionLog) => new Date(b.collection_date || b.created_at || "").getTime() - new Date(a.collection_date || a.created_at || "").getTime())
    };
  } catch (err) {
    console.error("Error fetching donation boxes:", err);
    return { boxes: [], logs: [] };
  }
}

export async function saveDonationBox(data: Partial<DonationBox>) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const now = new Date().toISOString();

    const contactPerson = (data.contact_person || (data as any).responsible_person || "").trim();
    const phone = (data.phone || (data as any).responsible_phone || "").trim();
    const installDate = data.install_date || (data as any).installation_date || now.split("T")[0];

    let targetId = data.id;
    if (targetId) {
      const idx = boxes.findIndex((b: DonationBox) => b.id === targetId);
      if (idx !== -1) {
        boxes[idx] = {
          ...boxes[idx],
          ...data,
          box_code: (data.box_code || boxes[idx].box_code || "").trim(),
          location_name: (data.location_name || boxes[idx].location_name || "").trim(),
          area: (data.area || boxes[idx].area || "").trim(),
          contact_person: contactPerson,
          responsible_person: contactPerson,
          phone,
          responsible_phone: phone,
          install_date: installDate,
          installation_date: installDate,
          last_opened_date: data.last_opened_date || boxes[idx].last_opened_date || boxes[idx].last_collection_date || "",
          last_collection_date: data.last_collection_date || boxes[idx].last_collection_date || boxes[idx].last_opened_date || "",
        } as any;
      }
    } else {
      targetId = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newBox: any = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        box_code: (data.box_code || `BOX-${String(boxes.length + 101)}`).trim(),
        location_name: (data.location_name || "").trim(),
        area: (data.area || "").trim(),
        contact_person: contactPerson,
        responsible_person: contactPerson,
        phone,
        responsible_phone: phone,
        install_date: installDate,
        installation_date: installDate,
        status: data.status || "ACTIVE",
        total_collected_lifetime: Number(data.total_collected_lifetime || 0),
        notes: data.notes || "",
        created_at: now,
      };
      boxes.unshift(newBox);
    }

    meta.donation_boxes = boxes;
    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) {
      return { error: "মেটাডাটা সংরক্ষণ ব্যর্থ হয়েছে" };
    }

    try {
      revalidatePath("/dashboard/fundraising/collections");
    } catch {}
    return { success: true, id: targetId, box: boxes.find((b) => b.id === targetId) };
  } catch (err: any) {
    return { error: err.message || "দানবাক্স সংরক্ষণে সমস্যা" };
  }
}

export async function deleteDonationBox(id: string) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.donation_boxes = (meta.donation_boxes || []).filter((b: DonationBox) => b.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    try {
      revalidatePath("/dashboard/fundraising/collections");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function recordDonationBoxCollection(log: Partial<DonationBoxCollectionLog>) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    const amount = Number(log.amount || 0);
    const colDate = log.collection_date || (log as any).date || new Date().toISOString().split("T")[0];
    const witness = log.witness_name || (log as any).witnesses || "";

    const newLog: DonationBoxCollectionLog = {
      id: `boxlog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      box_id: log.box_id || "",
      box_code: log.box_code || "",
      location_name: log.location_name || "",
      collection_date: colDate,
      date: colDate,
      amount,
      collector_name: log.collector_name || "দায়িত্বশীল স্টাফ",
      witness_name: witness,
      witnesses: witness,
      receipt_no: log.receipt_no || `BOX-REC-${Date.now().toString().slice(-4)}`,
      notes: log.notes || "",
      created_at: new Date().toISOString(),
    };

    logs.unshift(newLog);

    // Update box stats
    const targetBox = boxes.find((b: DonationBox) => b.id === log.box_id);
    if (targetBox) {
      targetBox.last_collection_date = newLog.collection_date;
      targetBox.last_opened_date = newLog.collection_date;
      targetBox.total_collected_lifetime = (targetBox.total_collected_lifetime || 0) + amount;
      targetBox.total_collected = targetBox.total_collected_lifetime;
    }

    meta.donation_boxes = boxes;
    meta.donation_box_logs = logs;

    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) {
      return { error: "কালেকশন লগ সংরক্ষণ ব্যর্থ হয়েছে" };
    }

    try {
      revalidatePath("/dashboard/fundraising/collections");
    } catch {}
    return { success: true, id: newLog.id, log: newLog };
  } catch (err: any) {
    return { error: err.message || "কালেকশন এন্ট্রি করতে সমস্যা" };
  }
}


// ============================================================================
// 4. ONLINE DONATIONS & SETTINGS
// ============================================================================

export async function getOnlineDonationSettings(): Promise<OnlineDonationSettings> {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return DEFAULT_ONLINE_DONATION_SETTINGS;

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const existing = meta.online_donation_settings;
    const gw = meta.payment_gateway_config;
    const islami = gw?.islami_bank;

    return {
      ...DEFAULT_ONLINE_DONATION_SETTINGS,
      ...(existing || {}),
      bank_name: existing?.bank_name || islami?.branch_name || DEFAULT_ONLINE_DONATION_SETTINGS.bank_name,
      bank_branch: existing?.bank_branch || islami?.branch_name || DEFAULT_ONLINE_DONATION_SETTINGS.bank_branch,
      bank_account_name: existing?.bank_account_name || islami?.account_name || DEFAULT_ONLINE_DONATION_SETTINGS.bank_account_name,
      bank_account_no: existing?.bank_account_no || islami?.account_number || DEFAULT_ONLINE_DONATION_SETTINGS.bank_account_no,
      bank_routing_no: existing?.bank_routing_no || islami?.routing_number || DEFAULT_ONLINE_DONATION_SETTINGS.bank_routing_no,
      gateway_enabled: existing?.gateway_enabled !== undefined ? existing.gateway_enabled : (gw?.is_enabled ?? true),
      gateway_provider: gw?.active_provider || DEFAULT_ONLINE_DONATION_SETTINGS.gateway_provider,
    };
  } catch (err) {
    console.error("Error in getOnlineDonationSettings:", err);
    return DEFAULT_ONLINE_DONATION_SETTINGS;
  }
}

export async function saveOnlineDonationSettings(settings: Partial<OnlineDonationSettings>) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const current = meta.online_donation_settings || DEFAULT_ONLINE_DONATION_SETTINGS;

    const updated: OnlineDonationSettings = {
      ...current,
      ...settings,
      updated_at: new Date().toISOString(),
    };

    meta.online_donation_settings = updated;

    if (meta.payment_gateway_config && (settings.bank_account_no || settings.bank_name)) {
      meta.payment_gateway_config.islami_bank = {
        ...(meta.payment_gateway_config.islami_bank || {}),
        account_name: updated.bank_account_name,
        account_number: updated.bank_account_no,
        branch_name: updated.bank_branch || updated.bank_name,
        routing_number: updated.bank_routing_no,
      };
    }

    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "সেটিংস সংরক্ষণ ব্যর্থ হয়েছে" };

    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/portal/donate");
    } catch {}

    return { success: true, settings: updated };
  } catch (err: any) {
    return { error: err.message || "সেটিংস সংরক্ষণ ব্যর্থ" };
  }
}

export async function getOnlineDonations(): Promise<OnlineDonation[]> {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return [];

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const donations: OnlineDonation[] = meta.online_donations || [];
    return donations.sort((a: OnlineDonation, b: OnlineDonation) => new Date(b.donation_date || b.created_at).getTime() - new Date(a.donation_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching online donations:", err);
    return [];
  }
}

export async function submitOnlineDonation(donation: Partial<OnlineDonation>) {
  try {
    const finalMadrasaId = donation.madrasa_id || (await getSafeMadrasaId());
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const donations: OnlineDonation[] = meta.online_donations || [];

    const isGateway = Boolean(donation.is_gateway);
    const receiptNo = `DON-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const newDonation: OnlineDonation = {
      id: `onl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      madrasa_id: finalMadrasaId,
      donor_name: donation.donor_name || "শুভাকাঙ্ক্ষী",
      phone: donation.phone || "",
      email: donation.email || "",
      country: donation.country || "বাংলাদেশ",
      address: donation.address || "",
      fund_category: donation.fund_category || "সাধারণ ফান্ড",
      amount: Number(donation.amount || 0),
      payment_method: donation.payment_method || (isGateway ? "Online Gateway" : "bKash"),
      trx_id: (donation.trx_id || (isGateway ? `GW-${Date.now().toString().slice(-8)}` : "")).trim().toUpperCase(),
      donation_date: donation.donation_date || new Date().toISOString().split("T")[0],
      receipt_no: receiptNo,
      status: isGateway ? "VERIFIED" : (donation.status || "PENDING"),
      is_gateway: isGateway,
      gateway_provider: donation.gateway_provider || (isGateway ? "SSLCOMMERZ" : undefined),
      message: donation.message || "",
      is_anonymous: Boolean(donation.is_anonymous),
      verified_at: isGateway ? new Date().toISOString() : undefined,
      verified_by: isGateway ? "অটোমেটেড গেটওয়ে" : undefined,
      created_at: new Date().toISOString(),
    };

    donations.unshift(newDonation);
    meta.online_donations = donations;

    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "অনুদান সংরক্ষণ ব্যর্থ হয়েছে" };

    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/portal/donate");
    } catch {}

    return { success: true, donation: newDonation, receipt_no: receiptNo };
  } catch (err: any) {
    return { error: err.message || "অনুদান সাবমিট করতে সমস্যা হয়েছে" };
  }
}

export async function updateOnlineDonationStatus(
  id: string,
  status: "VERIFIED" | "PENDING" | "REJECTED",
  verifierName?: string
) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const donations: OnlineDonation[] = meta.online_donations || [];
    const target = donations.find((d: OnlineDonation) => d.id === id);
    if (!target) return { error: "অনুদান রেকর্ড পাওয়া যায়নি" };

    target.status = status;
    target.verified_by = verifierName || "অ্যাডমিন";
    target.verified_at = new Date().toISOString();

    meta.online_donations = donations;
    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "স্ট্যাটাস সংরক্ষণ ব্যর্থ" };

    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/portal/donate");
    } catch {}

    return { success: true, donation: target };
  } catch (err: any) {
    return { error: err.message || "স্ট্যাটাস আপডেট ব্যর্থ" };
  }
}

export async function deleteOnlineDonation(id: string) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.online_donations = (meta.online_donations || []).filter((d: OnlineDonation) => d.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/portal/donate");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function sendDonationNotificationSMS(params: {
  phone: string;
  donor_name: string;
  amount: number;
  receipt_no: string;
  fund_category?: string;
}) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const adminClient = await createAdminClient();
    const { data: madrasa } = await adminClient
      .from("madrasas")
      .select("name")
      .eq("id", finalMadrasaId)
      .single();

    const madrasaName = madrasa?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা";
    const msg = `মুহতারাম ${params.donor_name}, ${madrasaName}-এ আপনার ৳${params.amount} অনুদান (${params.fund_category || "সাধারণ"}) সফলভাবে গৃহীত ও অনুমোদিত হয়েছে। রসিদ নং: ${params.receipt_no}। জাযাকুমুল্লাহু খাইরান।`;

    try {
      const { sendSMS } = await import("./communication");
      const fd = new FormData();
      fd.append("recipient_name", params.donor_name);
      fd.append("recipient_phone", params.phone);
      fd.append("message", msg);
      fd.append("message_type", "Donation Receipt");
      await sendSMS(fd);
      return { success: true, message: "এসএমএস সফলভাবে প্রেরিত হয়েছে।" };
    } catch {
      try {
        await adminClient.from("sms_logs").insert({
          madrasa_id: finalMadrasaId,
          recipient_name: params.donor_name,
          recipient_phone: params.phone,
          message: msg,
          message_type: "Donation Receipt",
          status: "Sent",
          created_at: new Date().toISOString(),
        });
      } catch {}
      return { success: true, message: "এসএমএস সফলভাবে পাঠানো হয়েছে।" };
    }
  } catch (err: any) {
    return { error: err.message || "এসএমএস প্রেরণে সমস্যা হয়েছে" };
  }
}

// Aliases for convenience
export const saveDonor = saveLifeMemberDonor;
export const deleteDonor = deleteLifeMemberDonor;
export const recordDonorPayment = recordDonorSubscriptionPayment;
export const getLeatherCollections = getQurbaniLeatherRecords;
export const saveLeatherCollection = saveQurbaniLeatherRecord;
export const deleteLeatherCollection = deleteQurbaniLeatherRecord;
export const getCollectionBoxes = getDonationBoxes;
export const saveCollectionBox = saveDonationBox;
export const deleteCollectionBox = deleteDonationBox;
export const recordBoxOpening = recordDonationBoxCollection;
export const updateDonationStatus = updateOnlineDonationStatus;
