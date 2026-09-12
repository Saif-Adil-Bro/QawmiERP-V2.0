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
  OnlineDonation
} from "@/lib/fundraising-types";

// ============================================================================
// 1. MAHFIL (বার্ষিক মহাসম্মেলন ও মাহফিল)
// ============================================================================

export async function getMahfils(): Promise<Mahfil[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return [];

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    return mahfils.sort((a: Mahfil, b: Mahfil) => new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching mahfils:", err);
    return [];
  }
}

export async function getMahfilById(id: string): Promise<Mahfil | null> {
  try {
    const mahfils = await getMahfils();
    return mahfils.find((m: Mahfil) => m.id === id) || null;
  } catch (err) {
    console.error("Error fetching mahfil by id:", err);
    return null;
  }
}

export async function saveMahfil(data: Partial<Mahfil>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
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

    revalidatePath("/dashboard/fundraising/mahfil");
    revalidatePath(`/dashboard/fundraising/mahfil/${targetId}`);
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
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.mahfils = (meta.mahfils || []).filter((m: Mahfil) => m.id !== id);

    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "মুছতে সমস্যা হয়েছে" };

    revalidatePath("/dashboard/fundraising/mahfil");
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
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

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
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilSpeaker(mahfilId: string, speakerId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.speakers = (targetMahfil.speakers || []).filter((s: MahfilSpeaker) => s.id !== speakerId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "বক্তা মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilReceiptBook(mahfilId: string, book: Partial<MahfilReceiptBook>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    const books = targetMahfil.receipt_books || [];
    const pageFrom = Number(book.page_from || 1);
    const pageTo = Number(book.page_to || 50);
    const totalPages = pageTo - pageFrom + 1;

    if (book.id) {
      const idx = books.findIndex((b: MahfilReceiptBook) => b.id === book.id);
      if (idx !== -1) {
        books[idx] = {
          ...books[idx],
          ...book,
          page_from: pageFrom,
          page_to: pageTo,
          total_pages: totalPages,
          total_collected: Number(book.total_collected || 0),
        };
      }
    } else {
      const newBook: MahfilReceiptBook = {
        id: `bk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        book_no: book.book_no || `বই #${books.length + 1}`,
        page_from: pageFrom,
        page_to: pageTo,
        total_pages: totalPages,
        category: book.category || "সাধারণ অনুদান",
        issued_to_name: book.issued_to_name || "",
        issued_to_type: book.issued_to_type || "উস্তাদ",
        issued_to_phone: book.issued_to_phone || "",
        issued_date: book.issued_date || new Date().toISOString().split("T")[0],
        total_collected: Number(book.total_collected || 0),
        status: book.status || "ISSUED",
        notes: book.notes || "",
      };
      books.push(newBook);
    }

    targetMahfil.receipt_books = books;
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "রসিদ বই সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilReceiptBook(mahfilId: string, bookId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.receipt_books = (targetMahfil.receipt_books || []).filter((b: MahfilReceiptBook) => b.id !== bookId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "রসিদ বই মুছতে ব্যর্থ হয়েছে" };
  }
}

export async function saveMahfilTransaction(mahfilId: string, txn: Partial<MahfilTransaction>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

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
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "ভাউচার সংরক্ষণে সমস্যা" };
  }
}

export async function deleteMahfilTransaction(mahfilId: string, txnId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils: Mahfil[] = meta.mahfils || [];
    const targetMahfil = mahfils.find((m: Mahfil) => m.id === mahfilId);
    if (!targetMahfil) return { error: "মাহফিল পাওয়া যায়নি" };

    targetMahfil.transactions = (targetMahfil.transactions || []).filter((t: MahfilTransaction) => t.id !== txnId);
    targetMahfil.updated_at = new Date().toISOString();

    meta.mahfils = mahfils;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath(`/dashboard/fundraising/mahfil/${mahfilId}`);
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
    const donors: LifeMemberDonor[] = meta.life_member_donors || [];
    const payments: DonorSubscriptionPayment[] = meta.donor_subscription_payments || [];

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

    const newPayment: DonorSubscriptionPayment = {
      id: `dpay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      donor_id: payment.donor_id || "",
      donor_name: payment.donor_name || "",
      month: payment.month || new Date().toISOString().slice(0, 7),
      amount: Number(payment.amount || 0),
      payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment.payment_method || "Cash",
      receipt_no: payment.receipt_no || `REC-${Date.now().toString().slice(-5)}`,
      fund_name: payment.fund_name || "সাধারণ ফান্ড",
      notes: payment.notes || "",
      collected_by: payment.collected_by || user.email || "অফিস",
      created_at: new Date().toISOString(),
    };

    payments.unshift(newPayment);
    meta.donor_subscription_payments = payments;

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

export async function getQurbaniLeatherRecords(): Promise<QurbaniLeatherRecord[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return [];

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const records: QurbaniLeatherRecord[] = meta.qurbani_leather_records || [];
    return records.sort((a: QurbaniLeatherRecord, b: QurbaniLeatherRecord) => new Date(b.collection_date || b.created_at).getTime() - new Date(a.collection_date || a.created_at).getTime());
  } catch (err) {
    console.error("Error fetching leather records:", err);
    return [];
  }
}

export async function saveQurbaniLeatherRecord(data: Partial<QurbaniLeatherRecord>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const records: QurbaniLeatherRecord[] = meta.qurbani_leather_records || [];
    const now = new Date().toISOString();

    const quantity = Number(data.quantity || 0);
    const rate = Number(data.rate_per_unit || 0);
    const totalSale = quantity * rate;
    const received = Number(data.received_amount || totalSale);
    const due = Math.max(0, totalSale - received);
    const transportCost = Number(data.transport_labour_cost || 0);
    const netProfit = received - transportCost;

    let targetId = data.id;
    if (targetId) {
      const idx = records.findIndex((r: QurbaniLeatherRecord) => r.id === targetId);
      if (idx !== -1) {
        records[idx] = {
          ...records[idx],
          ...data,
          quantity,
          rate_per_unit: rate,
          total_sale_price: totalSale,
          received_amount: received,
          due_amount: due,
          transport_labour_cost: transportCost,
          net_profit: netProfit,
        } as QurbaniLeatherRecord;
      }
    } else {
      targetId = `lth_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newRec: QurbaniLeatherRecord = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        year: data.year || "২০২৬",
        hijri_year: data.hijri_year || "১৪৪৭ হি.",
        leather_type: data.leather_type || "COW",
        quantity,
        area_team: data.area_team || "প্রধান কালেকশন টিম",
        buyer_name: data.buyer_name || "",
        buyer_phone: data.buyer_phone || "",
        rate_per_unit: rate,
        total_sale_price: totalSale,
        received_amount: received,
        due_amount: due,
        transport_labour_cost: transportCost,
        net_profit: netProfit,
        collection_date: data.collection_date || new Date().toISOString().split("T")[0],
        payment_status: due === 0 ? "PAID" : received > 0 ? "PARTIAL" : "DUE",
        notes: data.notes || "",
        created_at: now,
      };
      records.unshift(newRec);
    }

    meta.qurbani_leather_records = records;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/collections");
    return { success: true, id: targetId };
  } catch (err: any) {
    return { error: err.message || "চামড়া রেকর্ড সংরক্ষণে সমস্যা" };
  }
}

export async function deleteQurbaniLeatherRecord(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.qurbani_leather_records = (meta.qurbani_leather_records || []).filter((r: QurbaniLeatherRecord) => r.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    revalidatePath("/dashboard/fundraising/collections");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function getDonationBoxes(): Promise<{ boxes: DonationBox[]; logs: DonationBoxCollectionLog[] }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { boxes: [], logs: [] };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    return {
      boxes: boxes.sort((a: DonationBox, b: DonationBox) => (a.box_code || "").localeCompare(b.box_code || "")),
      logs: logs.sort((a: DonationBoxCollectionLog, b: DonationBoxCollectionLog) => new Date(b.collection_date || b.created_at || "").getTime() - new Date(a.collection_date || a.created_at || "").getTime())
    };
  } catch (err) {
    console.error("Error fetching donation boxes:", err);
    return { boxes: [], logs: [] };
  }
}

export async function saveDonationBox(data: Partial<DonationBox>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const now = new Date().toISOString();

    let targetId = data.id;
    if (targetId) {
      const idx = boxes.findIndex((b: DonationBox) => b.id === targetId);
      if (idx !== -1) {
        boxes[idx] = {
          ...boxes[idx],
          ...data,
        };
      }
    } else {
      targetId = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newBox: DonationBox = {
        id: targetId,
        madrasa_id: finalMadrasaId,
        box_code: data.box_code || `BOX-${String(boxes.length + 101)}`,
        location_name: data.location_name || "",
        area: data.area || "",
        contact_person: data.contact_person || "",
        phone: data.phone || "",
        install_date: data.install_date || new Date().toISOString().split("T")[0],
        status: data.status || "ACTIVE",
        total_collected_lifetime: Number(data.total_collected_lifetime || 0),
        notes: data.notes || "",
        created_at: now,
      };
      boxes.unshift(newBox);
    }

    meta.donation_boxes = boxes;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/collections");
    return { success: true, id: targetId };
  } catch (err: any) {
    return { error: err.message || "দানবাক্স সংরক্ষণে সমস্যা" };
  }
}

export async function deleteDonationBox(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.donation_boxes = (meta.donation_boxes || []).filter((b: DonationBox) => b.id !== id);

    await saveMadrasaMetadata(finalMadrasaId, meta);
    revalidatePath("/dashboard/fundraising/collections");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছতে সমস্যা" };
  }
}

export async function recordDonationBoxCollection(log: Partial<DonationBoxCollectionLog>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const boxes: DonationBox[] = meta.donation_boxes || [];
    const logs: DonationBoxCollectionLog[] = meta.donation_box_logs || [];

    const amount = Number(log.amount || 0);
    const newLog: DonationBoxCollectionLog = {
      id: `boxlog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      box_id: log.box_id || "",
      box_code: log.box_code || "",
      location_name: log.location_name || "",
      collection_date: log.collection_date || new Date().toISOString().split("T")[0],
      amount,
      collector_name: log.collector_name || user.email || "দায়িত্বশীল স্টাফ",
      witness_name: log.witness_name || "",
      receipt_no: log.receipt_no || `BOX-REC-${Date.now().toString().slice(-4)}`,
      notes: log.notes || "",
      created_at: new Date().toISOString(),
    };

    logs.unshift(newLog);

    // Update box stats
    const targetBox = boxes.find((b: DonationBox) => b.id === log.box_id);
    if (targetBox) {
      targetBox.last_collection_date = newLog.collection_date;
      targetBox.total_collected_lifetime = (targetBox.total_collected_lifetime || 0) + amount;
    }

    meta.donation_boxes = boxes;
    meta.donation_box_logs = logs;

    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/collections");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "কালেকশন এন্ট্রি করতে সমস্যা" };
  }
}


// ============================================================================
// 4. ONLINE DONATIONS
// ============================================================================

export async function getOnlineDonations(): Promise<OnlineDonation[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
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
    const adminClient = await createAdminClient();
    let madrasaId = donation.madrasa_id;
    if (!madrasaId) {
      const { data: firstMadrasa } = await adminClient.from("madrasas").select("id").limit(1).single();
      madrasaId = firstMadrasa?.id;
    }
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(madrasaId);
    const donations: OnlineDonation[] = meta.online_donations || [];

    const receiptNo = `DON-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const newDonation: OnlineDonation = {
      id: `onl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      madrasa_id: madrasaId,
      donor_name: donation.donor_name || "শুভাকাঙ্ক্ষী",
      phone: donation.phone || "",
      email: donation.email || "",
      country: donation.country || "বাংলাদেশ",
      address: donation.address || "",
      fund_category: donation.fund_category || "সাধারণ ফান্ড",
      amount: Number(donation.amount || 0),
      payment_method: donation.payment_method || "bKash",
      trx_id: (donation.trx_id || "").trim().toUpperCase(),
      donation_date: donation.donation_date || new Date().toISOString().split("T")[0],
      receipt_no: receiptNo,
      status: "VERIFIED",
      message: donation.message || "",
      is_anonymous: Boolean(donation.is_anonymous),
      created_at: new Date().toISOString(),
    };

    donations.unshift(newDonation);
    meta.online_donations = donations;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/fundraising/online-donations");
    revalidatePath("/portal/donate");
    return { success: true, donation: newDonation, receipt_no: receiptNo };
  } catch (err: any) {
    return { error: err.message || "অনুদান সাবমিট করতে সমস্যা হয়েছে" };
  }
}

export async function updateOnlineDonationStatus(id: string, status: "VERIFIED" | "PENDING" | "REJECTED") {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const donations: OnlineDonation[] = meta.online_donations || [];
    const target = donations.find((d: OnlineDonation) => d.id === id);
    if (target) {
      target.status = status;
      target.verified_by = user.email || "অ্যাডমিন";
      target.verified_at = new Date().toISOString();
    }

    meta.online_donations = donations;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/fundraising/online-donations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "স্ট্যাটাস আপডেট ব্যর্থ" };
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
