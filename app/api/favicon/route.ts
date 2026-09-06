import { NextResponse } from "next/server";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

// Default fallback SVG Favicon (Elegant Islamic Madrasa Crescent & Book Motif)
const DEFAULT_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#064e3b" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#grad)" />
  <circle cx="32" cy="32" r="24" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>
  <!-- Islamic Dome / Arch -->
  <path d="M32 12 C24 20, 22 28, 22 36 L42 36 C42 28, 40 20, 32 12 Z" fill="#ffffff" opacity="0.95"/>
  <!-- Crescent Star -->
  <path d="M32 17 C34 17, 35 15, 35 13 C33 13.5, 31 15, 32 17 Z" fill="#fbbf24"/>
  <!-- Open Quran / Book -->
  <path d="M20 40 C26 38, 30 41, 32 43 C34 41, 38 38, 44 40 L44 49 C38 47, 34 50, 32 52 C30 50, 26 47, 20 49 Z" fill="#fbbf24"/>
  <path d="M32 43 L32 52" stroke="#064e3b" stroke-width="1.5"/>
</svg>`;

export async function GET() {
  try {
    const madrasa = await getMadrasaInfo();

    if (madrasa?.logo_url && madrasa.logo_url.startsWith("http")) {
      try {
        const response = await fetch(madrasa.logo_url, {
          next: { revalidate: 3600 },
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "image/png";
          const arrayBuffer = await response.arrayBuffer();

          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
            },
          });
        }
      } catch (fetchErr) {
        console.warn("Failed to stream madrasa logo image for favicon, falling back to redirect or SVG:", fetchErr);
        // Fallback: Redirect directly to logo URL
        return NextResponse.redirect(madrasa.logo_url);
      }
    }

    // Default Fallback Favicon
    return new NextResponse(DEFAULT_FAVICON_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generating madrasa favicon:", error);
    return new NextResponse(DEFAULT_FAVICON_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
}
