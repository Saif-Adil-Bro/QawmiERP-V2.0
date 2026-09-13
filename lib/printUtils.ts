/**
 * Utility for isolated document printing (Money Receipts, Certificates, Invoices, Memos, Reports)
 * Completely eliminates background page, backdrop blur, buttons, and modal dialog borders.
 * Uses isolated invisible iframe with injected stylesheets to prevent blank pages across all browsers.
 */
export function printElementIsolated(elementId: string, pageTitle = "মানি রিসিট ও ভাউচার মেমো") {
  if (typeof window === "undefined") return;

  const targetElem = document.getElementById(elementId);
  if (!targetElem) {
    window.print();
    return;
  }

  try {
    let iframe = document.getElementById("document-print-iframe") as HTMLIFrameElement;
    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement("iframe");
    iframe.id = "document-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all existing stylesheets, link tags and style tags
    const styleTags = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((el) => el.outerHTML)
      .join("\n");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${pageTitle}</title>
        ${styleTags}
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: 'SolaimanLipi', 'Hind Siliguri', 'Amiri', ui-sans-serif, system-ui, sans-serif !important;
          }
          .isolated-print-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .receipt-card {
            border: 1.5px solid #475569 !important;
            border-radius: 8px !important;
            padding: 14px 18px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 6px !important;
          }
          .cut-separator {
            margin: 8px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        <div class="isolated-print-wrapper">
          ${targetElem.outerHTML}
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Give browser time to load styles/images in iframe, then trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Iframe print fallback to window.print:", err);
        window.print();
      }
    }, 300);
  } catch (err) {
    console.error("Print isolated error:", err);
    window.print();
  }
}
