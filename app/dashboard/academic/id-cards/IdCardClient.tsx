"use client";

import { useState } from "react";
import PrintButton from "@/app/components/PrintButton";
import {
  IdCard,
  Palette,
  LayoutTemplate,
  Sliders,
  FileText,
  Settings,
  Plus,
  Trash2,
  Type,
  Printer,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  QrCode,
  Eye,
  ShieldCheck,
  History,
  Layers,
  Sparkles,
  X,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { convertToBanglaNumber, getStudentIdNumber } from "@/lib/student-utils";
import {
  StudentIDCard,
  IDCardStatus,
  IDCardAuditLog,
} from "@/lib/id-card-management";
import {
  issueStudentIdCard,
  bulkGenerateIdCards,
  reissueStudentIdCard,
  updateIdCardStatus,
} from "@/app/actions/id-card-management";
import DigitalIdCardView from "@/app/components/DigitalIdCardView";
import StudentIdCardTemplate from "@/app/components/StudentIdCardTemplate";

const getDirectPhotoUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  let fetchUrl = url.trim();
  if (fetchUrl.includes("drive.google.com")) {
    const fileDMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = fetchUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);

    const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return fetchUrl;
};

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

interface IdCardClientProps {
  initialData: {
    cards: StudentIDCard[];
    templates: any[];
    auditLogs: IDCardAuditLog[];
    stats: { total: number; active: number; expired: number; lost: number; blocked: number; reissued: number };
  };
  allStudents: any[];
  classes: { id: string; name: string }[];
  users: any[];
  userType: string;
  madrasaInfo?: { name: string; address: string; phone: string };
}

export default function IdCardClient({
  initialData,
  allStudents,
  classes,
  users,
  userType,
  madrasaInfo,
}: IdCardClientProps) {
  const [activeTab, setActiveTab] = useState<"cards" | "generator" | "audit">("cards");
  const [cards, setCards] = useState<StudentIDCard[]>(initialData.cards || []);
  const [auditLogs, setAuditLogs] = useState<IDCardAuditLog[]>(initialData.auditLogs || []);
  const [stats, setStats] = useState(initialData.stats);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");

  // Modals & Actions
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [previewCard, setPreviewCard] = useState<StudentIDCard | null>(null);
  const [selectedStudentForIssue, setSelectedStudentForIssue] = useState("");
  const [bulkClassId, setBulkClassId] = useState("ALL");
  const [reissueReason, setReissueReason] = useState("");
  const [cardToReissue, setCardToReissue] = useState<StudentIDCard | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Print Generator Customization States
  const [template, setTemplate] = useState("classic_islamic");
  const [themeColor, setThemeColor] = useState("blue");
  const [cardSide, setCardSide] = useState<"front" | "back" | "both">("both");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [titleFontSize, setTitleFontSize] = useState(11);
  const [addressFontSize, setAddressFontSize] = useState(8.5);
  const [nameFontSize, setNameFontSize] = useState(12.5);
  const [detailsFontSize, setDetailsFontSize] = useState(9.5);
  const [detailsGap, setDetailsGap] = useState(3);
  const [backFontSize, setBackFontSize] = useState(7.5);
  const [backLineGap, setBackLineGap] = useState(3);
  const [showEditor, setShowEditor] = useState(false);

  const [customInstructions, setCustomInstructions] = useState<string[]>([
    "মাদরাসায় অবস্থানকালীন সময়ে কার্ডটি পরিধান করা বাধ্যতামূলক।",
    "এই কার্ডটি মাদরাসার সম্পত্তি এবং এটি হস্তান্তরযোগ্য নয়।",
    "কার্ড হারিয়ে গেলে কর্তৃপক্ষকে অবিলম্বে অবহিত করতে হবে।",
    "কার্ডটি পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।",
  ]);

  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    "This identity card is issued by the authority. It is non-transferable and must be returned if found."
  );

  const handleIssueSingle = async () => {
    if (!selectedStudentForIssue) return;
    setLoadingAction(true);
    setActionMessage(null);

    const res = await issueStudentIdCard({ student_id: selectedStudentForIssue });
    setLoadingAction(false);

    if (res.error) {
      setActionMessage({ type: "error", text: res.error });
    } else {
      setActionMessage({ type: "success", text: "আইডি কার্ড সফলভাবে ইস্যু করা হয়েছে!" });
      setShowIssueModal(false);
      setSelectedStudentForIssue("");
      if (res.card) {
        setCards([res.card, ...cards]);
        setStats({ ...stats, total: stats.total + 1, active: stats.active + 1 });
      }
    }
  };

  const handleBulkGenerate = async () => {
    setLoadingAction(true);
    setActionMessage(null);

    const res = await bulkGenerateIdCards({ class_id: bulkClassId });
    setLoadingAction(false);

    if (res.error) {
      setActionMessage({ type: "error", text: res.error });
    } else {
      setActionMessage({ type: "success", text: `${res.count} জন শিক্ষার্থীর জন্য আইডি কার্ড তৈরি হয়েছে!` });
      setShowBulkModal(false);
      if (res.cards && res.cards.length > 0) {
        setCards([...res.cards, ...cards]);
        setStats({ ...stats, total: stats.total + res.count, active: stats.active + res.count });
      }
    }
  };

  const handleReissueConfirm = async () => {
    if (!cardToReissue) return;
    setLoadingAction(true);
    setActionMessage(null);

    const res = await reissueStudentIdCard(cardToReissue.id, reissueReason);
    setLoadingAction(false);

    if (res.error) {
      setActionMessage({ type: "error", text: res.error });
    } else {
      setActionMessage({ type: "success", text: "কার্ডটি সফলভাবে রি-ইস্যু করা হয়েছে!" });
      setCardToReissue(null);
      setReissueReason("");
      if (res.newCard) {
        setCards([res.newCard, ...cards.map((c) => (c.id === cardToReissue.id ? { ...c, status: "REISSUED" as IDCardStatus } : c))]);
        setStats({ ...stats, active: stats.active, reissued: stats.reissued + 1 });
      }
    }
  };

  const handleStatusUpdate = async (cardId: string, newStatus: IDCardStatus) => {
    const res = await updateIdCardStatus(cardId, newStatus, "স্ট্যাটাস পরিবর্তন");
    if (res.success) {
      setCards(cards.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c)));
    }
  };

  const filteredCards = cards.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (classFilter !== "ALL" && !c.snapshot.class_name?.includes(classFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.card_number.toLowerCase().includes(q) ||
        c.snapshot.student_name.toLowerCase().includes(q) ||
        c.snapshot.roll_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const colors: Record<string, { bg: string; text: string; border: string; light: string }> = {
    blue: { bg: "bg-blue-700", text: "text-blue-700", border: "border-blue-700", light: "bg-blue-50 text-blue-700" },
    emerald: { bg: "bg-emerald-700", text: "text-emerald-700", border: "border-emerald-700", light: "bg-emerald-50 text-emerald-700" },
    indigo: { bg: "bg-indigo-700", text: "text-indigo-700", border: "border-indigo-700", light: "bg-indigo-50 text-indigo-700" },
    rose: { bg: "bg-rose-700", text: "text-rose-700", border: "border-rose-700", light: "bg-rose-50 text-rose-700" },
    slate: { bg: "bg-slate-800", text: "text-slate-800", border: "border-slate-800", light: "bg-slate-100 text-slate-800" },
  };

  const currentTheme = colors[themeColor] || colors.blue;

  const handlePrint = () => {
    const printableElement = document.getElementById("printable-id-card-sheet");
    if (!printableElement) {
      window.print();
      return;
    }
    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.classList.remove("hidden");
    clone.classList.add("block");
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
      }, 500);
    }, 150);
  };

  // Printable A4 Cards Generator List
  const allCardsList = (users || []).flatMap((user) => {
    const cardObj: StudentIDCard = {
      id: user.id,
      madrasa_id: user.madrasa_id || "",
      student_id: user.id,
      session_id: "",
      card_number: user.student_id || `QM-26-${String(user.roll_number || 1).padStart(6, "0")}`,
      student_number: user.roll_number || "",
      issue_date: "2026-09-01",
      expiry_date: "2027-08-31",
      status: "ACTIVE",
      photo_url: getDirectPhotoUrl(user.photo_url),
      verification_id: user.id,
      template_id: template,
      issued_by: "অফিস",
      snapshot: {
        student_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "শিক্ষার্থীর নাম",
        student_id_code: user.student_id || `QM-26-${String(user.roll_number || 1).padStart(6, "0")}`,
        roll_number: user.roll_number ? String(user.roll_number) : "—",
        class_name: user.classes?.name || "জামাতহীন",
        session_name: "১৪৪৭-৪৮ হিজরি",
        father_name: user.father_name,
        parent_phone: user.phone || user.guardian_phone,
        blood_group: user.blood_group,
        photo_url: getDirectPhotoUrl(user.photo_url),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const list: { type: "front" | "back"; card: StudentIDCard; user: any }[] = [];
    if (cardSide === "front" || cardSide === "both") list.push({ type: "front", card: cardObj, user });
    if (cardSide === "back" || cardSide === "both") list.push({ type: "back", card: cardObj, user });
    return list;
  });

  const printPages = chunkArray(allCardsList, 8);

  return (
    <div className="space-y-6">
      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold animate-in fade-in duration-150 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)}>
            <X className="w-4 h-4 cursor-pointer" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "cards"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <IdCard className="w-4 h-4 text-emerald-400" />
            <span>ইস্যুকৃত আইডি কার্ডসমূহ ({stats.total})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "generator"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>বাল্ক আইডি জেনারেটর ও A4 প্রিন্ট</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "audit"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4 text-purple-400" />
            <span>অডিট লগ ও ইতিহাস</span>
          </button>
        </div>

        {activeTab === "cards" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>বাল্ক জেনারেট</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIssueModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন কার্ড ইস্যু</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: REGISTERED CARDS TABLE & STATS */}
      {activeTab === "cards" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
              <span className="text-xs text-slate-400 block font-bold">সর্বমোট ইস্যুকৃত</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total}</span>
            </div>

            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-2xs text-center">
              <span className="text-xs text-emerald-700 block font-bold">● সক্রিয় (Active)</span>
              <span className="text-2xl font-black text-emerald-900 mt-1 block">{stats.active}</span>
            </div>

            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-2xs text-center">
              <span className="text-xs text-amber-700 block font-bold">● রি-ইস্যুকৃত (Reissued)</span>
              <span className="text-2xl font-black text-amber-900 mt-1 block">{stats.reissued}</span>
            </div>

            <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-2xs text-center">
              <span className="text-xs text-rose-700 block font-bold">● ব্লকড (Blocked)</span>
              <span className="text-2xl font-black text-rose-900 mt-1 block">{stats.blocked}</span>
            </div>

            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-2xs text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-600 block font-bold">● হারানো (Lost)</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.lost}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="কার্ড নম্বর, শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="ACTIVE">সক্রিয় (Active)</option>
                <option value="REISSUED">রি-ইস্যুকৃত (Reissued)</option>
                <option value="LOST">হারিয়ে গেছে (Lost)</option>
                <option value="BLOCKED">ব্লকড (Blocked)</option>
                <option value="EXPIRED">মেয়াদোত্তীর্ণ (Expired)</option>
              </select>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700"
              >
                <option value="ALL">সকল জামাত</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3.5 pl-4">কার্ড নম্বর</th>
                    <th className="p-3.5">শিক্ষার্থীর নাম</th>
                    <th className="p-3.5">জামাত ও রোল</th>
                    <th className="p-3.5">ইস্যু ও মেয়াদ</th>
                    <th className="p-3.5 text-center">স্ট্যাটাস</th>
                    <th className="p-3.5 pr-4 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCards.length > 0 ? (
                    filteredCards.map((card) => {
                      const isActive = card.status === "ACTIVE";
                      const isLost = card.status === "LOST";
                      const isBlocked = card.status === "BLOCKED";
                      const isReissued = card.status === "REISSUED";

                      return (
                        <tr key={card.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">
                            {card.card_number}
                          </td>
                          <td className="p-3.5 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-slate-600">
                                {card.snapshot.photo_url || card.photo_url ? (
                                  <img
                                    src={card.snapshot.photo_url || card.photo_url}
                                    alt={card.snapshot.student_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  card.snapshot.student_name?.[0] || "শ"
                                )}
                              </div>
                              <span>{card.snapshot.student_name}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-slate-700">{card.snapshot.class_name}</span>
                            <span className="text-slate-400 block text-[10px]">
                              রোল: {card.snapshot.roll_number}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            <span>{card.issue_date}</span>
                            <span className="text-slate-400 block text-[10px]">
                              মেয়াদ: {card.expiry_date}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isReissued
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : isBlocked
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : isLost
                                  ? "bg-slate-100 text-slate-700 border-slate-300"
                                  : "bg-gray-100 text-gray-700 border-gray-300"
                              }`}
                            >
                              {card.status}
                            </span>
                          </td>
                          <td className="p-3.5 pr-4 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => setPreviewCard(card)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition"
                              title="ডিজিটাল প্রিভিউ"
                            >
                              ডিজিটাল ভিউ
                            </button>

                            <button
                              type="button"
                              onClick={() => setCardToReissue(card)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition"
                              title="কার্ড রি-ইস্যু"
                            >
                              রি-ইস্যু
                            </button>

                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(card.id, "LOST")}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition"
                                title="হারানো হিসেবে চিহ্নিত করুন"
                              >
                                হারানো
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(card.id, "ACTIVE")}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition"
                              >
                                সক্রিয়
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        কোনো আইডি কার্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BULK PRINTABLE A4 GENERATOR & DESIGNER */}
      {activeTab === "generator" && (
        <div className="bg-white rounded-xl border shadow-xs p-6 print:border-none print:shadow-none print:p-0 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center print:hidden gap-4 border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                A4 শীট প্রাকদর্শন ({allCardsList.length} টি কার্ড)
              </h2>
              <p className="text-xs text-slate-500">প্রিন্ট করার জন্য কার্ডের ডিজাইন লেআউট সিলেক্ট করুন</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
              >
                <option value="classic_islamic">ক্লাসিক ইসলামিক (Classic Islamic)</option>
                <option value="modern_minimal">মডার্ন মিনিমাল (Modern Minimal)</option>
                <option value="premium_madrasa">প্রিমিয়াম মাদরাসা (Premium Madrasa)</option>
              </select>

              <select
                value={cardSide}
                onChange={(e) => setCardSide(e.target.value as any)}
                className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
              >
                <option value="both">সামনে ও পিছনে (Both)</option>
                <option value="front">শুধুমাত্র সামনে (Front)</option>
                <option value="back">শুধুমাত্র পিছনে (Back)</option>
              </select>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                A4 পেজে প্রিন্ট করুন
              </button>
            </div>
          </div>

          {/* Screen Grid */}
          <div className={`print:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center ${banglaFont}`}>
            {allCardsList.map((cardItem, idx) => (
              <div
                key={idx}
                className="bg-white p-2 border border-slate-200 rounded-2xl shadow-xs text-center space-y-2 hover:border-emerald-500 transition"
              >
                <div className="overflow-hidden rounded-xl shadow-sm border border-slate-200 inline-block">
                  <StudentIdCardTemplate
                    card={cardItem.card}
                    side={cardItem.type}
                    templateId={template}
                    madrasaInfo={madrasaInfo}
                  />
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {cardItem.type === "front" ? "সামনের দিক" : "পিছনের দিক"}
                </div>
              </div>
            ))}
          </div>

          {/* Print Printable Sheet */}
          <div id="printable-id-card-sheet" className={`hidden print:block print:w-full ${banglaFont}`}>
            {printPages.map((pageCards, pageIndex) => (
              <div
                key={pageIndex}
                className="a4-id-card-sheet bg-white p-4 grid grid-cols-2 gap-4 justify-items-center page-break-after-always"
                style={{ pageBreakAfter: "always" }}
              >
                {pageCards.map((c, i) => (
                  <div key={i} className="border border-dashed border-slate-300 p-1 rounded-2xl inline-block">
                    <StudentIdCardTemplate
                      card={c.card}
                      side={c.type}
                      templateId={template}
                      madrasaInfo={madrasaInfo}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <span>আইডি কার্ড ইস্যু ও পরিবর্তন সংক্রান্ত অডিট ইতিহাস</span>
          </h3>

          <div className="space-y-3">
            {auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3 text-xs">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{log.details}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString("bn-BD")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      অপারেটর: <strong>{log.user_name}</strong> • অ্যাকশন: <span className="font-mono text-purple-700">{log.action}</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">কোনো অডিট লগ পাওয়া যায়নি।</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Single Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">নতুন শিক্ষার্থী আইডি কার্ড ইস্যু</h3>
              <button type="button" onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">শিক্ষার্থী নির্বাচন করুন:</label>
              <select
                value={selectedStudentForIssue}
                onChange={(e) => setSelectedStudentForIssue(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">-- শিক্ষার্থী বাছাই করুন --</option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name || ""} ({s.classes?.name || "জামাতহীন"} - রোল: {s.roll_number || "-"})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                বাতিল
              </button>

              <button
                type="button"
                onClick={handleIssueSingle}
                disabled={loadingAction || !selectedStudentForIssue}
                className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loadingAction ? "ইস্যু হচ্ছে..." : "ইস্যু করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Generate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">এক সাথে বাল্ক আইডি কার্ড জেনারেটর</h3>
              <button type="button" onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">জামাত/শ্রেণি নির্বাচন করুন:</label>
              <select
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">সকল জামাত (All Classes)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                যে সকল শিক্ষার্থীর ইতিমধ্যে এই সেশনের জন্য সচল আইডি কার্ড রয়েছে তাদের দ্বিতীয়বার ইস্যু করা হবে না।
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                বাতিল
              </button>

              <button
                type="button"
                onClick={handleBulkGenerate}
                disabled={loadingAction}
                className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loadingAction ? "তৈরি হচ্ছে..." : "বাল্ক জেনারেট শুরু করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reissue Confirmation Modal */}
      {cardToReissue && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">আইডি কার্ড রি-ইস্যু নিশ্চিতকরণ</h3>
              <button type="button" onClick={() => setCardToReissue(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-amber-900 space-y-1">
                <p><strong>শিক্ষার্থী:</strong> {cardToReissue.snapshot.student_name}</p>
                <p><strong>বর্তমান কার্ড নম্বর:</strong> {cardToReissue.card_number}</p>
                <p className="text-[11px] text-amber-800 pt-1">
                  ⚠ রি-ইস্যু করলে বর্তমান পুরানো কার্ড নম্বরটি স্থায়ীভাবে বাতিল হয়ে যাবে এবং নতুন একটি সিকিউর কার্ড ইস্যু করা হবে।
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">রি-ইস্যু করার কারণ (ঐচ্ছিক):</label>
                <input
                  type="text"
                  placeholder="যেমন: হারিয়ে গেছে / নষ্ট হয়ে গেছে"
                  value={reissueReason}
                  onChange={(e) => setReissueReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCardToReissue(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                বাতিল
              </button>

              <button
                type="button"
                onClick={handleReissueConfirm}
                disabled={loadingAction}
                className="px-5 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-amber-700 transition disabled:opacity-50"
              >
                {loadingAction ? "রি-ইস্যু হচ্ছে..." : "নতুন কার্ড রি-ইস্যু করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Digital ID Card Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150 relative">
            <button
              type="button"
              onClick={() => setPreviewCard(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <h3 className="font-black text-slate-900 text-base">ডিজিটাল আইডি প্রিভিউ</h3>
              <p className="text-xs text-slate-400">{previewCard.snapshot.student_name}</p>
            </div>

            <DigitalIdCardView card={previewCard} madrasaInfo={madrasaInfo} showActions={true} />
          </div>
        </div>
      )}
    </div>
  );
}
