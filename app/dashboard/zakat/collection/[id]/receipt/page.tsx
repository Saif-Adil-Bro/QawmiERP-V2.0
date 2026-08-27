import React from "react";
import { notFound } from "next/navigation";
import { getDonationById } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import DonationReceipt from "@/components/zakat/DonationReceipt";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DonationReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [donation, madrasaInfo] = await Promise.all([
    getDonationById(id),
    getMadrasaInfo(),
  ]);

  if (!donation) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/zakat/collection"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>কালেকশন তালিকায় ফিরে যান</span>
        </Link>
      </div>

      <DonationReceipt
        donation={donation}
        madrasaInfo={madrasaInfo}
        showControls={true}
      />
    </div>
  );
}
