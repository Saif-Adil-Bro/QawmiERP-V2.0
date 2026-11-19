import React from "react";
import { getApprovalRequests, getApprovalWorkflows } from "@/app/actions/approvals";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import ApprovalsClient from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const [user, { workflows }, requests] = await Promise.all([
    getAuthUser(supabase),
    getApprovalWorkflows(),
    getApprovalRequests(),
  ]);

  return (
    <ApprovalsClient
      initialWorkflows={workflows}
      initialRequests={requests}
      currentUserId={user?.id || null}
    />
  );
}
