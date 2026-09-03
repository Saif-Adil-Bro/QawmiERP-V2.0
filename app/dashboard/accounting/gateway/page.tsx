import React from "react";
import {
  getPaymentGatewayConfig,
  getOnlinePaymentHistory,
} from "@/app/actions/payment-gateway";
import GatewaySettingsClient from "./GatewaySettingsClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GatewaySettingsPage() {
  const config = await getPaymentGatewayConfig();
  const transactions = await getOnlinePaymentHistory(50);

  // Get a sample student for the "Test Gateway" button
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name")
    .limit(1)
    .single();

  const sampleStudent = student
    ? {
        id: student.id,
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        roll: student.roll_number ? String(student.roll_number) : "১",
        className: student.class_name || "হিফজ বিভাগ",
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
