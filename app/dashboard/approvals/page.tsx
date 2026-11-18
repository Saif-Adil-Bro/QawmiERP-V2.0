import React from "react";
import { getApprovalRequests, getApprovalWorkflows } from "@/app/actions/approvals";
import ApprovalsClient from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [{ workflows }, requests] = await Promise.all([
    getApprovalWorkflows(),
    getApprovalRequests(),
  ]);

  return <ApprovalsClient initialWorkflows={workflows} initialRequests={requests} />;
}
