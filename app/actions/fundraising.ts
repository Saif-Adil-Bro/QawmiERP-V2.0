"use server";

import { isMaskedValue } from "@/lib/pii-masking";
import { confirmsMirror,saleAmount } from "@/lib/finance/collection-links";
import { ledgerEntries,money } from "@/lib/finance/entries";
import { financeRows,fundCatalog,replaceSources,collectionSnapshot, postCollection, postingFund } from "@/lib/finance/funds";
import { randomBytes, randomUUID } from "node:crypto";
import { getDefaultMadrasaId } from "@/lib/madrasa-default";
import { toDhakaDateStringFrom, toDhakaDateString, toDhakaMonthString, getDhakaYear } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  Mahfil,
  MahfilSpeaker,
  MahfilReceiptBook,
  MahfilTransaction,
  MahfilSettlement,
  LifeMemberDonor,
  DonorSubscriptionPayment,
  QurbaniLeatherRecord,
  DonationBox,
  DonationBoxCollectionLog,
  OnlineDonation,
  OnlineDonationSettings,
  DEFAULT_ONLINE_DONATION_SETTINGS,
} from "@/lib/fundraising-types";
import {isPostingUuid as isUuid} from "@/lib/finance/collection-links";
import { collectionFund, settlementIndex, unmatchedMahfil, storedFund, REVIEW_FUND, isVoidDonation } from "@/lib/fund-utils";
import { getFundChoices, getNextMahfilVoucherNo } from "@/app/actions/zakat";
import {
  createRealGatewaySession,
  bdtPoisha, paymentCallbackOrigin,
  validateGatewayCredentials,
} from "@/lib/payment-gateway-engine";
import { DEFAULT_GATEWAY_CONFIG, PaymentGatewayConfig } from "@/lib/payment-gateway";

// ============================================================================
// 1. MAHFIL (বার্ষিক মহাসম্মেলন ও মাহফিল)
// ============================================================================

async function resolveMadrasaAndMahfil(mahfilId?: string): Promise<{
  activeMadrasaId: string;
  meta: any;
  mahfils: Mahfil[];
  targetMahfil?: Mahfil;
  before:Record<string,any>;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const activeMadrasaId = (user && await getAuthMadrasaId(supabase,user)) || "";
  const meta = activeMadrasaId ? await getMadrasaMetadata(activeMadrasaId,true) : {};
  const mahfils: Mahfil[] = meta.mahfils || [];
  const targetMahfil = mahfils.find(m => m.id === mahfilId);
  return { activeMadrasaId, meta, mahfils, targetMahfil, before:collectionSnapshot(meta,"mahfils") };
}

export async function getMahfils(): Promise<Mahfil[]> {
  try {
    if(!(await writeGuard("financeRead")).allowed) throw Error("অনুমতি নেই।");
    const { activeMadrasaId, meta, mahfils: resolvedMahfils } = await resolveMadrasaAndMahfil();
    if (!activeMadrasaId) return [];

    const mahfils: Mahfil[] = resolvedMahfils || [];
    return mahfils.sort((a: Mahfil, b: Mahfil) => new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching mahfils:", err);
    return [];
  }
}

export async function getMahfilById(id: string): Promise<Mahfil | null> {
  try {
    const mahfils = await getMahfils();
    return mahfils.find(m => m.id === id) || null;
  } catch (err) {
    console.error("Error fetching mahfil by id:", err);
    return null;
  }
}

export async function saveMahfil(data: Partial<Mahfil>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const now = new Date().toISOString();

    const before = collectionSnapshot(meta,"mahfils");
    let targetId = data.id;
    if (targetId) {
      const event = mahfils.find(m=>m.id===targetId);
      if (!event) return {error:"মাহফিল পাওয়া যায়নি।"};
      // Event header form may submit an old copy of the books. Never replace those books here.
      for (const key of ['title','year','hijri_year','start_date','end_date','venue','president','host','target_budget','status','notes'] as const) {
        if (data[key]!==undefined) Object.assign(event,{[key]:data[key]});
      }
      event.updated_at = now;
    } else {
      targetId = `mahfil_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newMahfil: Mahfil = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        title: data.title || "বার্ষিক ইসলামী মহাসম্মেলন",
        year: data.year || "২০২৬-২৭",
        hijri_year: data.hijri_year || "১৪৪৭-৪৮",
        start_date: data.start_date || toDhakaDateString(),
        end_date: data.end_date || data.start_date || toDhakaDateString(),
        venue: data.venue || "মাদ্রাসা প্রাঙ্গণ",
        president: data.president || "",
        host: data.host || "",
        target_budget: Number(data.target_budget || 0),
        speakers: [], receipt_books: [], transactions: [],
        status: data.status || "UPCOMING",
        notes: data.notes || "",
        created_at: now,
        updated_at: now,
      };
      mahfils.unshift(newMahfil);
    }

    meta.mahfils = mahfils;
    await replaceSources(finalMadrasaId,before,meta);

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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const before = collectionSnapshot(meta,"mahfils");
    const targetMahfil = (meta.mahfils || []).find((m: Mahfil) => m.id === id);

    if (!targetMahfil) return {error:"মাহফিল পাওয়া যায়নি।"};
    if (targetMahfil.settlement || targetMahfil.settlements?.length || targetMahfil.transactions?.length || targetMahfil.receipt_books?.length) return {error:"খাতাসহ মাহফিল মুছবেন না। মাহফিলটি সমাপ্ত হিসেবে সংরক্ষণ করুন।"};
    meta.mahfils = (meta.mahfils || []).filter((m: Mahfil) => m.id !== id);

    const ok = await replaceSources(finalMadrasaId,before,meta);
    if (!ok) return { error: "মুছতে সমস্যা হয়েছে" };

    try {
      revalidatePath("/dashboard/fundraising/mahfil");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/accounting/funds");
      revalidatePath("/dashboard/accounting/donations");
      revalidatePath("/dashboard/accounting/expenses");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/funds");
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
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
    await replaceSources(activeMadrasaId,before,meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilSpeaker(mahfilId: string, speakerId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.speakers = (targetMahfil.speakers || []).filter((s: MahfilSpeaker) => s.id !== speakerId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await replaceSources(activeMadrasaId,before,meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilReceiptBook(mahfilId: string, book: Partial<MahfilReceiptBook>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const {activeMadrasaId,meta,mahfils,targetMahfil,before} = await resolveMadrasaAndMahfil(mahfilId);
    if (!targetMahfil) return {error:"মাহফিল পাওয়া যায়নি।"};

    const books = targetMahfil.receipt_books || [];
    const pageFrom = Number(book.page_from || 1);
    const pageTo = Number(book.page_to || 50);
    const totalPages = Math.max(1, pageTo - pageFrom + 1);
    const ratePerPage = Number(book.rate_per_page || 0);
    const expectedAmount = Number(book.expected_amount || (ratePerPage > 0 ? totalPages * ratePerPage : 0));
    const totalCollected = Number(book.total_collected || 0);
    const usedPages = Number(book.used_pages || 0);
    const remainingPages = Number(
      book.remaining_pages !== undefined
        ? book.remaining_pages
        : Math.max(0, totalPages - usedPages)
    );
    const currentPageFrom = Number(
      book.current_page_from !== undefined
        ? book.current_page_from
        : Math.min(pageTo, pageFrom + usedPages)
    );
    const distributedPages = Number(
      book.distributed_pages || (remainingPages > 0 ? remainingPages : totalPages)
    );
    const returnedPages = Number(
      book.returned_pages !== undefined
        ? book.returned_pages
        : Math.max(0, distributedPages - usedPages)
    );

    // Precise status and distribution determination
    const hasRemainingPages = remainingPages > 0;
    const isCompleted = !hasRemainingPages || (totalPages > 0 && usedPages >= totalPages);

    let finalStatus: "IN_STOCK" | "ISSUED" | "RETURNED" | "PARTIALLY_RETURNED" | "OVERDUE" | "COMPLETED" = book.status || "IN_STOCK";
    let isDistributed = book.is_distributed;

    if (isCompleted) {
      // If no pages left or used_pages >= total_pages, it is 100% completed & returned
      finalStatus = "RETURNED";
      isDistributed = false;
    } else {
      // Still has remaining pages
      if (finalStatus === "RETURNED" || finalStatus === "COMPLETED") {
        finalStatus = usedPages > 0 ? "PARTIALLY_RETURNED" : "IN_STOCK";
      }

      if (isDistributed === undefined) {
        isDistributed = Boolean(book.issued_to_name && book.issued_to_name.trim().length > 0 && finalStatus !== "IN_STOCK");
      }

      if (!finalStatus) {
        if (isDistributed) {
          finalStatus = usedPages > 0 ? "PARTIALLY_RETURNED" : "ISSUED";
        } else {
          finalStatus = "IN_STOCK";
        }
      }

      if (finalStatus === "IN_STOCK") {
        isDistributed = false;
      } else if (finalStatus === "ISSUED" || finalStatus === "PARTIALLY_RETURNED") {
        if (book.issued_to_name && book.issued_to_name.trim().length > 0) {
          isDistributed = true;
        }
      }
    }

    const isDeposited = book.is_deposited ?? (totalCollected > 0 || isCompleted || finalStatus === "PARTIALLY_RETURNED" || finalStatus === "RETURNED");

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
      const prevBook = books[idx];
      const depositHistory = Array.isArray(book.deposit_history)
        ? book.deposit_history
        : (prevBook.deposit_history || []);

      savedBook = {
        ...prevBook,
        ...book,
        id: prevBook.id,
        book_no: (book.book_no || prevBook.book_no || `কুপন বই #${idx + 1}`).trim(),
        category: book.category || prevBook.category || "সাধারণ অনুদান",
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: totalPages,
        rate_per_page: ratePerPage,
        expected_amount: expectedAmount,
        receipt_type: book.receipt_type || prevBook.receipt_type || "সাধারণ কুপন বই",
        is_distributed: isDistributed,
        issued_to_name: (book.issued_to_name !== undefined ? book.issued_to_name : (prevBook.issued_to_name || "")).trim(),
        issued_to_type: book.issued_to_type || prevBook.issued_to_type || "উস্তাদ",
        issued_to_phone: book.issued_to_phone !== undefined ? book.issued_to_phone : (prevBook.issued_to_phone || ""),
        issued_to_jamath: book.issued_to_jamath !== undefined ? book.issued_to_jamath : (prevBook.issued_to_jamath || ""),
        issued_to_area: book.issued_to_area !== undefined ? book.issued_to_area : (prevBook.issued_to_area || ""),
        issued_date: book.issued_date || prevBook.issued_date || (isDistributed ? toDhakaDateString() : ""),
        distributed_pages: distributedPages,
        issued_by: book.issued_by !== undefined ? book.issued_by : (prevBook.issued_by || ""),
        is_deposited: isDeposited,
        return_date: book.return_date !== undefined ? book.return_date : (prevBook.return_date || ""),
        used_pages: usedPages,
        returned_pages: returnedPages,
        remaining_pages: isCompleted ? 0 : remainingPages,
        current_page_from: currentPageFrom,
        total_collected: totalCollected,
        payment_method: book.payment_method || prevBook.payment_method || "Cash",
        deposit_voucher_no: book.deposit_voucher_no !== undefined ? book.deposit_voucher_no : (prevBook.deposit_voucher_no || ""),
        received_by: book.received_by !== undefined ? book.received_by : (prevBook.received_by || ""),
        due_amount: Number(book.due_amount !== undefined ? book.due_amount : (prevBook.due_amount || 0)),
        status: finalStatus as any,
        deposit_history: depositHistory,
        notes: book.notes !== undefined ? book.notes : (prevBook.notes || ""),
      };
      books[idx] = savedBook;
    } else {
      savedBook = {
        id: book.id || `bk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        book_no: (book.book_no || `কুপন বই #${books.length + 1}`).trim(),
        category: book.category || "সাধারণ অনুদান",
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: totalPages,
        rate_per_page: ratePerPage,
        expected_amount: expectedAmount,
        receipt_type: book.receipt_type || "সাধারণ কুপন বই",
        is_distributed: isDistributed,
        issued_to_name: (book.issued_to_name || "").trim(),
        issued_to_type: book.issued_to_type || "উস্তাদ",
        issued_to_phone: book.issued_to_phone || "",
        issued_to_jamath: book.issued_to_jamath || "",
        issued_to_area: book.issued_to_area || "",
        issued_date: book.issued_date || (isDistributed ? toDhakaDateString() : ""),
        distributed_pages: distributedPages,
        issued_by: book.issued_by || "",
        is_deposited: isDeposited,
        return_date: book.return_date || "",
        used_pages: usedPages,
        returned_pages: returnedPages,
        remaining_pages: isCompleted ? 0 : remainingPages,
        current_page_from: currentPageFrom,
        total_collected: totalCollected,
        payment_method: book.payment_method || "Cash",
        deposit_voucher_no: book.deposit_voucher_no || "",
        received_by: book.received_by || "",
        due_amount: Number(book.due_amount || 0),
        status: finalStatus as any,
        deposit_history: book.deposit_history || [],
        notes: book.notes || "",
      };
      books.push(savedBook);
    }

    targetMahfil.receipt_books = books;
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    const saveSuccess = await replaceSources(activeMadrasaId,before,meta);
    if (!saveSuccess) {
      return { error: "ডাটাবেজে কুপন বই সংরক্ষণ করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।" };
    }

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}

    return { success: true, book: savedBook, books };
  } catch (err: any) {
    console.error("Error saving mahfil coupon book:", err);
    return { error: err.message || "কুপন বই সংরক্ষণে সমস্যা হয়েছে" };
  }
}

export async function saveMahfilBulkReceiptBooks(
  mahfilId: string,
  params: {
    totalBooks: number;
    pagesPerBook: number;
    startPageNo?: number;
    startBookNo?: number;
    prefix?: string;
    category?: string;
    ratePerPage?: number;
    expectedAmountPerBook?: number;
    receiptType?: string;
    notes?: string;
  }
) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const totalBooks = Math.max(1, Math.min(500, Number(params.totalBooks || 1)));
    const pagesPerBook = Math.max(1, Number(params.pagesPerBook || 50));
    const startPageNo = Math.max(1, Number(params.startPageNo || 1));
    const startBookNo = Math.max(1, Number(params.startBookNo || 1));
    const prefix = params.prefix !== undefined ? params.prefix : "কুপন বই #";
    const category = params.category || "সাধারণ অনুদান";
    const ratePerPage = Number(params.ratePerPage || 0);
    const receiptType = params.receiptType || "সাধারণ কুপন বই";
    const notes = params.notes || "";

    const existingBooks = targetMahfil.receipt_books || [];
    const newBooks: MahfilReceiptBook[] = [];

    const now = Date.now();
    for (let i = 0; i < totalBooks; i++) {
      const bookIndex = startBookNo + i;
      const pageFrom = startPageNo + (i * pagesPerBook);
      const pageTo = pageFrom + pagesPerBook - 1;
      const expectedAmount = Number(
        params.expectedAmountPerBook || (ratePerPage > 0 ? pagesPerBook * ratePerPage : 0)
      );

      const newBook: MahfilReceiptBook = {
        id: `bk_bulk_${now}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        book_no: `${prefix}${bookIndex}`,
        category,
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: pagesPerBook,
        rate_per_page: ratePerPage,
        expected_amount: expectedAmount,
        receipt_type: receiptType,
        is_distributed: false,
        issued_to_name: "",
        issued_to_type: "উস্তাদ",
        issued_to_phone: "",
        issued_to_jamath: "",
        issued_to_area: "",
        issued_date: "",
        distributed_pages: pagesPerBook,
        issued_by: "",
        is_deposited: false,
        return_date: "",
        used_pages: 0,
        returned_pages: pagesPerBook,
        remaining_pages: pagesPerBook,
        current_page_from: pageFrom,
        total_collected: 0,
        payment_method: "Cash",
        deposit_voucher_no: "",
        received_by: "",
        due_amount: 0,
        status: "IN_STOCK",
        deposit_history: [],
        notes,
      };

      newBooks.push(newBook);
    }

    targetMahfil.receipt_books = [...existingBooks, ...newBooks];
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    const saveSuccess = await replaceSources(activeMadrasaId,before,meta);
    if (!saveSuccess) {
      return { error: "ডাটাবেজে বাল্ক রসিদ বই সংরক্ষণ করা সম্ভব হয়নি।" };
    }

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}

    return { success: true, count: newBooks.length, books: targetMahfil.receipt_books };
  } catch (err: any) {
    console.error("Error saving bulk mahfil coupon books:", err);
    return { error: err.message || "বাল্ক কুপন বই তৈরিতে সমস্যা হয়েছে" };
  }
}

export async function deleteMahfilReceiptBook(mahfilId: string, bookId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.receipt_books = (targetMahfil.receipt_books || []).filter((b: MahfilReceiptBook) => b.id !== bookId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await replaceSources(activeMadrasaId,before,meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "কুপন বই মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilTransaction(mahfilId: string, txn: Partial<MahfilTransaction>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    if (!(bdtPoisha(txn.amount) ?? 0)) return {error:"লেনদেনের অঙ্ক সঠিক নয়।"};
    if (txn.id && [...(targetMahfil.settlements || []),targetMahfil.settlement].some(s=>s?.mahfil_txn_id===txn.id)) return {error:"সমন্বিত ভাউচার আলাদাভাবে বদলানো যাবে না।"};
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
        date: txn.date || toDhakaDateString(),
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
    await replaceSources(activeMadrasaId,before,meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ভাউচার সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilTransaction(mahfilId: string, txnId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil, before } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const targetTxn = (targetMahfil.transactions || []).find((t: MahfilTransaction) => t.id === txnId);

    targetMahfil.transactions = (targetMahfil.transactions || []).filter((t: MahfilTransaction) => t.id !== txnId);
    targetMahfil.updated_at = new Date().toISOString();

    if (!targetTxn || [...(targetMahfil.settlements || []),targetMahfil.settlement].some(st=>st && (st.mahfil_txn_id===txnId || (st.accounting_voucher_no && [targetTxn.receipt_no,targetTxn.voucher_no].includes(st.accounting_voucher_no))))) return {error:"সমন্বিত লেনদেন আলাদাভাবে মোছা যাবে না।"};

    meta.mahfils = mahfils;
    await replaceSources(activeMadrasaId,before,meta);

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/accounting/funds");
      revalidatePath("/dashboard/zakat/funds");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা হয়েছে" };
  }
}

// -------------------------------------------------------------
// Mahfil Fund Coordination & Settlement (তহবিল উদ্বৃত্ত/ঘাটতি সমন্বয়)
// -------------------------------------------------------------

export interface MahfilSettlementPayload {
  settlement_type: "SURPLUS_DEPOSIT" | "DEFICIT_COVER";
  amount: number;
  fund_id: string;
  fund_name: string;
  settlement_date: string;
  payment_method: "Cash" | "bKash" | "Nagad" | "Bank" | "Other";
  notes?: string;
}

export async function getAvailableFundsForMahfil() {
  return getFundChoices();
}

export async function settleMahfilFund(mahfilId: string, payload: MahfilSettlementPayload) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("fundraising");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };
    if (!["SURPLUS_DEPOSIT","DEFICIT_COVER"].includes(payload.settlement_type)) return {error:"সমন্বয়ের ধরন সঠিক নয়।"};
    const surplus = payload.settlement_type === "SURPLUS_DEPOSIT";
    const fund = await postingFund(activeMadrasaId,payload.fund_id,surplus ? "deposit" : "mahfil_deficit","","",payload.fund_name);
    const before = collectionSnapshot(meta,"mahfils");
    const settlementId = `settle_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const dateStr = payload.settlement_date || toDhakaDateStringFrom(now);
    const amount = Number(payload.amount);

    const net = (targetMahfil.receipt_books || []).reduce((a,b) => a+Number(b.total_collected || 0),0)
      + (targetMahfil.transactions || []).reduce((a,t) => a+(t.type === "INCOME" ? 1 : -1)*Number(t.amount || 0),0);
    if (!(bdtPoisha(amount) ?? 0) || !Number.isFinite(net) || Math.round(amount*100) > Math.round((surplus ? net : -net)*100)) return {error:"মাহফিলের উদ্বৃত্ত বা ঘাটতির অঙ্কের সঙ্গে সমন্বয় মিলছে না।"};
    const accountingRecordId = randomUUID();
    const accountingVoucherNo = await getNextMahfilVoucherNo(activeMadrasaId,surplus ? "SURPLUS" : "DEFICIT");
    const mahfilTxnId = `txn_settle_${accountingRecordId}`;
    const description = `মাহফিল: ${targetMahfil.title} (${targetMahfil.year}) | ${surplus ? "উদ্বৃত্ত জমা" : "ঘাটতি পূরণ"} | ${fund.name} | ${accountingVoucherNo} [Method: ${payload.payment_method}] ${payload.notes || ""}`;
    targetMahfil.transactions = [...(targetMahfil.transactions || []),{
      id:mahfilTxnId,mahfil_id:mahfilId,type:surplus ? "EXPENSE" : "INCOME",category:surplus ? "উদ্বৃত্ত ফান্ডে স্থানান্তর" : "ফান্ড থেকে ঘাটতি পূরণ",
      amount,date:dateStr,payment_method:payload.payment_method,receipt_no:accountingVoucherNo,description,
    }];
    const settlementRecord: MahfilSettlement = {
      id: settlementId,
      mahfil_id: mahfilId,
      settlement_type: payload.settlement_type,
      amount: amount,
      fund_id: fund.id,
      fund_name: fund.name,
      settlement_date: dateStr,
      payment_method: payload.payment_method,
      accounting_voucher_no: accountingVoucherNo,
      accounting_record_id: accountingRecordId,
      mahfil_txn_id: mahfilTxnId,
      notes: payload.notes || "",
      created_at: now,
    };

    const previous = targetMahfil.settlements || [];
    if (targetMahfil.settlement && !previous.some(s=>s.id===targetMahfil.settlement?.id)) previous.push(targetMahfil.settlement);
    targetMahfil.settlements = [...previous,settlementRecord];
    targetMahfil.settlement = settlementRecord;
    targetMahfil.updated_at = now;

    meta.mahfils = mahfils;
    await postCollection(activeMadrasaId,before,meta,surplus ? "donation" : "mahfil_deficit",{
      tender:{operator:__authz.userId,method:payload.payment_method},id:accountingRecordId,amount,date:dateStr,receipt_no:accountingVoucherNo,notes:description,fund_id:fund.id,fund_name:fund.name,
    });

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
      revalidatePath("/dashboard/fundraising/mahfil");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/accounting/expenses");
      revalidatePath("/dashboard/accounting/donations");
      revalidatePath("/dashboard/accounting/funds");
    } catch {}

    return {
      success: true,
      settlement: settlementRecord,
      message: payload.settlement_type === "SURPLUS_DEPOSIT"
        ? `আলহামদুলিল্লাহ! ৳${amount} উদ্বৃত্ত অর্থ সফলভাবে "${fund.name}"-এ স্থানান্তর করা হয়েছে এবং জমা ভাউচার #${accountingVoucherNo} যুক্ত হয়েছে।`
        : `আলহামদুলিল্লাহ! "${fund.name}" থেকে ৳${amount} ঘাটতি সমন্বয় সম্পন্ন হয়েছে এবং খরচ ভাউচার #${accountingVoucherNo} যুক্ত হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Error settling mahfil fund:", err);
    return { error: err.message || "তহবিল সমন্বয়ে সমস্যা হয়েছে" };
  }
}

export async function deleteMahfilSettlement(mahfilId: string, settlementId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const { activeMadrasaId, meta, mahfils, targetMahfil } = await resolveMadrasaAndMahfil(mahfilId);
    if (!activeMadrasaId || !targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const settlement = (targetMahfil.settlements || []).find((s: MahfilSettlement) => s.id === settlementId) || targetMahfil.settlement;
    if (!settlement) return { error: "সমন্বয় রেকর্ড পাওয়া যায়নি" };

    if (!settlement.accounting_record_id || settlement.id !== settlementId) return {error:"সমন্বয়ের মূল ভাউচারটি মেলেনি। ম্যানুয়াল যাচাই প্রয়োজন।"};
    const before = collectionSnapshot(meta,"mahfils");
    const txns = targetMahfil.transactions || [];
    const surplus = settlement.settlement_type === 'SURPLUS_DEPOSIT';
    const links = settlementIndex(mahfils, await fundCatalog(activeMadrasaId));
    if (!settlement.mahfil_txn_id || unmatchedMahfil({ id: settlement.accounting_record_id, fund_id: settlement.fund_id, amount: settlement.amount,
      [surplus ? 'receipt_no' : 'voucher_no']: settlement.accounting_voucher_no }, links)) return {error:"মাহফিলের মূল লেনদেন মেলেনি। ম্যানুয়াল যাচাই প্রয়োজন।"};
    targetMahfil.transactions = txns.filter(t => t.id !== settlement.mahfil_txn_id);
    targetMahfil.settlements = (targetMahfil.settlements || []).filter(s=>s.id!==settlementId);
    if (targetMahfil.settlement?.id===settlementId) targetMahfil.settlement = targetMahfil.settlements.at(-1);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await postCollection(activeMadrasaId,before,meta,settlement.settlement_type === "SURPLUS_DEPOSIT" ? "void_surplus" : "void_deficit",{
      id:settlement.accounting_record_id,amount:settlement.amount,receipt_no:settlement.accounting_voucher_no || "",date:settlement.settlement_date,
      fund_id:settlement.fund_id,fund_name:settlement.fund_name,notes:"মাহফিল সমন্বয় বাতিল",
    });

    try {
      revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
      revalidatePath("/dashboard/fundraising/mahfil");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/accounting/expenses");
      revalidatePath("/dashboard/accounting/donations");
      revalidatePath("/dashboard/accounting/funds");
    } catch {}

    return { success: true, message: "সমন্বয় বাতিল করা হয়েছে এবং হিসাব আপডেট করা হয়েছে।" };
  } catch (err: any) {
    return { error: err.message || "বাতিল করতে সমস্যা হয়েছে" };
  }
}


// ============================================================================
// 2. DONORS & LIFE MEMBERS (আজীবন সদস্য ও দাতা - Unified Master Donors)
// ============================================================================

export async function getLifeMemberDonors(): Promise<{ donors: LifeMemberDonor[]; payments: DonorSubscriptionPayment[] }> {
  try {
    const guard=await writeGuard('financeRead');
    if (!guard.allowed || !guard.madrasaId) throw Error('অনুমতি নেই।');
    const finalMadrasaId=guard.madrasaId;
    const adminClient=await createAdminClient();
    const meta=await getMadrasaMetadata(finalMadrasaId,true);
    const rawDonors: LifeMemberDonor[] = (meta.life_member_donors || []).filter((d:LifeMemberDonor)=>!d.madrasa_id || d.madrasa_id===finalMadrasaId);

    // Fetch relational database donors & donations
    const [dbDonors,dbDonations,funds] = await Promise.all([financeRows(adminClient,finalMadrasaId,"donors"),financeRows(adminClient,finalMadrasaId,"donations"),fundCatalog(finalMadrasaId,true)]);
    // Merge Map for Donors
    const donorMap = new Map<string, LifeMemberDonor>();

    // 1. Add raw meta donors
    rawDonors.forEach((d) => {
      donorMap.set(d.id, { ...d });
    });

    // 2. Merge database donors
    (dbDonors || []).forEach((dbD: any) => {
      const existingId = dbD.id;

      let pledgeAmount:number|undefined;
      let memberNoFromNotes = "";
      let notesText = dbD.notes || "";
      if (dbD.notes && dbD.notes.startsWith("{")) {
        try {
          const parsed = JSON.parse(dbD.notes);
          pledgeAmount = parsed.pledge_amount;
          memberNoFromNotes = parsed.member_no || "";
          notesText = parsed.notes || "";
        } catch {}
      }

      if (existingId && donorMap.has(existingId)) {
        const existing = donorMap.get(existingId)!;
        donorMap.set(existingId, {
          ...existing,
          name: existing.name || dbD.name,
          phone: existing.phone || dbD.phone || "",
          address: existing.address || dbD.address || "",
          notes: existing.notes || notesText,
        });
      } else {
        const mappedMemberType: any = 
          dbD.donor_type === "Monthly" ? "MONTHLY_DONOR" :
          dbD.donor_type === "Annual" ? "ANNUAL_DONOR" :
          dbD.donor_type === "LIFE_MEMBER" ? "LIFE_MEMBER" : "ONETIME";

        const newUnifiedDonor: LifeMemberDonor = {
          id: dbD.id,
          madrasa_id: finalMadrasaId,
          member_no: memberNoFromNotes,
          name: dbD.name,
          father_name: "",
          phone: dbD.phone || "",
          email: dbD.email || "",
          address: dbD.address || "",
          occupation: "শুভাকাঙ্ক্ষী",
          blood_group: "",
          member_type: mappedMemberType,
          membership_type: mappedMemberType,
          pledge_amount: pledgeAmount ?? dbD.pledge_amount ?? 0,
          preferred_fund: dbD.preferred_fund || "",
          collection_day: 10,
          payment_method: "Cash",
          join_date: dbD.created_at ? toDhakaDateStringFrom(dbD.created_at) : toDhakaDateString(),
          status: "ACTIVE",
          notes: notesText,
          created_at: dbD.created_at || new Date().toISOString(),
          updated_at: dbD.created_at || new Date().toISOString(),
        };

        donorMap.set(dbD.id, newUnifiedDonor);
      }
    });

    // Names and family phone numbers are not unique donor identities. The source
    // ID may identify a legacy member even when the mirrored SQL row has no donor FK.
    const donorDonationSumMap=new Map<string,number>();
    const allUnifiedPayments:DonorSubscriptionPayment[]=[];
    for (const e of ledgerEntries({funds,donations:dbDonations,meta,expenses:[],bazar:[],payments:[]})) {
      if (!e.income || !e.donor_id || !donorMap.has(e.donor_id)) continue;
      if(e.status!=='VOID') donorDonationSumMap.set(e.donor_id,money((donorDonationSumMap.get(e.donor_id)||0)+e.amount));
      allUnifiedPayments.push({id:e.id,donor_id:e.donor_id,donor_name:donorMap.get(e.donor_id)!.name,amount:e.amount,
        month:e.subscription_month || '',payment_date:e.date,status:e.status,category:e.category,
        receipt_no:e.receipt_number || '',fund_id:e.fund_id,fund_name:e.fund_name,payment_method:e.payment_method || '' });
    }

    const { getCurrentUserMaskingContext, maskDonorSensitiveFields } = await import("@/lib/data-access-guards");
    const maskingCtx = await getCurrentUserMaskingContext("fundraising", "phone");

    // Build final merged donors with lifetime total donated
    const finalDonors: LifeMemberDonor[] = Array.from(donorMap.values()).map((d) => {
      const calculatedTotal = donorDonationSumMap.get(d.id) || 0;
      return maskDonorSensitiveFields(
        {
          ...d,
          notes:maskingCtx.allowUnmasked ? d.notes : undefined,
          total_donated: calculatedTotal,
        },
        maskingCtx.allowUnmasked
      );
    });

    return {
      donors: finalDonors.sort((a, b) => (a.member_no || "").localeCompare(b.member_no || "", undefined, { numeric: true })),
      payments: allUnifiedPayments.sort((a, b) => new Date(b.payment_date || b.created_at || "").getTime() - new Date(a.payment_date || a.created_at || "").getTime())
    };
  } catch (err) {
    console.error("Error fetching unified donors:", err);
    throw new Error("দাতাদের পূর্ণ হিসাব পড়া যায়নি।");
  }
}

export async function saveLifeMemberDonor(data: Partial<LifeMemberDonor>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    // Do not persist a masked copy of contact/payment identifiers over originals.
    // The SQL directory can predate the metadata member; don't invent a replacement.
    if([data.phone,data.email,data.account_or_trx_no].some(isMaskedValue)) return {error:'আড়াল করা যোগাযোগ বা হিসাব নম্বর দিয়ে দাতার তথ্য বদলানো যাবে না।'};
    const before=collectionSnapshot(meta,'life_member_donors');
    const donors: LifeMemberDonor[] = meta.life_member_donors || [];
    const now = new Date().toISOString();

    let targetId = data.id;
    let savedDonorObj: LifeMemberDonor;

    // Keep legacy member IDs stable. Their receipts are not relational UUIDs.
    if (targetId) {
      const idx = donors.findIndex((d: LifeMemberDonor) => d.id === targetId);
      if (idx !== -1) {
        donors[idx] = {
          ...donors[idx],
          ...data,
          id: targetId,madrasa_id:finalMadrasaId,total_donated:donors[idx].total_donated,
          pledge_amount: Number(data.pledge_amount ?? data.committed_amount ?? donors[idx].pledge_amount ?? 0),
          updated_at: now,
        };
        savedDonorObj = donors[idx];
      } else {
        savedDonorObj = {
          id: targetId,
          madrasa_id: finalMadrasaId,
          member_no: data.member_no || `DN-${String(donors.length + 1).padStart(3, "0")}`,
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          occupation: data.occupation || "",
          blood_group: data.blood_group || "",
          member_type: data.member_type || data.membership_type || "MONTHLY_DONOR",
          pledge_amount: Number(data.pledge_amount ?? data.committed_amount ?? 0),
          preferred_fund: data.preferred_fund || "সাধারণ ফান্ড",
          collection_day: Number(data.collection_day || 10),
          payment_method: data.payment_method || "Cash",
          join_date: data.join_date || data.joined_date || toDhakaDateString(),
          status: data.status || "ACTIVE",
          notes: data.notes || "",
          created_at: now,
          updated_at: now,
        };
        donors.unshift(savedDonorObj);
      }
    } else {
      targetId = crypto.randomUUID();
      const memberCount = donors.length + 1;
      const mType = data.member_type || data.membership_type || "MONTHLY_DONOR";
      const prefix = mType === "LIFE_MEMBER" ? "LM" : mType === "MONTHLY_DONOR" || mType === "MONTHLY" ? "MD" : "DN";
      savedDonorObj = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        member_no: data.member_no || `${prefix}-${String(memberCount).padStart(3, "0")}`,
        name: data.name || "",
        father_name: data.father_name || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        occupation: data.occupation || "",
        blood_group: data.blood_group || "",
        member_type: mType,
        membership_type: mType,
        pledge_amount: Number(data.pledge_amount ?? data.committed_amount ?? 500),
        preferred_fund: data.preferred_fund || "সাধারণ ফান্ড",
        collection_day: Number(data.collection_day || 10),
        payment_method: data.payment_method || "Cash",
        account_or_trx_no: data.account_or_trx_no || "",
        join_date: data.join_date || data.joined_date || toDhakaDateString(),
        status: data.status || "ACTIVE",
        notes: data.notes || "",
        created_at: now,
        updated_at: now,
      };
      donors.unshift(savedDonorObj);
    }

    // Save to Metadata
    meta.life_member_donors = donors;


    const {error}=await adminClient.rpc('finance_save_member',{p_tenant:finalMadrasaId,p_id:targetId,p_before:before.life_member_donors ?? [],p_member:savedDonorObj,p_mode:data.id?'edit':'create'});
    if (error) return {error:error.message};
    revalidatePath("/dashboard/fundraising/donors");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat");
    const {getCurrentUserMaskingContext,maskDonorSensitiveFields}=await import('@/lib/data-access-guards');
    const {allowUnmasked}=await getCurrentUserMaskingContext('fundraising','phone');
    return { success: true, id: targetId,donor:maskDonorSensitiveFields({...savedDonorObj,notes:allowUnmasked?savedDonorObj.notes:undefined},allowUnmasked) };
  } catch (err: any) {
    return { error: err.message || "সংরক্ষণে সমস্যা হয়েছে" };
  }
}

export async function deleteLifeMemberDonor(id: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const {error}=await adminClient.rpc('finance_save_member',{p_tenant:finalMadrasaId,p_id:id,p_before:meta.life_member_donors ?? [],p_member:null,p_mode:'delete'});
    if (error) return {error:error.message};
    revalidatePath("/dashboard/fundraising/donors");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function recordDonorSubscriptionPayment(payment: Partial<DonorSubscriptionPayment>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const fund = await postingFund(finalMadrasaId,payment.fund_id,"deposit","","",payment.fund_category,payment.fund_name);
    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const before = collectionSnapshot(meta,"donor_subscription_payments");
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

    if (!payment.donor_id || (!(meta.life_member_donors || []).some((d:any)=>d.id===payment.donor_id) && !isUuid(payment.donor_id))) return {error:"দাতা পাওয়া যায়নি।"};
    if (!(bdtPoisha(payment.amount) ?? 0)) return {error:"চাঁদার অঙ্ক সঠিক নয়।"};
    const newPayment: DonorSubscriptionPayment = { accounting_record_id:randomUUID(),
      id: `dpay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      donor_id: payment.donor_id || "",
      donor_name: payment.donor_name || "",
      month: payment.month || toDhakaMonthString(),
      amount: Number(payment.amount || 0),
      payment_date: payment.payment_date || toDhakaDateString(),
      payment_method: payment.payment_method || "Cash",
      receipt_no: receiptNo,
      fund_id: fund.id, fund_name: fund.name,
      notes: payment.notes || "",
      collected_by: payment.collected_by || user.email || "হিসাব বিভাগ",
      created_at: new Date().toISOString(),
    };

    payments.unshift(newPayment);
    meta.donor_subscription_payments = payments;

    await postCollection(finalMadrasaId,before,meta,"donation",{
      tender:{operator:user.id,method:payment.payment_method},id:newPayment.accounting_record_id,member_id:!isUuid(newPayment.donor_id)?newPayment.donor_id:undefined, donor_id: payment.donor_id && isUuid(payment.donor_id) ? payment.donor_id : null,
      amount:newPayment.amount,fund_id:fund.id,fund_name:fund.name,date:newPayment.payment_date!,receipt_no:receiptNo,
      notes:`[মাসিক চাঁদা: ${newPayment.month}] ${newPayment.notes || ""}`,
    });

    revalidatePath("/dashboard/fundraising/donors");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/reports");
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
    // A signed-in account with no valid tenant must not post into the public default.
    return user ? (await getAuthMadrasaId(supabase,user)) || null : await getDefaultMadrasaId();
  } catch { return null; }
}

export async function getQurbaniLeatherRecords(): Promise<QurbaniLeatherRecord[]> {
  try {
    const g=await writeGuard("financeRead");if(!g.allowed)throw Error(g.error);
    const finalMadrasaId=g.madrasaId;
    if (!finalMadrasaId) return [];

    let meta = await getMadrasaMetadata(finalMadrasaId);
    let records: QurbaniLeatherRecord[] = meta.qurbani_leather_records || meta.leather_batches || [];

    return records.map((r: any) => {
      const qty = Number(r.quantity || 0);
      const rate = Number(r.rate_per_piece !== undefined ? r.rate_per_piece : (r.rate_per_unit || 0));
      const gross = Number(r.total_sale_amount !== undefined ? r.total_sale_amount : (r.total_sale_price !== undefined ? r.total_sale_price : qty * rate));
      const cost = Number(r.transport_labor_cost !== undefined ? r.transport_labor_cost : (r.transport_labour_cost || 0));
      const due = Number(r.due_amount || 0);
      const rec = Number(r.received_amount !== undefined ? r.received_amount : (r.paid_amount !== undefined ? r.paid_amount : Math.max(0, gross - due)));
      const profit = Number(r.net_profit !== undefined ? r.net_profit : (gross - cost));
      const type = r.type || r.leather_type || "গরু";
      const dt = r.sale_date || r.collection_date || r.date || toDhakaDateStringFrom(r.created_at) || "";

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
        buyer_name: r.buyer_name || "",
        year: r.year || "২০২৬",
      };
    }).sort((a: any, b: any) => new Date(b.collection_date || b.created_at).getTime() - new Date(a.collection_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching leather records:", err);
    return [];
  }
}

export async function getNextLeatherVoucherNo(madrasaId?: string): Promise<string> {
  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId || (madrasaId && madrasaId!==finalMadrasaId)) throw new Error("অনুমতি নেই।");
    let maxSeq = 0;

    if (finalMadrasaId) {
      const meta = await getMadrasaMetadata(finalMadrasaId,true);
      const records = meta.qurbani_leather_records || meta.leather_batches || [];
      records.forEach((r: any) => {
        const rec = (r.receipt_no || "").trim();
        const match = rec.match(/(?:LTH[-_]?(?:REC)?[-_]?)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
    }

    const adminClient = await createAdminClient();
    const donList=await financeRows(adminClient,finalMadrasaId,"donations","id,receipt_no");
    (donList || []).forEach((d: any) => {
      const rec = (d.receipt_no || "").trim();
      if (rec.toUpperCase().includes("LTH")) {
        const match = rec.match(/(?:LTH[-_]?(?:REC)?[-_]?)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `LTH-REC-${String(nextSeq).padStart(3, "0")}`;
  } catch {
    throw new Error("চামড়ার রসিদ সিরিজ পড়া যায়নি।");
  }
}

export async function saveQurbaniLeatherRecord(data: Partial<QurbaniLeatherRecord>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("fundraising");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    if (meta.qurbani_leather_records && meta.leather_batches && JSON.stringify(meta.qurbani_leather_records)!==JSON.stringify(meta.leather_batches)) return {error:"চামড়ার দুই খাতা মিলছে না। যাচাই করুন।"};
    const before = collectionSnapshot(meta,"qurbani_leather_records","leather_batches");
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
    const recordDate = data.sale_date || data.collection_date || (data as any).date || toDhakaDateStringFrom(now);
    if (![received,transportCost,totalSale,due].every(n => Number.isFinite(n) && (n===0 || (bdtPoisha(n) ?? 0)>0)) || Math.abs(received+due-totalSale)>0.001) return {error:"চালানের অঙ্ক সঠিক নয়।"};
    const fund = await postingFund(finalMadrasaId,data.fund_id,transportCost > 0 ? "expense" : "deposit","Transport","",data.fund_name,data.target_fund);
    const targetFund = fund.name;
    const previous = records.find(r => r.id === data.id);
    if (data.id && (!previous || records.filter(r=>r.id===data.id).length!==1)) return {error:"চালান বদলেছে। রিফ্রেশ করুন।"};
    if (previous && (collectionFund(await fundCatalog(finalMadrasaId), previous)?.id !== fund.id || (data.receipt_no && previous.receipt_no && data.receipt_no !== previous.receipt_no))) return {error:"পোস্ট করা চালানের ফান্ড বা নম্বর বদলানো যাবে না। মূল চালান যাচাই করুন।"};

    if (previous && (isVoidDonation(previous) || ['VOID'].includes((previous as any).income_status) || (previous as any).expense_status==='VOID' || (previous as any).exp_notes?.includes('[VOID:'))) return {error:"বাতিল চালান এই ফর্মে সংশোধন করা যাবে না।"};
    if ([data.notes,(data as any).exp_notes].some(note=>note?.includes('[VOID:'))) return {error:"বাতিলের জন্য মূল ভাউচার ব্যবহার করুন।"};
    let voucherId=previous?.accounting_record_id;
    if (previous && (saleAmount(previous)>0 || voucherId)) {
      const db=await createAdminClient();
      const {data:old,error}=await db.from('donations').select('*').eq('madrasa_id',finalMadrasaId).eq(voucherId?'id':'receipt_no',voucherId || previous.receipt_no).maybeSingle();
      if (error || !old || isVoidDonation(old) || !confirmsMirror(await fundCatalog(finalMadrasaId),old,'qurbani_leather_records',previous)) return {error:"পুরোনো চালানের মূল রসিদ যাচাই করুন।"};
      voucherId=old.id;
    }
    if (received>0) voucherId ||= randomUUID();
    let receiptNo = (data.receipt_no || "").trim();
    if (!receiptNo || receiptNo.includes("undefined") || receiptNo.startsWith("LTH-") && receiptNo.length < 8) {
      receiptNo = await getNextLeatherVoucherNo(finalMadrasaId);
    }

    let targetId = data.id;
    if (targetId) {
      const idx = records.findIndex((r: QurbaniLeatherRecord) => r.id === targetId);
      if (idx !== -1) {
        if (!data.receipt_no && records[idx].receipt_no) {
          receiptNo = records[idx].receipt_no!;
        }
        records[idx] = {
          ...records[idx],
          area_team:data.area_team ?? records[idx].area_team,notes:data.notes ?? records[idx].notes,
          id: targetId,
          madrasa_id: finalMadrasaId,
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
          fund_id: fund.id, fund_name: targetFund,
          target_fund: targetFund,
          receipt_no: receiptNo,
          year: data.year || records[idx].year || "২০২৬",
          buyer_name: (data.buyer_name !== undefined ? data.buyer_name : (records[idx].buyer_name || "")).trim(),
          buyer_phone: (data.buyer_phone !== undefined ? data.buyer_phone : (records[idx].buyer_phone || "")).trim(),
          payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
        } as QurbaniLeatherRecord;
      } else {
        // Upsert if ID was generated on client or existed in another state
        const newRec: QurbaniLeatherRecord = {
          id: targetId,
          madrasa_id: finalMadrasaId,
          year: data.year || "২০২৬",
          hijri_year: data.hijri_year || "১৪৪৭ হি.",
          leather_type: leatherType,
          type: type,
          quantity,
          area_team: data.area_team || "প্রধান কালেকশন টিম",
          buyer_name: (data.buyer_name || "").trim(),
          buyer_phone: (data.buyer_phone || "").trim(),
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
          fund_id: fund.id, fund_name: targetFund,
          target_fund: targetFund,
          receipt_no: receiptNo,
          payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
          notes: data.notes || "",
          created_at: now,
        };
        records.unshift(newRec);
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
        buyer_name: (data.buyer_name || "").trim(),
        buyer_phone: (data.buyer_phone || "").trim(),
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
        fund_id: fund.id, fund_name: targetFund,
        target_fund: targetFund,
        receipt_no: receiptNo,
        payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
        notes: data.notes || "",
        created_at: now,
      };
      records.unshift(newRec);
    }

    const saved=records.find(r=>r.id===targetId)!;
    saved.payment_method=previous?.payment_method || (!previous || !previous.accounting_record_id ? data.payment_method : undefined);
    if (transportCost>0 && !Number(previous?.transport_labour_cost??previous?.transport_labor_cost??0) && data.transport_method) {
      saved.transport_method=data.transport_method;saved.transport_operator_id=__authz.userId;
    }
    if (voucherId) saved.accounting_record_id=voucherId;
    meta.qurbani_leather_records = records;
    meta.leather_batches = records;
    const depositAmount = received;
    if (depositAmount > 0) await postCollection(finalMadrasaId,before,meta,"donation",{
      tender:{operator:__authz.userId,method:data.payment_method},id:voucherId,amount:depositAmount,date:recordDate,fund_id:fund.id,fund_name:fund.name,receipt_no:receiptNo,
      notes:`[কুরবানির চামড়া বিক্রয়] চালান: ${receiptNo}, চামড়া: ${type} (${quantity} পিস), দর: ৳${rate}, মোট বিক্রয়: ৳${totalSale}, লেবার/পরিবহন খরচ: ৳${transportCost}, ক্রেতা: ${data.buyer_name || ""}`,
    },!!previous);
    else if (previous && saleAmount(previous) > 0) return {error:"জমাকৃত চালান বাতিলের জন্য হিসাব যাচাই করুন।"};
    else await replaceSources(finalMadrasaId,before,meta,__authz.userId);

    try {
      revalidatePath("/dashboard/fundraising/collections");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/fundraising");
    } catch {}
    return { success: true, id: targetId, record: records.find((r) => r.id === targetId) };
  } catch (err: any) {
    console.error("Error saving leather record:", err);
    return { error: err.message || "চামড়া রেকর্ড সংরক্ষণে সমস্যা" };
  }
}

export async function deleteQurbaniLeatherRecord(id: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const keys = ['qurbani_leather_records','leather_batches'];
    const records = keys.flatMap(k=>(meta[k] || []).filter((r:any)=>r.id===id));
    if (!records.length) return {error:"চালান পাওয়া যায়নি।"};
    if (records.some(r=>Number(r.received_amount ?? r.paid_amount ?? r.total_sale_amount ?? r.total_sale_price)>0 || Number(r.transport_labor_cost ?? r.transport_labour_cost)>0)) {
      return {error:"পোস্ট করা চালান মোছা যাবে না। মূল ফান্ড খতিয়ান থেকে ভাউচার বাতিল করুন।"};
    }
    const before = collectionSnapshot(meta,...keys);
    for (const k of keys) meta[k]=(meta[k] || []).filter((r:any)=>r.id!==id);
    await replaceSources(finalMadrasaId,before,meta);

    try {
      revalidatePath("/dashboard/fundraising/collections");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/accounting/funds");
      revalidatePath("/dashboard/accounting/donations");
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/fundraising");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function getDonationBoxes(): Promise<{ boxes: DonationBox[]; logs: DonationBoxCollectionLog[] }> {
  try {
    const g=await writeGuard("financeRead");if(!g.allowed)throw Error(g.error);
    const finalMadrasaId=g.madrasaId;
    if (!finalMadrasaId) return { boxes: [], logs: [] };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    let boxes: DonationBox[] = meta.donation_boxes || [];
    let logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    return {
      boxes: boxes.map((b: any) => ({
        ...b,
        collection_logs: logs.filter(l=>l.box_id===b.id),
        total_collected_lifetime:logs.filter(l=>l.box_id===b.id && !isVoidDonation(l)).reduce((n,l)=>n+Number(l.amount || 0),0),
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

export async function getNextBoxVoucherNo(madrasaId?: string): Promise<string> {
  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId || (madrasaId && madrasaId!==finalMadrasaId)) throw new Error("অনুমতি নেই।");
    let maxSeq = 0;

    if (finalMadrasaId) {
      const meta = await getMadrasaMetadata(finalMadrasaId,true);
      const logs = meta.donation_box_logs || [];
      logs.forEach((l: any) => {
        const rec = (l.receipt_no || "").trim();
        const match = rec.match(/(?:BOX[-_]?(?:REC)?[-_]?)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
    }

    const adminClient = await createAdminClient();
    const donList=await financeRows(adminClient,finalMadrasaId,"donations","id,receipt_no");
    (donList || []).forEach((d: any) => {
      const rec = (d.receipt_no || "").trim();
      if (rec.toUpperCase().includes("BOX")) {
        const match = rec.match(/(?:BOX[-_]?(?:REC)?[-_]?)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `BOX-REC-${String(nextSeq).padStart(3, "0")}`;
  } catch {
    throw new Error("বাক্সের রসিদ সিরিজ পড়া যায়নি।");
  }
}

export async function saveDonationBox(data: Partial<DonationBox>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const before=collectionSnapshot(meta,'donation_boxes');
    const boxes: DonationBox[] = meta.donation_boxes || [];
    if (data.id && !boxes.some(b=>b.id===data.id)) return {error:'বাক্স পাওয়া যায়নি।'};
    const now = new Date().toISOString();

    const contactPerson = (data.contact_person || (data as any).responsible_person || "").trim();
    const phone = (data.phone || (data as any).responsible_phone || "").trim();
    const installDate = data.install_date || (data as any).installation_date || toDhakaDateStringFrom(now);

    // Compute next sequential box code if not provided
    let boxCode = (data.box_code || "").trim();
    if (!boxCode) {
      let maxNum = 0;
      boxes.forEach((b) => {
        const match = (b.box_code || "").match(/(?:BOX[-_\s]*)?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      boxCode = `BOX-${String(maxNum + 1).padStart(3, "0")}`;
    }

    let targetId = data.id;
    if (targetId) {
      const idx = boxes.findIndex((b: DonationBox) => b.id === targetId);
      if (idx !== -1) {
        boxes[idx] = {
          ...boxes[idx],
          status:data.status || boxes[idx].status,notes:data.notes ?? boxes[idx].notes,
          box_code: boxCode,
          location_name: (data.location_name || boxes[idx].location_name || "").trim(),
          area: (data.area || boxes[idx].area || "").trim(),
          contact_person: contactPerson,
          responsible_person: contactPerson,
          phone,
          responsible_phone: phone,
          install_date: installDate,
          installation_date: installDate,
          last_opened_date: boxes[idx].last_opened_date || boxes[idx].last_collection_date || "",
          last_collection_date: boxes[idx].last_collection_date || boxes[idx].last_opened_date || "",
        } as any;
      } else {
        const newBox: any = {
          id: targetId,
          madrasa_id: finalMadrasaId,
          box_code: boxCode,
          location_name: (data.location_name || "").trim(),
          area: (data.area || "").trim(),
          contact_person: contactPerson,
          responsible_person: contactPerson,
          phone,
          responsible_phone: phone,
          install_date: installDate,
          installation_date: installDate,
          status: data.status || "ACTIVE",
          total_collected_lifetime: 0,
          notes: data.notes || "",
          created_at: now,
        };
        boxes.unshift(newBox);
      }
    } else {
      targetId = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newBox: any = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        box_code: boxCode,
        location_name: (data.location_name || "").trim(),
        area: (data.area || "").trim(),
        contact_person: contactPerson,
        responsible_person: contactPerson,
        phone,
        responsible_phone: phone,
        install_date: installDate,
        installation_date: installDate,
        status: data.status || "ACTIVE",
        total_collected_lifetime: 0,
        notes: data.notes || "",
        created_at: now,
      };
      boxes.unshift(newBox);
    }

    meta.donation_boxes = boxes;
    const ok = await replaceSources(finalMadrasaId,before,meta);
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    if ((meta.donation_box_logs || []).some((r:any)=>r.box_id===id)) return {error:"সংগ্রহের ইতিহাসসহ বাক্স মোছা যাবে না। বাক্সটি নিষ্ক্রিয় করুন।"};
    const before = collectionSnapshot(meta,"donation_boxes","donation_box_logs");
    meta.donation_boxes = (meta.donation_boxes || []).filter((b:DonationBox)=>b.id!==id);
    await replaceSources(finalMadrasaId,before,meta);

    try {
      revalidatePath("/dashboard/fundraising/collections");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/fundraising");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function deleteDonationBoxCollectionLog(logId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  return {error:"সংগ্রহের রসিদ মোছা যাবে না। মূল ফান্ড খতিয়ান থেকে ভাউচার বাতিল করুন।"};
}

export async function recordDonationBoxCollection(log: Partial<DonationBoxCollectionLog>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("fundraising");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const before = collectionSnapshot(meta,"donation_boxes","donation_box_logs");
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    const amount = Number(log.amount || 0);
    const colDate = log.collection_date || (log as any).date || toDhakaDateString();
    const witness = (log.witness_name || (log as any).witnesses || "মুহতামিম ও ক্যাশিয়ার").trim();

    const targetBox = boxes.find((b: DonationBox) => b.id === log.box_id);
    if (!targetBox || targetBox.status!=="ACTIVE" || !(bdtPoisha(amount) ?? 0)) return {error:"সক্রিয় বাক্স ও সঠিক অঙ্ক আবশ্যক।"};
    if (boxes.filter(b=>b.id===log.box_id).length!==1 || log.notes?.includes('[VOID:')) return {error:'বাক্স বা রসিদ যাচাই করুন।'};
    const boxCode = targetBox.box_code;
    const locName = log.location_name || targetBox?.location_name || "";
    const fund = await postingFund(finalMadrasaId,log.fund_id,"deposit","","",log.fund_name);
    const targetFund = fund.name;

    // Generate sequential receipt no if not passed or if placeholder
    let receiptNo = (log.receipt_no || "").trim();
    if (!receiptNo || receiptNo.includes("undefined") || (receiptNo.startsWith("BOX-") && receiptNo.length < 9)) {
      receiptNo = await getNextBoxVoucherNo(finalMadrasaId);
    }

    const newLog: DonationBoxCollectionLog = { accounting_record_id:randomUUID(),
      id: `boxlog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      box_id: log.box_id || "",
      box_code: boxCode,
      location_name: locName,
      collection_date: colDate,
      date: colDate,
      amount,
      fund_id: fund.id, fund_name: targetFund,
      collector_name: log.collector_name || "দায়িত্বশীল স্টাফ",
      witness_name: witness,
      witnesses: witness,
      receipt_no: receiptNo,
      notes: log.notes || "",
      created_at: new Date().toISOString(),
    };

    logs.unshift(newLog);

    // Update box stats
    if (targetBox) {
      targetBox.last_collection_date = newLog.collection_date;
      targetBox.last_opened_date = newLog.collection_date;
      targetBox.total_collected_lifetime = (targetBox.total_collected_lifetime || 0) + amount;
      targetBox.total_collected = targetBox.total_collected_lifetime;
    }

    meta.donation_boxes = boxes;
    meta.donation_box_logs = logs;

    await postCollection(finalMadrasaId,before,meta,"donation",{
      tender:{operator:__authz.userId,method:"Cash"},id:newLog.accounting_record_id,amount,date:colDate,receipt_no:receiptNo,fund_id:fund.id,fund_name:fund.name,
      notes:`[দানবাক্স কালেকশন] বক্স: ${boxCode} (${locName}), স্বাক্ষী: ${witness} ${log.notes || ""}`,
    });

    try {
      revalidatePath("/dashboard/fundraising/collections");
      revalidatePath("/dashboard/zakat");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/funds");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/dashboard/accounting");
      revalidatePath("/dashboard/finance");
      revalidatePath("/dashboard/fundraising");
    } catch {}
    return { success: true, id: newLog.id, log: newLog };
  } catch (err: any) {
    return { error: err.message || "কালেকশন এন্ট্রি করতে সমস্যা" };
  }
}

export async function getOnlineDonationSettings(): Promise<OnlineDonationSettings> {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return DEFAULT_ONLINE_DONATION_SETTINGS;

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
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
      revalidatePath("/donate");
    } catch {}

    return { success: true, settings: updated };
  } catch (err: any) {
    return { error: err.message || "সেটিংস সংরক্ষণ ব্যর্থ" };
  }
}

function generateNextOnlineDonationReceiptNo(donations: OnlineDonation[], year: number = getDhakaYear()): string {
  let maxSerial = 0;
  for (const d of donations) {
    if (d.receipt_no) {
      const match = d.receipt_no.match(/DON-(\d{4})-(\d+)/);
      if (match) {
        const itemYear = parseInt(match[1], 10);
        const itemSerial = parseInt(match[2], 10);
        if (itemYear === year && !isNaN(itemSerial) && Number.isSafeInteger(itemSerial)) {
          if (itemSerial > maxSerial) {
            maxSerial = itemSerial;
          }
        }
      }
    }
  }
  const nextSerial = maxSerial + 1;
  return `DON-${year}-${String(nextSerial).padStart(4, "0")}`;
}

// Public tracking returns one redacted receipt, not the institution's donor directory.
export async function trackDonationReceipt(query:string) {
  const key=query?.trim().toLowerCase();
  if (!key || key.length>150) return null;
  const tenant=await getSafeMadrasaId();
  if (!tenant) return null;
  const meta=await getMadrasaMetadata(tenant,true);
  const matches=(meta.online_donations || []).filter((d:OnlineDonation)=>(!d.madrasa_id || d.madrasa_id===tenant) && [d.receipt_no,d.trx_id].some(v=>v?.toLowerCase()===key));
  if (matches.length!==1) return null;
  const d=matches[0];
  if (!d.receipt_no) return null;
  return {receipt_no:String(d.receipt_no),fund_category:String(d.fund_category || REVIEW_FUND.name),
    payment_method:String(d.payment_method || ''),amount:Number(d.amount),status:String(d.status),donor_name:'শুভাকাঙ্ক্ষী'};
}
export async function getOnlineDonations(): Promise<OnlineDonation[]> {
  try {
    const guard=await writeGuard('fundraising');
    const finalMadrasaId=guard.allowed && guard.madrasaId;
    if (!finalMadrasaId) return [];

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const donations: OnlineDonation[] = (meta.online_donations || []).filter((d:OnlineDonation)=>!d.madrasa_id || d.madrasa_id===finalMadrasaId);
    return donations.sort((a: OnlineDonation, b: OnlineDonation) => new Date(b.donation_date || b.created_at).getTime() - new Date(a.donation_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching online donations:", err);
    return [];
  }
}

export async function submitOnlineDonation(donation: Partial<OnlineDonation>) {
  try {
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const donations: OnlineDonation[] = meta.online_donations || [];

    const fund = await postingFund(finalMadrasaId,donation.fund_id,"deposit","","",donation.fund_category);
    if (!(bdtPoisha(donation.amount) ?? 0)) return {error:"অনুদানের অঙ্ক সঠিক নয়।"};
    const currentYear = getDhakaYear();
    const trx=(donation.trx_id||'').trim().toUpperCase();
    if (trx && donations.some(d=>d.trx_id?.trim().toUpperCase()===trx)) return {error:'এই লেনদেনের রেফারেন্স আগে জমা হয়েছে। মূল রসিদ যাচাই করুন।'};
    const receiptNo = generateNextOnlineDonationReceiptNo(donations, currentYear);

    const nowIso = new Date().toISOString();
    const newDonation: OnlineDonation = {
      id: `onl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      madrasa_id: finalMadrasaId,
      donor_name: donation.donor_name || "শুভাকাঙ্ক্ষী",
      phone: donation.phone || "",
      email: donation.email || "",
      country: donation.country || "বাংলাদেশ",
      address: donation.address || "",
      fund_id:fund.id, fund_category:fund.name,
      amount: Number(donation.amount || 0),
      payment_method: donation.payment_method || "bKash",
      trx_id: (donation.trx_id || "").trim().toUpperCase(),
      donation_date: donation.donation_date || toDhakaDateStringFrom(nowIso),
      receipt_no: receiptNo,
      status: "PENDING", is_gateway:false,
      message: donation.message || "", is_anonymous: Boolean(donation.is_anonymous),
      created_at: nowIso,
    };

    const db = await createAdminClient();
    const {error} = await db.rpc("replace_portal_gateway_key",{p_tenant:finalMadrasaId,p_key:"online_donations",p_before:meta.online_donations ?? null,p_after:[newDonation,...donations]});
    if (error) return {error:"অনুদান সংরক্ষণ হয়নি। রিফ্রেশ করে আবার চেষ্টা করুন।"};

    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/portal/donate");
      revalidatePath("/donate");
    } catch {}

    return { success: true, donation: newDonation, receipt_no: receiptNo };
  } catch (err: any) {
    return { error: err.message || "অনুদান সাবমিট করতে সমস্যা হয়েছে" };
  }
}

/**
 * Initiate Real Online Donation Payment Gateway Session
 */
export async function initiateOnlineDonationGateway(params: {
  donor_name: string;
  phone: string;
  email?: string;
  amount: number;
  fund_id: string;
  payment_channel: "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other";
  message?: string;
  is_anonymous?: boolean;
}) {
  try {
    if (typeof params.amount !== "number" || !(bdtPoisha(params.amount) ?? 0))
      return { error: "অনুদানের অঙ্ক সঠিক নয়।" };
    const finalMadrasaId = await getSafeMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId, true);
    const fund = await postingFund(finalMadrasaId,params.fund_id,"deposit");
    const config: PaymentGatewayConfig = meta.payment_gateway_config || DEFAULT_GATEWAY_CONFIG;

    if (!config.is_enabled) {
      return {
        error: "অনলাইন পেমেন্ট গেটওয়ে বর্তমানে সাময়িকভাবে নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে ম্যানুয়াল মাধ্যম ব্যবহার করুন।",
      };
    }

    // 1. Check Gateway Credentials
    const credCheck = validateGatewayCredentials(config.active_provider, config);
    if (!credCheck.isValid) {
      return {
        error: credCheck.error || "অনলাইন পেমেন্ট গেটওয়ে সেটিংসে ভুল বা অসম্পূর্ণ তথ্য রয়েছে।",
      };
    }

    const nowIso = new Date().toISOString();
    const transactionId = `DON-${randomBytes(12).toString("hex")}`;

    // 2. Call Real Payment Gateway Provider
    const appUrl = paymentCallbackOrigin();
    if (!appUrl)
      return { error: "পেমেন্ট callback-এর জন্য এই পরিবেশের NEXT_PUBLIC_APP_URL (HTTPS origin) সেট করুন।" };
    // Save pending donation record
    const donations: OnlineDonation[] = meta.online_donations || [];
    const receiptNo = generateNextOnlineDonationReceiptNo(donations, getDhakaYear());

    const pendingDonation: OnlineDonation = {
      id: `onl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      madrasa_id: finalMadrasaId,
      donor_name: params.donor_name || "শুভাকাঙ্ক্ষী",
      phone: params.phone || "",
      email: params.email || "",
      fund_id:fund.id, fund_category:fund.name,
      amount: Number(params.amount || 0),
      payment_method: `${params.payment_channel} (Gateway)`,
      trx_id: transactionId,
      receipt_no: receiptNo,
      donation_date: toDhakaDateStringFrom(nowIso),
      status: "PENDING",
      is_gateway: true,
      gateway_provider: config.active_provider,
      message: params.message || "",
      is_anonymous: Boolean(params.is_anonymous),
      created_at: nowIso,
    };

    const db = await createAdminClient();
    const { error: saveError } = await db.rpc("replace_portal_gateway_key", {
      p_tenant: finalMadrasaId,
      p_key: "online_donations",
      p_before: meta.online_donations ?? null,
      p_after: [pendingDonation, ...donations],
    });
    if (saveError) return { error: "অনুদানের তথ্য বদলেছে বা সংরক্ষণ হয়নি। চেকআউট খোলা হয়নি।" };

    const sessionRes = await createRealGatewaySession(
      {
        tran_id: transactionId,
        amount: params.amount,
        cus_name: params.donor_name || "শুভাকাঙ্ক্ষী",
        cus_phone: params.phone || "01700000000",
        cus_email: params.email || "donor@qawmimanager.app",
        product_name: `Donation: ${fund.name}`,
        product_category: "Donation",
        success_url: `${appUrl}/api/payments/sslcommerz/success?type=donation&tenant=${finalMadrasaId}`,
        fail_url: `${appUrl}/api/payments/sslcommerz/fail?type=donation`,
        cancel_url: `${appUrl}/api/payments/sslcommerz/cancel?type=donation`,
        ipn_url: `${appUrl}/api/payments/sslcommerz/ipn?type=donation&tenant=${finalMadrasaId}`,
        payment_channel: params.payment_channel,
      },
      config,
    );

    if (!sessionRes.success || !sessionRes.gateway_url) {
      return {
        error:
          sessionRes.error ||
          "পেমেন্ট গেটওয়ে সার্ভার থেকে কোনো পেমেন্ট লিংক তৈরি করা যায়নি। গেটওয়ে সেটিংস যাচাই করুন।",
      };
    }

    return {
      success: true,
      transaction_id: transactionId,
      redirect_url: sessionRes.gateway_url,
      gateway_url: sessionRes.gateway_url,
      provider: config.active_provider,
      receipt_no: receiptNo,
      message: "পেমেন্ট গেটওয়ে সেশন তৈরি হয়েছে।",
    };
  } catch (err: any) {
    console.error("Error in initiateOnlineDonationGateway:", err);
    return { error: err.message || "পেমেন্ট সেশন তৈরি করতে সমস্যা হয়েছে।" };
  }
}


export async function updateOnlineDonationStatus(
  id: string,
  status: "VERIFIED" | "PENDING" | "REJECTED",
  _verifierName?: string
) {
  const guard=await writeGuard('fundraising');
  if(!guard.allowed) return guard.fallback;
  try {
    const finalMadrasaId=guard.madrasaId;
    if(!finalMadrasaId || !guard.userId) return {error:'প্রতিষ্ঠান বা যাচাইকারীর পরিচয় মেলেনি।'};
    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const donations: OnlineDonation[] = meta.online_donations || [];
    const target = donations.find((d: OnlineDonation) => d.id === id);
    if (!target || donations.filter(d=>d.id===id).length!==1 || (target.madrasa_id && target.madrasa_id!==finalMadrasaId)) return { error: "অনুদান রেকর্ড পাওয়া যায়নি" };

    if (!['PENDING','REJECTED','VERIFIED'].includes(target.status)) return {error:"পোস্ট করা রসিদ খতিয়ান থেকে পরিচালনা করুন।"};
    if (target.status === "VERIFIED") return {error:"ইতিমধ্যে পোস্ট করা রসিদ। মূল খতিয়ান দেখুন।"};
    if (target.is_gateway || target.gateway_provider || !["PENDING","VERIFIED","REJECTED"].includes(status)) return {error:"গেটওয়ে পেমেন্ট কেবল যাচাইকৃত callback থেকে পোস্ট হয়।"};
    const before = collectionSnapshot(meta,"online_donations");
    target.status = status;
    target.verified_by = guard.actorName || guard.actorEmail || guard.userId;
    target.verified_at = new Date().toISOString();

    meta.online_donations = donations;
    if (status === "VERIFIED") {
        const fund = await postingFund(finalMadrasaId,target.fund_id,"deposit","","",target.fund_category);
        // A public name or shared phone is not a directory identity. Keep the donor
        // on the source receipt; link a directory UUID only when explicitly identified.
        target.accounting_record_id=randomUUID();
        await postCollection(finalMadrasaId,before,meta,"donation",{tender:{operator:guard.userId,method:"Online"},id:target.accounting_record_id,donor_id:null,amount:target.amount,date:target.donation_date,
          receipt_no:target.receipt_no || "",fund_id:fund.id,fund_name:fund.name,notes:`[অনলাইন অনুদান ভেরিফাইড | TrxID: ${target.trx_id}] ${target.message || ""}`});
    } else {
      const db = await createAdminClient();
      const {error} = await db.rpc("replace_portal_gateway_key",{p_tenant:finalMadrasaId,p_key:"online_donations",p_before:before.online_donations,p_after:donations});
      if (error) return {error:"স্ট্যাটাস সংরক্ষণ হয়নি। রিফ্রেশ করে আবার চেষ্টা করুন।"};
    }

    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/dashboard/zakat/collection");
      revalidatePath("/dashboard/zakat/reports");
      revalidatePath("/portal/donate");
      revalidatePath("/donate");
    } catch {}

    return { success: true, donation: target };
  } catch (err: any) {
    return { error: err.message || "স্ট্যাটাস আপডেট ব্যর্থ" };
  }
}

export async function deleteOnlineDonation(id: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const finalMadrasaId = await getAuthMadrasaId();
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId,true);
    const original = meta.online_donations || [];
    const target = original.find((r:OnlineDonation)=>r.id===id);
    if (!target || target.is_gateway || target.gateway_provider || !['REJECTED','PENDING'].includes(target.status)) return {error:"পোস্ট করা বা গেটওয়ে রসিদ মোছা যাবে না।"};
    const before = collectionSnapshot(meta,"online_donations");
    meta.online_donations=original.filter((d:OnlineDonation)=>d.id!==id);
    await replaceSources(finalMadrasaId,before,meta);
    try {
      revalidatePath("/dashboard/fundraising/online-donations");
      revalidatePath("/portal/donate");
      revalidatePath("/donate");
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("fundraising");
    if (!__authz.allowed) return __authz.fallback;
  }

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

    const { getSMSGatewayConfig } = await import("./communication");
    const { dispatchSMSGatewayRequest } = await import("@/lib/sms-gateway");
    const gatewayConfig = await getSMSGatewayConfig();

    if (gatewayConfig.isEnabled && gatewayConfig.apiKey) {
      const dispatchRes = await dispatchSMSGatewayRequest(gatewayConfig, params.phone, msg);
      
      const isSuccess = dispatchRes.success;
      try {
        await adminClient.from("sms_logs").insert({
          madrasa_id: finalMadrasaId,
          recipient_name: params.donor_name,
          recipient_phone: params.phone,
          message: msg,
          message_type: "Donation Receipt",
          status: isSuccess ? "Sent" : "Failed",
          created_at: new Date().toISOString(),
        });
      } catch {}

      if (isSuccess) {
        return {
          success: true,
          message: `এসএমএস গেটওয়ের (${gatewayConfig.provider.toUpperCase()}) মাধ্যমে দাতার মোবাইলে (${params.phone}) সফলভাবে পাঠানো হয়েছে।`,
        };
      } else {
        const errorDetail = dispatchRes.error || dispatchRes.rawResponse || "গেটওয়ে এপিআই ত্রুটি";
        return {
          error: `এসএমএস পাঠানো ব্যর্থ হয়েছে (${gatewayConfig.provider.toUpperCase()}): ${errorDetail}। অনুগ্রহ করে এসএমএস ব্যালেন্স ও সেটিংস চেক করুন।`,
        };
      }
    } else {
      // Gateway is not configured or disabled
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

      return {
        success: true,
        message: "এসএমএস রেকর্ড সংরক্ষণ করা হয়েছে। সরাসরি লাইভ মোবাইলে এসএমএস পাঠাতে যোগাযোগ ➔ এসএমএস গেটওয়ে সেটিংস থেকে আপনার API Key ও Sender ID সেট করুন।",
      };
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
