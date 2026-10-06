/**
 * Utility for isolated document printing (Money Receipts, Certificates, Invoices, Memos, Reports)
 * Completely eliminates background page, backdrop blur, buttons, and modal dialog borders.
 * Uses isolated invisible iframe with injected stylesheets to prevent blank pages across all browsers.
 */
export function printElementIsolated(
  elementId: string,
  pageTitle = "মানি রিসিট ও ভাউচার মেমো",
  orientation: "portrait" | "landscape" = "portrait",
  pageSize: "A4" | "Letter" | "auto" = "auto"
) {
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

    const pageSizeDeclaration =
      pageSize !== "auto"
        ? `size: ${pageSize} ${orientation};`
        : `size: auto;`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${pageTitle}</title>
        ${styleTags}
        <style>
          @font-face {
            font-family: 'SolaimanLipi';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: local('SolaimanLipi'), local('Solaiman Lipi'),
                 url('/fonts/solaimanlipi.ttf') format('truetype');
          }
          @font-face {
            font-family: 'SolaimanLipi';
            font-style: normal;
            font-weight: 700;
            font-display: swap;
            src: local('SolaimanLipi Bold'), local('SolaimanLipi-Bold'),
                 url('/fonts/solaimanlipi_bold.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Amiri';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: local('Amiri'),
                 url('/fonts/amiri_regular.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Amiri';
            font-style: normal;
            font-weight: 700;
            font-display: swap;
            src: local('Amiri Bold'),
                 url('/fonts/amiri_regular.ttf') format('truetype');
          }
          @page {
            ${pageSizeDeclaration}
            margin: 4mm 5mm;
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
          .arabic-text, .bismillah {
            font-family: 'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif !important;
            direction: rtl;
          }
          .isolated-print-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .receipt-card {
            border: 1.2px solid #475569 !important;
            border-radius: 6px !important;
            padding: 10px 14px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 2px !important;
          }
          .cut-separator {
            margin: 4px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Admission Form Print Specific Styles */
          .admission-print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            color: #0f172a !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: 276mm !important;
            min-height: 276mm !important;
            max-height: 276mm !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .admission-print-container.is-letter {
            height: 260mm !important;
            min-height: 260mm !important;
            max-height: 260mm !important;
          }
          .admission-card-block {
            border: 1px solid #475569 !important;
            border-radius: 4px !important;
            overflow: hidden !important;
            background: #ffffff !important;
            margin-bottom: 4px !important;
          }
          .admission-card-title {
            background-color: #ecfdf5 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            padding: 2.5px 8px !important;
            font-weight: 700 !important;
            font-size: 11px !important;
            color: #064e3b !important;
          }
          .admission-card-body {
            padding: 5px 8px !important;
          }
          .admission-dotted-line {
            border-bottom: 1px dotted #475569 !important;
            min-height: 16px !important;
            display: inline-block !important;
            flex: 1 !important;
          }

          @media print {
            .page-break-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
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
