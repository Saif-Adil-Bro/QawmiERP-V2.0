import React from "react";
import { ShieldCheck } from "lucide-react";
import { getVerificationAuditData } from "@/app/actions/verification-logs";
import VerificationAuditHubClient from "@/components/verification/VerificationAuditHubClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const metadata = {
  title: "অনলাইন যাচাইকরণ ও সিকিউরিটি লগ | QawmiERP",
  description: "স্টুডেন্ট আইডি কার্ড ও সনদপত্র অনলাইন কিউআর কোড যাচাইকরণের অডিট হিস্ট্রি ও সিকিউরিটি লগ",
};

export default async function VerificationAuditPage() {
  const auditData = await getVerificationAuditData();

  return (
    <PermissionGuard permission="certificate.view">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
              <span>অনলাইন যাচাইকরণ ও সিকিউরিটি লগ হাব</span>
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              কোন আইডি বা সনদপত্র কতবার এবং কখন যাচাই করা হয়েছে তার সার্বিক নিরাপত্তা লগ ও নিরীক্ষা
            </p>
          </div>
        </div>

        <VerificationAuditHubClient initialAuditData={auditData} />
      </div>
    </PermissionGuard>
  );
}
