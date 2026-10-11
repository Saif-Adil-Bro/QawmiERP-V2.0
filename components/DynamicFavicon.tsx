"use client";

import { useEffect } from "react";

function applyFaviconToDocument(url: string) {
  if (!url || typeof document === "undefined") return;

  const linkTypes = [
    { rel: "icon", type: "image/png", sizes: "32x32" },
    { rel: "icon", type: "image/png", sizes: "192x192" },
    { rel: "icon", type: "image/png", sizes: "512x512" },
    { rel: "shortcut icon", type: "image/png" },
    { rel: "apple-touch-icon", sizes: "180x180" },
  ];

  linkTypes.forEach(({ rel, type, sizes }) => {
    let selector = `link[rel='${rel}']`;
    if (sizes) selector += `[sizes='${sizes}']`;
    let link = document.querySelector(selector) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      if (type) link.type = type;
      if (sizes) link.setAttribute("sizes", sizes);
      document.head.appendChild(link);
    }
    link.href = url;
  });
}

export default function DynamicFavicon() {
  useEffect(() => {
    // 1. Initial Load: Fetch current madrasa info to get real logo URL & ensure 100% full-circle favicon
    fetch("/api/madrasa-info")
      .then((res) => res.json())
      .then((data) => {
        const faviconUrl = `/api/favicon?v=${data?.logo_url ? encodeURIComponent(data.logo_url) : "default"}`;
        applyFaviconToDocument(faviconUrl);
      })
      .catch(() => {
        applyFaviconToDocument("/api/favicon");
      });

    // 2. Real-time Logo Update Listener (from Settings or Image Uploader)
    const handleLogoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ logoUrl?: string }>;
      const nextUrl = customEvent?.detail?.logoUrl 
        ? `/api/favicon?v=${encodeURIComponent(customEvent.detail.logoUrl)}&t=${Date.now()}`
        : `/api/favicon?t=${Date.now()}`;
      applyFaviconToDocument(nextUrl);
    };

    window.addEventListener("madrasa-logo-updated", handleLogoUpdate);

    return () => {
      window.removeEventListener("madrasa-logo-updated", handleLogoUpdate);
    };
  }, []);

  return null;
}

