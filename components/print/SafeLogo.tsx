"use client";

import React, { useState, useEffect, useRef } from "react";

interface SafeLogoProps {
  src?: string | null;
  alt?: string;
  madrasaName?: string;
  prefix?: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a madrasa logo image with an immediate fallback to an institutional
 * monogram badge whenever the image URL is empty, fails to load (400/404),
 * or completes with naturalWidth === 0 (broken bucket object).
 */
export default function SafeLogo({
  src,
  alt = "Madrasa Logo",
  madrasaName = "মাদরাসা",
  prefix,
  className = "w-full h-full object-cover rounded-full",
  fallbackClassName = "w-full h-full rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-black",
}: SafeLogoProps) {
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setHasError(true);
    }
  }, [src]);

  const cleanSrc = typeof src === "string" ? src.trim() : "";
  const monogram =
    (prefix && prefix.trim().slice(0, 2).toUpperCase()) ||
    (madrasaName && madrasaName.trim().slice(0, 1)) ||
    "ম";

  if (!cleanSrc || hasError) {
    return (
      <div className={fallbackClassName} aria-label={alt}>
        <span className="select-none">{monogram}</span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={cleanSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      onLoad={(e) => {
        const target = e.currentTarget;
        if (target.naturalWidth === 0) {
          setHasError(true);
        }
      }}
    />
  );
}
