"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";

export async function addNotice(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const target_audience = formData.get("target_audience") as string;

  const { error } = await supabase.from("notices").insert({
    madrasa_id: finalMadrasaId,
    title,
    content,
    target_audience,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/communication/notices");
}

export async function deleteNotice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);
  
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/communication/notices");
}

export async function sendSMS(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const recipient_name = formData.get("recipient_name") as string;
  const recipient_phone = formData.get("recipient_phone") as string;
  const message = formData.get("message") as string;
  const message_type = formData.get("message_type") as string;

  // Simulate sending SMS by just logging it into the database
  const { error } = await supabase.from("sms_logs").insert({
    madrasa_id: finalMadrasaId,
    recipient_name,
    recipient_phone,
    message,
    message_type,
    status: 'Sent', // Simulating successful send
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/communication/sms");
  revalidatePath("/dashboard/communication/logs");
}
