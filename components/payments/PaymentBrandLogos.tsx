import React from "react";

/**
 * Official Brand Badges and Typography Blocks with Authentic Corporate Colors
 * - বিকাশ (bKash): #E2136E
 * - নগদ (Nagad): #EA1D25 (Red-Orange gradient)
 * - ইসলামী ব্যাংক (Islami Bank Bangladesh PLC): #006A4E (Islamic Green)
 * - রকেট (Rocket): #8C3494 (Purple)
 * - সেলফিন (CellFin): #008060 (Teal Green)
 * - কার্ড / অন্যান্য (Cards / Other): #0F172A (Deep Navy)
 */

// 1. বিকাশ (bKash) Badge & Symbol
export function BkashIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-[#E2136E] rounded-xl select-none tracking-tight shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-14 h-7"
      }`}
    >
      <span>বিকাশ</span>
    </div>
  );
}

export function BkashBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl text-white bg-[#E2136E] shadow-2xs select-none transition ${
        isSm
          ? "px-2 py-0.5 text-[11px] font-bold leading-tight"
          : isLg
          ? "px-4 py-2 text-base font-extrabold"
          : "px-3 py-1 text-xs font-bold"
      }`}
    >
      <span>বিকাশ</span>
    </div>
  );
}

// 2. নগদ (Nagad) Badge & Symbol
export function NagadIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-gradient-to-r from-[#EA1D25] to-[#F7931E] rounded-xl select-none tracking-tight shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-14 h-7"
      }`}
    >
      <span>নগদ</span>
    </div>
  );
}

export function NagadBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl text-white bg-gradient-to-r from-[#EA1D25] to-[#F7931E] shadow-2xs select-none transition ${
        isSm
          ? "px-2 py-0.5 text-[11px] font-bold leading-tight"
          : isLg
          ? "px-4 py-2 text-base font-extrabold"
          : "px-3 py-1 text-xs font-bold"
      }`}
    >
      <span>নগদ</span>
    </div>
  );
}

// 3. রকেট (Rocket) Badge & Symbol
export function RocketIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-[#8C3494] rounded-xl select-none tracking-tight shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-14 h-7"
      }`}
    >
      <span>রকেট</span>
    </div>
  );
}

export function RocketBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl text-white bg-[#8C3494] shadow-2xs select-none transition ${
        isSm
          ? "px-2 py-0.5 text-[11px] font-bold leading-tight"
          : isLg
          ? "px-4 py-2 text-base font-extrabold"
          : "px-3 py-1 text-xs font-bold"
      }`}
    >
      <span>রকেট</span>
    </div>
  );
}

// 4. ইসলামী ব্যাংক (Islami Bank Bangladesh PLC) Badge & Symbol
export function IslamiBankIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-[#006A4E] rounded-xl select-none tracking-tight border border-emerald-400/20 shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-24 h-7"
      }`}
    >
      <span>ইসলামী ব্যাংক</span>
    </div>
  );
}

export function IslamiBankBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl text-white bg-[#006A4E] border border-emerald-400/20 shadow-2xs select-none transition ${
        isSm
          ? "px-2 py-0.5 text-[10px] font-bold leading-tight"
          : isLg
          ? "px-4 py-2 text-base font-extrabold"
          : "px-3 py-1 text-xs font-bold"
      }`}
    >
      <span>ইসলামী ব্যাংক</span>
    </div>
  );
}

// 5. সেলফিন (CellFin) Badge & Symbol
export function CellfinBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl text-white bg-[#008060] shadow-2xs select-none transition ${
        isSm
          ? "px-2 py-0.5 text-[10px] font-bold leading-tight"
          : isLg
          ? "px-4 py-2 text-base font-extrabold"
          : "px-3 py-1 text-xs font-bold"
      }`}
    >
      <span>সেলফিন</span>
    </div>
  );
}

// 6. কার্ড / ভিসা / মাস্টারকার্ড (Cards / Other)
export function CardBrandsIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-[#0F172A] rounded-xl select-none tracking-tight shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-16 h-7"
      }`}
    >
      <span>কার্ড / ব্যাংক</span>
    </div>
  );
}

// 7. SSLCommerz Icon / Badge
export function SSLCommerzIcon({ className }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-[#0A2540] rounded-xl select-none tracking-tight border border-cyan-400/30 shadow-2xs ${
        className || "px-2.5 py-1 text-xs min-w-20 h-7"
      }`}
    >
      <span>SSLCommerz</span>
    </div>
  );
}

// 8. Dynamic Brand Component Selector
export function PaymentBrandSymbol({
  channel,
  brand,
  size = "md",
  className,
}: {
  channel?: string;
  brand?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const target = (brand || channel || "").toLowerCase();

  if (target.includes("bkash") || target.includes("বিকাশ")) {
    return <BkashBadge size={size} />;
  }
  if (target.includes("nagad") || target.includes("নগদ")) {
    return <NagadBadge size={size} />;
  }
  if (target.includes("rocket") || target.includes("রকেট")) {
    return <RocketBadge size={size} />;
  }
  if (
    target.includes("islami") ||
    target.includes("ibbl") ||
    target.includes("ইসলামী ব্যাংক")
  ) {
    return <IslamiBankBadge size={size} />;
  }
  if (target.includes("cellfin") || target.includes("সেলফিন")) {
    return <CellfinBadge size={size} />;
  }
  if (target.includes("ssl") || target.includes("sslcommerz")) {
    return (
      <div className="inline-flex items-center justify-center font-black rounded-xl text-white bg-[#0A2540] px-2.5 py-1 text-xs shadow-2xs">
        SSLCommerz
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center font-bold rounded-xl text-white bg-[#0F172A] px-2.5 py-1 text-xs shadow-2xs">
      কার্ড / ব্যাংক
    </div>
  );
}

// 9. Payment Channel Badges Row
export function PaymentChannelBadgesRow({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <BkashBadge size={size} />
      <NagadBadge size={size} />
      <RocketBadge size={size} />
      <IslamiBankBadge size={size} />
    </div>
  );
}
