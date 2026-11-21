import { redirect } from "next/navigation";
import React from "react";
import { getOnlinePaymentHistory } from "@/app/actions/payment-gateway";
import { getFullPaymentGatewayConfig, gatewayManagerIdentity } from "@/lib/payment-gateway-config";
import GatewaySettingsClient from "./GatewaySettingsClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GatewaySettingsPage() {
  const i = await gatewayManagerIdentity();
  if (!i) redirect("/dashboard");
  const config = await getFullPaymentGatewayConfig(i.tenant);
  const transactions = await getOnlinePaymentHistory(50);

  // Get a sample student for the "Test Gateway" button
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name")
    .eq("madrasa_id", i.tenant)
    .limit(1)
    .single();

  const sampleStudent = student
    ? {
        id: student.id,
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        roll: student.roll_number ? String(student.roll_number) : "—",
        className: student.class_name || "—",
      }
    : undefined;

  return (
    <PermissionGuard permission="finance.manage">
      <GatewaySettingsClient
        initialConfig={config}
        recentTransactions={transactions}
        sampleStudent={sampleStudent}
      />
    </PermissionGuard>
  );
}
