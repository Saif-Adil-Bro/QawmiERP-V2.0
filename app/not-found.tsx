import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-800 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
        <h2 className="text-4xl font-extrabold text-slate-900 mb-2">৪০৪</h2>
        <h3 className="text-lg font-bold text-slate-800 mb-2">পেজটি পাওয়া যায়নি</h3>
        <p className="text-sm text-slate-600 mb-6">
          আপনি যে পেজটি খুঁজছেন তা স্থানান্তরিত হয়েছে অথবা বিদ্যমান নেই।
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition"
        >
          ড্যাশবোর্ডে ফিরে যান
        </Link>
      </div>
    </div>
  );
}
