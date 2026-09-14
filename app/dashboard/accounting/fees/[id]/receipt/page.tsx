import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getFeeWithReceiptNo } from "@/app/actions/accounting";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { notFound } from "next/navigation";
import ReceiptClient from "./ReceiptClient";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const fee = await getFeeWithReceiptNo(resolvedParams.id);

  if (!fee) {
    return notFound();
  }

  const madrasaInfo = await getMadrasaInfo(madrasaId || fee.madrasa_id);

  return <ReceiptClient fee={fee} madrasaInfo={madrasaInfo} />;
}
