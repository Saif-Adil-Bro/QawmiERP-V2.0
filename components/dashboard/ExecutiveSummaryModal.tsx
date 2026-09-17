"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  Printer,
  Calendar,
  Building,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Scale,
  Award,
  Download,
  Loader2,
  FileText,
  DollarSign,
  ShieldCheck,
  Coins,
  Receipt,
  GraduationCap,
} from "lucide-react";
import { getMonthlyExecutiveSummary, MonthlyExecutiveSummaryData } from "@/app/actions/executive-summary";

export function ExecutiveSummaryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<MonthlyExecutiveSummaryData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [isPending, startTransition] = useTransition();

  const loadData = (month: string) => {
    startTransition(async () => {
      try {
        const res = await getMonthlyExecutiveSummary(month);
        setData(res);
      } catch (err) {
        console.error("Failed to load executive summary:", err);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadData(selectedMonth);
    }
  }, [isOpen, selectedMonth]);

  // Dedicated Print Function that outputs a 100% clean, official A4 Memo document
  const handlePrint = () => {
    if (!data) return;

    // 1. Try iframe-based isolated print for zero-shell interference
    try {
      const printIframe = document.createElement("iframe");
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "0";
      document.body.appendChild(printIframe);

      const m = data.metrics;
      const totalFundsIncome = data.fundsBreakdown.reduce((s, f) => s + f.income, 0);
      const totalFundsExpense = data.fundsBreakdown.reduce((s, f) => s + f.expense, 0);
      const totalFundsBalance = data.fundsBreakdown.reduce((s, f) => s + f.balance, 0);
      const totalFundsReserve = data.fundsBreakdown.reduce((s, f) => s + f.totalReserve, 0);

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="utf-8" />
          <title>${data.madrasaInfo.name} - মাসিক নির্বাহী সামারি (${data.monthNameBn})</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap');

            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.45;
              -webkit-font-smoothing: antialiased;
            }
            .memo-container {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #0f172a;
              padding: 16px 20px;
              border-radius: 6px;
            }
            .arabic-bismillah {
              text-align: center;
              font-size: 20px;
              font-weight: 700;
              font-family: 'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', 'Traditional Arabic', serif;
              margin-bottom: 4px;
              color: #15803d;
              direction: rtl;
              letter-spacing: 0.5px;
            }
            .header-title {
              text-align: center;
              font-size: 22px;
              font-weight: 700;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
              margin: 0;
              color: #0f172a;
              letter-spacing: -0.2px;
            }
            .header-sub {
              text-align: center;
              font-size: 11px;
              color: #475569;
              margin: 2px 0 8px 0;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            .badge-bar {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 5px 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: 600;
              font-size: 12px;
              margin-bottom: 12px;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .kpi-box {
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              padding: 6px 8px;
              border-radius: 4px;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            .kpi-title {
              font-size: 10px;
              color: #64748b;
              font-weight: 600;
              margin: 0 0 2px 0;
            }
            .kpi-value {
              font-size: 15px;
              font-weight: 700;
              margin: 0;
              color: #0f172a;
            }
            .kpi-sub {
              font-size: 9px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .section-title {
              font-size: 12px;
              font-weight: 700;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
              background: #0f172a;
              color: #ffffff;
              padding: 4px 8px;
              border-radius: 3px;
              margin: 10px 0 6px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 11px;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 5px 6px;
              text-align: left;
            }
            th {
              background: #f1f5f9;
              font-weight: 700;
              color: #1e293b;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .font-bold {
              font-weight: 700;
            }
            .text-green {
              color: #166534;
            }
            .text-red {
              color: #991b1b;
            }
            .academic-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 12px;
            }
            .academic-card {
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 6px 8px;
              background: #ffffff;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            .signatures-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-top: 24px;
              text-align: center;
              font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
            }
            .sig-line {
              border-top: 1px solid #0f172a;
              padding-top: 3px;
              font-size: 10px;
              font-weight: 700;
            }
            .sig-sub {
              font-size: 8px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="memo-container">
            <div class="arabic-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            <h1 class="header-title">${data.madrasaInfo.name}</h1>
            <div class="header-sub">
              ${data.madrasaInfo.address} | ফোন: ${data.madrasaInfo.phone} | রেজি: ${data.madrasaInfo.regNo}
            </div>

            <div class="badge-bar">
              <span>📋 মাসিক সার্বিক প্রশাসনিক, শিক্ষা ও আর্থিক নির্বাহী পর্যালোচনা</span>
              <span>মাস: ${data.monthNameBn} | মুদ্রণ: ${data.generatedAt}</span>
            </div>

            <!-- 4 Main Institutional Metrics -->
            <div class="kpi-grid">
              <div class="kpi-box">
                <div class="kpi-title">মোট শিক্ষার্থী ও শিক্ষক</div>
                <div class="kpi-value">${m.totalStudents} ছাত্র</div>
                <div class="kpi-sub">উস্তাদ: ${m.totalTeachers} জন | জামাত: ${m.activeClasses}টি</div>
              </div>

              <div class="kpi-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                <div class="kpi-title" style="color:#166534;">চলতি মাসের মোট আয়</div>
                <div class="kpi-value" style="color:#15803d;">৳ ${m.totalIncome.toLocaleString("en-IN")}</div>
                <div class="kpi-sub">ফি: ৳${m.feeCollection.toLocaleString("en-IN")} | অনুদান: ৳${(m.generalDonations + m.zakatCollection).toLocaleString("en-IN")}</div>
              </div>

              <div class="kpi-box" style="background:#fef2f2; border-color:#fecaca;">
                <div class="kpi-title" style="color:#991b1b;">চলতি মাসের মোট ব্যয়</div>
                <div class="kpi-value" style="color:#dc2626;">৳ ${m.totalExpense.toLocaleString("en-IN")}</div>
                <div class="kpi-sub">মেস বাজার: ৳${m.boardingBazarExpense.toLocaleString("en-IN")} | সাধারণ: ৳${m.generalExpenses.toLocaleString("en-IN")}</div>
              </div>

              <div class="kpi-box" style="background:${m.netBalance >= 0 ? '#eff6ff' : '#fffbeb'}; border-color:${m.netBalance >= 0 ? '#bfdbfe' : '#fde68a'};">
                <div class="kpi-title" style="color:${m.netBalance >= 0 ? '#1e40af' : '#92400e'};">মাসিক নিট স্থিতি</div>
                <div class="kpi-value" style="color:${m.netBalance >= 0 ? '#2563eb' : '#d97706'};">৳ ${Math.abs(m.netBalance).toLocaleString("en-IN")} ${m.netBalance >= 0 ? '(উদ্বৃত্ত)' : '(ঘাটতি)'}</div>
                <div class="kpi-sub">বকেয়া ফি: ৳${m.totalDueAmount.toLocaleString("en-IN")} (${m.studentsWithDueCount} জন)</div>
              </div>
            </div>

            <!-- Dynamic Shariah Funds Ledger -->
            <div class="section-title">১. শরিয়াহ তহবিল ও ফান্ডভিত্তিক পূর্ণাঙ্গ হিসাব খতিয়ান</div>
            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width:30px;">ক্র.</th>
                  <th>ফান্ডের নাম ও কোড</th>
                  <th>ক্যাটাগরি</th>
                  <th class="text-right">চলতি মাসের জমা (৳)</th>
                  <th class="text-right">চলতি মাসের ব্যয় (৳)</th>
                  <th class="text-right">চলতি মাসের স্থিতি (৳)</th>
                  <th class="text-right">বর্তমান মোট রিজার্ভ (৳)</th>
                </tr>
              </thead>
              <tbody>
                ${data.fundsBreakdown.map((f, idx) => `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td class="font-bold">${f.fundName} <span style="font-size:9px; color:#64748b;">[${f.code || 'FUND'}]</span></td>
                    <td>${f.category || 'সাধারণ'}</td>
                    <td class="text-right text-green font-bold">৳ ${f.income.toLocaleString("en-IN")}</td>
                    <td class="text-right text-red font-bold">৳ ${f.expense.toLocaleString("en-IN")}</td>
                    <td class="text-right font-bold" style="color:${f.balance >= 0 ? '#1e293b' : '#b45309'};">৳ ${f.balance.toLocaleString("en-IN")}</td>
                    <td class="text-right font-bold" style="color:#0f172a; background:#f8fafc;">৳ ${f.totalReserve.toLocaleString("en-IN")}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f1f5f9; font-weight:bold;">
                  <td colspan="3" class="text-right">সর্বমোট তহবিল হিসাব:</td>
                  <td class="text-right text-green">৳ ${totalFundsIncome.toLocaleString("en-IN")}</td>
                  <td class="text-right text-red">৳ ${totalFundsExpense.toLocaleString("en-IN")}</td>
                  <td class="text-right" style="color:${totalFundsBalance >= 0 ? '#1e293b' : '#b45309'};">৳ ${totalFundsBalance.toLocaleString("en-IN")}</td>
                  <td class="text-right" style="color:#0f172a; background:#e2e8f0;">৳ ${totalFundsReserve.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Academic & Attendance Section -->
            <div class="section-title">২. শিক্ষা, হিফজুল কুরআন ও হাজিরা পর্যালোচনা</div>
            <div class="academic-grid">
              <div class="academic-card">
                <div class="font-bold" style="font-size:11px; margin-bottom:4px; color:#1e293b;">• হাজিরা পর্যালোচনা (গড় ${m.attendanceRate}%)</div>
                <div style="font-size:10px; color:#334155; line-height:1.6;">
                  মোট উপস্থিতি: <b>${m.totalPresents}</b> | অনুপস্থিতি: <b style="color:#b91c1c;">${m.totalAbsents}</b> | ছুটি: <b>${m.totalLeaves}</b><br/>
                  সেরা উপস্থিত জামাত: <b>${m.topAttendanceClass}</b>
                </div>
              </div>

              <div class="academic-card">
                <div class="font-bold" style="font-size:11px; margin-bottom:4px; color:#1e293b;">• হিফজ ও কিতাব সিলেবাস অগ্রগতি</div>
                <div style="font-size:10px; color:#334155; line-height:1.6;">
                  হিফজ ছাত্র: <b>${m.hifzStudentsCount} জন</b> | খতম/হাফেজ: <b>${m.hifzKhatamCount} জন</b><br/>
                  মোট মুখস্থ পারা: <b>${m.hifzParasCompletedTotal} পারা</b> | কিতাব সিলেবাস অগ্রগতি: <b>${m.syllabusCompletionRate}%</b>
                </div>
              </div>
            </div>

            <!-- Signatures Grid -->
            <div class="signatures-grid">
              <div>
                <div class="sig-line">হিসাবরক্ষক / ক্যাশিয়ার</div>
                <div class="sig-sub">স্বাক্ষর ও তারিখ</div>
              </div>
              <div>
                <div class="sig-line">শিক্ষা সচিব / নাযিমে তা'লীমাত</div>
                <div class="sig-sub">স্বাক্ষর ও তারিখ</div>
              </div>
              <div>
                <div class="sig-line">নায়েবে মুহতামিম</div>
                <div class="sig-sub">স্বাক্ষর ও তারিখ</div>
              </div>
              <div>
                <div class="sig-line">মুহতামিম / সভাপতি</div>
                <div class="sig-sub">স্বাক্ষর ও মাদরাসার সিল</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const doc = printIframe.contentWindow?.document;
      const win = printIframe.contentWindow;
      if (doc && win) {
        doc.open();
        doc.write(htmlContent);
        doc.close();

        const triggerPrint = () => {
          try {
            win.focus();
            win.print();
          } catch (e) {
            console.warn("Print execution warning:", e);
          } finally {
            setTimeout(() => {
              try {
                if (document.body.contains(printIframe)) {
                  document.body.removeChild(printIframe);
                }
              } catch {}
            }, 1500);
          }
        };

        if (doc.fonts && doc.fonts.ready) {
          doc.fonts.ready.then(() => {
            setTimeout(triggerPrint, 350);
          }).catch(() => {
            setTimeout(triggerPrint, 500);
          });
        } else {
          setTimeout(triggerPrint, 500);
        }
        return;
      }
    } catch (e) {
      console.warn("Iframe print fallback triggered:", e);
    }

    // Fallback: standard window.print with modal isolation class
    document.body.classList.add("printing-modal");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-modal");
    }, 1000);
  };

  if (!isOpen) return null;

  const m = data?.metrics;
  const totalFundsIncome = data?.fundsBreakdown.reduce((s, f) => s + f.income, 0) || 0;
  const totalFundsExpense = data?.fundsBreakdown.reduce((s, f) => s + f.expense, 0) || 0;
  const totalFundsBalance = data?.fundsBreakdown.reduce((s, f) => s + f.balance, 0) || 0;
  const totalFundsReserve = data?.fundsBreakdown.reduce((s, f) => s + f.totalReserve, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 modal-print-container">
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col dark:bg-slate-900 dark:border-slate-800 sepia-mode:bg-[#FCF8F2] sepia-mode:border-[#E8DFD1] printable-memo-document"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">মাসিক সার্বিক নির্বাহী ড্যাশবোর্ড</h2>
              <p className="text-[11px] text-slate-300 leading-tight">
                মুহতামিম, নায়েবে মুহতামিম ও পরিচালনা কমিটির জন্য
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Month Selector */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden"
            />

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>অফিসিয়াল কপি প্রিন্ট / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body / Printable Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 space-y-6 flex-1 print:p-0 print:overflow-visible">
          {isPending && !data ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">মাদরাসার ডাটাবেজ থেকে রিয়েল ডাটা লোড করা হচ্ছে...</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Official Header */}
              <div className="text-center border-b pb-4 border-slate-200 dark:border-slate-800 sepia-mode:border-[#E8DFD1]">
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sepia-mode:text-[#2C1A0C]">
                  {data.madrasaInfo.name}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 sepia-mode:text-[#7C6248] mt-0.5">
                  {data.madrasaInfo.address} | ফোন: {data.madrasaInfo.phone} | রেজি: {data.madrasaInfo.regNo}
                </p>
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 text-xs font-bold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>মাসিক সার্বিক প্রশাসনিক, শিক্ষা ও আর্থিক প্রতিবেদন — {data.monthNameBn}</span>
                </div>
              </div>

              {/* 4 Main KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 sepia-mode:bg-[#F5EFE6] sepia-mode:border-[#E8DFD1]">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>মোট শিক্ষার্থী ও শিক্ষক</span>
                  </p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {m?.totalStudents} <span className="text-xs font-normal text-slate-500">ছাত্র</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    উস্তাদ: {m?.totalTeachers} জন | জামাত: {m?.activeClasses}টি
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 sepia-mode:bg-[#EAE4D7] sepia-mode:border-[#D5C9B3]">
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-700" />
                    <span>চলতি মাসের মোট আয়</span>
                  </p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                    ৳ {m?.totalIncome.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5 truncate">
                    ফি: ৳{m?.feeCollection.toLocaleString("en-IN")} | অনুদান: ৳{((m?.generalDonations || 0) + (m?.zakatCollection || 0)).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 sepia-mode:bg-[#F3E2DB] sepia-mode:border-[#DEC3B8]">
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-rose-700" />
                    <span>চলতি মাসের মোট ব্যয়</span>
                  </p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    ৳ {m?.totalExpense.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 truncate">
                    মেস বাজার: ৳{m?.boardingBazarExpense.toLocaleString("en-IN")} | সাধারণ: ৳{m?.generalExpenses.toLocaleString("en-IN")}
                  </p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    (m?.netBalance || 0) >= 0
                      ? "bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
                      : "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>{(m?.netBalance || 0) >= 0 ? "মাসিক নিট উদ্বৃত্ত" : "মাসিক নিট ঘাটতি"}</span>
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      (m?.netBalance || 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    ৳ {Math.abs(m?.netBalance || 0).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    বকেয়া ফি: ৳{m?.totalDueAmount.toLocaleString("en-IN")} ({m?.studentsWithDueCount} জন)
                  </p>
                </div>
              </div>

              {/* Dynamic Shariah Funds Ledger Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden dark:border-slate-700 sepia-mode:border-[#E8DFD1]">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>শরিয়াহ তহবিল ও ফান্ডভিত্তিক পূর্ণাঙ্গ মাসিক হিসাব খতিয়ান</span>
                  </h4>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-sm font-semibold">
                    মোট {data.fundsBreakdown.length}টি ফান্ড
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <th className="p-2.5 font-semibold text-center w-10">ক্র.</th>
                        <th className="p-2.5 font-semibold">ফান্ডের নাম ও কোড</th>
                        <th className="p-2.5 font-semibold">ক্যাটাগরি</th>
                        <th className="p-2.5 font-semibold text-right">চলতি মাসের আদায়</th>
                        <th className="p-2.5 font-semibold text-right">চলতি মাসের খরচ</th>
                        <th className="p-2.5 font-semibold text-right">চলতি মাসের স্থিতি</th>
                        <th className="p-2.5 font-semibold text-right bg-slate-100/70 dark:bg-slate-800/70">বর্তমান মোট রিজার্ভ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.fundsBreakdown.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {f.fundName}
                            <span className="ml-1 text-[10px] font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                              {f.code || "FUND"}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{f.category || "সাধারণ"}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">
                            ৳ {f.income.toLocaleString("en-IN")}
                          </td>
                          <td className="p-2.5 text-right font-bold text-rose-600">
                            ৳ {f.expense.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={`p-2.5 text-right font-bold ${
                              f.balance >= 0 ? "text-slate-800 dark:text-slate-100" : "text-amber-600"
                            }`}
                          >
                            ৳ {f.balance.toLocaleString("en-IN")}
                          </td>
                          <td className="p-2.5 text-right font-black text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-800/30">
                            ৳ {f.totalReserve.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <td colSpan={3} className="p-2.5 text-right font-bold">সর্বমোট তহবিল হিসাব:</td>
                        <td className="p-2.5 text-right text-emerald-700 dark:text-emerald-400 font-black">
                          ৳ {totalFundsIncome.toLocaleString("en-IN")}
                        </td>
                        <td className="p-2.5 text-right text-rose-700 dark:text-rose-400 font-black">
                          ৳ {totalFundsExpense.toLocaleString("en-IN")}
                        </td>
                        <td className="p-2.5 text-right font-black">
                          ৳ {totalFundsBalance.toLocaleString("en-IN")}
                        </td>
                        <td className="p-2.5 text-right font-black bg-slate-200/80 dark:bg-slate-700">
                          ৳ {totalFundsReserve.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Attendance & Hifz Progress Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attendance Summary */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800/60 dark:border-slate-700 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>শিক্ষার্থী হাজিরা বিশ্লেষণ</span>
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md">
                      গড় {m?.attendanceRate}% উপস্থিতি
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden dark:bg-slate-700 mb-3">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${m?.attendanceRate}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">মোট উপস্থিতি</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{m?.totalPresents}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">অনুপস্থিতি</p>
                      <p className="font-bold text-rose-600">{m?.totalAbsents}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">ছুটি</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{m?.totalLeaves}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    সেরা উপস্থিত জামাত: <span className="font-semibold text-slate-700 dark:text-slate-300">{m?.topAttendanceClass}</span>
                  </p>
                </div>

                {/* Hifz & Academic Progress */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800/60 dark:border-slate-700 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      <span>হিফজুল কুরআন ও কিতাব অগ্রগতি</span>
                    </h3>
                    <span className="text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-md">
                      {m?.hifzStudentsCount} জন হিফজ ছাত্র
                    </span>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">খতম সম্পন্নকারী / হাফেজ:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                        {m?.hifzKhatamCount} জন
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">মোট মুখস্থকৃত পারা:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {m?.hifzParasCompletedTotal} পারা
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">কিতাব সিলেবাস অগ্রগতি:</span>
                      <span className="font-bold text-indigo-700">{m?.syllabusCompletionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Official 4-Officer Signatures Grid */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800 dark:text-slate-200">হিসাবরক্ষক / ক্যাশিয়ার</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও তারিখ</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800 dark:text-slate-200">শিক্ষাসচিব / নাযিমে তা'লীমাত</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও তারিখ</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800 dark:text-slate-200">নায়েবে মুহতামিম</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও তারিখ</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800 dark:text-slate-200">মুহতামিম / সভাপতি</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও মাদরাসার সিল</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
