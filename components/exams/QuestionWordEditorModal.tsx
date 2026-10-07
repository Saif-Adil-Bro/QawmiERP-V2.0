"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText, Printer, Download, Save, X, RotateCcw, RotateCw,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table, Plus, Trash2,
  Columns, Sparkles, LayoutTemplate, Palette, Eye, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Check, ArrowLeftRight, HelpCircle, Subscript,
  Superscript, Type, Eraser, Scissors, Copy, SplitSquareVertical
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface QuestionWordEditorModalProps {
  initialContent?: string;
  examTitle?: string;
  subjectName?: string;
  className?: string;
  madrasaName?: string;
  onSave?: (htmlContent: string) => void;
  onClose: () => void;
}

export type PageSize = "A4" | "Letter" | "Legal";
export type PageOrientation = "portrait" | "landscape";
export type ColumnCount = 1 | 2 | 3;
export type MarginSize = "narrow" | "normal" | "moderate";

export default function QuestionWordEditorModal({
  initialContent,
  examTitle = "বার্ষিক পরীক্ষা - ২০২৬",
  subjectName = "কুরআন ও হাদিস",
  className: targetClassName = "জামাতে তাইসির",
  madrasaName = "দারুল উলূম ইসলামিয়া মাদরাসা",
  onSave,
  onClose,
}: QuestionWordEditorModalProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Active Ribbon Tab: home (formatting), layout (page & columns), insert (tables & marks), view (preview & print)
  const [activeRibbonTab, setActiveRibbonTab] = useState<"home" | "layout" | "insert" | "view">("home");

  // Page Format Settings
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [columns, setColumns] = useState<ColumnCount>(2);
  const [hasColumnDivider, setHasColumnDivider] = useState(true);
  const [marginSize, setMarginSize] = useState<MarginSize>("normal");
  const [borderStyle, setBorderStyle] = useState<"simple" | "double" | "none">("double");
  const [selectedFont, setSelectedFont] = useState("SolaimanLipi");
  const [fontSizePt, setFontSizePt] = useState<string>("14");
  const [zoomLevel, setZoomLevel] = useState<number>(95);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Table Grid Insert Dimensions
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);

  // Stats
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Default Template if initialContent is empty
  const defaultExamTemplate = `
    <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
      <div style="font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 16px; color: #064e3b; margin-bottom: 4px;" dir="rtl">
        بِسْمِ اللَّهِ الرَّحْمٰনِ الرَّحِيمِ
      </div>
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
        ${madrasaName}
      </h1>
      <div style="font-size: 14px; font-weight: 700; color: #334155; margin-top: 2px;">
        ${examTitle}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #1e293b; border-top: 1px dashed #64748b; margin-top: 6px; padding-top: 4px;">
        <span>জামাত: ${targetClassName}</span>
        <span>বিষয়: ${subjectName}</span>
        <span>সময়: ২ ঘণ্টা ৩০ মিনিট</span>
        <span>পূর্ণমান: ১০০</span>
      </div>
    </div>

    <div style="font-size: 12px; font-style: italic; color: #475569; margin-bottom: 10px; border-left: 3px solid #059669; padding-left: 6px;">
      [বিশেষ দ্রষ্টব্য: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক।]
    </div>

    <div style="margin-bottom: 12px;">
      <div style="background-color: #f1f5f9; padding: 4px 8px; font-weight: 800; font-size: 14px; color: #0f172a; border-left: 4px solid #0284c7; margin-bottom: 8px;">
        ক-বিভাগ: কুরআন ও হাদিস (মান: ৫০)
      </div>

      <p style="margin-bottom: 6px; line-height: 1.6;">
        <strong>১. </strong> নিম্নের আয়াতুল কারিমার সহিহ তরজমা ও প্রাসঙ্গিক শানে নুযুল বিস্তারিত আলোচনা করো: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
      </p>
      <div style="font-family: 'Amiri', serif; font-size: 17px; text-align: right; background-color: #f8fafc; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin: 6px 0;" dir="rtl">
        « إِنَّ الدِّينَ عِندَ اللَّهِ الْإِسْلَامُ ۗ وَمَا اخْتَلَفَ الَّذِينَ أُوتُوا الْكِتَابَ إِلَّا مِن بَعْدِ مَا جَاءَهُمُ الْعِلْمُ »
      </div>

      <p style="margin-bottom: 6px; line-height: 1.6;">
        <strong>২. </strong> যেকোনো পাঁচটি হাদিসের অর্থ ও সংক্ষিপ্ত ব্যাখ্যা লিখ: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
      </p>
      <p style="margin-bottom: 4px; padding-left: 16px;">(ক) طلب العلم فريضة على كل مسلم</p>
      <p style="margin-bottom: 4px; padding-left: 16px;">(খ) خيركم من تعلم القرآن وعلمه</p>
      <p style="margin-bottom: 4px; padding-left: 16px;">(গ) الدين النصيحة</p>
    </div>

    <div style="margin-bottom: 12px;">
      <div style="background-color: #f1f5f9; padding: 4px 8px; font-weight: 800; font-size: 14px; color: #0f172a; border-left: 4px solid #059669; margin-bottom: 8px;">
        খ-বিভাগ: ফিকহ ও ফতোয়া (মান: ৫০)
      </div>

      <p style="margin-bottom: 6px; line-height: 1.6;">
        <strong>৩. </strong> সালাতের আরকান ও আহকামের বিবরণ দিয়ে তালিকাটি পূর্ণ করো: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; text-align: center;">
        <thead>
          <tr style="background-color: #e2e8f0; font-weight: bold;">
            <th style="border: 1px solid #475569; padding: 4px;">নং</th>
            <th style="border: 1px solid #475569; padding: 4px;">নামাজের আহকাম (বাইরের ফরজ)</th>
            <th style="border: 1px solid #475569; padding: 4px;">নামাজের আরকান (ভিতরের ফরজ)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #475569; padding: 4px;">১</td>
            <td style="border: 1px solid #475569; padding: 4px;">শরীর পাক হওয়া</td>
            <td style="border: 1px solid #475569; padding: 4px;">তাকবীরে তাহরীমা</td>
          </tr>
          <tr>
            <td style="border: 1px solid #475569; padding: 4px;">২</td>
            <td style="border: 1px solid #475569; padding: 4px;">কাপড় পাক হওয়া</td>
            <td style="border: 1px solid #475569; padding: 4px;">কিয়াম (দাঁড়ানো)</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Initialize Content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || defaultExamTemplate;
      updateStats();
    }
  }, []);

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    setCharCount(text.length);
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  };

  // Execute standard formatting commands
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      updateStats();
    }
  };

  // Insert Custom Element / HTML at cursor position
  const insertHTML = (html: string) => {
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.getRangeAt && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement("div");
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        let lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else {
        execCmd("insertHTML", html);
      }
    } else {
      execCmd("insertHTML", html);
    }
    updateStats();
  };

  // Insert Table
  const handleInsertTable = () => {
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; text-align: left;">
      <thead>
        <tr style="background-color: #f1f5f9; font-weight: bold;">`;
    for (let c = 1; c <= tableCols; c++) {
      tableHtml += `<th style="border: 1px solid #475569; padding: 5px 8px;">হেডার ${toBanglaNumber(c)}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= tableRows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `<td style="border: 1px solid #475569; padding: 5px 8px;">তথ্য</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;
    insertHTML(tableHtml);
    setIsTableMenuOpen(false);
  };

  // Handle Save
  const handleSaveDocument = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    if (onSave) {
      onSave(content);
    }
    alert("প্রশ্নপত্রের ডকুমেন্ট সফলভাবে সংরক্ষণ করা হয়েছে!");
  };

  // Handle Print Isolated
  const handlePrint = () => {
    const printableElement = document.getElementById("word-editor-print-sheet");
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

  // Margin CSS mapping
  const marginPaddingMap: Record<MarginSize, string> = {
    narrow: "10mm",
    normal: "14mm",
    moderate: "18mm",
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col ${isFullscreen ? "p-0" : "p-2 sm:p-4"}`}>
      <div className={`bg-slate-100 rounded-2xl shadow-2xl border border-slate-700 flex flex-col w-full h-full overflow-hidden`}>
        
        {/* TOP TITLEBAR */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white font-bold flex items-center gap-1 shadow-xs">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-mono">MS Word Pro</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>প্রশ্নপত্র লাইট টেক্সট ও ডকুমেন্ট এডিটর</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {pageSize} • {columns} কলাম • {orientation === "portrait" ? "লম্বালম্বি" : "আড়াআড়ি"}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDocument}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>সংরক্ষণ করুন</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title={isFullscreen ? "ছোট করুন" : "ফুলস্ক্রিন"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RIBBON TAB SELECTOR */}
        <div className="bg-slate-800 text-slate-300 px-4 pt-1 flex items-center gap-1 border-b border-slate-700 shrink-0 select-none text-xs">
          <button
            type="button"
            onClick={() => setActiveRibbonTab("home")}
            className={`px-3.5 py-1.5 rounded-t-lg font-bold transition cursor-pointer ${
              activeRibbonTab === "home"
                ? "bg-slate-100 text-slate-900 border-t-2 border-blue-500 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            হোম ও ফরম্যাটিং
          </button>
          <button
            type="button"
            onClick={() => setActiveRibbonTab("layout")}
            className={`px-3.5 py-1.5 rounded-t-lg font-bold transition cursor-pointer ${
              activeRibbonTab === "layout"
                ? "bg-slate-100 text-slate-900 border-t-2 border-blue-500 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            পেজ ও কলাম লেআউট
          </button>
          <button
            type="button"
            onClick={() => setActiveRibbonTab("insert")}
            className={`px-3.5 py-1.5 rounded-t-lg font-bold transition cursor-pointer ${
              activeRibbonTab === "insert"
                ? "bg-slate-100 text-slate-900 border-t-2 border-blue-500 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            টেবিল ও বিশেষ উপাদান
          </button>
          <button
            type="button"
            onClick={() => setActiveRibbonTab("view")}
            className={`px-3.5 py-1.5 rounded-t-lg font-bold transition cursor-pointer ${
              activeRibbonTab === "view"
                ? "bg-slate-100 text-slate-900 border-t-2 border-blue-500 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            ভিউ ও প্রিন্ট সেটিংস
          </button>
        </div>

        {/* RIBBON TOOLBAR ACTIONS */}
        <div className="bg-slate-200/90 border-b border-slate-300 p-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0 select-none shadow-2xs">
          
          {/* TAB 1: HOME (Typography & Formatting) */}
          {activeRibbonTab === "home" && (
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              {/* Heading Selector */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <select
                  onChange={(e) => {
                    const tag = e.target.value;
                    if (tag === "p") execCmd("formatBlock", "<p>");
                    else if (tag === "h1") execCmd("formatBlock", "<h1>");
                    else if (tag === "h2") execCmd("formatBlock", "<h2>");
                    else if (tag === "h3") execCmd("formatBlock", "<h3>");
                  }}
                  defaultValue="p"
                  className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
                  title="হেডিং লেভেল"
                >
                  <option value="p">সাধারণ অনুচ্ছেদ (Paragraph)</option>
                  <option value="h1">প্রধান শিরোনাম (H1)</option>
                  <option value="h2">বিভাগীয় শিরোনাম (H2)</option>
                  <option value="h3">উপশিরোনাম (H3)</option>
                </select>
              </div>

              {/* Font Family Selector */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <select
                  value={selectedFont}
                  onChange={(e) => {
                    setSelectedFont(e.target.value);
                    execCmd("fontName", e.target.value);
                  }}
                  className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
                  title="ফন্ট নির্বাচন"
                >
                  <option value="SolaimanLipi">সোলায়মান লিপি (বাংলা)</option>
                  <option value="Hind Siliguri">হিন্দ শিলিগুড়ি (বাংলা)</option>
                  <option value="Amiri">আমিরি ক্যালিগ্রাফি (আরবি)</option>
                  <option value="Scheherazade New">শাহরাজাদ (আরবি)</option>
                  <option value="Times New Roman">Times New Roman (English)</option>
                  <option value="Arial">Arial (English)</option>
                </select>
              </div>

              {/* Font Size Selector */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <span className="text-[11px] text-slate-500 font-semibold px-1">সাইজ:</span>
                <select
                  value={fontSizePt}
                  onChange={(e) => {
                    setFontSizePt(e.target.value);
                    execCmd("fontSize", e.target.value === "18" ? "5" : e.target.value === "24" ? "6" : e.target.value === "12" ? "2" : "3");
                  }}
                  className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
                  title="ফন্ট সাইজ"
                >
                  <option value="10">১০ pt</option>
                  <option value="12">১২ pt</option>
                  <option value="14">১৪ pt (স্ট্যান্ডার্ড)</option>
                  <option value="16">১৬ pt</option>
                  <option value="18">১৮ pt (বড়)</option>
                  <option value="24">২৪ pt</option>
                </select>
              </div>

              {/* Basic Styles (B, I, U, S) */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => execCmd("bold")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 font-bold transition"
                  title="বোল্ড (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("italic")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="ইটালিক (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("underline")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="আন্ডারলাইন (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("strikeThrough")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="কাটা দাগ (Strikethrough)"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("subscript")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="সাবস্ক্রিপ্ট"
                >
                  <Subscript className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("superscript")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="সুপারস্ক্রিপ্ট"
                >
                  <Superscript className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Color & Highlight */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5">
                <label className="p-1 hover:bg-slate-100 rounded cursor-pointer flex items-center gap-0.5" title="টেক্সট কালার">
                  <span className="font-bold text-[11px] text-slate-700">A</span>
                  <input
                    type="color"
                    onChange={(e) => execCmd("foreColor", e.target.value)}
                    className="w-3 h-3 p-0 border-0 cursor-pointer"
                  />
                </label>
                <label className="p-1 hover:bg-slate-100 rounded cursor-pointer flex items-center gap-0.5" title="হাইলাইট কালার">
                  <span className="font-bold text-[11px] bg-amber-300 px-0.5 rounded">H</span>
                  <input
                    type="color"
                    defaultValue="#fef08a"
                    onChange={(e) => execCmd("hiliteColor", e.target.value)}
                    className="w-3 h-3 p-0 border-0 cursor-pointer"
                  />
                </label>
              </div>

              {/* Text Alignment */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => execCmd("justifyLeft")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="বামে সারিবদ্ধ (Align Left)"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyCenter")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="মাঝখানে (Center)"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyRight")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="ডানে সারিবদ্ধ (Align Right)"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyFull")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="দুইপাশে সমান (Justify)"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Direction Control (RTL / LTR / Mixed Smart Direction) */}
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const sel = window.getSelection();
                    if (sel && sel.anchorNode) {
                      const parent = sel.anchorNode.parentElement;
                      if (parent) {
                        parent.setAttribute("dir", "rtl");
                        parent.style.textAlign = "right";
                        parent.style.fontFamily = "'Amiri', 'Traditional Arabic', serif";
                      }
                    }
                  }}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded text-[11px] transition font-amiri"
                  title="আরবি টেক্সট ডিরেকশন (RTL - ডান দিক থেকে)"
                >
                  عربي (RTL ➔)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sel = window.getSelection();
                    if (sel && sel.anchorNode) {
                      const parent = sel.anchorNode.parentElement;
                      if (parent) {
                        parent.setAttribute("dir", "ltr");
                        parent.style.textAlign = "left";
                        parent.style.fontFamily = "'SolaimanLipi', sans-serif";
                      }
                    }
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[11px] transition"
                  title="বাংলা / ইংরেজি টেক্সট ডিরেকশন (LTR - বাম দিক থেকে)"
                >
                  বাংলা/Eng (➔ LTR)
                </button>
              </div>

              {/* Lists */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => execCmd("insertUnorderedList")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="বুলেট পয়েন্ট তালিকা"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("insertOrderedList")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition"
                  title="ক্রমিক নম্বর তালিকা"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Clear Formatting */}
              <button
                type="button"
                onClick={() => execCmd("removeFormat")}
                className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-lg border border-slate-300 transition"
                title="ফরম্যাট ক্লিয়ার করুন"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 2: PAGE LAYOUT & COLUMNS */}
          {activeRibbonTab === "layout" && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Paper Size */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700">পেজের সাইজ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value="A4">A4 (210 × 297 মিমি) - স্ট্যান্ডার্ড</option>
                  <option value="Letter">Letter (8.5 × 11 ইঞ্চি)</option>
                  <option value="Legal">Legal (8.5 × 14 ইঞ্চি)</option>
                </select>
              </div>

              {/* Page Orientation */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700">ওরিয়েন্টেশন:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrientation("portrait")}
                    className={`px-2.5 py-1 rounded font-bold transition ${
                      orientation === "portrait" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    লম্বালম্বি (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation("landscape")}
                    className={`px-2.5 py-1 rounded font-bold transition ${
                      orientation === "landscape" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    আড়াআড়ি (Landscape)
                  </button>
                </div>
              </div>

              {/* Column Count Selection (1, 2, 3 Columns) */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Columns className="w-3.5 h-3.5 text-blue-600" />
                  <span>কলাম সংখ্যা:</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setColumns(1)}
                    className={`px-2 py-1 rounded font-bold transition ${
                      columns === 1 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ১ কলাম
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns(2)}
                    className={`px-2 py-1 rounded font-bold transition ${
                      columns === 2 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ২ কলাম (খাতা/প্রশ্ন)
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns(3)}
                    className={`px-2 py-1 rounded font-bold transition ${
                      columns === 3 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ৩ কলাম
                  </button>
                </div>
              </div>

              {/* Column Divider Line Toggle */}
              {columns > 1 && (
                <label className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasColumnDivider}
                    onChange={(e) => setHasColumnDivider(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="font-bold text-slate-800">কলামের মাঝে দাগ (Divider Line)</span>
                </label>
              )}

              {/* Margins */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700">মার্জিন:</span>
                <select
                  value={marginSize}
                  onChange={(e) => setMarginSize(e.target.value as MarginSize)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value="narrow">সংকীর্ণ (Narrow - ১০ মিমি)</option>
                  <option value="normal">স্ট্যান্ডার্ড (Normal - ১৪ মিমি)</option>
                  <option value="moderate">প্রশস্ত (Moderate - ১৮ মিমি)</option>
                </select>
              </div>

              {/* Page Frame Border Style */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700">চারপাশের বর্ডার:</span>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value="double">ইসলামিক ডাবল বর্ডার (❖ কর্নার)</option>
                  <option value="simple">একক লাইন বর্ডার (Simple)</option>
                  <option value="none">কোনো বর্ডার নয় (None)</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: INSERT & TABLE BUILDER */}
          {activeRibbonTab === "insert" && (
            <div className="flex flex-wrap items-center gap-2.5 w-full">
              {/* Insert Table Menu Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTableMenuOpen(!isTableMenuOpen)}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-900 font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                >
                  <Table className="w-3.5 h-3.5 text-blue-600" />
                  <span>টেবিল যোগ করুন ({tableRows}×{tableCols})</span>
                </button>

                {isTableMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white p-3 rounded-xl shadow-xl border border-slate-300 z-50 w-56 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1 border-b pb-1">
                      <Table className="w-3.5 h-3.5 text-blue-600" />
                      <span>টেবিল সাইজ নির্ধারণ:</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">সারি (Rows):</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={tableRows}
                          onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                          className="w-full p-1 border rounded font-bold text-slate-900 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">কলাম (Cols):</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={tableCols}
                          onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                          className="w-full p-1 border rounded font-bold text-slate-900 text-center"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertTable}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition cursor-pointer"
                    >
                      টেবিল যুক্ত করুন
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Question Tokens Insertion */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500 px-1">প্রশ্ন নম্বর:</span>
                {["১. ", "২. ", "৩. ", "(ক) ", "(খ) ", "(গ) ", "(১) ", "(২) "].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertHTML(`<strong>${token}</strong> `)}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-800 font-bold rounded text-[11px] transition"
                  >
                    {token.trim()}
                  </button>
                ))}
              </div>

              {/* Quick Marks Bracket Insertion */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500 px-1">নম্বর ব্র্যাকেট:</span>
                {["[১০]", "[৫+৫=১০]", "(৫×২=১০)", "[২০]", "[৫০]"].map((mark) => (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => insertHTML(` <span style="float: right; font-weight: bold; color: #0f172a;">${mark}</span>`)}
                    className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded text-[11px] transition"
                  >
                    {mark}
                  </button>
                ))}
              </div>

              {/* Bismillah Calligraphy Ribbon */}
              <button
                type="button"
                onClick={() => insertHTML(`<div style="text-align: center; font-family: 'Amiri', serif; font-size: 16px; color: #064e3b; margin: 6px 0;" dir="rtl">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>`)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded-lg border border-emerald-300 text-xs transition font-amiri"
                title="বিসমিল্লাহির রাহমানির রাহিম"
              >
                بِسْمِ اللَّهِ
              </button>

              {/* Blank Fill in the blanks Line */}
              <button
                type="button"
                onClick={() => insertHTML(` .................................................... `)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition"
                title="শূন্যস্থান পূরণ ডট লাইন"
              >
                শূন্যস্থান (......)
              </button>

              {/* Horizontal Divider Line */}
              <button
                type="button"
                onClick={() => insertHTML(`<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 12px 0;" />`)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition"
                title="বিভাজক লাইন"
              >
                বিভাজক রেখা
              </button>
            </div>
          )}

          {/* TAB 4: VIEW & ZOOM */}
          {activeRibbonTab === "view" && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <span className="font-bold text-slate-700 px-1">প্রিভিউ জুম:</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-700 transition"
                  title="জুম আউট"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold px-2">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-700 transition"
                  title="জুম ইন"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(95)}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-bold"
                >
                  রিসেট (১০০%)
                </button>
              </div>

              {/* Stats Summary */}
              <div className="text-xs text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-300 flex items-center gap-3">
                <span>মোট শব্দ: <strong className="text-slate-900">{toBanglaNumber(wordCount)}</strong></span>
                <span>মোট অক্ষর: <strong className="text-slate-900">{toBanglaNumber(charCount)}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CANVAS SCROLL AREA (Realistic MS Word Sheet Container) */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-300/80 flex justify-center items-start">
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease",
            }}
          >
            {/* REALISTIC A4 / LETTER SHEET */}
            <div
              id="word-editor-print-sheet"
              className={`bg-white shadow-2xl rounded-xs text-slate-900 relative transition-all border border-slate-400 ${
                borderStyle === "double"
                  ? "ring-1 ring-slate-800 ring-offset-2"
                  : borderStyle === "simple"
                  ? "border-2 border-slate-800"
                  : ""
              }`}
              style={{
                width: orientation === "portrait" 
                  ? (pageSize === "Letter" ? "215.9mm" : pageSize === "Legal" ? "215.9mm" : "210mm")
                  : (pageSize === "Letter" ? "279.4mm" : pageSize === "Legal" ? "355.6mm" : "297mm"),
                minHeight: orientation === "portrait"
                  ? (pageSize === "Letter" ? "279.4mm" : pageSize === "Legal" ? "355.6mm" : "297mm")
                  : (pageSize === "Letter" ? "215.9mm" : pageSize === "Legal" ? "215.9mm" : "210mm"),
                padding: marginPaddingMap[marginSize],
                boxSizing: "border-box",
                fontFamily: selectedFont === "Amiri" 
                  ? "'Amiri', 'Traditional Arabic', serif" 
                  : selectedFont === "Scheherazade New" 
                  ? "'Scheherazade New', serif" 
                  : "'SolaimanLipi', 'Hind Siliguri', sans-serif",
              }}
            >
              {/* Optional Islamic Corner Ornaments for double border */}
              {borderStyle === "double" && (
                <>
                  <div className="absolute top-1 left-1.5 text-slate-400 text-xs select-none">❖</div>
                  <div className="absolute top-1 right-1.5 text-slate-400 text-xs select-none">❖</div>
                  <div className="absolute bottom-1 left-1.5 text-slate-400 text-xs select-none">❖</div>
                  <div className="absolute bottom-1 right-1.5 text-slate-400 text-xs select-none">❖</div>
                </>
              )}

              {/* MULTI-COLUMN WYSIWYG EDITABLE CANVAS */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={updateStats}
                className="w-full h-full min-h-[600px] outline-none text-slate-900 leading-relaxed question-paper-editor-content"
                style={{
                  columnCount: columns,
                  columnGap: "24px",
                  columnRule: hasColumnDivider && columns > 1 ? "1.5px solid #cbd5e1" : "none",
                  fontSize: `${fontSizePt}pt`,
                }}
              />
            </div>
          </div>
        </div>

        {/* BOTTOM STATUS BAR */}
        <div className="bg-slate-900 text-slate-400 px-4 py-1.5 flex items-center justify-between text-[11px] border-t border-slate-800 shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>পৃষ্ঠা ফরম্যাট: <strong>{pageSize}</strong> ({orientation})</span>
            <span>কলাম: <strong>{columns} কলাম</strong></span>
            <span>ফন্ট: <strong>{selectedFont}</strong> ({fontSizePt}pt)</span>
          </div>
          <div className="flex items-center gap-3">
            <span>শব্দ: {toBanglaNumber(wordCount)}</span>
            <span>অক্ষর: {toBanglaNumber(charCount)}</span>
            <span className="text-emerald-400 font-sans">✓ ড্রাফট প্রস্তুত</span>
          </div>
        </div>

      </div>

      {/* ISOLATED PRINT STYLES */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: ${pageSize} ${orientation};
              margin: 4mm 5mm 4mm 5mm !important;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #temp-print-frame {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .question-paper-editor-content {
              column-count: ${columns} !important;
              column-gap: 24px !important;
              column-rule: ${hasColumnDivider && columns > 1 ? "1.5px solid #94a3b8" : "none"} !important;
            }
          }
        `
      }} />
    </div>
  );
}
