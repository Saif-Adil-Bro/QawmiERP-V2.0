"use client";

import { useEffect } from "react";

function applyFaviconToDocument(url: string) {
  if (!url || typeof document === "undefined") return;

  const linkTypes = [
    { rel: "icon" },
    { rel: "shortcut icon" },
    { rel: "apple-touch-icon" },
  ];

  linkTypes.forEach(({ rel }) => {
    let link = document.querySelector(`link[rel*='${rel}']`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = url;
  });
}

export default function DynamicFavicon() {
  useEffect(() => {
    // 1. Initial Load: Fetch current madrasa info to get real logo URL
    fetch("/api/madrasa-info")
      .then((res) => res.json())
      .then((data) => {
        if (data?.logo_url) {
          applyFaviconToDocument(data.logo_url);
        } else {
          applyFaviconToDocument("/api/favicon");
        }
      })
      .catch(() => {
        applyFaviconToDocument("/api/favicon");
      });

    // 2. Real-time Logo Update Listener (from Settings or Image Uploader)
    const handleLogoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ logoUrl?: string }>;
      if (customEvent?.detail?.logoUrl) {
        applyFaviconToDocument(customEvent.detail.logoUrl);
      }
    };

    window.addEventListener("madrasa-logo-updated", handleLogoUpdate);

    return () => {
      window.removeEventListener("madrasa-logo-updated", handleLogoUpdate);
    };
  }, []);

  return null;
}
