import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMahfilById } from "@/app/actions/fundraising";
import MahfilDetailClient from "./MahfilDetailClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MahfilDetailPage({ params }: Props) {
  const { id } = await params;
  const mahfil = await getMahfilById(id);

  if (!mahfil) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <MahfilDetailClient mahfil={mahfil} />
    </Suspense>
  );
}
