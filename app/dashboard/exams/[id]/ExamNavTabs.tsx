"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, List, FileSignature, PenTool, FileText, IdCard, Printer, Trophy } from "lucide-react";

interface ExamNavTabsProps {
  examId: string;
}

export default function ExamNavTabs({ examId }: ExamNavTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      id: "setup",
      name: "সেটআপ সাবজেক্ট",
      englishName: "Setup Subjects",
      href: `/dashboard/exams/${examId}/setup`,
      icon: Settings,
    },
    {
      id: "routine",
      name: "পরীক্ষার রুটিন",
      englishName: "Routine",
      href: `/dashboard/exams/${examId}/routine`,
      icon: List,
    },
    {
      id: "paper",
      name: "প্রশ্নপত্র বিল্ডার",
      englishName: "Paper Generator",
      href: `/dashboard/exams/${examId}/paper`,
      icon: FileSignature,
    },
    {
      id: "marks",
      name: "নম্বর এন্ট্রি",
      englishName: "Marks Entry",
      href: `/dashboard/exams/${examId}/marks`,
      icon: PenTool,
    },
    {
      id: "results",
      name: "ফলাফল তালিকা",
      englishName: "Results / Tabulation",
      href: `/dashboard/exams/${examId}/results`,
      icon: FileText,
    },
    {
      id: "report-cards",
      name: "স্বতন্ত্র মার্কশিট",
      englishName: "Report Cards",
      href: `/dashboard/exams/${examId}/report-cards`,
      icon: Printer,
    },
    {
      id: "admit-cards",
      name: "প্রবেশপত্র",
      englishName: "Admit Cards",
      href: `/dashboard/exams/${examId}/admit-cards`,
      icon: IdCard,
    },
    {
      id: "merit-list",
      name: "মেধাতালিকা",
      englishName: "Merit List",
      href: `/dashboard/exams/${examId}/merit-list`,
      icon: Trophy,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white rounded-xl shadow-sm p-2 print:hidden mb-6">
      <div className="flex space-x-1 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((tab) => {
          // Precise active checking
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center space-x-2.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <div className="flex flex-col text-left">
                <span className="leading-tight text-xs font-semibold">{tab.name}</span>
                <span className={`text-[10px] font-normal leading-none mt-0.5 ${isActive ? "text-indigo-200" : "text-slate-400"}`}>
                  {tab.englishName}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
