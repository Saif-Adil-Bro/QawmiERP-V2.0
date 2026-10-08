"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  Check,
  CheckCircle2,
  Building,
  Layers,
  Settings2,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Save,
  Bookmark,
  FilePlus2,
  FolderPlus,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { printElementIsolated } from "@/lib/printUtils";
import { generateAutoMemoNumber } from "@/app/components/PrintLetterpad";

interface LetterpadNoticeBuilderProps {
  madrasaInfo: any;
}

interface NoticePreset {
  id: string;
  name: string;
  title: string;
  recipient: string;
  subject: string;
  body: string;
  points: string[];
  note: string;
  signer1: string;
  signer1Title: string;
  signer2?: string;
  signer2Title?: string;
}

const NOTICE_PRESETS: NoticePreset[] = [
  {
    id: "general_notice",
    name: "সাধারণ জরুরি নোটিশ",
    title: "জরুরি বিজ্ঞপ্তি",
    recipient: "মাদরাসার সকল ছাত্র, অভিভাবক ও শিক্ষকমণ্ডলীর অবগতির জন্য —",
    subject: "জরুরি প্রশাসনিক সিদ্ধান্ত ও সাধারণ নির্দেশনা প্রসঙ্গে।",
    body: "এতদ্বারা অত্র মাদরাসার সকল শিক্ষক, ছাত্র ও সংশ্লিষ্ট অভিভাবকদের জানানো যাচ্ছে যে, আগামী ২০২৬ শিক্ষাবর্ষের সার্বিক উন্নয়ন ও সুশৃঙ্খল পরিবেশ বজায় রাখার স্বার্থে নিম্নোক্ত সিদ্ধান্তসমূহ গৃহীত হয়েছে। সকলকে উল্লেখিত বিষয়সমূহ যথাযথভাবে অনুসরণের নির্দেশ প্রদান করা হলো।",
    points: [
      "মাদরাসার নির্ধারিত পোশাক ও সুন্নতি লেবাস পরিধান করে সঠিক সময়ে দরসে উপস্থিত হতে হবে।",
      "বিনা অনুমতিতে কোনো শিক্ষার্থী ক্লাস বা বোর্ডিংয়ে অনুপস্থিত থাকতে পারবে না।",
      "যেকোনো জরুরি প্রয়োজনে সরাসরি মাদরাসা অফিসে যোগাযোগ করার জন্য অনুরোধ করা হলো।",
    ],
    note: "বিশেষ দ্রষ্টব্য: উল্লেখিত নির্দেশনাবলি অমান্য করলে মাদরাসার শৃঙ্খলাবিধি অনুযায়ী ব্যবস্থা গ্রহণ করা হবে।",
    signer1: "মুহতামিম / প্রিন্সিপাল",
    signer1Title: "মাদরাসা প্রশাসন",
    signer2: "নাযিমে তা'লীমাত (শিক্ষা সচিব)",
    signer2Title: "শিক্ষা বিভাগ",
  },
  {
    id: "holiday_notice",
    name: "ছুটি ও বন্ধের বিজ্ঞপ্তি",
    title: "মাদরাসা বন্ধ ও ছুটির বিজ্ঞপ্তি",
    recipient: "সম্মানিত অভিভাবক ও স্নেহের শিক্ষার্থীবৃন্দ —",
    subject: "আসন্ন পবিত্র রমজানুল মুবারক ও ঈদুল ফিতর উপলক্ষে মাদরাসা বন্ধের নোটিশ।",
    body: "আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ। পরম করুণাময় আল্লাহর অশেষ রহমতে অত্র মাদরাসার চলতি শিক্ষাবর্ষের ১ম সাময়িক পরীক্ষা ও নিয়মিত ক্লাস সফলভাবে সমাপ্ত হয়েছে। আনন্দের সাথে জানানো যাচ্ছে যে, পবিত্র মাহে রমজান ও ঈদুল ফিতর উপলক্ষে মাদরাসার সকল জামাত আগামী নির্দিষ্ট তারিখ থেকে বন্ধ থাকবে।",
    points: [
      "মাদরাসা ছুটি আরম্ভ: ২০২৬ রমজানুল মুবারকের শুরুতে।",
      "পুনরায় ক্লাস শুরু: ঈদের পর নির্ধারিত ৮ই শাওয়াল সকাল ৮:০০ ঘটিকা হতে।",
      "ছুটিকালীন হিফজ ছাত্রদের প্রতিদিন অন্তত ১ পারা করে আমুক্তা নিয়মিত পড়ার জন্য তাকিদ করা হলো।",
      "প্রত্যেক শিক্ষার্থীকে ছুটির দিনগুলোতে পাঁচ ওয়াক্ত নামাজ জামাতে আদায়ের কঠোর নির্দেশ দেওয়া হলো।",
    ],
    note: "বিশেষ দ্রষ্টব্য: নির্ধারিত তারিখে কোনো ছাত্র উপস্থিত হতে ব্যর্থ হলে দৈনিক জরিমানা ও অভিভাবকের জবাবদিহিতা প্রযোজ্য হবে।",
    signer1: "মুহতামিম",
    signer1Title: "প্রধান কার্যালয়",
    signer2: "নাযিমে তা'লীমাত",
    signer2Title: "তা'লীমাত শাখা",
  },
  {
    id: "admission_notice",
    name: "ভর্তি কার্যক্রম ও পরীক্ষা নোটিশ",
    title: "নতুন শিক্ষাবর্ষে ভর্তি বিজ্ঞপ্তি",
    recipient: "সম্মানিত দ্বীনদার অভিভাবক ও শুভানুধ্যায়ী মুসলমান ভাইবোনদের প্রতি —",
    subject: "নতুন শিক্ষাবর্ষে নূরানী, নাজেরা, হিফজুল কুরআন ও কিতাব বিভাগে নতুন ছাত্র ভর্তি প্রসঙ্গে।",
    body: "আলহামদুলিল্লাহ, দ্বীনি ইলমের আলো ছড়িয়ে দিতে আমাদের মাদরাসায় নতুন শিক্ষাবর্ষ ১৪৪৭-৪৮ হিজরি (২০২৬-২৭ খ্রি.) উপলক্ষে নতুন ছাত্র ভর্তির আবেদন ফরম বিতরণ ও ভর্তি পরীক্ষা শুরু হতে যাচ্ছে। সীমিত আসনে আগ্রহী ছাত্রদের দ্রুত ফরম পূরণ ও জমা দেওয়ার জন্য আহ্বান জানানো যাচ্ছে।",
    points: [
      "ভর্তি ফরম বিতরণ ও জমা: প্রতিদিন সকাল ৯:০০ টা থেকে বিকাল ৪:০০ টা পর্যন্ত।",
      "ভর্তি পরীক্ষা ও মৌখিক যাচাই: নির্ধারিত তারিখে মাদরাসা মিলনায়তনে অনুষ্ঠিত হবে।",
      "ভর্তির সময় শিক্ষার্থীর জন্মনিবন্ধন সনদ ও পাসপোর্ট সাইজ ২ কপি রঙিন ছবি আবশ্যক।",
      "এতিম, অসচ্ছল ও মেধাবী ছাত্রদের জন্য লিল্লাহ বোর্ডিংয়ে বিশেষ ছাড় ও সুবিধার ব্যবস্থা রয়েছে।",
    ],
    note: "অনলাইনে সরাসরি ভর্তি আবেদন করতে ভিজিট করুন আমাদের ওয়েবসাইট ও অনলাইন ভর্তি পোর্টাল।",
    signer1: "মুহতামিম",
    signer1Title: "ভর্তি ও পরিচালনা কমিটি",
  },
  {
    id: "parents_meeting",
    name: "অভিভাবক সমাবেশ ও জরুরি বৈঠক",
    title: "অভিভাবক সমাবেশের আমন্ত্রণপত্র",
    recipient: "শ্রদ্ধেয় অভিভাবক মহোদয় —",
    subject: "শিক্ষার্থীদের সামগ্রিক পড়ালেখার মানোন্নয়ন ও ত্রৈমাসিক অভিভাবক সমাবেশ প্রসঙ্গে।",
    body: "সালাম ও মোবারকবাদ জ্ঞাপন করছি। আপনার সন্তানের আদর্শ দ্বীনি ও চারিত্রিক গঠন, লেখাপড়ার অগ্রগতি এবং হিফজ/কিতাবের মান পর্যালোচনার লক্ষ্যে অত্র মাদরাসার উদ্যোগে এক বিশেষ অভিভাবক সম্মেলনের আয়োজন করা হয়েছে। উক্ত সভায় আপনার উপস্থিতি একান্ত অপরিহার্য।",
    points: [
      "তারিখ ও বার: আগামী শুক্রবার বাদ আসর।",
      "স্থান: মাদরাসার কেন্দ্রীয় মিলনায়তন ও অডিটোরিয়াম।",
      "আলোচ্য বিষয়: ছাত্রদের অগ্রগতি রিপোর্ট কার্ড বিতরণ, নৈতিক গঠন ও আগামীর পরিকল্পনা।",
    ],
    note: "অনুরোধ: সন্তানের সুন্দর ভবিষ্যতের স্বার্থে নির্দিষ্ট সময়ের ১০ মিনিট পূর্বে উপস্থিত হয়ে আসন গ্রহণ করুন।",
    signer1: "মুহতামিম / সাধারণ সম্পাদক",
    signer1Title: "মাদরাসা পরিচালনা কমিটি",
  },
  {
    id: "due_reminder",
    name: "বেতন ও বকেয়া ফি পরিশোধের তাগিদ",
    title: "ফি পরিশোধ সংক্রান্ত জরুরি নোটিশ",
    recipient: "সম্মানিত অভিভাবক মহোদয় —",
    subject: "শিক্ষার্থীর মাসিক খোরাকি ও টিউশন ফি পরিশোধের তাগিদপত্র।",
    body: "বিনীত নিবেদন এই যে, মাদরাসা একটি স্বাবলম্বী দ্বীনি প্রতিষ্ঠান যা সম্মানিত অভিভাবকদের আন্তরিক সহযোগিতায় পরিচালিত হয়। আপনার স্নেহের সন্তানের মাসিক খোরাকি ও বেতনের কিছু অংশ বকেয়া রয়েছে। মাদরাসার সুষ্ঠু পরিচালনা ও শিক্ষক-কর্মচারীদের নিয়মিত বেতন-ভাতার স্বার্থে বকেয়া অর্থ দ্রুত পরিশোধের অনুরোধ করা হচ্ছে।",
    points: [
      "চলতি মাসের ১০ তারিখের মধ্যে মাদরাসা অফিসে এসে রশিদ সংগ্রহপূর্বক ফি পরিশোধ করুন।",
      "অনলাইন পেমেন্ট বা ব্যাংকের মাধ্যমে ফি জমা দিলে রশিদ নং অবশ্যই মাদরাসা অফিসে অবহিত করুন।",
    ],
    note: "ফি সংক্রান্ত কোনো সমস্যা বা পরামর্শ থাকলে অফিস চলাকালীন সময়ে সরাসরি যোগাযোগ করুন।",
    signer1: "নাযিমে হিসাব (হিসাবরক্ষক)",
    signer1Title: "অর্থ ও হিসাব বিভাগ",
    signer2: "মুহতামিম",
    signer2Title: "মাদরাসা প্রশাসন",
  },
  {
    id: "custom_blank",
    name: "কাস্টম ফরম / ফাঁকা লেটারপ্যাড",
    title: "ঘোষণাপত্র / প্রত্যয়নপত্র / কাস্টম ফরম",
    recipient: "যাহার নিকট প্রযোজ্য —",
    subject: "বিষয়: কাস্টম অফিসিয়াল আবেদন / অনুমোদন / প্রত্যয়ন প্রসঙ্গে।",
    body: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, জনাব / শিক্ষার্থী ........................................., পিতা: ........................................., গ্রাম: ........................................., অত্র মাদরাসার একজন নিয়মিত শিক্ষার্থী / শিক্ষক / সদস্য। তাহার নৈতিক চরিত্র ও স্বভাব প্রশংসনীয়।",
    points: [],
    note: "",
    signer1: "মুহতামিম",
    signer1Title: "মাদরাসা কর্তৃপক্ষ",
  },
];

export default function LetterpadNoticeBuilder({ madrasaInfo }: LetterpadNoticeBuilderProps) {
  const mName = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা";
  const mAddress = madrasaInfo?.address || "কাতিয়ারচর, কিশোরগঞ্জ সদর, কিশোরগঞ্জ।";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "+8801749424277";
  const logoUrl = madrasaInfo?.logo_url || "";
  const prefix = madrasaInfo?.prefix || "AHM";

  // Template States
  const [selectedPresetId, setSelectedPresetId] = useState("general_notice");
  const [memoNo, setMemoNo] = useState(() => generateAutoMemoNumber("নোটিশ", prefix));
  const [customDate, setCustomDate] = useState(() => {
    const today = new Date();
    const d = toBanglaNumber(today.getDate());
    const m = toBanglaNumber(today.getMonth() + 1);
    const y = toBanglaNumber(today.getFullYear());
    return `${d}/${m}/${y} খ্রি. (১৪৪৭ হিজরি)`;
  });

  const [noticeTitle, setNoticeTitle] = useState(NOTICE_PRESETS[0].title);
  const [recipient, setRecipient] = useState(NOTICE_PRESETS[0].recipient);
  const [subject, setSubject] = useState(NOTICE_PRESETS[0].subject);
  const [bodyText, setBodyText] = useState(NOTICE_PRESETS[0].body);
  const [points, setPoints] = useState<string[]>(NOTICE_PRESETS[0].points);
  const [specialNote, setSpecialNote] = useState(NOTICE_PRESETS[0].note);
  const [signer1, setSigner1] = useState(NOTICE_PRESETS[0].signer1);
  const [signer1Title, setSigner1Title] = useState(NOTICE_PRESETS[0].signer1Title);
  const [signer2, setSigner2] = useState(NOTICE_PRESETS[0].signer2 || "");
  const [signer2Title, setSigner2Title] = useState(NOTICE_PRESETS[0].signer2Title || "");

  // Custom User Templates from localStorage
  const [customTemplates, setCustomTemplates] = useState<NoticePreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Load custom saved templates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`madrasa_letterpad_templates_${prefix}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomTemplates(parsed);
        }
      }
    } catch (e) {
      console.error("Error loading custom templates:", e);
    }
  }, [prefix]);

  // Letterpad Pad Settings
  const [useOfficialPad, setUseOfficialPad] = useState(true); // true = print full pad, false = blank for pre-printed physical pad
  const [padMarginTop, setPadMarginTop] = useState(65); // mm margin when printing on pre-printed paper
  const [themeColor, setThemeColor] = useState<"emerald" | "slate" | "amber">("emerald");
  const [fontFamily, setFontFamily] = useState<"solaiman" | "siliguri" | "amiri">("solaiman");

  // Load a preset or custom template
  const handleSelectPreset = (presetId: string) => {
    const allTemplates = [...NOTICE_PRESETS, ...customTemplates];
    const found = allTemplates.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(presetId);
    setNoticeTitle(found.title);
    setRecipient(found.recipient);
    setSubject(found.subject);
    setBodyText(found.body);
    setPoints([...found.points]);
    setSpecialNote(found.note);
    setSigner1(found.signer1);
    setSigner1Title(found.signer1Title);
    setSigner2(found.signer2 || "");
    setSigner2Title(found.signer2Title || "");
    setMemoNo(generateAutoMemoNumber(found.name, prefix));
  };

  // Save current notice as a new custom template
  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newTemplate: NoticePreset = {
      id: `custom_${Date.now()}`,
      name: newTemplateName.trim(),
      title: noticeTitle,
      recipient,
      subject,
      body: bodyText,
      points: [...points],
      note: specialNote,
      signer1,
      signer1Title,
      signer2,
      signer2Title,
    };
    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    try {
      localStorage.setItem(`madrasa_letterpad_templates_${prefix}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving custom template:", e);
    }
    setSelectedPresetId(newTemplate.id);
    setShowSaveModal(false);
    setNewTemplateName("");
    setSaveSuccessMsg("নতুন টেমপ্লেট সফলভাবে সংরক্ষিত হয়েছে!");
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  // Delete a saved custom template
  const handleDeleteCustomTemplate = (idToDelete: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই কাস্টম টেমপ্লেটটি মুছে ফেলতে চান?")) return;
    const updated = customTemplates.filter((t) => t.id !== idToDelete);
    setCustomTemplates(updated);
    try {
      localStorage.setItem(`madrasa_letterpad_templates_${prefix}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (selectedPresetId === idToDelete) {
      handleSelectPreset(NOTICE_PRESETS[0].id);
    }
  };

  // Start with a blank canvas
  const handleCreateBlankForm = () => {
    setSelectedPresetId("custom_blank");
    setNoticeTitle("নতুন অফিসিয়াল নোটিশ / কাস্টম ফরম");
    setRecipient("সকলের অবগতির জন্য —");
    setSubject("বিষয়: ...");
    setBodyText("");
    setPoints([]);
    setSpecialNote("");
    setMemoNo(generateAutoMemoNumber("ফরম", prefix));
  };

  const handleAddPoint = () => {
    setPoints([...points, "নতুন পয়েন্ট বা শর্ত এখানে লিখুন..."]);
  };

  const handleUpdatePoint = (index: number, val: string) => {
    const updated = [...points];
    updated[index] = val;
    setPoints(updated);
  };

  const handleRemovePoint = (index: number) => {
    setPoints(points.filter((_, idx) => idx !== index));
  };

  const handlePrint = () => {
    printElementIsolated("letterpad-notice-printable", `${noticeTitle} - ${mName}`, "portrait", "A4");
  };

  const colorConfig = {
    emerald: {
      border: "border-emerald-700",
      bgBadge: "bg-emerald-800 text-white",
      textAccent: "text-emerald-800",
      accentBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
      line: "bg-emerald-700",
    },
    slate: {
      border: "border-slate-800",
      bgBadge: "bg-slate-900 text-white",
      textAccent: "text-slate-900",
      accentBg: "bg-slate-50 border-slate-300 text-slate-900",
      line: "bg-slate-800",
    },
    amber: {
      border: "border-amber-700",
      bgBadge: "bg-amber-800 text-white",
      textAccent: "text-amber-900",
      accentBg: "bg-amber-50 border-amber-300 text-amber-950",
      line: "bg-amber-700",
    },
  }[themeColor];

  const fontClass =
    fontFamily === "siliguri"
      ? "font-hindsiliguri"
      : fontFamily === "amiri"
      ? "font-amiri"
      : "font-solaiman";

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Control Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset / Custom Selector */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">নোটিশ / ফরমের টেমপ্লেট:</span>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 cursor-pointer focus:ring-2 focus:ring-emerald-500"
              >
                <optgroup label="📋 সাধারণ প্রিসেটসমূহ">
                  {NOTICE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {customTemplates.length > 0 && (
                  <optgroup label="⭐ আপনার সংরক্ষিত কাস্টম টেমপ্লেট">
                    {customTemplates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Delete button if selected template is a custom template */}
              {selectedPresetId.startsWith("custom_") && selectedPresetId !== "custom_blank" && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomTemplate(selectedPresetId)}
                  title="এই কাস্টম টেমপ্লেটটি মুছে ফেলুন"
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions: Save current as template & Blank Template */}
          <div className="flex items-end gap-1.5 pt-4">
            <button
              type="button"
              onClick={() => {
                setNewTemplateName(noticeTitle || "আমার কাস্টম টেমপ্লেট");
                setShowSaveModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
              title="বর্তমান নোটিশ বা ফরমটি নতুন টেমপ্লেট হিসেবে সেভ করুন"
            >
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span>টেমপ্লেট সেভ করুন</span>
            </button>

            <button
              type="button"
              onClick={handleCreateBlankForm}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              title="নতুন ফাঁকা কাস্টম ফরম দিয়ে শুরু করুন"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-slate-600" />
              <span>+ ফাঁকা ফরম</span>
            </button>
          </div>

          {/* Letterpad Mode */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">লেটারপ্যাড মোড:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setUseOfficialPad(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  useOfficialPad
                    ? "bg-white text-emerald-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏢 পূর্ণাঙ্গ লেটারপ্যাড সহ
              </button>
              <button
                type="button"
                onClick={() => setUseOfficialPad(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !useOfficialPad
                    ? "bg-white text-emerald-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📄 আগে ছাপানো ফাঁকা প্যাডে (হেডার ছাড়া)
              </button>
            </div>
          </div>

          {/* Color Theme */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">থিম কালার:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setThemeColor("emerald")}
                className={`w-6 h-6 rounded-full bg-emerald-700 transition ${
                  themeColor === "emerald" ? "ring-2 ring-emerald-500 ring-offset-2" : "opacity-60"
                }`}
                title="ঐতিহ্যবাহী সবুজ"
              />
              <button
                type="button"
                onClick={() => setThemeColor("slate")}
                className={`w-6 h-6 rounded-full bg-slate-800 transition ${
                  themeColor === "slate" ? "ring-2 ring-slate-600 ring-offset-2" : "opacity-60"
                }`}
                title="অফিসিয়াল কালো"
              />
              <button
                type="button"
                onClick={() => setThemeColor("amber")}
                className={`w-6 h-6 rounded-full bg-amber-700 transition ${
                  themeColor === "amber" ? "ring-2 ring-amber-500 ring-offset-2" : "opacity-60"
                }`}
                title="গোল্ডেন"
              />
            </div>
          </div>

          {/* Pre-printed Pad top margin slider if false */}
          {!useOfficialPad && (
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                প্যাডের উপরের খালি মার্জিন: <strong className="text-slate-800">{padMarginTop} মিমি</strong>
              </span>
              <input
                type="range"
                min="35"
                max="100"
                value={padMarginTop}
                onChange={(e) => setPadMarginTop(Number(e.target.value))}
                className="w-28 accent-emerald-600 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Quick Print Button */}
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>লেটারপ্যাড প্রিন্ট করুন (A4)</span>
        </button>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: LIVE EDITING CONTROLS (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-600" />
              <span>নোটিশ ও ফরম কাস্টমাইজেশন</span>
            </h3>
            <button
              type="button"
              onClick={() => handleSelectPreset(selectedPresetId)}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>রিসেট</span>
            </button>
          </div>

          {/* Smarok & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">স্মারক নম্বর:</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={memoNo}
                  onChange={(e) => setMemoNo(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setMemoNo(generateAutoMemoNumber(noticeTitle, prefix))}
                  title="নতুন স্মারক নম্বর অটো তৈরি"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">তারিখ:</label>
              <input
                type="text"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Title & Subject */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">নোটিশের শিরোনাম (Title):</label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="যেমন: জরুরি বিজ্ঞপ্তি / নোটিশ"
                className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">প্রাপক / সম্বোধন:</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="যেমন: সম্মানিত অভিভাবক ও শিক্ষার্থীবৃন্দ —"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">বিষয় (Subject):</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="বিষয়: ..."
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Main Body */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">মূল বক্তব্য (Body Text):</label>
            <textarea
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full text-xs leading-relaxed border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Bullet Points */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600">পয়েন্ট / নির্দেশনাবলি ({points.length} টি):</label>
              <button
                type="button"
                onClick={handleAddPoint}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ পয়েন্ট যোগ করুন</span>
              </button>
            </div>
            {points.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-xs font-bold text-slate-400 mt-1.5">{toBanglaNumber(idx + 1)}.</span>
                <input
                  type="text"
                  value={pt}
                  onChange={(e) => handleUpdatePoint(idx, e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePoint(idx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Special Note */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">বিশেষ দ্রষ্টব্য (Optional Note):</label>
            <input
              type="text"
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              placeholder="যেমন: বিশেষ দ্রষ্টব্য: ..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Signatories */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">স্বাক্ষরকারী ১:</label>
              <input
                type="text"
                value={signer1}
                onChange={(e) => setSigner1(e.target.value)}
                placeholder="পদবী / নাম"
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5"
              />
              <input
                type="text"
                value={signer1Title}
                onChange={(e) => setSigner1Title(e.target.value)}
                placeholder="বিভাগ / মাদরাসা"
                className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 text-slate-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">স্বাক্ষরকারী ২ (ঐচ্ছিক):</label>
              <input
                type="text"
                value={signer2}
                onChange={(e) => setSigner2(e.target.value)}
                placeholder="পদবী / নাম"
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5"
              />
              <input
                type="text"
                value={signer2Title}
                onChange={(e) => setSigner2Title(e.target.value)}
                placeholder="বিভাগ / মাদরাসা"
                className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE PRINTABLE A4 PREVIEW (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="text-xs text-slate-500 font-semibold mb-2 print:hidden flex items-center justify-between w-full max-w-[210mm]">
            <span>লাইভ প্রিভিউ (A4 পেজ ফরম্যাট)</span>
            <span className="text-emerald-700 font-bold">প্রিন্ট রেজোলিউশন: ৩০০ ডিপিআই</span>
          </div>

          {/* PRINTABLE CONTAINER */}
          <div
            id="letterpad-notice-printable"
            className={`bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 flex flex-col justify-between ${fontClass}`}
            style={{
              paddingTop: !useOfficialPad ? `${padMarginTop}mm` : undefined,
            }}
          >
            {/* 1. OFFICIAL LETTERPAD HEADER (If useOfficialPad === true) */}
            {useOfficialPad ? (
              <div className="space-y-2 border-b-2 pb-4 mb-6 border-slate-800 text-center relative">
                {/* Bismillah */}
                <p className="text-xs font-serif text-slate-500 print:text-black">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>

                {/* Main Institution Header with Logo */}
                <div className="flex items-center justify-center gap-4">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt=""
                      className="w-14 h-14 object-contain shrink-0 print:grayscale-0"
                    />
                  )}
                  <div className="space-y-0.5">
                    <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${colorConfig.textAccent} print:text-black`}>
                      {mName}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 print:text-black font-semibold">
                      {mAddress}
                    </p>
                    {mPhone && (
                      <p className="text-[11px] text-slate-500 print:text-black font-mono">
                        মোবাইল: {mPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subtle Islamic Quranic Quote Accent */}
                <p className="text-[10px] text-slate-400 italic pt-0.5 print:text-black">
                  &ldquo;وَقُلْ رَبِّ زِدْنِي عِلْمًا&rdquo; — বলুন, হে আমার পালনকর্তা! আমার জ্ঞান বৃদ্ধি করুন। (সূরা ত্বহা: ১১৪)
                </p>
              </div>
            ) : (
              /* When printing on already printed letterhead, leave an indicator on screen (hidden on print) */
              <div className="p-3 border border-dashed border-amber-300 bg-amber-50 rounded-xl mb-4 text-center text-xs text-amber-900 print:hidden">
                ℹ️ প্রাক-মুদ্রিত প্যাড মোড: উপরের {padMarginTop} মিমি ফাঁকা জায়গা ছেড়ে প্রিন্ট হবে।
              </div>
            )}

            {/* 2. NOTICE BODY & CONTENT */}
            <div className="flex-1 space-y-5">
              {/* Smarok / Memo No & Date Line */}
              <div className="flex items-center justify-between text-xs sm:text-sm border-b border-slate-200 pb-2 print:border-black">
                <div className="font-semibold text-slate-800 print:text-black">
                  <span>স্মারক নং: </span>
                  <span className="font-mono font-bold">{memoNo}</span>
                </div>
                <div className="font-semibold text-slate-800 print:text-black">
                  <span>তারিখ: </span>
                  <span className="font-bold">{customDate}</span>
                </div>
              </div>

              {/* Notice Title Banner Badge */}
              <div className="text-center py-1">
                <span className={`inline-block ${colorConfig.bgBadge} print:bg-black print:text-white px-6 py-1.5 rounded-full text-sm sm:text-base font-extrabold shadow-xs tracking-wide uppercase`}>
                  {noticeTitle}
                </span>
              </div>

              {/* Recipient Greeting */}
              {recipient && (
                <div className="text-xs sm:text-sm font-bold text-slate-800 print:text-black pt-1">
                  {recipient}
                </div>
              )}

              {/* Subject Line */}
              {subject && (
                <div className="text-xs sm:text-sm font-extrabold text-slate-900 print:text-black bg-slate-50 print:bg-transparent p-2 rounded-lg border-l-4 border-slate-800">
                  {subject}
                </div>
              )}

              {/* Main Body Paragraph */}
              {bodyText && (
                <div className="text-xs sm:text-sm leading-relaxed text-slate-800 print:text-black text-justify whitespace-pre-line">
                  {bodyText}
                </div>
              )}

              {/* Bullet Points */}
              {points && points.length > 0 && (
                <div className="space-y-1.5 pl-2 sm:pl-4 text-xs sm:text-sm">
                  {points.map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="font-bold text-slate-700 print:text-black shrink-0">
                        {toBanglaNumber(idx + 1)}.
                      </span>
                      <span className="text-slate-800 print:text-black leading-relaxed">
                        {pt}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Special Note Box */}
              {specialNote && (
                <div className={`p-3 rounded-xl border text-xs sm:text-sm ${colorConfig.accentBg} print:bg-transparent print:border-black print:text-black font-semibold mt-4`}>
                  {specialNote}
                </div>
              )}
            </div>

            {/* 3. OFFICIAL SIGNATURES & FOOTER */}
            <div className="pt-16 pb-4 flex items-end justify-between text-xs sm:text-sm text-center">
              {/* Signer 1 (Left) or Seal */}
              {signer2 ? (
                <div className="space-y-1 min-w-[130px]">
                  <div className="w-36 border-b-2 border-slate-700 print:border-black mx-auto mb-1" />
                  <p className="font-bold text-slate-900 print:text-black">{signer2}</p>
                  <p className="text-[11px] text-slate-600 print:text-black">{signer2Title}</p>
                </div>
              ) : (
                <div className="space-y-1 min-w-[120px] text-left">
                  <div className="w-24 h-24 border-2 border-dashed border-slate-300 print:border-black rounded-xl flex items-center justify-center text-[10px] text-slate-400 print:text-black">
                    অফিসিয়াল গোল সিল
                  </div>
                </div>
              )}

              {/* Signer 1 (Primary Muhtamim - Right) */}
              <div className="space-y-1 min-w-[140px]">
                <div className="w-40 border-b-2 border-slate-800 print:border-black mx-auto mb-1" />
                <p className="font-black text-slate-900 print:text-black text-sm">{signer1}</p>
                <p className="text-xs text-slate-600 print:text-black font-medium">{signer1Title}</p>
                <p className="text-[10px] text-slate-500 print:text-black">{mName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE TEMPLATE MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-emerald-600" />
                <span>নতুন টেমপ্লেট হিসেবে সংরক্ষণ</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              বর্তমান নোটিশ / ফরমের শিরোনাম, বিষয়, বক্তব্য, পয়েন্ট ও স্বাক্ষরকারী তথ্য একটি নতুন কাস্টম টেমপ্লেট হিসেবে সেভ হবে। পরবর্তীতে ড্রপডাউন থেকে এক ক্লিকেই এটি ব্যবহার করতে পারবেন।
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                টেমপ্লেটের নাম লিখুন:
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="যেমন: বার্ষিক পুরস্কার বিতরণী নোটিশ"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={!newTemplateName.trim()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>সংরক্ষণ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
