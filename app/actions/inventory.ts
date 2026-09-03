"use server";

import { revalidatePath } from "next/cache";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import {
  AssetItem,
  AssetAllocation,
  MaintenanceRecord,
  getDefaultInventorySeed,
  generateAssetCode,
  AssetCategory,
} from "@/lib/inventory";

export interface InventoryMetadata {
  items: AssetItem[];
  allocations: AssetAllocation[];
  maintenance: MaintenanceRecord[];
}

async function getAuthenticatedMadrasaId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return null;
    return await getAuthMadrasaId(supabase, user);
  } catch {
    return null;
  }
}

export async function getInventoryData(): Promise<InventoryMetadata> {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) {
    return { items: [], allocations: [], maintenance: [] };
  }

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory || !meta.inventory.items || meta.inventory.items.length === 0) {
      // Seed default Madrasa inventory items
      const seed = getDefaultInventorySeed(madrasaId);
      meta.inventory = seed;
      await saveMadrasaMetadata(madrasaId, meta);
      return seed;
    }

    return {
      items: meta.inventory.items || [],
      allocations: meta.inventory.allocations || [],
      maintenance: meta.inventory.maintenance || [],
    };
  } catch (error) {
    console.error("Error fetching inventory data:", error);
    return { items: [], allocations: [], maintenance: [] };
  }
}

export async function createAssetItem(data: {
  name: string;
  category: AssetCategory;
  category_name?: string;
  total_qty: number;
  condition?: "EXCELLENT" | "GOOD" | "NEEDS_REPAIR" | "DAMAGED";
  purchase_date?: string;
  purchase_price_per_unit?: number;
  vendor_or_donor?: string;
  voucher_no?: string;
  room_location?: string;
  description?: string;
}) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  if (!data.name || !data.category || data.total_qty <= 0) {
    return { error: "নাম, ক্যাটাগরি এবং সঠিক সংখ্যা আবশ্যক" };
  }

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    meta.inventory = meta.inventory || { items: [], allocations: [], maintenance: [] };

    const assetCode = generateAssetCode(data.category, meta.inventory.items.length + 1);
    const now = new Date().toISOString();
    const totalQty = Number(data.total_qty) || 1;
    const unitPrice = Number(data.purchase_price_per_unit) || 0;

    const newItem: AssetItem = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      asset_code: assetCode,
      name: data.name.trim(),
      category: data.category,
      category_name: data.category_name || "মাদরাসা সম্পদ",
      total_qty: totalQty,
      allocated_qty: 0,
      in_stock_qty: totalQty,
      damaged_qty: 0,
      condition: data.condition || "GOOD",
      purchase_date: data.purchase_date || now.split("T")[0],
      purchase_price_per_unit: unitPrice,
      total_value: totalQty * unitPrice,
      vendor_or_donor: data.vendor_or_donor?.trim() || "",
      voucher_no: data.voucher_no?.trim() || "",
      room_location: data.room_location?.trim() || "প্রধান গুদাম",
      description: data.description?.trim() || "",
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    meta.inventory.items.unshift(newItem);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/inventory");
    return { success: true, item: newItem };
  } catch (error: any) {
    return { error: error.message || "সম্পদ সংরক্ষণ করতে ব্যর্থ হয়েছে" };
  }
}

export async function updateAssetItem(
  id: string,
  data: Partial<AssetItem>
) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.items) return { error: "ইনভেন্টরি ডেটা পাওয়া যায়নি" };

    const index = meta.inventory.items.findIndex((i: AssetItem) => i.id === id);
    if (index === -1) return { error: "সম্পদ পাওয়া যায়নি" };

    const existing = meta.inventory.items[index];
    const totalQty = data.total_qty !== undefined ? Number(data.total_qty) : existing.total_qty;
    const allocatedQty = existing.allocated_qty || 0;

    if (totalQty < allocatedQty) {
      return {
        error: `মোট সংখ্যা ইতিমধ্যে বরাদ্দকৃত (${allocatedQty} টি) সংখ্যার চেয়ে কম হতে পারবে না`,
      };
    }

    meta.inventory.items[index] = {
      ...existing,
      ...data,
      total_qty: totalQty,
      in_stock_qty: totalQty - allocatedQty,
      updated_at: new Date().toISOString(),
    };

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true, item: meta.inventory.items[index] };
  } catch (error: any) {
    return { error: error.message || "আপডেট করতে ব্যর্থ হয়েছে" };
  }
}

export async function deleteAssetItem(id: string) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.items) return { error: "ইনভেন্টরি ডেটা পাওয়া যায়নি" };

    meta.inventory.items = meta.inventory.items.filter((i: AssetItem) => i.id !== id);
    // Also remove allocations for this asset
    if (meta.inventory.allocations) {
      meta.inventory.allocations = meta.inventory.allocations.filter((a: AssetAllocation) => a.asset_id !== id);
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "সম্পদ মুছে ফেলতে ব্যর্থ হয়েছে" };
  }
}

export async function archiveAssetItem(id: string) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.items) return { error: "ইনভেন্টরি ডেটা পাওয়া যায়নি" };

    const item = meta.inventory.items.find((i: AssetItem) => i.id === id);
    if (!item) return { error: "সম্পদ পাওয়া যায়নি" };

    item.is_archived = !item.is_archived;
    item.updated_at = new Date().toISOString();

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true, is_archived: item.is_archived };
  } catch (error: any) {
    return { error: error.message || "আর্কাইভ করতে ব্যর্থ হয়েছে" };
  }
}

export async function allocateAsset(data: {
  asset_id: string;
  location_or_room: string;
  assigned_to_person?: string;
  quantity: number;
  remarks?: string;
}) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.items) return { error: "ইনভেন্টরি ডেটা পাওয়া যায়নি" };

    const item = meta.inventory.items.find((i: AssetItem) => i.id === data.asset_id);
    if (!item) return { error: "সম্পদ নির্বাচন সঠিক নয়" };

    const reqQty = Number(data.quantity) || 1;
    if (reqQty <= 0) return { error: "বরাদ্দ সংখ্যা অবশ্যই ১ বা তার বেশি হতে হবে" };
    if (item.in_stock_qty < reqQty) {
      return { error: `স্টকে পর্যাপ্ত পরিমাণ নেই! বর্তমানে স্টকে আছে: ${item.in_stock_qty} টি` };
    }

    const now = new Date().toISOString();
    const newAllocation: AssetAllocation = {
      id: `alc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      asset_id: item.id,
      asset_name: item.name,
      asset_code: item.asset_code,
      location_or_room: data.location_or_room.trim(),
      assigned_to_person: data.assigned_to_person?.trim() || "",
      quantity: reqQty,
      allocation_date: now.split("T")[0],
      status: "ACTIVE",
      remarks: data.remarks?.trim() || "",
    };

    // Update stock in asset item
    item.allocated_qty += reqQty;
    item.in_stock_qty -= reqQty;
    item.updated_at = now;

    meta.inventory.allocations = meta.inventory.allocations || [];
    meta.inventory.allocations.unshift(newAllocation);

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true, allocation: newAllocation };
  } catch (error: any) {
    return { error: error.message || "বরাদ্দ দিতে ব্যর্থ হয়েছে" };
  }
}

export async function returnAssetAllocation(allocationId: string, returnQty?: number) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.allocations) return { error: "বরাদ্দ তথ্য পাওয়া যায়নি" };

    const alloc = meta.inventory.allocations.find((a: AssetAllocation) => a.id === allocationId);
    if (!alloc) return { error: "বরাদ্দ রেকর্ড পাওয়া যায়নি" };
    if (alloc.status === "RETURNED") return { error: "এই বরাদ্দ আগেই ফেরত নেওয়া হয়েছে" };

    const item = meta.inventory.items?.find((i: AssetItem) => i.id === alloc.asset_id);
    const qtyToReturn = returnQty !== undefined ? Math.min(alloc.quantity, Number(returnQty)) : alloc.quantity;

    if (item) {
      item.allocated_qty = Math.max(0, item.allocated_qty - qtyToReturn);
      item.in_stock_qty += qtyToReturn;
      item.updated_at = new Date().toISOString();
    }

    alloc.status = "RETURNED";
    alloc.return_date = new Date().toISOString().split("T")[0];

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "বরাদ্দ ফেরত নিতে ব্যর্থ হয়েছে" };
  }
}

export async function recordMaintenance(data: {
  asset_id: string;
  maintenance_date: string;
  issue_description: string;
  work_done: string;
  cost: number;
  technician_or_shop: string;
  voucher_no?: string;
  fund_name: string;
  auto_add_to_expense?: boolean;
}) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.items) return { error: "ইনভেন্টরি ডেটা পাওয়া যায়নি" };

    const item = meta.inventory.items.find((i: AssetItem) => i.id === data.asset_id);
    if (!item) return { error: "সম্পদ পাওয়া যায়নি" };

    const now = new Date().toISOString();
    const cost = Number(data.cost) || 0;

    const newRecord: MaintenanceRecord = {
      id: `mnt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      asset_id: item.id,
      asset_name: item.name,
      asset_code: item.asset_code,
      maintenance_date: data.maintenance_date || now.split("T")[0],
      issue_description: data.issue_description.trim(),
      work_done: data.work_done.trim(),
      cost,
      technician_or_shop: data.technician_or_shop.trim(),
      voucher_no: data.voucher_no?.trim() || "",
      fund_name: data.fund_name || "সাধারণ ফান্ড",
      auto_add_to_expense: !!data.auto_add_to_expense,
      created_at: now,
    };

    meta.inventory.maintenance = meta.inventory.maintenance || [];
    meta.inventory.maintenance.unshift(newRecord);

    // If auto_add_to_expense is checked and cost > 0, create an entry in madrasa expenses!
    if (data.auto_add_to_expense && cost > 0) {
      try {
        const supabase = await createClient();
        const fundTag = `[FUND: ${data.fund_name.toLowerCase().includes("উন্নয়ন") ? "fund-building" : "fund-general"} | ${data.fund_name}]`;
        await supabase.from("expenses").insert({
          madrasa_id: madrasaId,
          category: "রক্ষণাবেক্ষণ ও মেরামত",
          amount: cost,
          expense_date: data.maintenance_date,
          description: `${fundTag} ${item.name} (${item.asset_code}) মেরামত: ${data.work_done} - দোকান: ${data.technician_or_shop}`,
        });
      } catch (expErr) {
        console.error("Auto expense error:", expErr);
      }
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/inventory");
    return { success: true, record: newRecord };
  } catch (error: any) {
    return { error: error.message || "রক্ষণাবেক্ষণ খরচ রেকর্ড করতে ব্যর্থ হয়েছে" };
  }
}

export async function deleteMaintenance(id: string) {
  const madrasaId = await getAuthenticatedMadrasaId();
  if (!madrasaId) return { error: "অননুমোদিত অ্যাক্সেস" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.inventory?.maintenance) return { error: "রেকর্ড পাওয়া যায়নি" };

    meta.inventory.maintenance = meta.inventory.maintenance.filter((m: MaintenanceRecord) => m.id !== id);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "রেকর্ড মুছতে ব্যর্থ হয়েছে" };
  }
}
