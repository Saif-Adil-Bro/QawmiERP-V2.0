import React from "react";

/**
 * High-Fidelity Official Vector Brand Logos for Bangladeshi Payment Gateways & Mobile Wallets
 */

// 1. Official bKash Logo & Icon
export function BkashIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="bKash"
    >
      <rect width="100" height="100" rx="20" fill="#E2136E" />
      {/* Official bKash Origami Bird Symbol */}
      <path
        d="M50 14L86 38L62 48L78 72L50 56L22 72L38 48L14 38L50 14Z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M50 24L74 40L58 47L68 62L50 51L32 62L42 47L26 40L50 24Z"
        fill="#E2136E"
      />
      <path
        d="M50 32L62 40L54 44L60 52L50 46L40 52L46 44L38 40L50 32Z"
        fill="white"
      />
    </svg>
  );
}

export function BkashBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center gap-1.5 font-sans font-black rounded-xl text-white shadow-2xs ${
        isSm
          ? "px-2 py-0.5 text-[10px] bg-[#E2136E]"
          : isLg
          ? "px-3.5 py-1.5 text-sm bg-[#E2136E]"
          : "px-2.5 py-1 text-xs bg-[#E2136E]"
      }`}
    >
      <BkashIcon className={isSm ? "w-3.5 h-3.5" : isLg ? "w-5 h-5" : "w-4 h-4"} />
      <span>bKash</span>
    </div>
  );
}

// 2. Official Nagad Logo & Icon
export function NagadIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Nagad"
    >
      <rect width="100" height="100" rx="20" fill="#F7931E" />
      {/* Official Nagad Swirl Flow */}
      <circle cx="50" cy="50" r="32" fill="#EA1D25" />
      <path
        d="M48 24C62.3594 24 74 35.6406 74 50C74 64.3594 62.3594 76 48 76C37.6 76 28.6 69.8 24.5 61C26.5 61.6 28.7 62 31 62C42.0457 62 51 53.0457 51 42C51 33.8 46.1 26.8 39 23.8C41.8 23.9 44.9 24 48 24Z"
        fill="white"
      />
      <circle cx="36" cy="40" r="8" fill="#F7931E" />
    </svg>
  );
}

export function NagadBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center gap-1.5 font-sans font-black rounded-xl text-white shadow-2xs ${
        isSm
          ? "px-2 py-0.5 text-[10px] bg-[#EA1D25]"
          : isLg
          ? "px-3.5 py-1.5 text-sm bg-[#EA1D25]"
          : "px-2.5 py-1 text-xs bg-[#EA1D25]"
      }`}
    >
      <NagadIcon className={isSm ? "w-3.5 h-3.5" : isLg ? "w-5 h-5" : "w-4 h-4"} />
      <span>নগদ (Nagad)</span>
    </div>
  );
}

// 3. Official Dutch-Bangla Rocket Logo & Icon
export function RocketIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Rocket"
    >
      <rect width="100" height="100" rx="20" fill="#8C3494" />
      {/* Official Rocket Silhouette Vector */}
      <path
        d="M50 18C44 26 38 42 38 58L26 68L36 70L40 82L48 74H52L60 82L64 70L74 68L62 58C62 42 56 26 50 18Z"
        fill="#8DC63F"
      />
      <circle cx="50" cy="42" r="6" fill="#8C3494" />
    </svg>
  );
}

export function RocketBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center gap-1.5 font-sans font-black rounded-xl text-white shadow-2xs ${
        isSm
          ? "px-2 py-0.5 text-[10px] bg-[#8C3494]"
          : isLg
          ? "px-3.5 py-1.5 text-sm bg-[#8C3494]"
          : "px-2.5 py-1 text-xs bg-[#8C3494]"
      }`}
    >
      <RocketIcon className={isSm ? "w-3.5 h-3.5" : isLg ? "w-5 h-5" : "w-4 h-4"} />
      <span>Rocket</span>
    </div>
  );
}

// 4. Official Islami Bank Bangladesh PLC Logo
export function IslamiBankIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Islami Bank Bangladesh PLC"
    >
      <rect width="100" height="100" rx="20" fill="#006A4E" />
      {/* Official IBBL Traditional Islamic Crescent & Star Symbol */}
      <circle cx="50" cy="50" r="30" stroke="#FDB913" strokeWidth="4" />
      <path
        d="M50 26C36.7 26 26 36.7 26 50C26 63.3 36.7 74 50 74C58.3 74 65.6 69.8 70 63.3C60.5 66.8 49 62.5 45.5 53C43 46 45 38 50 33C42 33 34 39 34 50C34 58.8 41.2 66 50 66C56 66 61 63 64 58C55 58 48 51 48 42C48 35 53 29 60 27C57 26.3 53.5 26 50 26Z"
        fill="#FDB913"
      />
      <polygon
        points="65,36 68,43 75,44 70,49 71,56 65,52 59,56 60,49 55,44 62,43"
        fill="#FDB913"
      />
    </svg>
  );
}

export function IslamiBankBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";
  return (
    <div
      className={`inline-flex items-center gap-1.5 font-sans font-black rounded-xl text-white shadow-2xs ${
        isSm
          ? "px-2 py-0.5 text-[10px] bg-[#006A4E]"
          : isLg
          ? "px-3.5 py-1.5 text-sm bg-[#006A4E]"
          : "px-2.5 py-1 text-xs bg-[#006A4E]"
      }`}
    >
      <IslamiBankIcon className={isSm ? "w-3.5 h-3.5" : isLg ? "w-5 h-5" : "w-4 h-4"} />
      <span>ইসলামী ব্যাংক (IBBL)</span>
    </div>
  );
}

// 5. Official SSLCOMMERZ Logo & Icon
export function SSLCommerzIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SSLCommerz"
    >
      <rect width="100" height="100" rx="20" fill="#0A2540" />
      {/* Secure Shield Vector */}
      <path
        d="M50 18L76 28V46C76 64 64 77 50 82C36 77 24 64 24 46V28L50 18Z"
        fill="#00D4B2"
      />
      <path
        d="M50 24L70 32V46C70 60 61 71 50 75C39 71 30 60 30 46V32L50 24Z"
        fill="#0A2540"
      />
      <path
        d="M44 48L49 53L59 41"
        stroke="#00D4B2"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 6. Visa / Mastercard / Card Icon
export function CardBrandsIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Cards"
    >
      <rect width="100" height="100" rx="20" fill="#1E293B" />
      <circle cx="40" cy="50" r="20" fill="#EB001B" fillOpacity="0.9" />
      <circle cx="60" cy="50" r="20" fill="#F79E1B" fillOpacity="0.9" />
      <path
        d="M50 34.5C54.8 38.3 58 43.8 58 50C58 56.2 54.8 61.7 50 65.5C45.2 61.7 42 56.2 42 50C42 43.8 45.2 38.3 50 34.5Z"
        fill="#FF5F00"
      />
    </svg>
  );
}

// 7. Dynamic Brand Component Selector
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
  const defaultSizeClass =
    className ||
    (size === "sm" ? "w-5 h-5" : size === "lg" ? "w-8 h-8" : "w-6 h-6");

  if (target.includes("bkash") || target.includes("বিকাশ")) {
    return <BkashIcon className={defaultSizeClass} />;
  }
  if (target.includes("nagad") || target.includes("নগদ")) {
    return <NagadIcon className={defaultSizeClass} />;
  }
  if (target.includes("rocket") || target.includes("রকেট")) {
    return <RocketIcon className={defaultSizeClass} />;
  }
  if (
    target.includes("islami") ||
    target.includes("ibbl") ||
    target.includes("ইসলামী ব্যাংক") ||
    target.includes("cellfin")
  ) {
    return <IslamiBankIcon className={defaultSizeClass} />;
  }
  if (target.includes("ssl") || target.includes("sslcommerz")) {
    return <SSLCommerzIcon className={defaultSizeClass} />;
  }
  return <CardBrandsIcon className={defaultSizeClass} />;
}

// 8. Payment Channel Badges Row
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
