import { NextResponse } from "next/server";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import sharp from "sharp";

// Default fallback SVG Favicon (Edge-to-edge Islamic Madrasa Emblem)
const DEFAULT_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#064e3b" />
    </linearGradient>
  </defs>
  <!-- Full edge-to-edge circle (no gap) -->
  <circle cx="32" cy="32" r="32" fill="url(#grad)" />
  <circle cx="32" cy="32" r="29.5" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.85"/>
  <!-- Islamic Dome / Arch -->
  <path d="M32 9 C22 19, 19 29, 19 39 L45 39 C45 29, 42 19, 32 9 Z" fill="#ffffff" opacity="0.95"/>
  <!-- Crescent Star -->
  <path d="M32 14 C34.5 14, 36 12, 36 9.5 C33.5 10, 31 11.5, 32 14 Z" fill="#fbbf24"/>
  <!-- Open Quran / Book -->
  <path d="M16 43 C23 40, 28 44, 32 46 C36 44, 41 40, 48 43 L48 53 C41 50, 36 54, 32 56 C28 54, 23 50, 16 53 Z" fill="#fbbf24"/>
  <path d="M32 46 L32 56" stroke="#064e3b" stroke-width="1.5"/>
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
          const rawBuffer = Buffer.from(await response.arrayBuffer());

          // Process with sharp:
          // 1. Trim outer padding (removes any margin/gap around the logo)
          // 2. Resize to 256x256 square with cover fit (edge-to-edge full bleed)
          // 3. Composite with circular mask so transparent corners outside the circle match any background/browser
          let processedBuffer: Buffer;
          try {
            const trimmed = await sharp(rawBuffer)
              .trim({ threshold: 15 })
              .resize(256, 256, { fit: "cover" })
              .toBuffer();

            const circleMask = await sharp(
              Buffer.from(
                '<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff" /></svg>'
              )
            )
              .resize(256, 256)
              .png()
              .toBuffer();

            processedBuffer = await sharp(trimmed)
              .composite([{ input: circleMask, blend: "dest-in" }])
              .png({ quality: 95 })
              .toBuffer();
          } catch (sharpErr) {
            console.warn("Sharp favicon crop fallback:", sharpErr);
            processedBuffer = await sharp(rawBuffer)
              .resize(256, 256, { fit: "cover" })
              .png()
              .toBuffer();
          }

          return new NextResponse(new Uint8Array(processedBuffer), {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
            },
          });
        }
      } catch (fetchErr) {
        console.warn("Failed to stream madrasa logo image for favicon:", fetchErr);
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
