import MakhrajAudioGuide from "@/components/audio/MakhrajAudioGuide";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "নূরানী কায়দা ও ১৭ মাখরাজ অডিও গাইড | প্যারেন্ট পোর্টাল",
  description: "অভিভাবকদের জন্য নূরানী কায়দা ও ১৭টি মাখরাজের সঠিক উচ্চারণ ও অডিও গাইড।",
};

export default function ParentTajweedPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <MakhrajAudioGuide />
    </div>
  );
}
