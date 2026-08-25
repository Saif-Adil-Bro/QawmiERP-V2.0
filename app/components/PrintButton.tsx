"use client";

import { Printer, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

export default function PrintButton({ targetId, fileName = "document.pdf" }: { targetId?: string, fileName?: string }) {
  const [inIframe, setInIframe] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch (e) {
      setInIframe(true);
    }

    if (window.location.search.includes('print=true')) {
      // Auto trigger print when opened via the button
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, []);

  const handlePrint = () => {
    if (inIframe) {
      const url = new URL(window.location.href);
      url.searchParams.set('print', 'true');
      const newWin = window.open(url.toString(), '_blank');
      if (!newWin) {
        // Popup was blocked
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 5000);
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={handlePrint} 
        className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition flex items-center print:hidden"
      >
        {inIframe ? <ExternalLink className="w-4 h-4 mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
        {inIframe ? "প্রিন্ট করতে নতুন ট্যাবে খুলুন" : "প্রিন্ট করুন"}
      </button>
      
      {showMessage && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-amber-100 border border-amber-300 text-amber-900 text-sm p-3 rounded-md shadow-lg z-50 print:hidden text-left">
          <p>পপআপ ব্লক করা আছে! দয়া করে উপরে ডানদিকের <strong>"Open in new tab"</strong> আইকনে ক্লিক করে অ্যাপটি নতুন ট্যাবে খুলুন।</p>
        </div>
      )}
    </div>
  );
}
