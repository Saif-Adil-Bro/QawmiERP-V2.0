"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { DEFAULT_FUNDS, FundItem, DonorItem, DonationItem, FundTransactionRecord, parseExpenseFund, normalizeFundName, isTransactionInFund } from "@/lib/fund-utils";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

// In-memory fallback cache for custom funds if database table is not yet created
const customFundsStore: Map<string, FundItem[]> = new Map();

// Generate sequential receipt number (ZR-YYYY-XXXX)
export async function getNextDonationReceiptNo(madrasaId: string, prefix = "ZR"): Promise<string> {
  try {
    const adminClient = await createAdminClient();
    const currentYear = new Date().getFullYear();
    const { data: donations } = await adminClient
      .from("donations")
      .select("receipt_no")
      .eq("madrasa_id", madrasaId);

    let maxSeq = 0;
    const yearPrefixPattern = new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`, "i");
    const simplePrefixPattern = new RegExp(`^${prefix}(\\d+)$`, "i");

    (donations || []).forEach((d: any) => {
      const rec = (d.receipt_no || "").trim();
      const matchYear = rec.match(yearPrefixPattern);
      if (matchYear && matchYear[1] === String(currentYear)) {
        const seq = parseInt(matchYear[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      } else {
        const matchSimple = rec.match(simplePrefixPattern);
        if (matchSimple) {
          const seq = parseInt(matchSimple[1], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
  } catch {
    const currentYear = new Date().getFullYear();
    return `${prefix}-${currentYear}-0001`;
  }
}

// Generate sequential Mahfil voucher number
export async function getNextMahfilVoucherNo(madrasaId: string, type: "SURPLUS" | "DEFICIT"): Promise<string> {
  try {
    const adminClient = await createAdminClient();
    const currentYear = new Date().getFullYear();
    const prefix = "MHF";
    
    let maxSeq = 0;
    
    // Check donations for existing vouchers
    const { data: donations } = await adminClient
      .from("donations")
      .select("receipt_no")
      .eq("madrasa_id", madrasaId);

    const mhfPattern = /MHF(?:-(?:SURP|DEF|SURPLUS|DEFICIT))?-?(\d{4})?-?(\d+)/i;
    
    (donations || []).forEach((d: any) => {
      const rec = (d.receipt_no || "").trim();
      const match = rec.match(mhfPattern);
      if (match) {
        const yearOrSeq = match[1];
        const numPart = match[2];
        if (yearOrSeq && yearOrSeq === String(currentYear) && numPart) {
          const seq = parseInt(numPart, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        } else if (numPart) {
          const seq = parseInt(numPart, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const { data: expenses } = await adminClient
      .from("expenses")
      .select("voucher_no")
      .eq("madrasa_id", madrasaId);

    (expenses || []).forEach((e: any) => {
      const rec = (e.voucher_no || "").trim();
      const match = rec.match(mhfPattern);
      if (match) {
        const yearOrSeq = match[1];
        const numPart = match[2];
        if (yearOrSeq && yearOrSeq === String(currentYear) && numPart) {
          const seq = parseInt(numPart, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        } else if (numPart) {
          const seq = parseInt(numPart, 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `MHF-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
  } catch {
    const currentYear = new Date().getFullYear();
    return `MHF-${currentYear}-0001`;
  }
}

// Active Madrasa Header Info for Money Receipts and Invoices
export async function getActiveMadrasaHeaderInfo() {
  try {
    const info = await getMadrasaInfo();
    return {
      name: info.name || "মাদরাসা",
      address: info.address || "",
      phone: info.phone || "",
      email: info.email || "",
      logo_url: info.logo_url || "",
      registration_no: info.registration_no || info.reg_no || "",
      signature_url: info.signature_url || "",
      principal_name: info.principal_name || "",
      slogan: info.slogan || "",
      established_year: info.established_year || "",
    };
  } catch {
    return {
      name: "মাদরাসা",
      address: "",
      phone: "",
      email: "",
      logo_url: "",
      registration_no: "",
      signature_url: "",
      principal_name: "",
      slogan: "",
      established_year: "",
    };
  }
}

// Helper to get all funds (Defaults + Relational Table zakat_funds + Custom funds) with real-time financial balances
export async function getFunds(): Promise<FundItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    let baseFunds: FundItem[] = [];

    // 1. Try relational table zakat_funds
    try {
      const { data: dbFunds, error: dbErr } = await adminClient
        .from("zakat_funds")
        .select("*")
        .eq("madrasa_id", finalMadrasaId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!dbErr && dbFunds && dbFunds.length > 0) {
        const existingCodes = new Set(dbFunds.map((f: any) => f.code || f.id));
        const existingNames = new Set(dbFunds.map((f: any) => f.name?.toLowerCase()));
        const formatted: FundItem[] = dbFunds.map((f: any) => ({
          id: f.id,
          madrasa_id: f.madrasa_id,
          name: f.name,
          code: f.code,
          category: f.category as any,
          description: f.description || "",
          target_amount: Number(f.target_amount || 0),
          current_balance: Number(f.current_balance || 0),
          color: "emerald",
          is_default: false,
          is_active: f.is_active !== false,
          created_at: f.created_at,
        }));
        baseFunds = [
          ...DEFAULT_FUNDS.filter((df) => !existingCodes.has(df.code) && !existingCodes.has(df.id) && !existingNames.has(df.name.toLowerCase())),
          ...formatted,
        ];
      }
    } catch {}

    // 2. Check madrasa metadata for custom funds (Fallback)
    if (baseFunds.length === 0) {
      try {
        const { data: madrasaData } = await adminClient
          .from("madrasas")
          .select("registration_no")
          .eq("id", finalMadrasaId)
          .single();

        if (madrasaData?.registration_no && madrasaData.registration_no.startsWith("{")) {
          const meta = JSON.parse(madrasaData.registration_no);
          if (meta.custom_funds && Array.isArray(meta.custom_funds)) {
            const customList: FundItem[] = meta.custom_funds;
            const existingIds = new Set(customList.map((f) => f.id));
            const existingCodes = new Set(customList.map((f) => f.code));
            const existingNames = new Set(customList.map((f) => f.name?.toLowerCase()));
            baseFunds = [
              ...DEFAULT_FUNDS.filter((f) => !existingIds.has(f.id) && !existingCodes.has(f.code) && !existingNames.has(f.name.toLowerCase())),
              ...customList,
            ];
          }
        }
      } catch {}
    }

    // 3. Fallback to in-memory custom funds merged with defaults
    if (baseFunds.length === 0) {
      const madrasaCustom = customFundsStore.get(finalMadrasaId) || [];
      const customIds = new Set(madrasaCustom.map(f => f.id));
      const customCodes = new Set(madrasaCustom.map(f => f.code));
      const customNames = new Set(madrasaCustom.map(f => f.name?.toLowerCase()));
      baseFunds = [
        ...DEFAULT_FUNDS.filter(f => !customIds.has(f.id) && !customCodes.has(f.code) && !customNames.has(f.name.toLowerCase())),
        ...madrasaCustom,
      ];
    }

    // Fetch dynamic live collections & expenses to calculate real-time balances for all funds
    const [donationsRes, expensesRes, meta] = await Promise.all([
      adminClient.from("donations").select("id, amount, donation_type, donor_id, receipt_no, notes").eq("madrasa_id", finalMadrasaId),
      adminClient.from("expenses").select("id, amount, description, category, voucher_no").eq("madrasa_id", finalMadrasaId),
      getMadrasaMetadata(finalMadrasaId),
    ]);

    const mahfils = meta.mahfils || [];
    const validMahfilVouchers = new Set<string>();
    const validMahfilRecordIds = new Set<string>();

    mahfils.forEach((m: any) => {
      const allSt = m.settlements || (m.settlement ? [m.settlement] : []);
      allSt.forEach((s: any) => {
        if (s.accounting_voucher_no) validMahfilVouchers.add(s.accounting_voucher_no);
        if (s.accounting_record_id) validMahfilRecordIds.add(s.accounting_record_id);
        if (s.mahfil_txn_id) validMahfilRecordIds.add(s.mahfil_txn_id);
      });
    });

    const allDonations = donationsRes.data || [];
    const allExpenses = expensesRes.data || [];
    const subscriptionPayments = meta.donor_subscription_payments || [];

    const fundStats = new Map<string, { collected: number; expense: number; count: number; donors: Set<string> }>();
    baseFunds.forEach((f) => {
      fundStats.set(f.name, { collected: 0, expense: 0, count: 0, donors: new Set<string>() });
    });

    const existingReceiptNos = new Set(allDonations.map((d: any) => d.receipt_no).filter(Boolean));
    const existingIds = new Set(allDonations.map((d: any) => d.id).filter(Boolean));

    for (const d of allDonations) {
      const isMahfil = d.receipt_no?.startsWith("MHF-") || (d.notes && d.notes.includes("মাহফিল"));
      if (isMahfil) {
        const isValid = (d.receipt_no && validMahfilVouchers.has(d.receipt_no)) || validMahfilRecordIds.has(d.id);
        if (!isValid) {
          try {
            await adminClient.from("donations").delete().eq("id", d.id);
          } catch {}
          continue;
        }
      }

      const amt = Number(d.amount || 0);
      const matched = baseFunds.find((f) => isTransactionInFund(f, undefined, d.donation_type, baseFunds));
      if (matched) {
        const stat = fundStats.get(matched.name);
        if (stat) {
          stat.collected += amt;
          stat.count += 1;
          const donorIdentifier = d.donor_id || d.receipt_no || d.id;
          if (donorIdentifier) stat.donors.add(donorIdentifier);
        }
      }
    }

    // Merge meta subscription payments into funds collection calculation
    for (const sp of subscriptionPayments) {
      if ((sp.receipt_no && existingReceiptNos.has(sp.receipt_no)) || existingIds.has(sp.id)) continue;
      const amt = Number(sp.amount || 0);
      const targetFundName = sp.fund_name || "সাধারণ ফান্ড";
      const matched = baseFunds.find((f) => isTransactionInFund(f, undefined, targetFundName, baseFunds));
      if (matched) {
        const stat = fundStats.get(matched.name);
        if (stat) {
          stat.collected += amt;
          stat.count += 1;
          const donorIdentifier = sp.donor_id || sp.receipt_no || sp.id;
          if (donorIdentifier) stat.donors.add(donorIdentifier);
        }
      }
    }

    // Merge online donations into funds collection calculation
    const onlineDonations = meta.online_donations || [];
    for (const od of onlineDonations) {
      if ((od.receipt_no && existingReceiptNos.has(od.receipt_no)) || existingIds.has(od.id) || (od.trx_id && existingReceiptNos.has(od.trx_id))) continue;
      if (od.status === "VERIFIED" || od.status === "COMPLETED" || od.status === "SUCCESS") {
        const amt = Number(od.amount || 0);
        if (amt <= 0) continue;
        const targetFundName = od.fund_category || od.fund_name || od.purpose || "সাধারণ ফান্ড";
        const matched = baseFunds.find((f) => isTransactionInFund(f, undefined, targetFundName, baseFunds));
        if (matched) {
          const stat = fundStats.get(matched.name);
          if (stat) {
            stat.collected += amt;
            stat.count += 1;
            const donorIdentifier = od.phone || od.receipt_no || od.trx_id || od.id;
            if (donorIdentifier) stat.donors.add(donorIdentifier);
          }
        }
      }
    }

    // Merge donation box collections
    const boxLogs = meta.donation_box_logs || [];
    for (const b of boxLogs) {
      const recNo = b.receipt_no || b.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      const amt = Number(b.amount || 0);
      if (amt <= 0) continue;
      const targetFundName = b.fund_name || "সাধারণ ফান্ড";
      const matched = baseFunds.find((f) => isTransactionInFund(f, undefined, targetFundName, baseFunds));
      if (matched) {
        const stat = fundStats.get(matched.name);
        if (stat) {
          stat.collected += amt;
          stat.count += 1;
          stat.donors.add(b.id || "box");
        }
      }
    }

    // Merge Qurbani leather sale collections
    const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
    for (const lr of leatherRecords) {
      const recNo = lr.receipt_no || lr.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      const inc = Number(lr.received_amount || lr.total_sale_price || lr.total_sale_amount || 0);
      const exp = Number(lr.transport_labour_cost || lr.transport_labor_cost || 0);
      const lillahFund = baseFunds.find((f) => isTransactionInFund(f, undefined, "লিল্লাহ বোর্ডিং ফান্ড", baseFunds));
      if (lillahFund) {
        const stat = fundStats.get(lillahFund.name);
        if (stat) {
          if (inc > 0) {
            stat.collected += inc;
            stat.count += 1;
            stat.donors.add(lr.id || "leather");
          }
          if (exp > 0) {
            stat.expense += exp;
          }
        }
      }
    }

    // Merge student fee payments into funds collection calculation (Dynamic Fund Routing)
    const feePayments = (meta.payments || []).filter(
      (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
    );
    for (const p of feePayments) {
      if ((p.receipt_no && existingReceiptNos.has(p.receipt_no)) || existingIds.has(p.id)) continue;
      if (p.allocations && p.allocations.length > 0) {
        for (const alloc of p.allocations) {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) continue;
          const name = alloc.fee_type_name || "মাসিক বেতন";
          const isLillah =
            name.includes("বোর্ডিং") ||
            name.includes("খাবার") ||
            name.includes("খোরাকি") ||
            name.includes("hostel") ||
            name.includes("lillah");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const targetFundId = alloc.fund_id || p.fund_id;
          const targetFundName = alloc.fund_name || p.fund_name || fallbackFundName;

          const matched = baseFunds.find((f) =>
            isTransactionInFund(f, targetFundId, targetFundName, baseFunds)
          );
          if (matched) {
            const stat = fundStats.get(matched.name);
            if (stat) {
              stat.collected += amt;
              stat.count += 1;
              const identifier = p.student_id || p.receipt_no || p.id;
              if (identifier) stat.donors.add(identifier);
            }
          }
        }
      } else {
        const amt = Number(p.total_amount_received || 0);
        if (amt > 0) {
          const isLillah =
            (p.notes || "").includes("বোর্ডিং") ||
            (p.notes || "").includes("খাবার") ||
            (p.notes || "").includes("খোরাকি");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const targetFundId = p.fund_id;
          const targetFundName = p.fund_name || fallbackFundName;

          const matched = baseFunds.find((f) =>
            isTransactionInFund(f, targetFundId, targetFundName, baseFunds)
          );
          if (matched) {
            const stat = fundStats.get(matched.name);
            if (stat) {
              stat.collected += amt;
              stat.count += 1;
              const identifier = p.student_id || p.receipt_no || p.id;
              if (identifier) stat.donors.add(identifier);
            }
          }
        }
      }
    }

    for (const e of allExpenses) {
      const isMahfilDeficit = e.voucher_no?.startsWith("EXP-MHF") || (e.description && e.description.includes("মাহফিল"));
      if (isMahfilDeficit) {
        const isValid = (e.voucher_no && validMahfilVouchers.has(e.voucher_no)) || validMahfilRecordIds.has(e.id);
        if (!isValid) {
          try {
            await adminClient.from("expenses").delete().eq("id", e.id);
          } catch {}
          continue;
        }
      }

      const amt = Number(e.amount || 0);
      const parsed = parseExpenseFund(e.description);
      const targetFundName = parsed.fundName || parsed.fundId || e.category;
      const matched = baseFunds.find((f) => isTransactionInFund(f, parsed.fundId, targetFundName, baseFunds));
      if (matched) {
        const stat = fundStats.get(matched.name);
        if (stat) {
          stat.expense += amt;
        }
      }
    }

    return baseFunds.map((f) => {
      const st = fundStats.get(f.name) || { collected: 0, expense: 0, count: 0, donors: new Set<string>() };
      return {
        ...f,
        total_collected: st.collected,
        total_expense: st.expense,
        current_balance: Math.max(0, st.collected - st.expense),
        donations_count: st.count,
        unique_donors_count: st.donors.size,
      };
    });
  } catch (err) {
    console.error("Error in getFunds:", err);
    return DEFAULT_FUNDS;
  }
}

// Create a new custom Fund manually
export async function createFund(formData: FormData) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase() || "FND";
    const category = (formData.get("category") as string) || "General";
    const description = (formData.get("description") as string)?.trim() || "";
    const target_amount = parseFloat(formData.get("target_amount") as string) || 0;
    const color = (formData.get("color") as string) || "emerald";

    if (!name) {
      throw new Error("ফান্ডের নাম আবশ্যক");
    }

    const newFund: FundItem = {
      id: `fund-${Date.now()}`,
      madrasa_id: finalMadrasaId,
      name,
      code,
      category: category as any,
      description,
      target_amount,
      color,
      is_default: false,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Save to relational table zakat_funds
    try {
      await adminClient.from("zakat_funds").upsert({
        id: newFund.id,
        madrasa_id: finalMadrasaId,
        name: newFund.name,
        code: newFund.code,
        category: newFund.category,
        description: newFund.description,
        target_amount: newFund.target_amount,
        current_balance: 0,
        is_active: true,
      });
    } catch {}

    // Save to metadata in madrasas table (dual write for zero-downtime compatibility)
    try {
      const { data: madrasaData } = await adminClient
        .from("madrasas")
        .select("registration_no")
        .eq("id", finalMadrasaId)
        .single();

      let meta: any = {};
      if (madrasaData?.registration_no && madrasaData.registration_no.startsWith("{")) {
        try {
          meta = JSON.parse(madrasaData.registration_no);
        } catch {}
      }

      const existingFunds: FundItem[] = meta.custom_funds || [];
      const updatedFunds = [...existingFunds.filter((f) => f.id !== newFund.id), newFund];
      meta.custom_funds = updatedFunds;

      await adminClient
        .from("madrasas")
        .update({ registration_no: JSON.stringify(meta) })
        .eq("id", finalMadrasaId);
    } catch {}

    const currentList = customFundsStore.get(finalMadrasaId) || [];
    customFundsStore.set(finalMadrasaId, [...currentList, newFund]);

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/reports");

    return { success: true, fund: newFund };
  } catch (err: any) {
    return { error: err.message || "ফান্ড তৈরি করতে সমস্যা হয়েছে" };
  }
}

// Update Fund
export async function updateFund(fundId: string, formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) throw new Error("Unauthorized");

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) throw new Error("Madrasa ID not found");

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase() || "FND";
    const category = (formData.get("category") as string) || "General";
    const description = (formData.get("description") as string)?.trim() || "";
    const target_amount = parseFloat(formData.get("target_amount") as string) || 0;

    try {
      const adminClient = await createAdminClient();
      await adminClient.from("zakat_funds").update({
        name,
        code,
        category,
        description,
        target_amount,
      }).eq("id", fundId);
      await adminClient.from("funds").update({
        name,
        code,
        category,
        description,
        target_amount,
      }).eq("id", fundId);
    } catch (err) {
      console.error("Fund update in db failed, checking fallback:", err);
    }

    // Update in memory if present
    const currentList = customFundsStore.get(finalMadrasaId) || [];
    const updated = currentList.map(f => f.id === fundId ? {
      ...f,
      name,
      code,
      category: category as any,
      description,
      target_amount,
    } : f);
    customFundsStore.set(finalMadrasaId, updated);

    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

// Delete Fund
export async function deleteFund(fundId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) throw new Error("Unauthorized");

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) throw new Error("Madrasa ID not found");

    try {
      const adminClient = await createAdminClient();
      await adminClient.from("zakat_funds").delete().eq("id", fundId);
      await adminClient.from("funds").delete().eq("id", fundId);
      
      const { data: madrasaData } = await adminClient
        .from("madrasas")
        .select("registration_no")
        .eq("id", finalMadrasaId)
        .single();
      if (madrasaData?.registration_no?.startsWith("{")) {
        const meta = JSON.parse(madrasaData.registration_no);
        if (meta.custom_funds && Array.isArray(meta.custom_funds)) {
          meta.custom_funds = meta.custom_funds.filter((f: any) => f.id !== fundId);
          await adminClient.from("madrasas").update({ registration_no: JSON.stringify(meta) }).eq("id", finalMadrasaId);
        }
      }
    } catch (err) {
      console.error("Fund deletion in db failed:", err);
    }

    const currentList = customFundsStore.get(finalMadrasaId) || [];
    customFundsStore.set(finalMadrasaId, currentList.filter(f => f.id !== fundId));

    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছে ফেলা সম্ভব হয়নি" };
  }
}

// Fetch all donors with donation aggregates (Unified Master Donors)
export async function getDonors(): Promise<DonorItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return [];

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const rawDonors: any[] = meta.life_member_donors || [];
    const subscriptionPayments: any[] = meta.donor_subscription_payments || [];
    const mahfils: any[] = meta.mahfils || [];

    const { data: dbDonors, error } = await adminClient
      .from("donors")
      .select("*")
      .eq("madrasa_id", finalMadrasaId)
      .order("created_at", { ascending: false });

    // Get donations to calculate donor totals
    const { data: dbDonations } = await adminClient
      .from("donations")
      .select("donor_id, amount, donation_date, receipt_no, donors(name, phone)")
      .eq("madrasa_id", finalMadrasaId);

    const donorDonationMap = new Map<string, { total: number; count: number; lastDate: string }>();

    // Add subscription payments into map
    subscriptionPayments.forEach((p: any) => {
      if (p.donor_id) {
        const cur = donorDonationMap.get(p.donor_id) || { total: 0, count: 0, lastDate: "" };
        cur.total += Number(p.amount || 0);
        cur.count += 1;
        const pDate = p.payment_date || p.created_at || "";
        if (!cur.lastDate || new Date(pDate) > new Date(cur.lastDate)) {
          cur.lastDate = pDate;
        }
        donorDonationMap.set(p.donor_id, cur);
      }
    });

    // Add relational DB donations into map
    dbDonations?.forEach((d: any) => {
      if (!d.donor_id) return;
      const current = donorDonationMap.get(d.donor_id) || { total: 0, count: 0, lastDate: "" };
      current.total += Number(d.amount || 0);
      current.count += 1;
      if (!current.lastDate || new Date(d.donation_date) > new Date(current.lastDate)) {
        current.lastDate = d.donation_date;
      }
      donorDonationMap.set(d.donor_id, current);
    });

    // Master unified donors mapping
    const donorResultMap = new Map<string, DonorItem>();

    // First, add all DB donors
    (dbDonors || []).forEach((d: any) => {
      const stats = donorDonationMap.get(d.id) || { total: 0, count: 0, lastDate: "" };
      let pledgeAmount = 0;
      let notesText = d.notes || "";
      if (d.notes && d.notes.startsWith("{")) {
        try {
          const parsed = JSON.parse(d.notes);
          pledgeAmount = parsed.pledge_amount || 0;
          notesText = parsed.notes || "";
        } catch {}
      }

      donorResultMap.set(d.id, {
        id: d.id,
        madrasa_id: d.madrasa_id,
        name: d.name,
        phone: d.phone || "",
        email: d.email || "",
        address: d.address || "",
        donor_type: (d.donor_type as any) || "OneTime",
        pledge_amount: pledgeAmount || d.pledge_amount || 0,
        preferred_fund: d.preferred_fund || "",
        notes: notesText,
        created_at: d.created_at,
        total_donated: stats.total,
        donation_count: stats.count,
        last_donation_date: stats.lastDate,
      });
    });

    // Second, merge any metadata life_member_donors not in DB
    rawDonors.forEach((lm: any) => {
      const existing = donorResultMap.get(lm.id);
      const stats = donorDonationMap.get(lm.id) || { total: 0, count: 0, lastDate: "" };
      const dType = lm.member_type === "LIFE_MEMBER" ? "Annual" : lm.member_type === "MONTHLY_DONOR" || lm.member_type === "MONTHLY" ? "Monthly" : "Annual";

      if (existing) {
        existing.pledge_amount = existing.pledge_amount || lm.pledge_amount || 0;
        existing.preferred_fund = existing.preferred_fund || lm.preferred_fund || "";
        existing.total_donated = Math.max(existing.total_donated || 0, stats.total || 0, Number(lm.total_donated) || 0);
      } else {
        donorResultMap.set(lm.id, {
          id: lm.id,
          madrasa_id: finalMadrasaId,
          name: lm.name,
          phone: lm.phone || "",
          email: lm.email || "",
          address: lm.address || "",
          donor_type: dType as any,
          pledge_amount: Number(lm.pledge_amount || lm.committed_amount || 0),
          preferred_fund: lm.preferred_fund || "",
          notes: lm.notes || "",
          created_at: lm.created_at || new Date().toISOString(),
          total_donated: Math.max(stats.total, Number(lm.total_donated) || 0),
          donation_count: stats.count || (stats.total > 0 ? 1 : 0),
          last_donation_date: stats.lastDate || lm.join_date || "",
        });
      }
    });

    return Array.from(donorResultMap.values());
  } catch (err) {
    console.error("Error in getDonors:", err);
    return [];
  }
}

// Add Donor with Frequency: Annual / Monthly / OneTime
export async function addDonor(formData: FormData) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || "";
    const address = (formData.get("address") as string)?.trim() || "";
    const donor_type = (formData.get("donor_type") as string) || "OneTime"; // "Monthly", "Annual", "OneTime"
    const pledge_amount = parseFloat(formData.get("pledge_amount") as string) || 0;
    const preferred_fund = (formData.get("preferred_fund") as string)?.trim() || "সাধারণ ফান্ড";
    const notes = (formData.get("notes") as string)?.trim() || "";

    if (!name) {
      return { error: "দাতার নাম আবশ্যক" };
    }

    // Store notes with metadata safely
    const metaNotes = JSON.stringify({
      pledge_amount,
      preferred_fund,
      notes,
    });

    let donorData = null;
    const { data, error } = await adminClient.from("donors").insert({
      madrasa_id: finalMadrasaId,
      name,
      phone,
      address,
      donor_type,
      notes: metaNotes,
    }).select().single();

    if (error) {
      const { data: retryData, error: retryError } = await adminClient.from("donors").insert({
        madrasa_id: finalMadrasaId,
        name,
        phone,
        address,
        donor_type,
      }).select().single();
      if (retryError) return { error: retryError.message };
      donorData = retryData;
    } else {
      donorData = data;
    }

    // Sync into Madrasa Metadata life_member_donors
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      const rawDonors = meta.life_member_donors || [];
      const mType = donor_type === "Monthly" ? "MONTHLY_DONOR" : donor_type === "Annual" ? "LIFE_MEMBER" : "ONETIME";
      const prefix = mType === "LIFE_MEMBER" ? "LM" : mType === "MONTHLY_DONOR" ? "MD" : "DN";
      const newDonorEntry = {
        id: donorData.id,
        madrasa_id: finalMadrasaId,
        member_no: `${prefix}-${String(rawDonors.length + 1).padStart(3, "0")}`,
        name,
        phone,
        email: "",
        address,
        occupation: "শুভাকাঙ্ক্ষী",
        blood_group: "",
        member_type: mType,
        pledge_amount,
        preferred_fund,
        collection_day: 10,
        payment_method: "Cash",
        join_date: new Date().toISOString().split("T")[0],
        status: "ACTIVE",
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rawDonors.unshift(newDonorEntry);
      meta.life_member_donors = rawDonors;
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (metaErr) {
      console.warn("Could not sync metadata donor:", metaErr);
    }

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/fundraising/donors");
    return { 
      success: true, 
      donor: donorData ? {
        id: donorData.id,
        madrasa_id: donorData.madrasa_id,
        name: donorData.name,
        phone: donorData.phone || "",
        email: donorData.email || "",
        address: donorData.address || "",
        donor_type: donorData.donor_type || donor_type,
        pledge_amount: pledge_amount,
        notes: notes,
        created_at: donorData.created_at || new Date().toISOString(),
        total_donated: 0,
        donation_count: 0,
        last_donation_date: "",
      } : null 
    };
  } catch (err: any) {
    return { error: err.message || "দাতা যুক্ত করতে সমস্যা হয়েছে" };
  }
}

// Update Donor
export async function updateDonor(donorId: string, formData: FormData) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || "";
    const address = (formData.get("address") as string)?.trim() || "";
    const donor_type = (formData.get("donor_type") as string) || "OneTime";
    const pledge_amount = parseFloat(formData.get("pledge_amount") as string) || 0;
    const preferred_fund = (formData.get("preferred_fund") as string)?.trim() || "সাধারণ ফান্ড";
    const notes = (formData.get("notes") as string)?.trim() || "";

    const metaNotes = JSON.stringify({
      pledge_amount,
      preferred_fund,
      notes,
    });

    const { error } = await adminClient.from("donors").update({
      name,
      phone,
      address,
      donor_type,
      notes: metaNotes,
    }).eq("id", donorId);

    if (error) {
      return { error: error.message };
    }

    // Sync to Madrasa metadata
    if (finalMadrasaId) {
      try {
        const meta = await getMadrasaMetadata(finalMadrasaId);
        const rawDonors = meta.life_member_donors || [];
        const idx = rawDonors.findIndex((d: any) => d.id === donorId);
        if (idx !== -1) {
          rawDonors[idx] = {
            ...rawDonors[idx],
            name,
            phone,
            address,
            pledge_amount,
            preferred_fund,
            notes,
            updated_at: new Date().toISOString(),
          };
          meta.life_member_donors = rawDonors;
          await saveMadrasaMetadata(finalMadrasaId, meta);
        }
      } catch {}
    }

    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/fundraising/donors");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

export async function deleteDonor(id: string) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const { error } = await adminClient.from("donors").delete().eq("id", id);
    
    if (error) {
      return { error: error.message };
    }

    if (finalMadrasaId) {
      try {
        const meta = await getMadrasaMetadata(finalMadrasaId);
        meta.life_member_donors = (meta.life_member_donors || []).filter((d: any) => d.id !== id);
        await saveMadrasaMetadata(finalMadrasaId, meta);
      } catch {}
    }

    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/reports");
    revalidatePath("/dashboard/fundraising/donors");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছে ফেলা ব্যর্থ হয়েছে" };
  }
}

// Fetch all donations with fund info and donor details
export async function getDonations(filters?: {
  fund_id?: string;
  donation_type?: string;
  donor_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DonationItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    let query = adminClient
      .from("donations")
      .select(`
        *,
        donors (
          id,
          name,
          phone,
          address,
          donor_type
        )
      `)
      .eq("madrasa_id", finalMadrasaId)
      .order("donation_date", { ascending: false });

    if (filters?.donor_id) query = query.eq("donor_id", filters.donor_id);
    if (filters?.donation_type && filters.donation_type !== "ALL") {
      query = query.eq("donation_type", filters.donation_type);
    }
    if (filters?.startDate) query = query.gte("donation_date", filters.startDate);
    if (filters?.endDate) query = query.lte("donation_date", filters.endDate);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching donations:", error);
      return [];
    }

    const funds = await getFunds();
    const fundNameMap = new Map(funds.map(f => [f.name, f]));

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const subscriptionPayments = meta.donor_subscription_payments || [];
    const donorsList = await getDonors();
    const donorMap = new Map(donorsList.map(d => [d.id, d]));

    const existingReceiptNos = new Set((data || []).map((d: any) => d.receipt_no).filter(Boolean));
    const existingIds = new Set((data || []).map((d: any) => d.id).filter(Boolean));

    const extraSubscriptionDonations: any[] = [];
    for (const sp of subscriptionPayments) {
      if ((sp.receipt_no && existingReceiptNos.has(sp.receipt_no)) || existingIds.has(sp.id)) continue;
      const dObj = donorMap.get(sp.donor_id);
      extraSubscriptionDonations.push({
        id: sp.id,
        madrasa_id: finalMadrasaId,
        donor_id: sp.donor_id,
        amount: Number(sp.amount || 0),
        donation_type: sp.fund_name || "সাধারণ ফান্ড",
        donation_date: sp.payment_date || (sp.created_at ? sp.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
        receipt_no: sp.receipt_no || `MR-${sp.id.slice(0, 5)}`,
        notes: sp.notes ? `[মাস: ${sp.month || ""}] ${sp.notes}` : `[মাস: ${sp.month || ""}] মাসিক/বাৎসরিক চাঁদা আদায়`,
        created_at: sp.created_at || new Date().toISOString(),
        donors: dObj ? {
          id: dObj.id,
          name: dObj.name,
          phone: dObj.phone,
          address: dObj.address,
          donor_type: dObj.donor_type,
        } : {
          id: sp.donor_id || "sp-donor",
          name: sp.donor_name || "সম্মানিত দাতা",
          phone: "",
          address: "",
          donor_type: "Monthly",
        },
      });
    }

    // Merge student fee payments into donations (e.g. Tuition -> General Fund, Khoraki -> Lillah Fund)
    const extraFeeDonations: any[] = [];
    const feePayments = (meta.payments || []).filter(
      (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
    );
    for (const p of feePayments) {
      if ((p.receipt_no && existingReceiptNos.has(p.receipt_no)) || existingIds.has(p.id)) continue;
      const paymentDate = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
      
      if (p.allocations && p.allocations.length > 0) {
        for (const alloc of p.allocations) {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) continue;
          const name = alloc.fee_type_name || "মাসিক বেতন";
          const isLillah = name.includes("বোর্ডিং") || name.includes("খাবার") || name.includes("খোরাকি") || name.includes("hostel") || name.includes("lillah");
          const fundCategory = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)";
          
          extraFeeDonations.push({
            id: `${p.id}_${alloc.fee_type_id || "alloc"}`,
            madrasa_id: finalMadrasaId,
            donor_id: p.student_id,
            amount: amt,
            donation_type: fundCategory,
            donation_date: paymentDate,
            receipt_no: p.receipt_no || `MR-${p.id.slice(0, 5)}`,
            notes: p.notes ? `[${name}] ${p.notes}` : `[${name}] শিক্ষার্থী ফি আদায়`,
            created_at: p.created_at || new Date().toISOString(),
            donors: {
              id: p.student_id || "student",
              name: `${p.student_name || "শিক্ষার্থী"} (${p.class_name || "শ্রেণি"}${p.student_roll ? `, রোল: ${p.student_roll}` : ""})`,
              phone: "-",
              address: "মাদরাসা শিক্ষার্থী",
              donor_type: "Monthly",
            },
          });
        }
      } else {
        const amt = Number(p.total_amount_received || 0);
        if (amt > 0) {
          const isLillah = (p.notes || "").includes("খোরাকি") || (p.notes || "").includes("খাবার") || (p.notes || "").includes("বোর্ডিং");
          const fundCategory = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)";
          
          extraFeeDonations.push({
            id: p.id,
            madrasa_id: finalMadrasaId,
            donor_id: p.student_id,
            amount: amt,
            donation_type: fundCategory,
            donation_date: paymentDate,
            receipt_no: p.receipt_no || `MR-${p.id.slice(0, 5)}`,
            notes: p.notes ? `[ফি কালেকশন] ${p.notes}` : `[ফি কালেকশন] শিক্ষার্থী ফি আদায়`,
            created_at: p.created_at || new Date().toISOString(),
            donors: {
              id: p.student_id || "student",
              name: `${p.student_name || "শিক্ষার্থী"} (${p.class_name || "শ্রেণি"}${p.student_roll ? `, রোল: ${p.student_roll}` : ""})`,
              phone: "-",
              address: "মাদরাসা শিক্ষার্থী",
              donor_type: "Monthly",
            },
          });
        }
      }
    }

    // Merge online donations into donations list
    const extraOnlineDonations: any[] = [];
    const onlineDonations = meta.online_donations || [];
    for (const od of onlineDonations) {
      if ((od.receipt_no && existingReceiptNos.has(od.receipt_no)) || existingIds.has(od.id) || (od.trx_id && existingReceiptNos.has(od.trx_id))) continue;
      const paymentDate = od.donation_date || (od.created_at ? od.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
      const canonicalFund = normalizeFundName(od.fund_category || od.fund_name || od.purpose, funds);
      extraOnlineDonations.push({
        id: od.id,
        madrasa_id: finalMadrasaId,
        donor_id: od.id,
        amount: Number(od.amount || 0),
        donation_type: canonicalFund,
        donation_date: paymentDate,
        receipt_no: od.receipt_no || `ONL-${od.id.slice(0, 5)}`,
        notes: `[অনলাইন দান | মেথড: ${od.payment_method || "Digital"} | TrxID: ${od.trx_id || "-"}] ${od.message || ""}`.trim(),
        created_at: od.created_at || new Date().toISOString(),
        donors: {
          id: od.id,
          name: `${od.donor_name || "অনলাইন শুভাকাঙ্ক্ষী"}${od.is_anonymous ? " (গোপন দান)" : ""}`,
          phone: od.phone || "-",
          address: od.address || "অনলাইন পোর্টাল",
          donor_type: "OneTime",
        },
      });
    }

    let combinedList = [...(data || []), ...extraSubscriptionDonations, ...extraFeeDonations, ...extraOnlineDonations];

    if (filters?.donor_id) combinedList = combinedList.filter((d: any) => d.donor_id === filters.donor_id);
    if (filters?.donation_type && filters.donation_type !== "ALL") {
      const targetFundName = normalizeFundName(filters.donation_type, funds);
      combinedList = combinedList.filter((d: any) => normalizeFundName(d.donation_type, funds) === targetFundName);
    }
    if (filters?.startDate) combinedList = combinedList.filter((d: any) => (d.donation_date || "") >= filters.startDate!);
    if (filters?.endDate) combinedList = combinedList.filter((d: any) => (d.donation_date || "") <= filters.endDate!);

    // Sort combined by date descending
    combinedList.sort((a, b) => new Date(b.donation_date || b.created_at).getTime() - new Date(a.donation_date || a.created_at).getTime());

    return combinedList.map((d: any, index: number) => {
      // Resolve canonical fund name and fund ID
      const fundName = normalizeFundName(d.donation_type, funds);
      const matchedFund = fundNameMap.get(fundName);
      const fundId = matchedFund?.id || "";

      // Parse payment method or transaction notes if structured
      let paymentMethod = "Cash";
      let cleanNotes = d.notes || "";
      if (cleanNotes.includes("[Method:")) {
        const match = cleanNotes.match(/\[Method:\s*([^\]]+)\]/);
        if (match) {
          paymentMethod = match[1];
          cleanNotes = cleanNotes.replace(/\[Method:\s*[^\]]+\]/, "").trim();
        }
      }

      const serialReceipt = d.receipt_no || `ZR${String(index + 1).padStart(4, "0")}`;

      // Mahfil settlement detection and synthetic donor information
      let isMahfilSettlement = false;
      let mahfilTitle = "";
      let donorObj = d.donors;

      if (
        serialReceipt.startsWith("MHF-") ||
        (d.notes && d.notes.includes("[মাহফিল উদ্বৃত্ত")) ||
        (d.notes && d.notes.toLowerCase().includes("মাহফিল"))
      ) {
        isMahfilSettlement = true;
        const mMatch = (d.notes || "").match(/মাহফিল:\s*([^(|.]+)/);
        mahfilTitle = mMatch ? mMatch[1].trim() : "বার্ষিক ইসলামি মহাসম্মেলন";
        if (!donorObj) {
          donorObj = {
            id: "mahfil-source",
            name: `${mahfilTitle} (মাহফিল উদ্বৃত্ত তহবিল)`,
            phone: "-",
            address: "মাহফিল আয়োজক কমিটি",
            donor_type: "OneTime",
          };
        }
      }

      return {
        id: d.id,
        madrasa_id: d.madrasa_id,
        donor_id: d.donor_id,
        amount: Number(d.amount || 0),
        donation_type: fundName,
        fund_id: fundId,
        fund_name: fundName,
        donation_date: d.donation_date,
        receipt_no: serialReceipt,
        payment_method: paymentMethod,
        notes: cleanNotes,
        created_at: d.created_at,
        is_mahfil_settlement: isMahfilSettlement,
        mahfil_title: mahfilTitle,
        donors: donorObj,
      };
    });
  } catch (err) {
    console.error("Error in getDonations:", err);
    return [];
  }
}

// Get Single Donation with full details for Money Receipt
export async function getDonationById(id: string): Promise<DonationItem | null> {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("donations")
      .select(`
        *,
        donors (
          id,
          name,
          phone,
          address,
          donor_type
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const funds = await getFunds();
    const fundName = normalizeFundName(data.donation_type, funds);

    let paymentMethod = "Cash";
    let cleanNotes = data.notes || "";
    if (cleanNotes.includes("[Method:")) {
      const match = cleanNotes.match(/\[Method:\s*([^\]]+)\]/);
      if (match) {
        paymentMethod = match[1];
        cleanNotes = cleanNotes.replace(/\[Method:\s*[^\]]+\]/, "").trim();
      }
    }

    const serialReceipt = data.receipt_no || `ZR${data.id.substring(0, 6).toUpperCase()}`;
    let isMahfilSettlement = false;
    let mahfilTitle = "";
    let donorObj = data.donors;

    if (
      serialReceipt.startsWith("MHF-") ||
      (data.notes && data.notes.includes("[মাহফিল উদ্বৃত্ত")) ||
      (data.notes && data.notes.toLowerCase().includes("মাহফিল"))
    ) {
      isMahfilSettlement = true;
      const mMatch = (data.notes || "").match(/মাহফিল:\s*([^(|.]+)/);
      mahfilTitle = mMatch ? mMatch[1].trim() : "বার্ষিক ইসলামি মহাসম্মেলন";
      if (!donorObj) {
        donorObj = {
          id: "mahfil-source",
          name: `${mahfilTitle} (মাহফিল উদ্বৃত্ত তহবিল)`,
          phone: "-",
          address: "মাহফিল আয়োজক কমিটি",
          donor_type: "OneTime",
        };
      }
    }

    return {
      id: data.id,
      madrasa_id: data.madrasa_id,
      donor_id: data.donor_id,
      amount: Number(data.amount || 0),
      donation_type: fundName,
      fund_name: fundName,
      donation_date: data.donation_date,
      receipt_no: serialReceipt,
      payment_method: paymentMethod,
      notes: cleanNotes,
      created_at: data.created_at,
      is_mahfil_settlement: isMahfilSettlement,
      mahfil_title: mahfilTitle,
      donors: donorObj,
    };
  } catch (err) {
    console.error("Error in getDonationById:", err);
    return null;
  }
}

// Get Full Financial Ledger & Statement for a specific Fund
export async function getFundLedgerData(fundIdentifier: string): Promise<{
  fund: FundItem | null;
  transactions: FundTransactionRecord[];
  totalInflow: number;
  totalOutflow: number;
  currentBalance: number;
}> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const funds = await getFunds();
    const targetFund = funds.find(
      (f) =>
        f.id === fundIdentifier ||
        f.name === fundIdentifier ||
        f.code?.toLowerCase() === fundIdentifier.toLowerCase() ||
        f.name.toLowerCase().includes(fundIdentifier.toLowerCase()) ||
        isTransactionInFund(f, fundIdentifier, fundIdentifier, funds)
    ) || funds[0];

    const targetCanonicalName = targetFund ? targetFund.name : "সাধারণ ফান্ড (General Fund)";
    const targetFundId = targetFund ? targetFund.id : "fund-general";

    // 1. Fetch Inflow Donations for this madrasa
    const { data: dbDonations } = await adminClient
      .from("donations")
      .select(`
        *,
        donors (
          id,
          name,
          phone,
          address,
          donor_type
        )
      `)
      .eq("madrasa_id", finalMadrasaId)
      .order("donation_date", { ascending: false });

    // 2. Fetch Expenses for this madrasa
    const { data: dbExpenses } = await adminClient
      .from("expenses")
      .select("*")
      .eq("madrasa_id", finalMadrasaId)
      .order("expense_date", { ascending: false });

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mahfils = meta.mahfils || [];
    const validMahfilVouchers = new Set<string>();
    const validMahfilRecordIds = new Set<string>();

    mahfils.forEach((m: any) => {
      const allSt = m.settlements || (m.settlement ? [m.settlement] : []);
      allSt.forEach((s: any) => {
        if (s.accounting_voucher_no) validMahfilVouchers.add(s.accounting_voucher_no);
        if (s.accounting_record_id) validMahfilRecordIds.add(s.accounting_record_id);
        if (s.mahfil_txn_id) validMahfilRecordIds.add(s.mahfil_txn_id);
      });
    });

    const transactions: FundTransactionRecord[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;

    const existingReceiptNos = new Set((dbDonations || []).map((d: any) => d.receipt_no).filter(Boolean));
    const existingIds = new Set((dbDonations || []).map((d: any) => d.id).filter(Boolean));

    // Process Donations
    for (const d of dbDonations || []) {
      if (isTransactionInFund(targetFund, d.fund_id, d.donation_type, funds)) {
        let isMahfil = false;
        let sourceName = d.donors?.name || "সাধারণ দাতা";
        if (d.receipt_no?.startsWith("MHF-") || (d.notes && d.notes.includes("মাহফিল"))) {
          isMahfil = true;
          const isValid = (d.receipt_no && validMahfilVouchers.has(d.receipt_no)) || validMahfilRecordIds.has(d.id);
          if (!isValid) {
            try {
              await adminClient.from("donations").delete().eq("id", d.id);
            } catch {}
            continue;
          }
          const mMatch = (d.notes || "").match(/মাহফিল:\s*([^(|.]+)/);
          const mTitle = mMatch ? mMatch[1].trim() : "বার্ষিক ইসলামি মহাসম্মেলন";
          sourceName = `${mTitle} (মাহফিল উদ্বৃত্ত তহবিল)`;
        }

        const amt = Number(d.amount || 0);
        totalInflow += amt;

        transactions.push({
          id: d.id,
          type: isMahfil ? "MAHFIL_SURPLUS" : "INCOME",
          fund_id: targetFundId,
          fund_name: targetCanonicalName,
          amount: amt,
          date: d.donation_date,
          source_or_recipient: sourceName,
          voucher_no: d.receipt_no || `ZR-${d.id.substring(0, 6)}`,
          payment_method: d.notes?.includes("[Method:") ? d.notes.match(/\[Method:\s*([^\]]+)\]/)?.[1] : "Cash",
          notes: d.notes || "",
          category: isMahfil ? "মাহফিল উদ্বৃত্ত জমা" : "সাধারণ অনুদান প্রাপ্তি",
          is_mahfil_settlement: isMahfil,
        });
      }
    }

    // Process Student Fee Payments into Fund Ledger (Dynamic Fund Routing)
    const feePayments = (meta.payments || []).filter(
      (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
    );
    for (const p of feePayments) {
      if ((p.receipt_no && existingReceiptNos.has(p.receipt_no)) || existingIds.has(p.id)) continue;
      if (p.allocations && p.allocations.length > 0) {
        for (const alloc of p.allocations) {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) continue;
          const name = alloc.fee_type_name || "মাসিক বেতন";
          const isLillah =
            name.includes("বোর্ডিং") ||
            name.includes("খাবার") ||
            name.includes("খোরাকি") ||
            name.includes("hostel") ||
            name.includes("lillah");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const itemFundId = alloc.fund_id || p.fund_id;
          const itemFundName = alloc.fund_name || p.fund_name || fallbackFundName;

          if (isTransactionInFund(targetFund, itemFundId, itemFundName, funds)) {
            totalInflow += amt;
            transactions.push({
              id: `${p.id}_${alloc.fee_type_id || "alloc"}`,
              type: "INCOME",
              fund_id: targetFundId,
              fund_name: targetCanonicalName,
              amount: amt,
              date: p.payment_date || (p.created_at ? p.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
              source_or_recipient: `${p.student_name || "শিক্ষার্থী"} (${p.class_name || "সাধারণ"}) [${name}]`,
              voucher_no: p.receipt_no || `MR-${p.id.substring(0, 6)}`,
              payment_method: p.payment_method || "Cash",
              notes: p.notes ? `${name} - ${p.notes}` : `${name} আদায়`,
              category: name,
              is_mahfil_settlement: false,
            });
          }
        }
      } else {
        const amt = Number(p.total_amount_received || 0);
        if (amt > 0) {
          const isLillah =
            (p.notes || "").includes("বোর্ডিং") ||
            (p.notes || "").includes("খাবার") ||
            (p.notes || "").includes("খোরাকি");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const itemFundId = p.fund_id;
          const itemFundName = p.fund_name || fallbackFundName;

          if (isTransactionInFund(targetFund, itemFundId, itemFundName, funds)) {
            totalInflow += amt;
            transactions.push({
              id: p.id,
              type: "INCOME",
              fund_id: targetFundId,
              fund_name: targetCanonicalName,
              amount: amt,
              date: p.payment_date || (p.created_at ? p.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
              source_or_recipient: `${p.student_name || "শিক্ষার্থী"} (${p.class_name || "সাধারণ"})`,
              voucher_no: p.receipt_no || `MR-${p.id.substring(0, 6)}`,
              payment_method: p.payment_method || "Cash",
              notes: p.notes || "শিক্ষার্থীর ফি আদায়",
              category: "শিক্ষার্থীর ফি",
              is_mahfil_settlement: false,
            });
          }
        }
      }
    }

    // Process Donor Subscriptions
    const subscriptionPayments = meta.donor_subscription_payments || [];
    for (const sp of subscriptionPayments) {
      if ((sp.receipt_no && existingReceiptNos.has(sp.receipt_no)) || existingIds.has(sp.id)) continue;
      const amt = Number(sp.amount || 0);
      const targetFundName = sp.fund_name || "সাধারণ ফান্ড";
      if (isTransactionInFund(targetFund, undefined, targetFundName, funds)) {
        totalInflow += amt;
        transactions.push({
          id: sp.id,
          type: "INCOME",
          fund_id: targetFundId,
          fund_name: targetCanonicalName,
          amount: amt,
          date: sp.payment_date || (sp.created_at ? sp.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
          source_or_recipient: `${sp.donor_name || "সম্মানিত দাতা"} (মাসিক/বাৎসরিক চাঁদা)`,
          voucher_no: sp.receipt_no || `SUB-${sp.id.substring(0, 6)}`,
          payment_method: sp.payment_method || "Cash",
          notes: sp.notes || `[মাস: ${sp.month || ""}] চাঁদা আদায়`,
          category: "দাতা চাঁদা",
          is_mahfil_settlement: false,
        });
      }
    }

    // Process Online Donations
    const onlineDonations = meta.online_donations || [];
    for (const od of onlineDonations) {
      if ((od.receipt_no && existingReceiptNos.has(od.receipt_no)) || existingIds.has(od.id) || (od.trx_id && existingReceiptNos.has(od.trx_id))) continue;
      const targetFundName = od.fund_category || od.fund_name || od.purpose || "সাধারণ ফান্ড";
      if (isTransactionInFund(targetFund, undefined, targetFundName, funds)) {
        const amt = Number(od.amount || 0);
        if (amt > 0) {
          const isVerified = od.status === "VERIFIED" || od.status === "COMPLETED" || od.status === "SUCCESS";
          if (isVerified) {
            totalInflow += amt;
          }
          transactions.push({
            id: od.id,
            type: "INCOME",
            fund_id: targetFundId,
            fund_name: targetCanonicalName,
            amount: amt,
            date: od.donation_date || (od.created_at ? od.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
            source_or_recipient: `${od.donor_name || "অনলাইন শুভাকাঙ্ক্ষী"}${od.phone ? ` (${od.phone})` : ""}${od.is_anonymous ? " [গোপন দান]" : ""}`,
            voucher_no: od.receipt_no || `ONL-${od.id.substring(0, 6)}`,
            payment_method: od.payment_method || "Digital",
            notes: `[অনলাইন অনুদান | TrxID: ${od.trx_id || "-"}] ${od.message || ""}`.trim(),
            category: `অনলাইন দান (${isVerified ? "ভেরিফাইড" : od.status === "PENDING" ? "অপেক্ষমান" : od.status})`,
            is_mahfil_settlement: false,
          });
        }
      }
    }

    // Process Donation Boxes
    const boxLogs = meta.donation_box_logs || [];
    for (const b of boxLogs) {
      const recNo = b.receipt_no || b.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      const targetFundName = b.fund_name || "সাধারণ ফান্ড";
      if (isTransactionInFund(targetFund, undefined, targetFundName, funds)) {
        const amt = Number(b.amount || 0);
        if (amt > 0) {
          totalInflow += amt;
          transactions.push({
            id: b.id,
            type: "INCOME",
            fund_id: targetFundId,
            fund_name: targetCanonicalName,
            amount: amt,
            date: b.collection_date || (b.created_at ? b.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
            source_or_recipient: `${b.box_name || "দানবাক্স"} (কালেকশন)`,
            voucher_no: b.receipt_no || `BOX-${b.id.substring(0, 6)}`,
            payment_method: "Cash",
            notes: b.notes || "দানবাক্স থেকে সংগৃহীত অর্থ",
            category: "দানবাক্স কালেকশন",
            is_mahfil_settlement: false,
          });
        }
      }
    }

    // Process Qurbani Leather Records
    const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
    for (const lr of leatherRecords) {
      const recNo = lr.receipt_no || lr.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      if (isTransactionInFund(targetFund, undefined, "লিল্লাহ বোর্ডিং ফান্ড", funds)) {
        const inc = Number(lr.received_amount || lr.total_sale_price || lr.total_sale_amount || 0);
        const exp = Number(lr.transport_labour_cost || lr.transport_labor_cost || 0);
        const date = lr.sale_date || lr.collection_date || (lr.created_at ? lr.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
        if (inc > 0) {
          totalInflow += inc;
          transactions.push({
            id: `leather_inc_${lr.id}`,
            type: "INCOME",
            fund_id: targetFundId,
            fund_name: targetCanonicalName,
            amount: inc,
            date,
            source_or_recipient: `${lr.buyer_name || "চামড়া ক্রেতা"} (কুরবানির চামড়া বিক্রয়)`,
            voucher_no: lr.receipt_no || `LTH-${lr.id.substring(0, 6)}`,
            payment_method: "Cash",
            notes: lr.notes || "কুরবানির চামড়া বিক্রয় বাবদ আয়",
            category: "কুরবানির চামড়া বিক্রয়",
            is_mahfil_settlement: false,
          });
        }
        if (exp > 0) {
          totalOutflow += exp;
          transactions.push({
            id: `leather_exp_${lr.id}`,
            type: "EXPENSE",
            fund_id: targetFundId,
            fund_name: targetCanonicalName,
            amount: exp,
            date,
            source_or_recipient: "চামড়া পরিবহন ও শ্রমিক মজুরি",
            voucher_no: `EXP-LTH-${lr.id.substring(0, 6)}`,
            payment_method: "Cash",
            notes: "কুরবানির চামড়া সংগ্রহ ও পরিবহন খরচ",
            category: "চামড়া সংগ্রহ খরচ",
            is_mahfil_settlement: false,
          });
        }
      }
    }

    // Process Expenses
    for (const e of dbExpenses || []) {
      const parsed = parseExpenseFund(e.description);
      const expFundId = e.fund_id || parsed.fundId;
      const expFundName = e.fund_name || parsed.fundName || e.category;

      if (isTransactionInFund(targetFund, expFundId, expFundName, funds)) {
        let isMahfilDeficit = false;
        let recipientName = e.category || "মাদরাসা সাধারণ খরচ";
        if (e.voucher_no?.startsWith("EXP-MHF") || (e.description && e.description.includes("মাহফিল"))) {
          isMahfilDeficit = true;
          const isValid = (e.voucher_no && validMahfilVouchers.has(e.voucher_no)) || validMahfilRecordIds.has(e.id);
          if (!isValid) {
            try {
              await adminClient.from("expenses").delete().eq("id", e.id);
            } catch {}
            continue;
          }
          recipientName = "মাহফিল পরিচালনা কমিটি (ঘাটতি সমন্বয়)";
        }

        const amt = Number(e.amount || 0);
        totalOutflow += amt;

        transactions.push({
          id: e.id,
          type: isMahfilDeficit ? "MAHFIL_DEFICIT" : "EXPENSE",
          fund_id: targetFundId,
          fund_name: targetCanonicalName,
          amount: amt,
          date: e.expense_date,
          source_or_recipient: recipientName,
          voucher_no: e.voucher_no || `EXP-${e.id.substring(0, 6)}`,
          notes: parsed.cleanDesc || e.description || "",
          category: e.category || "সাধারণ খরচ",
          is_mahfil_settlement: isMahfilDeficit,
        });
      }
    }

    // Sort all transactions by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const currentBalance = totalInflow - totalOutflow;

    return {
      fund: targetFund,
      transactions,
      totalInflow,
      totalOutflow,
      currentBalance,
    };
  } catch (err) {
    console.error("Error in getFundLedgerData:", err);
    return {
      fund: null,
      transactions: [],
      totalInflow: 0,
      totalOutflow: 0,
      currentBalance: 0,
    };
  }
}

// Delete a specific transaction from Fund Ledger (Donation or Expense or Settlement or Fee or Online or Box or Leather)
export async function deleteFundTransaction(
  txnId: string,
  txnType: string,
  voucherNo?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const isInflow = txnType === "INCOME" || txnType === "MAHFIL_SURPLUS";
    const isOutflow = txnType === "EXPENSE" || txnType === "MAHFIL_DEFICIT";

    // 1. Delete from SQL donations table
    if (isInflow || txnId.startsWith("ZR-") || voucherNo?.startsWith("ZR-") || voucherNo?.startsWith("MHF-")) {
      try {
        await adminClient.from("donations").delete().eq("id", txnId);
        if (voucherNo) {
          await adminClient.from("donations").delete().eq("receipt_no", voucherNo);
          await adminClient.from("donations").delete().like("notes", `%${voucherNo}%`);
        }
      } catch {}
    }

    // 2. Delete from SQL expenses table
    if (isOutflow || txnId.startsWith("EXP-") || voucherNo?.startsWith("EXP-") || txnId.startsWith("leather_exp_")) {
      try {
        await adminClient.from("expenses").delete().eq("id", txnId);
        if (voucherNo) {
          await adminClient.from("expenses").delete().eq("voucher_no", voucherNo);
          await adminClient.from("expenses").delete().like("description", `%${voucherNo}%`);
        }
      } catch {}
    }

    // 3. Process metadata (fees, online donations, subscriptions, donation boxes, leather, mahfils)
    const meta = await getMadrasaMetadata(finalMadrasaId);
    let metaChanged = false;

    // Check Student Fee Payments
    const feePayments = meta.payments || [];
    const studentFees = meta.student_fees || [];
    const payIdx = feePayments.findIndex(
      (p: any) =>
        p.id === txnId ||
        p.receipt_no === voucherNo ||
        txnId.startsWith(p.id) ||
        (voucherNo && p.receipt_no === voucherNo)
    );

    if (payIdx >= 0) {
      const payment = feePayments[payIdx];
      const now = new Date().toISOString();

      // Rollback allocations from student fees to restore dues
      for (const alloc of payment.allocations || []) {
        if (alloc.student_fee_id) {
          const feeIdx = studentFees.findIndex((f: any) => f.id === alloc.student_fee_id);
          if (feeIdx >= 0) {
            const target = studentFees[feeIdx];
            const newPaid = Math.max(0, (target.paid_amount || 0) - (alloc.allocated_amount || 0));
            const newDue = Math.max(0, (target.payable_amount || 0) - newPaid);
            studentFees[feeIdx] = {
              ...target,
              paid_amount: newPaid,
              due_amount: newDue,
              status: newPaid === 0 ? "UNPAID" : "PARTIAL",
              updated_at: now,
            };
          }
        }
      }

      // Remove the payment from payments array
      feePayments.splice(payIdx, 1);
      meta.payments = feePayments;
      meta.student_fees = studentFees;
      metaChanged = true;

      // Clean up legacy fees table if linked
      try {
        if (payment.db_fee_id) {
          await adminClient.from("fees").delete().eq("id", payment.db_fee_id).eq("madrasa_id", finalMadrasaId);
        }
        if (payment.receipt_no) {
          await adminClient.from("fees").delete().like("notes", `%${payment.receipt_no}%`).eq("madrasa_id", finalMadrasaId);
        }
        await adminClient.from("fees").delete().eq("id", payment.id).eq("madrasa_id", finalMadrasaId);
      } catch {}
    }

    // Check Online Donations
    const origOnlineCount = (meta.online_donations || []).length;
    meta.online_donations = (meta.online_donations || []).filter(
      (od: any) =>
        od.id !== txnId &&
        (!voucherNo || od.receipt_no !== voucherNo) &&
        (!voucherNo || od.trx_id !== voucherNo) &&
        !txnId.includes(od.id)
    );
    if ((meta.online_donations || []).length !== origOnlineCount) {
      metaChanged = true;
    }

    // Check Donor Subscriptions
    const origSubCount = (meta.donor_subscription_payments || []).length;
    meta.donor_subscription_payments = (meta.donor_subscription_payments || []).filter(
      (sp: any) =>
        sp.id !== txnId &&
        (!voucherNo || sp.receipt_no !== voucherNo) &&
        !txnId.includes(sp.id)
    );
    if ((meta.donor_subscription_payments || []).length !== origSubCount) {
      metaChanged = true;
    }

    // Check Donation Boxes
    const origBoxCount = (meta.donation_box_logs || []).length;
    meta.donation_box_logs = (meta.donation_box_logs || []).filter(
      (b: any) =>
        b.id !== txnId &&
        (!voucherNo || b.receipt_no !== voucherNo) &&
        !txnId.includes(b.id)
    );
    if ((meta.donation_box_logs || []).length !== origBoxCount) {
      metaChanged = true;
    }

    // Check Qurbani Leather Records
    const origLeatherCount = (meta.qurbani_leather_records || []).length;
    meta.qurbani_leather_records = (meta.qurbani_leather_records || []).filter(
      (lr: any) =>
        lr.id !== txnId &&
        (!voucherNo || lr.receipt_no !== voucherNo) &&
        !txnId.includes(lr.id)
    );
    if ((meta.qurbani_leather_records || []).length !== origLeatherCount) {
      metaChanged = true;
    }
    const origBatchCount = (meta.leather_batches || []).length;
    meta.leather_batches = (meta.leather_batches || []).filter(
      (lb: any) =>
        lb.id !== txnId &&
        (!voucherNo || lb.receipt_no !== voucherNo) &&
        !txnId.includes(lb.id)
    );
    if ((meta.leather_batches || []).length !== origBatchCount) {
      metaChanged = true;
    }

    // Check Mahfil settlements in metadata
    (meta.mahfils || []).forEach((m: any) => {
      const origCount = (m.settlements || []).length;
      m.settlements = (m.settlements || []).filter(
        (s: any) =>
          s.id !== txnId &&
          s.accounting_record_id !== txnId &&
          s.mahfil_txn_id !== txnId &&
          (!voucherNo || s.accounting_voucher_no !== voucherNo)
      );
      if (m.settlements.length !== origCount) metaChanged = true;

      if (
        m.settlement &&
        (m.settlement.id === txnId ||
          m.settlement.accounting_record_id === txnId ||
          m.settlement.mahfil_txn_id === txnId ||
          (voucherNo && m.settlement.accounting_voucher_no === voucherNo))
      ) {
        m.settlement = m.settlements.length > 0 ? m.settlements[m.settlements.length - 1] : undefined;
        metaChanged = true;
      }
    });

    if (metaChanged) {
      await saveMadrasaMetadata(finalMadrasaId, meta);
    }

    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/funds");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/donations");
    revalidatePath("/dashboard/accounting/expenses");
    revalidatePath("/dashboard/fundraising/mahfil");

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting fund transaction:", err);
    return { error: err.message || "লেনদেন ডিলিট করতে সমস্যা হয়েছে" };
  }
}

// Add Collection with Fund Selection and Auto Receipt Generation
export async function addDonation(prevState: any, formData: FormData) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    let donor_id = (formData.get("donor_id") as string) || null;
    const is_new_donor = formData.get("is_new_donor") === "true";
    const new_donor_name = (formData.get("new_donor_name") as string)?.trim();
    const new_donor_phone = (formData.get("new_donor_phone") as string)?.trim() || "";
    const new_donor_address = (formData.get("new_donor_address") as string)?.trim() || "";
    const new_donor_type = (formData.get("new_donor_type") as string) || "OneTime";
    const new_donor_pledge = parseFloat(formData.get("new_donor_pledge") as string) || 0;
    const auto_save_donor = formData.get("auto_save_donor") !== "false";

    let createdDonorObj: DonorItem | null = null;

    // 1-Click Auto Add Donor if in new donor mode
    if (is_new_donor && new_donor_name) {
      if (auto_save_donor) {
        const metaNotes = JSON.stringify({
          pledge_amount: new_donor_pledge,
          notes: "সংগ্রহের সময় অটো-অ্যাড করা হয়েছে",
        });

        let newDonorDb = null;
        const { data: dbDonor, error: donorErr } = await adminClient.from("donors").insert({
          madrasa_id: finalMadrasaId,
          name: new_donor_name,
          phone: new_donor_phone,
          address: new_donor_address,
          donor_type: new_donor_type,
          notes: metaNotes,
        }).select().single();

        if (!donorErr && dbDonor) {
          newDonorDb = dbDonor;
        } else {
          const { data: retryDonor } = await adminClient.from("donors").insert({
            madrasa_id: finalMadrasaId,
            name: new_donor_name,
            phone: new_donor_phone,
            address: new_donor_address,
            donor_type: new_donor_type,
          }).select().single();
          if (retryDonor) newDonorDb = retryDonor;
        }

        if (newDonorDb) {
          donor_id = newDonorDb.id;
          createdDonorObj = {
            id: newDonorDb.id,
            madrasa_id: newDonorDb.madrasa_id,
            name: newDonorDb.name,
            phone: newDonorDb.phone || "",
            email: newDonorDb.email || "",
            address: newDonorDb.address || "",
            donor_type: (newDonorDb.donor_type as any) || new_donor_type,
            pledge_amount: new_donor_pledge,
            notes: "সংগ্রহের সময় অটো-অ্যাড করা হয়েছে",
            created_at: newDonorDb.created_at || new Date().toISOString(),
            total_donated: 0,
            donation_count: 0,
            last_donation_date: "",
          };
        }
      }
    }

    const amount = parseFloat(formData.get("amount") as string);
    const raw_donation_type = (formData.get("donation_type") as string) || "General";
    const fundsList = await getFunds();
    const donation_type = normalizeFundName(raw_donation_type, fundsList);
    const donation_date = (formData.get("donation_date") as string) || new Date().toISOString().split("T")[0];
    const payment_method = (formData.get("payment_method") as string) || "Cash";
    const receipt_no_input = (formData.get("receipt_no") as string)?.trim();
    const userNotes = (formData.get("notes") as string)?.trim() || "";

    if (!amount || isNaN(amount) || amount <= 0) {
      return { error: "অনুগ্রহ করে সঠিক অনুদানের পরিমাণ লিখুন" };
    }

    // Auto generate sequential receipt number if not provided
    const receipt_no = receipt_no_input || (await getNextDonationReceiptNo(finalMadrasaId, "ZR"));

    // Store payment method and walk-in donor details in notes tag if not saved to directory
    let formattedNotes = userNotes;
    if (is_new_donor && new_donor_name && !createdDonorObj) {
      formattedNotes = `[Donor: ${new_donor_name}${new_donor_phone ? `, ${new_donor_phone}` : ""}] ${formattedNotes}`.trim();
    }
    if (payment_method !== "Cash") {
      formattedNotes = `[Method: ${payment_method}] ${formattedNotes}`.trim();
    }

    const { data, error } = await adminClient.from("donations").insert({
      madrasa_id: finalMadrasaId,
      donor_id: donor_id && donor_id !== "" ? donor_id : null,
      amount,
      donation_type,
      donation_date,
      receipt_no,
      notes: formattedNotes,
    }).select().single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/reports");
    revalidatePath("/dashboard/zakat/funds");

    return { 
      success: true, 
      donation: {
        ...data,
        payment_method,
        notes: userNotes,
      },
      createdDonor: createdDonorObj,
      tempDonorName: (is_new_donor && new_donor_name) ? new_donor_name : undefined,
      tempDonorPhone: (is_new_donor && new_donor_phone) ? new_donor_phone : undefined,
      tempDonorAddress: (is_new_donor && new_donor_address) ? new_donor_address : undefined,
      tempDonorType: (is_new_donor && new_donor_type) ? new_donor_type : undefined,
    };
  } catch (err: any) {
    return { error: err.message || "সংগ্রহ সম্পন্ন করতে ব্যর্থ হয়েছে" };
  }
}

export async function deleteDonation(id: string) {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient.from("donations").delete().eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/reports");
    revalidatePath("/dashboard/zakat/funds");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছে ফেলা ব্যর্থ হয়েছে" };
  }
}

// Comprehensive Fund & Zakat Report Statistics
export async function getZakatReportStats() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return null;

    const [funds, donors, donations] = await Promise.all([
      getFunds(),
      getDonors(),
      getDonations(),
    ]);

    // Calculate total collection per fund
    const fundTotals: Record<string, { name: string; total: number; count: number; category: string; color: string }> = {};
    
    funds.forEach(f => {
      fundTotals[f.name] = {
        name: f.name,
        total: f.total_collected || 0,
        count: f.donations_count || 0,
        category: f.category,
        color: f.color || "emerald",
      };
    });

    let grandTotal = 0;
    let monthlyDonorTotal = 0;
    let annualDonorTotal = 0;
    let oneTimeDonorTotal = 0;

    // Normalize donor type string to "Monthly" | "Annual" | "OneTime"
    const normalizeDonorType = (rawType?: string): "Monthly" | "Annual" | "OneTime" => {
      if (!rawType) return "OneTime";
      const upper = rawType.toUpperCase();
      if (upper.includes("MONTH") || upper.includes("মাসিক")) return "Monthly";
      if (upper.includes("ANNUAL") || upper.includes("LIFE") || upper.includes("বাৎসরিক") || upper.includes("আজীবন")) return "Annual";
      return "OneTime";
    };

    // Donor type map
    const donorTypeMap = new Map(donors.map(d => [d.id, normalizeDonorType(d.donor_type)]));

    // Unique donor identifiers per type for donations
    const monthlyDonorSet = new Set<string>();
    const annualDonorSet = new Set<string>();
    const oneTimeDonorSet = new Set<string>();

    donations.forEach((d: any) => {
      const amt = Number(d.amount || 0);
      grandTotal += amt;

      const fType = normalizeFundName(d.donation_type, funds);
      if (!fundTotals[fType]) {
        fundTotals[fType] = {
          name: fType,
          total: 0,
          count: 0,
          category: "Other",
          color: "teal",
        };
      }

      // Group by donor type
      const dtype = d.donor_id ? (donorTypeMap.get(d.donor_id) || "OneTime") : "OneTime";
      const donorKey = d.donor_id || d.receipt_no || d.id;

      if (dtype === "Monthly") {
        monthlyDonorTotal += amt;
        if (donorKey) monthlyDonorSet.add(donorKey);
      } else if (dtype === "Annual") {
        annualDonorTotal += amt;
        if (donorKey) annualDonorSet.add(donorKey);
      } else {
        oneTimeDonorTotal += amt;
        if (donorKey) oneTimeDonorSet.add(donorKey);
      }
    });

    // Calculate donor counts by type combining registered profiles and active transaction donors
    const regMonthly = donors.filter(d => normalizeDonorType(d.donor_type) === "Monthly").length;
    const regAnnual = donors.filter(d => normalizeDonorType(d.donor_type) === "Annual").length;
    const regOneTime = donors.filter(d => normalizeDonorType(d.donor_type) === "OneTime").length;

    const monthlyDonorsCount = Math.max(regMonthly, monthlyDonorSet.size);
    const annualDonorsCount = Math.max(regAnnual, annualDonorSet.size);
    const oneTimeDonorsCount = Math.max(regOneTime, oneTimeDonorSet.size);

    const allUniqueDonorKeys = new Set<string>();
    monthlyDonorSet.forEach(k => allUniqueDonorKeys.add(k));
    annualDonorSet.forEach(k => allUniqueDonorKeys.add(k));
    oneTimeDonorSet.forEach(k => allUniqueDonorKeys.add(k));

    const totalUniqueDonors = Math.max(
      donors.length,
      allUniqueDonorKeys.size
    );

    return {
      grandTotal,
      totalDonors: totalUniqueDonors,
      totalCollectionsCount: donations.length,
      fundBreakdown: Object.values(fundTotals),
      donorTypeStats: {
        monthly: { count: monthlyDonorsCount, collected: monthlyDonorTotal },
        annual: { count: annualDonorsCount, collected: annualDonorTotal },
        oneTime: { count: oneTimeDonorsCount, collected: oneTimeDonorTotal },
      },
      recentDonations: donations.slice(0, 10),
    };
  } catch (err) {
    console.error("Error in getZakatReportStats:", err);
    return null;
  }
}
