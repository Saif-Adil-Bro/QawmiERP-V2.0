"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReceiptClient({ fee, madrasaInfo }: { fee: any, madrasaInfo?: any }) {
  const printReceipt = () => {
    window.print();
  };

  const selectedStudent = fee.students;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/accounting/fees"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">মানি রিসিট</h1>
            <p className="text-slate-500 text-sm">রিসিট নং: {fee.receipt_no}</p>
          </div>
        </div>
        <button 
          onClick={printReceipt}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>প্রিন্ট করুন</span>
        </button>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-xl shadow-sm border border-slate-200 max-w-3xl mx-auto" id="receipt-area">
        <div className="text-center mb-8 pb-8 border-b border-slate-200 flex flex-col items-center">
          {madrasaInfo?.logo_url && (
            <img src={madrasaInfo.logo_url} alt="Logo" className="w-20 h-20 object-contain mb-3" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          {madrasaInfo?.name && <h1 className="text-2xl font-bold text-slate-800">{madrasaInfo.name}</h1>}
          {madrasaInfo?.address && <p className="text-slate-600 mb-4">{madrasaInfo.address}</p>}
          <h2 className="text-xl font-bold text-slate-800 mt-2 bg-slate-100 inline-block px-4 py-1.5 rounded-full border border-slate-200">মানি রিসিট</h2>
          <p className="text-slate-500 mt-3">রিসিট নং: <span className="font-mono text-slate-700 font-medium">{fee.receipt_no}</span></p>
        </div>
        
        <div className="grid grid-cols-2 gap-y-6 gap-x-12 text-slate-700">
          <div>
            <p className="text-sm text-slate-500 mb-1">শিক্ষার্থীর নাম</p>
            <p className="font-semibold text-lg">{selectedStudent?.first_name} {selectedStudent?.last_name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">তারিখ</p>
            <p className="font-semibold text-lg">{new Date(fee.payment_date).toLocaleDateString('en-GB')}</p>
          </div>
          
          <div>
            <p className="text-sm text-slate-500 mb-1">জামাত (ক্লাস) ও রোল</p>
            <p className="font-semibold text-lg">{selectedStudent?.class_name || 'N/A'} - রোল: {selectedStudent?.roll_number || 'N/A'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">ফি'র ধরন</p>
            <p className="font-semibold text-lg">
              {fee.fee_type === 'Monthly' ? 'মাসিক বেতন' : fee.fee_type === 'Admission' ? 'ভর্তি ফি' : fee.fee_type === 'Exam' ? 'পরীক্ষার ফি' : 'অন্যান্য'}
            </p>
          </div>

          {(fee.fee_month || fee.fee_year) && (
            <div>
              <p className="text-sm text-slate-500 mb-1">মাস ও বছর</p>
              <p className="font-semibold text-lg">{fee.fee_month || ''} {fee.fee_year || ''}</p>
            </div>
          )}
          
          <div className="col-span-2 mt-6 pt-6 border-t border-slate-200">
            <div className="flex justify-between items-center bg-slate-50 p-6 rounded-lg border border-slate-100">
              <p className="font-bold text-slate-700 text-lg">সর্বমোট পরিমাণ</p>
              <p className="text-3xl font-bold text-slate-900">৳ {Number(fee.amount).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        
        <div className="mt-20 flex justify-between pt-8">
          <div className="text-center">
            <div className="w-40 border-t-2 border-slate-300 mx-auto"></div>
            <p className="text-sm text-slate-500 mt-3 font-medium">প্রদানকারীর স্বাক্ষর</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-t-2 border-slate-300 mx-auto"></div>
            <p className="text-sm text-slate-500 mt-3 font-medium">গ্রহণকারীর স্বাক্ষর</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-area, #receipt-area * {
            visibility: visible;
          }
          #receipt-area {
            position: absolute;
            left: 50%;
            top: 20px;
            transform: translateX(-50%);
            width: 100%;
            max-width: 800px;
            border: none !important;
            box-shadow: none !important;
            margin: 0;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
}
