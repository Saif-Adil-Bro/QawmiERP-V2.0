/**
 * Utility for isolated document printing (Money Receipts, Certificates, Invoices, Memos, Reports)
 * Completely eliminates background page, backdrop blur, buttons, and modal dialog borders.
 */
export function printElementIsolated(elementId: string, pageTitle?: string) {
  if (typeof window === "undefined") return;

  const targetElem = document.getElementById(elementId);
  if (!targetElem) {
    window.print();
    return;
  }

  // Remove existing temp frame if any
  const existingFrame = document.getElementById("temp-print-frame");
  if (existingFrame) {
    existingFrame.remove();
  }

  // Clone target element
  const clone = targetElem.cloneNode(true) as HTMLElement;
  clone.id = "temp-print-frame";

  // Clean shadow/fixed styles from clone
  clone.classList.remove("shadow-2xl", "shadow-xl", "shadow-lg", "shadow-md", "shadow-sm", "shadow-xs");
  clone.style.boxShadow = "none";

  // Attach to body
  document.body.appendChild(clone);
  document.body.classList.add("is-printing-now");

  const originalTitle = document.title;
  if (pageTitle) {
    document.title = pageTitle;
  }

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove("is-printing-now");
      const temp = document.getElementById("temp-print-frame");
      if (temp) {
        temp.remove();
      }
      document.title = originalTitle;
    }, 700);
  }, 150);
}
