"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { DEFAULT_FUNDS, FundItem, DonorItem, DonationItem } from "@/lib/fund-utils";

// In-memory fallback cache for custom funds if database table is not yet created
const customFundsStore: Map<string, FundItem[]> = new Map();

// Helper to get all funds (Defaults + Relational Table zakat_funds + Custom funds)
export async function getFunds(): Promise<FundItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

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
        return [
          ...DEFAULT_FUNDS.filter((df) => !existingCodes.has(df.code) && !existingCodes.has(df.id)),
          ...formatted,
        ];
      }
    } catch {}

    // 2. Check madrasa metadata for custom funds (Fallback)
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
          return [
            ...DEFAULT_FUNDS.filter((f) => !existingIds.has(f.id)),
            ...customList,
          ];
        }
      }
    } catch {}

    // 3. Fallback to in-memory custom funds merged with defaults
    const madrasaCustom = customFundsStore.get(finalMadrasaId) || [];
    return [...DEFAULT_FUNDS, ...madrasaCustom];
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

// Fetch all donors with donation aggregates
export async function getDonors(): Promise<DonorItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const { data: donors, error } = await adminClient
      .from("donors")
      .select("*")
      .eq("madrasa_id", finalMadrasaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching donors:", error);
      return [];
    }

    // Get donations to calculate donor totals
    const { data: donations } = await adminClient
      .from("donations")
      .select("donor_id, amount, donation_date")
      .eq("madrasa_id", finalMadrasaId);

    const donorDonationMap = new Map<string, { total: number; count: number; lastDate: string }>();
    donations?.forEach((d: any) => {
      if (!d.donor_id) return;
      const current = donorDonationMap.get(d.donor_id) || { total: 0, count: 0, lastDate: "" };
      current.total += Number(d.amount || 0);
      current.count += 1;
      if (!current.lastDate || new Date(d.donation_date) > new Date(current.lastDate)) {
        current.lastDate = d.donation_date;
      }
      donorDonationMap.set(d.donor_id, current);
    });

    return (donors || []).map((d: any) => {
      const stats = donorDonationMap.get(d.id) || { total: 0, count: 0, lastDate: "" };
      
      // Parse extra meta stored in notes if JSON
      let pledgeAmount = 0;
      let notesText = d.notes || "";
      if (d.notes && d.notes.startsWith("{")) {
        try {
          const parsed = JSON.parse(d.notes);
          pledgeAmount = parsed.pledge_amount || 0;
          notesText = parsed.notes || "";
        } catch {
          // fallback
        }
      }

      return {
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
      };
    });
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
    const notes = (formData.get("notes") as string)?.trim() || "";

    if (!name) {
      return { error: "দাতার নাম আবশ্যক" };
    }

    // Store notes with metadata safely
    const metaNotes = JSON.stringify({
      pledge_amount,
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

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
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
    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || "";
    const address = (formData.get("address") as string)?.trim() || "";
    const donor_type = (formData.get("donor_type") as string) || "OneTime";
    const pledge_amount = parseFloat(formData.get("pledge_amount") as string) || 0;
    const notes = (formData.get("notes") as string)?.trim() || "";

    const metaNotes = JSON.stringify({
      pledge_amount,
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

    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

export async function deleteDonor(id: string) {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient.from("donors").delete().eq("id", id);
    
    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/reports");
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

    return (data || []).map((d: any, index: number) => {
      // Resolve fund name and fund ID
      let fundName = d.donation_type || "সাধারণ ফান্ড";
      let fundId = "";

      // Try matching fund by type/name
      if (fundNameMap.has(d.donation_type)) {
        const found = fundNameMap.get(d.donation_type)!;
        fundName = found.name;
        fundId = found.id;
      } else if (d.donation_type === "General") {
        fundName = "সাধারণ ফান্ড (General Fund)";
        fundId = "fund-general";
      } else if (d.donation_type === "Lillah") {
        fundName = "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";
        fundId = "fund-lillah";
      } else if (d.donation_type === "Zakat") {
        fundName = "যাকাত ফান্ড (Zakat Fund)";
        fundId = "fund-zakat";
      } else if (d.donation_type === "Fitra") {
        fundName = "ফিতরা ও সদকা ফান্ড (Fitra & Sadaqah)";
        fundId = "fund-fitra";
      }

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

      return {
        id: d.id,
        madrasa_id: d.madrasa_id,
        donor_id: d.donor_id,
        amount: Number(d.amount || 0),
        donation_type: d.donation_type,
        fund_id: fundId,
        fund_name: fundName,
        donation_date: d.donation_date,
        receipt_no: serialReceipt,
        payment_method: paymentMethod,
        notes: cleanNotes,
        created_at: d.created_at,
        donors: d.donors,
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
    const fundNameMap = new Map(funds.map(f => [f.name, f]));
    let fundName = data.donation_type || "সাধারণ ফান্ড";

    if (fundNameMap.has(data.donation_type)) {
      fundName = fundNameMap.get(data.donation_type)!.name;
    } else if (data.donation_type === "General") fundName = "সাধারণ ফান্ড (General Fund)";
    else if (data.donation_type === "Lillah") fundName = "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";
    else if (data.donation_type === "Zakat") fundName = "যাকাত ফান্ড (Zakat Fund)";
    else if (data.donation_type === "Fitra") fundName = "ফিতরা ও সদকা ফান্ড";

    let paymentMethod = "Cash";
    let cleanNotes = data.notes || "";
    if (cleanNotes.includes("[Method:")) {
      const match = cleanNotes.match(/\[Method:\s*([^\]]+)\]/);
      if (match) {
        paymentMethod = match[1];
        cleanNotes = cleanNotes.replace(/\[Method:\s*[^\]]+\]/, "").trim();
      }
    }

    return {
      id: data.id,
      madrasa_id: data.madrasa_id,
      donor_id: data.donor_id,
      amount: Number(data.amount || 0),
      donation_type: data.donation_type,
      fund_name: fundName,
      donation_date: data.donation_date,
      receipt_no: data.receipt_no || `ZR${data.id.substring(0, 6).toUpperCase()}`,
      payment_method: paymentMethod,
      notes: cleanNotes,
      created_at: data.created_at,
      donors: data.donors,
    };
  } catch (err) {
    console.error("Error in getDonationById:", err);
    return null;
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
    const donation_type = (formData.get("donation_type") as string) || "General"; // Selected Fund name or code
    const donation_date = (formData.get("donation_date") as string) || new Date().toISOString().split("T")[0];
    const payment_method = (formData.get("payment_method") as string) || "Cash";
    const receipt_no_input = (formData.get("receipt_no") as string)?.trim();
    const userNotes = (formData.get("notes") as string)?.trim() || "";

    if (!amount || isNaN(amount) || amount <= 0) {
      return { error: "অনুগ্রহ করে সঠিক অনুদানের পরিমাণ লিখুন" };
    }

    // Auto generate receipt number if not provided
    const receipt_no = receipt_no_input || `ZR${Date.now().toString().slice(-6)}`;

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
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const [funds, donors, donationsRes] = await Promise.all([
      getFunds(),
      getDonors(),
      adminClient.from("donations").select("*").eq("madrasa_id", finalMadrasaId)
    ]);

    const donations = donationsRes.data || [];

    // Calculate total collection per fund
    const fundTotals: Record<string, { name: string; total: number; count: number; category: string; color: string }> = {};
    
    funds.forEach(f => {
      fundTotals[f.name] = {
        name: f.name,
        total: 0,
        count: 0,
        category: f.category,
        color: f.color || "emerald",
      };
    });

    let grandTotal = 0;
    let monthlyDonorTotal = 0;
    let annualDonorTotal = 0;
    let oneTimeDonorTotal = 0;

    // Donor type map
    const donorTypeMap = new Map(donors.map(d => [d.id, d.donor_type]));

    donations.forEach((d: any) => {
      const amt = Number(d.amount || 0);
      grandTotal += amt;

      const fType = d.donation_type || "সাধারণ ফান্ড";
      if (!fundTotals[fType]) {
        fundTotals[fType] = {
          name: fType,
          total: 0,
          count: 0,
          category: "Other",
          color: "teal",
        };
      }
      fundTotals[fType].total += amt;
      fundTotals[fType].count += 1;

      // Group by donor type
      const dtype = d.donor_id ? donorTypeMap.get(d.donor_id) : "OneTime";
      if (dtype === "Monthly") monthlyDonorTotal += amt;
      else if (dtype === "Annual") annualDonorTotal += amt;
      else oneTimeDonorTotal += amt;
    });

    // Calculate donor counts by type
    const monthlyDonorsCount = donors.filter(d => d.donor_type === "Monthly").length;
    const annualDonorsCount = donors.filter(d => d.donor_type === "Annual").length;
    const oneTimeDonorsCount = donors.filter(d => d.donor_type === "OneTime").length;

    return {
      grandTotal,
      totalDonors: donors.length,
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
