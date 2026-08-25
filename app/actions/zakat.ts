"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";

export async function addDonor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const donor_type = formData.get("donor_type") as string;

  const { error } = await supabase.from("donors").insert({
    madrasa_id: finalMadrasaId,
    name,
    phone,
    address,
    donor_type,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/zakat/donors");
}

export async function deleteDonor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("donors").delete().eq("id", id);
  
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/zakat/donors");
}

export async function addDonation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const donor_id = formData.get("donor_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const donation_type = formData.get("donation_type") as string;
  const donation_date = formData.get("donation_date") as string;
  const receipt_no = formData.get("receipt_no") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("donations").insert({
    madrasa_id: finalMadrasaId,
    donor_id: donor_id || null,
    amount,
    donation_type,
    donation_date,
    receipt_no,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/zakat/collection");
}

export async function deleteDonation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("donations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/zakat/collection");
}
