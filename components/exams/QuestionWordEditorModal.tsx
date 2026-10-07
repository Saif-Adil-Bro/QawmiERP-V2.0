"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, Printer, Save, X, RotateCcw, RotateCw,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table, Plus, Trash2,
  Columns, Sparkles, LayoutTemplate, Palette, Eye, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Check, ArrowLeftRight, HelpCircle, Subscript,
  Superscript, Type, Eraser, Scissors, Copy, SplitSquareVertical,
  CornerDownLeft, CornerRightDown, Heading1, Heading2, Heading3,
  Sliders, ArrowDown, MoveDown, Info
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
export type MarginSize = "tight" | "narrow" | "normal" | "moderate";
export type ColumnFillMode = "full_height" | "free_flow" | "balance";

export default function QuestionWordEditorModal({
  initialContent,
  examTitle = "বার্ষিক পরীক্ষা - ২০২৬",
  subjectName = "কুরআন ও হাদিস",
  className: targetClassName = "জামাতে তাইসির",
  madrasaName = "দারুল উলূম ইসলামিয়া মাদরাসা",
  onSave,
  onClose,
}: QuestionWordEditorModalProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Active Ribbon Tab
  const [activeRibbonTab, setActiveRibbonTab] = useState<"home" | "layout" | "insert" | "view">("home");

  // Page Format Settings
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [columns, setColumns] = useState<ColumnCount>(2);
  const [hasColumnDivider, setHasColumnDivider] = useState(true);
  const [columnFillMode, setColumnFillMode] = useState<ColumnFillMode>("full_height");
  const [marginSize, setMarginSize] = useState<MarginSize>("tight");
  const [customBottomMarginMm, setCustomBottomMarginMm] = useState<number>(6);
  const [borderStyle, setBorderStyle] = useState<"double" | "simple" | "none">("double");
  const [selectedFont, setSelectedFont] = useState("SolaimanLipi");
  const [fontSizePt, setFontSizePt] = useState<string>("13");
  const [zoomLevel, setZoomLevel] = useState<number>(95);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);

  // Undo / Redo History Stack State
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoAction = useRef(false);

  // Table Grid Insert Dimensions
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);

  // Stats
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Default Full-Width Top Header Template
  const defaultHeaderTemplate = `
    <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 6px;">
      <div style="font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 15px; color: #064e3b; margin-bottom: 2px;" dir="rtl">
        بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
      </div>
      <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
        ${madrasaName}
      </h1>
      <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">
        ${examTitle}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; color: #1e293b; border-top: 1px dashed #64748b; margin-top: 3px; padding-top: 2px;">
        <span>জামাত: ${targetClassName}</span>
        <span>বিষয়: ${subjectName}</span>
        <span>সময়: ২ ঘণ্টা ৩০ মিনিট</span>
        <span>পূর্ণমান: ১০০</span>
      </div>
    </div>
    <div style="font-size: 10.5px; font-style: italic; color: #475569; margin-bottom: 6px; border-left: 3px solid #059669; padding-left: 5px;">
      [বিশেষ দ্রষ্টব্য: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক।]
    </div>
  `;

  // Default Questions Body Template
  const defaultQuestionsBodyTemplate = `
    <div style="background-color: #f1f5f9; padding: 3px 6px; font-weight: 800; font-size: 13px; color: #0f172a; border-left: 3px solid #0284c7; margin-bottom: 6px;">
      ক-বিভাগ: কুরআন ও হাদিস (মান: ৫০)
    </div>

    <p style="margin: 4px 0 6px 0; line-height: 1.5; font-size: 13px;">
      <strong>১. </strong> নিম্নের আয়াতুল কারিমার সহিহ তরজমা ও প্রাসঙ্গিক শানে নুযুল বিস্তারিত আলোচনা করো: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
    </p>
    <div style="font-family: 'Amiri', serif; font-size: 16px; text-align: right; background-color: #f8fafc; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin: 4px 0 6px 0;" dir="rtl">
      « إِنَّ الدِّينَ عِندَ اللَّهِ الْإِسْلَامُ ۗ وَمَا اخْتَلَفَ الَّذِينَ أُوتُوا الْكِتَابَ إِلَّا مِن بَعْدِ مَا جَاءَهُمُ الْعِلْمُ »
    </div>

    <p style="margin: 4px 0 6px 0; line-height: 1.5; font-size: 13px;">
      <strong>২. </strong> যেকোনো পাঁচটি হাদিসের অর্থ ও সংক্ষিপ্ত ব্যাখ্যা লিখ: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
    </p>
    <p style="margin: 2px 0 2px 14px; font-size: 12.5px;">(ক) طلب العلم فريضة على كل مسلم</p>
    <p style="margin: 2px 0 2px 14px; font-size: 12.5px;">(খ) خيركم من تعلم القرآن وعلمه</p>
    <p style="margin: 2px 0 2px 14px; font-size: 12.5px;">(গ) الدين النصيحة</p>

    <div style="background-color: #f1f5f9; padding: 3px 6px; font-weight: 800; font-size: 13px; color: #0f172a; border-left: 3px solid #059669; margin: 8px 0 6px 0;">
      খ-বিভাগ: ফিকহ ও ফতোয়া (মান: ৫০)
    </div>

    <p style="margin: 4px 0 6px 0; line-height: 1.5; font-size: 13px;">
      <strong>৩. </strong> সালাতের আরকান ও আহকামের বিবরণ দিয়ে নিচের তালিকাটি পূর্ণ করো: <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11.5px; text-align: center;">
      <thead>
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <th style="border: 1px solid #475569; padding: 3px;">নং</th>
          <th style="border: 1px solid #475569; padding: 3px;">নামাজের আহকাম</th>
          <th style="border: 1px solid #475569; padding: 3px;">নামাজের আরকান</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #475569; padding: 3px;">১</td>
          <td style="border: 1px solid #475569; padding: 3px;">শরীর পাক হওয়া</td>
          <td style="border: 1px solid #475569; padding: 3px;">তাকবীরে তাহরীমা</td>
        </tr>
        <tr>
          <td style="border: 1px solid #475569; padding: 3px;">২</td>
          <td style="border: 1px solid #475569; padding: 3px;">কাপড় পাক হওয়া</td>
          <td style="border: 1px solid #475569; padding: 3px;">কিয়াম (দাঁড়ানো)</td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 4px 0 6px 0; line-height: 1.5; font-size: 13px;">
      <strong>৪. </strong> অজু ভঙ্গের কারণ কয়টি ও কি কি? বিস্তারিত লিপিবদ্ধ করো। <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
    </p>
    <p style="margin: 4px 0 6px 0; line-height: 1.5; font-size: 13px;">
      <strong>৫. </strong> সংক্ষেপে উত্তর দাও: (ক) তায়াম্মুমের ফরজ কয়টি? (খ) আজানের বাক্যসমূহ লিখ। <span style="float: right; font-weight: bold; color: #0f172a;">[১০]</span>
    </p>
  `;

  // Push snapshot to undo stack
  const saveSnapshot = useCallback(() => {
    if (isUndoRedoAction.current) return;
    const currentHtml = editorRef.current?.innerHTML || "";
    setHistoryStack((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced.length > 0 && sliced[sliced.length - 1] === currentHtml) {
        return prev;
      }
      return [...sliced, currentHtml].slice(-30); // keep last 30 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  // Initialize Content & History
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.innerHTML = defaultHeaderTemplate;
    }
    if (editorRef.current) {
      const content = initialContent || defaultQuestionsBodyTemplate;
      editorRef.current.innerHTML = content;
      setHistoryStack([content]);
      setHistoryIndex(0);
      updateStats();
    }
  }, []);

  const updateStats = () => {
    const headText = headerRef.current?.innerText || "";
    const bodyText = editorRef.current?.innerText || "";
    const fullText = headText + " " + bodyText;
    setCharCount(fullText.length);
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  };

  const handleEditorInput = () => {
    updateStats();
    saveSnapshot();
  };

  // Perform Undo
  const handleUndo = () => {
    if (historyIndex > 0 && editorRef.current) {
      isUndoRedoAction.current = true;
      const targetIndex = historyIndex - 1;
      editorRef.current.innerHTML = historyStack[targetIndex] || "";
      setHistoryIndex(targetIndex);
      updateStats();
      setTimeout(() => {
        isUndoRedoAction.current = false;
      }, 50);
    } else {
      document.execCommand("undo");
      updateStats();
    }
  };

  // Perform Redo
  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1 && editorRef.current) {
      isUndoRedoAction.current = true;
      const targetIndex = historyIndex + 1;
      editorRef.current.innerHTML = historyStack[targetIndex] || "";
      setHistoryIndex(targetIndex);
      updateStats();
      setTimeout(() => {
        isUndoRedoAction.current = false;
      }, 50);
    } else {
      document.execCommand("redo");
      updateStats();
    }
  };

  // Execute standard formatting commands
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      updateStats();
      saveSnapshot();
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
        document.execCommand("insertHTML", false, html);
      }
    } else {
      document.execCommand("insertHTML", false, html);
    }
    updateStats();
    saveSnapshot();
  };

  // Insert a 100% Fresh, Clean Paragraph (Unformatted New Line) that breaks out of any container
  const insertFreshParagraph = (prefixText = "") => {
    if (!editorRef.current) return;

    const sel = window.getSelection();
    const pTag = document.createElement("p");
    pTag.style.margin = "4px 0 6px 0";
    pTag.style.lineHeight = "1.5";
    pTag.style.fontSize = "inherit";
    pTag.style.color = "#0f172a";
    pTag.style.textAlign = "left";
    pTag.style.backgroundColor = "transparent";
    pTag.style.border = "none";
    pTag.style.padding = "0";

    if (prefixText) {
      pTag.innerHTML = `${prefixText}&nbsp;`;
    } else {
      pTag.innerHTML = "<br>";
    }

    if (sel && sel.rangeCount > 0 && sel.anchorNode) {
      const range = sel.getRangeAt(0);
      let currentNode: Node | null = sel.anchorNode;

      // Find highest container block inside editorRef
      let blockNode: HTMLElement | null = null;
      while (currentNode && currentNode !== editorRef.current) {
        if (
          currentNode.nodeType === Node.ELEMENT_NODE &&
          (currentNode as HTMLElement).tagName.match(/^(DIV|H1|H2|H3|H4|TABLE|BLOCKQUOTE|SECTION|P|LI|UL|OL)$/i)
        ) {
          blockNode = currentNode as HTMLElement;
        }
        currentNode = currentNode.parentNode;
      }

      if (blockNode && blockNode.parentNode) {
        // Insert clean paragraph right after the current block container
        blockNode.parentNode.insertBefore(pTag, blockNode.nextSibling);
        
        // Move selection cursor to the new clean paragraph
        const newRange = document.createRange();
        newRange.selectNodeContents(pTag);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
        editorRef.current.focus();
        updateStats();
        saveSnapshot();
        return;
      }
    }

    // Fallback if no block found: append or insert
    editorRef.current.appendChild(pTag);
    const newRange = document.createRange();
    newRange.selectNodeContents(pTag);
    newRange.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    editorRef.current.focus();
    updateStats();
    saveSnapshot();
  };

  // KeyDown Handler: Fix Enter Key & keyboard shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Undo / Redo Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Enter Key Handler: Break out cleanly and create fresh clean paragraph
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode && editorRef.current) {
        let node: Node | null = sel.anchorNode;
        let isInsideStyledBlock = false;
        let blockToBreakOutOf: HTMLElement | null = null;

        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            // Check if inside styled div, heading, blockquote, ribbon, or table
            if (
              el.tagName.match(/^(H1|H2|H3|H4|BLOCKQUOTE)$/i) ||
              el.style.backgroundColor ||
              el.style.border ||
              el.classList.contains("section-ribbon") ||
              el.getAttribute("dir") === "rtl"
            ) {
              isInsideStyledBlock = true;
              blockToBreakOutOf = el;
              break;
            }
          }
          node = node.parentNode;
        }

        if (isInsideStyledBlock && blockToBreakOutOf) {
          e.preventDefault();
          insertFreshParagraph();
          return;
        }
      }
    }
  };

  // Insert Table
  const handleInsertTable = () => {
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; text-align: left;">
      <thead>
        <tr style="background-color: #f1f5f9; font-weight: bold;">`;
    for (let c = 1; c <= tableCols; c++) {
      tableHtml += `<th style="border: 1px solid #475569; padding: 4px 6px;">হেডার ${toBanglaNumber(c)}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= tableRows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `<td style="border: 1px solid #475569; padding: 4px 6px;">তথ্য</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p style="margin: 4px 0;"><br></p>`;
    insertHTML(tableHtml);
    setIsTableMenuOpen(false);
  };

  // Handle Save Document
  const handleSaveDocument = () => {
    const head = headerRef.current?.innerHTML || "";
    const body = editorRef.current?.innerHTML || "";
    const fullHtml = `
      <div class="exam-paper-saved-doc">
        ${showHeader ? `<div class="exam-paper-header">${head}</div>` : ""}
        <div class="exam-paper-body" style="column-count: ${columns}; column-gap: 20px;">
          ${body}
        </div>
      </div>
    `;
    if (onSave) {
      onSave(fullHtml);
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
  const marginPaddingMap: Record<MarginSize, { top: string; right: string; bottom: string; left: string }> = {
    tight: { top: "4mm", right: "6mm", bottom: `${customBottomMarginMm}mm`, left: "6mm" },
    narrow: { top: "6mm", right: "8mm", bottom: `${customBottomMarginMm}mm`, left: "8mm" },
    normal: { top: "10mm", right: "12mm", bottom: `${customBottomMarginMm}mm`, left: "12mm" },
    moderate: { top: "14mm", right: "16mm", bottom: `${customBottomMarginMm}mm`, left: "16mm" },
  };

  // Page Dimension Calculations for exact A4/Letter full-height reach
  const pageHeightMm = orientation === "portrait"
    ? (pageSize === "Letter" ? 279.4 : pageSize === "Legal" ? 355.6 : 297)
    : (pageSize === "Letter" ? 215.9 : pageSize === "Legal" ? 215.9 : 210);

  const pageWidthMm = orientation === "portrait"
    ? (pageSize === "Letter" ? 215.9 : pageSize === "Legal" ? 215.9 : 210)
    : (pageSize === "Letter" ? 279.4 : pageSize === "Legal" ? 355.6 : 297);

  // Available column height inside the page without dead space
  const currentMargin = marginPaddingMap[marginSize];
  const topMarginVal = parseInt(currentMargin.top) || 6;
  const bottomMarginVal = customBottomMarginMm || 6;
  const headerEstimateMm = showHeader ? 32 : 0;
  const targetAvailableHeightMm = Math.max(140, pageHeightMm - topMarginVal - bottomMarginVal - headerEstimateMm - 4);

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex flex-col ${isFullscreen ? "p-0" : "p-2 sm:p-4"}`}>
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
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-sans">
                  {pageSize} • {columns} কলাম • {columnFillMode === "full_height" ? "নিচ পর্যন্ত পূর্ণ (Full Reach)" : "ফ্রি ফ্লো"}
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
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title={isFullscreen ? "ছোট করুন" : "ফুলস্ক্রিন"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
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
            পেজ ও কলাম লেআউট (মার্জিন ফিক্স)
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
            ভিউ ও প্রিভিউ
          </button>
        </div>

        {/* RIBBON TOOLBAR ACTIONS */}
        <div className="bg-slate-200/90 border-b border-slate-300 p-2 text-xs flex flex-wrap items-center gap-x-2.5 gap-y-1.5 shrink-0 select-none shadow-2xs">
          
          {/* TAB 1: HOME (Undo, Redo, Fresh New Line, Typography & Formatting) */}
          {activeRibbonTab === "home" && (
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              
              {/* Undo / Redo Group */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="px-2 py-1.5 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent rounded text-slate-800 font-bold transition cursor-pointer flex items-center gap-1"
                  title="পূর্বাবস্থায় ফিরুন (Undo - Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px]">আন্ডো</span>
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIndex >= historyStack.length - 1}
                  className="px-2 py-1.5 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent rounded text-slate-800 font-bold transition cursor-pointer flex items-center gap-1"
                  title="পুনরায় করুন (Redo - Ctrl+Y)"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px]">রিডো</span>
                </button>
              </div>

              {/* Dedicated Fresh Clean New Line Action */}
              <button
                type="button"
                onClick={() => insertFreshParagraph()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="কোনো ব্যাকগ্রাউন্ড/বর্ডার ছাড়াই একেবারে নতুন ও ফ্রেশ সাধারণ লাইন তৈরি করুন"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>নতুন ফ্রেশ লাইন (Enter)</span>
              </button>

              {/* Heading Selector */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
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
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
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
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-semibold px-1">সাইজ:</span>
                <select
                  value={fontSizePt}
                  onChange={(e) => {
                    setFontSizePt(e.target.value);
                    execCmd("fontSize", e.target.value === "16" ? "4" : e.target.value === "18" ? "5" : e.target.value === "24" ? "6" : e.target.value === "11" ? "2" : "3");
                  }}
                  className="bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
                  title="ফন্ট সাইজ"
                >
                  <option value="10">১০ pt (খুব ছোট)</option>
                  <option value="11">১১ pt (ছোট)</option>
                  <option value="12">১২ pt</option>
                  <option value="13">১৩ pt (স্ট্যান্ডার্ড)</option>
                  <option value="14">১৪ pt</option>
                  <option value="16">১৬ pt</option>
                  <option value="18">১৮ pt (বড়)</option>
                  <option value="24">২৪ pt</option>
                </select>
              </div>

              {/* Basic Styles (B, I, U, S) */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => execCmd("bold")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 font-bold transition cursor-pointer"
                  title="বোল্ড (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("italic")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="ইটালিক (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("underline")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="আন্ডারলাইন (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("strikeThrough")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="কাটা দাগ (Strikethrough)"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Color & Highlight */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
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
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => execCmd("justifyLeft")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="বামে সারিবদ্ধ (Align Left)"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyCenter")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="মাঝখানে (Center)"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyRight")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="ডানে সারিবদ্ধ (Align Right)"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("justifyFull")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="দুইপাশে সমান (Justify)"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Direction Control (RTL / LTR) */}
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
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
                        saveSnapshot();
                      }
                    }
                  }}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded text-[11px] transition font-amiri cursor-pointer"
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
                        saveSnapshot();
                      }
                    }
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[11px] transition cursor-pointer"
                  title="বাংলা / ইংরেজি টেক্সট ডিরেকশন (LTR - বাম দিক থেকে)"
                >
                  বাংলা/Eng (➔ LTR)
                </button>
              </div>

              {/* Lists */}
              <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => execCmd("insertUnorderedList")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="বুলেট পয়েন্ট তালিকা"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd("insertOrderedList")}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-800 transition cursor-pointer"
                  title="ক্রমিক নম্বর তালিকা"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Clear Formatting */}
              <button
                type="button"
                onClick={() => execCmd("removeFormat")}
                className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
                title="ফরম্যাট ক্লিয়ার করুন"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 2: PAGE LAYOUT & COLUMNS (FIXING BOTTOM MARGIN & COLUMN BREAK) */}
          {activeRibbonTab === "layout" && (
            <div className="flex flex-wrap items-center gap-2.5 w-full">
              {/* Paper Size */}
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700">সাইজ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value="A4">A4 (২১০ × ২৯৭ মিমি)</option>
                  <option value="Letter">Letter (৮.৫ × ১১ ইঞ্চি)</option>
                  <option value="Legal">Legal (৮.৫ × ১৪ ইঞ্চি)</option>
                </select>
              </div>

              {/* Page Orientation */}
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700">ওরিয়েন্টেশন:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrientation("portrait")}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      orientation === "portrait" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    লম্বালম্বি
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation("landscape")}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      orientation === "landscape" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    আড়াআড়ি
                  </button>
                </div>
              </div>

              {/* Column Count Selection (1, 2, 3 Columns) */}
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Columns className="w-3.5 h-3.5 text-blue-600" />
                  <span>কলাম:</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setColumns(1)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      columns === 1 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ১ কলাম
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns(2)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      columns === 2 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ২ কলাম (খাতা/প্রশ্ন)
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns(3)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      columns === 3 ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ৩ কলাম
                  </button>
                </div>
              </div>

              {/* Column Height Flow Mode (Full Height vs Free Flow vs Balanced) */}
              {columns > 1 && (
                <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                  <span className="font-bold text-slate-700">কলাম ফ্লো:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setColumnFillMode("full_height")}
                      className={`px-2.5 py-0.5 rounded font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                        columnFillMode === "full_height" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      title="১ম কলাম পেজের একেবারে নিচ পর্যন্ত পূর্ণ হবে, কোনো খালি স্পেস থাকবে না"
                    >
                      <ArrowDown className="w-3 h-3" />
                      <span>নিচ পর্যন্ত পূর্ণ (Full Reach)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnFillMode("free_flow")}
                      className={`px-2.5 py-0.5 rounded font-bold text-xs transition cursor-pointer ${
                        columnFillMode === "free_flow" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      title="স্বাভাবিক ফ্রি-ফ্লো যেখানে টেক্সট আটকে থাকে না"
                    >
                      ফ্রি-ফ্লো (Auto)
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnFillMode("balance")}
                      className={`px-2.5 py-0.5 rounded font-bold text-xs transition cursor-pointer ${
                        columnFillMode === "balance" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      title="উভয় কলাম সমান উচ্চতায় ব্যালান্স থাকবে"
                    >
                      ব্যালান্স (Equal)
                    </button>
                  </div>
                </div>
              )}

              {/* Column Divider Line Toggle */}
              {columns > 1 && (
                <label className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300 cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hasColumnDivider}
                    onChange={(e) => setHasColumnDivider(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="font-bold text-slate-800">মাঝে দাগ</span>
                </label>
              )}

              {/* Margins */}
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700">মার্জিন:</span>
                <select
                  value={marginSize}
                  onChange={(e) => setMarginSize(e.target.value as MarginSize)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                >
                  <option value="tight">জিরো/টাইট (৪ মিমি - সর্বোচ্চ জায়গা)</option>
                  <option value="narrow">সংকীর্ণ (৬ মিমি - রিকমেন্ডেড)</option>
                  <option value="normal">স্ট্যান্ডার্ড (১০ মিমি)</option>
                  <option value="moderate">প্রশস্ত (১৪ মিমি)</option>
                </select>
              </div>

              {/* Bottom Margin Fine Tuning Slider */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700 flex items-center gap-1" title="পেজের নিচের মার্জিন পরিবর্তন করুন">
                  <MoveDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>নিচের মার্জিন:</span>
                </span>
                <input
                  type="range"
                  min={2}
                  max={25}
                  value={customBottomMarginMm}
                  onChange={(e) => setCustomBottomMarginMm(parseInt(e.target.value))}
                  className="w-16 accent-blue-600 cursor-pointer"
                />
                <span className="text-[11px] font-mono font-bold text-blue-800 bg-blue-50 px-1 rounded">
                  {customBottomMarginMm}mm
                </span>
              </div>

              {/* Page Frame Border Style */}
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700">বর্ডার:</span>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="font-bold text-slate-900 outline-none cursor-pointer bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                >
                  <option value="double">ইসলামিক ডাবল (❖ কর্নার)</option>
                  <option value="simple">একক লাইন বর্ডার</option>
                  <option value="none">বর্ডার ছাড়া</option>
                </select>
              </div>

              {/* Toggle Full-Width Header */}
              <label className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300 cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => setShowHeader(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded"
                />
                <span className="font-bold text-slate-800">ফুল-উইডথ হেডার</span>
              </label>
            </div>
          )}

          {/* TAB 3: INSERT & TABLE BUILDER */}
          {activeRibbonTab === "insert" && (
            <div className="flex flex-wrap items-center gap-2 w-full">
              {/* Insert Table Menu Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTableMenuOpen(!isTableMenuOpen)}
                  className="px-3 py-1 bg-white hover:bg-blue-50 text-blue-900 font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
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
              <div className="flex items-center gap-0.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 px-1">প্রশ্ন নং:</span>
                {["১. ", "২. ", "৩. ", "৪. ", "৫. ", "(ক) ", "(খ) ", "(গ) "].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertFreshParagraph(`<strong>${token}</strong> `)}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-800 font-bold rounded text-[11px] transition cursor-pointer"
                  >
                    {token.trim()}
                  </button>
                ))}
              </div>

              {/* Quick Marks Bracket Insertion */}
              <div className="flex items-center gap-0.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 px-1">নম্বর:</span>
                {["[১০]", "[৫+৫=১০]", "(৫×২=১০)", "[২০]", "[৫০]"].map((mark) => (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => insertHTML(` <span style="float: right; font-weight: bold; color: #0f172a;">${mark}</span>`)}
                    className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded text-[11px] transition cursor-pointer"
                  >
                    {mark}
                  </button>
                ))}
              </div>

              {/* Bismillah Calligraphy Ribbon */}
              <button
                type="button"
                onClick={() => insertHTML(`<div style="text-align: center; font-family: 'Amiri', serif; font-size: 15px; color: #064e3b; margin: 4px 0;" dir="rtl">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>`)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded-lg border border-emerald-300 text-xs transition font-amiri cursor-pointer"
                title="বিসমিল্লাহির রাহমানির রাহিম"
              >
                بِسْمِ اللَّهِ
              </button>

              {/* Section Header Ribbon */}
              <button
                type="button"
                onClick={() => insertHTML(`<div class="section-ribbon" style="background-color: #f1f5f9; padding: 3px 6px; font-weight: 800; font-size: 13px; color: #0f172a; border-left: 3px solid #0284c7; margin: 6px 0 4px 0;">ক-বিভাগ: নতুন বিভাগ (মান: ৫০)</div>`)}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-300 text-xs transition cursor-pointer"
                title="নতুন বিভাগ শিরোনাম ফিতা"
              >
                + বিভাগ ফিতা
              </button>

              {/* Blank Fill in the blanks Line */}
              <button
                type="button"
                onClick={() => insertHTML(` .................................................... `)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition cursor-pointer"
                title="শূন্যস্থান পূরণ ডট লাইন"
              >
                শূন্যস্থান (......)
              </button>

              {/* Horizontal Divider Line */}
              <button
                type="button"
                onClick={() => insertHTML(`<hr style="border: none; border-top: 1px solid #cbd5e1; margin: 8px 0;" />`)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 text-xs transition cursor-pointer"
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
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                <span className="font-bold text-slate-700 px-1">প্রিভিউ জুম:</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-700 transition cursor-pointer"
                  title="জুম আউট"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold px-2">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-700 transition cursor-pointer"
                  title="জুম ইন"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(95)}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                >
                  রিসেট (১০০%)
                </button>
              </div>

              {/* Stats Summary */}
              <div className="text-xs text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-300 flex items-center gap-3 shadow-2xs">
                <span>মোট শব্দ: <strong className="text-slate-900">{toBanglaNumber(wordCount)}</strong></span>
                <span>মোট অক্ষর: <strong className="text-slate-900">{toBanglaNumber(charCount)}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CANVAS SCROLL AREA (Realistic MS Word Sheet Container) */}
        <div 
          className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-300/80 flex justify-center items-start"
          onClick={(e) => {
            // Click outside body focuses the editor at bottom
            if (e.target === e.currentTarget && editorRef.current) {
              editorRef.current.focus();
            }
          }}
        >
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
                width: `${pageWidthMm}mm`,
                minHeight: `${pageHeightMm}mm`,
                paddingTop: currentMargin.top,
                paddingRight: currentMargin.right,
                paddingBottom: currentMargin.bottom,
                paddingLeft: currentMargin.left,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
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

              {/* 1. FULL-WIDTH TOP HEADER (Spans 100% width across all columns) */}
              {showHeader && (
                <div
                  ref={headerRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={updateStats}
                  className="w-full shrink-0 outline-none text-slate-900 border-b border-transparent hover:border-blue-200 transition pb-1 mb-1.5"
                />
              )}

              {/* 2. MULTI-COLUMN QUESTIONS BODY (Reaches 100% down to the bottom margin) */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                className="w-full flex-1 outline-none text-slate-900 leading-relaxed question-paper-editor-content"
                style={{
                  columnCount: columns,
                  columnGap: "20px",
                  columnRule: hasColumnDivider && columns > 1 ? "1.2px solid #cbd5e1" : "none",
                  columnFill: columnFillMode === "full_height" ? "auto" : columnFillMode === "free_flow" ? "auto" : "balance",
                  height: columnFillMode === "full_height" ? `${targetAvailableHeightMm}mm` : "auto",
                  minHeight: columnFillMode === "full_height" ? `${targetAvailableHeightMm}mm` : "160mm",
                  fontSize: `${fontSizePt}pt`,
                }}
              />
            </div>
          </div>
        </div>

        {/* BOTTOM STATUS BAR */}
        <div className="bg-slate-900 text-slate-400 px-4 py-1.5 flex items-center justify-between text-[11px] border-t border-slate-800 shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>পৃষ্ঠা: <strong>{pageSize}</strong> ({orientation === "portrait" ? "লম্বালম্বি" : "আড়াআড়ি"})</span>
            <span>কলাম: <strong>{columns} কলাম</strong> ({columnFillMode === "full_height" ? "নিচ পর্যন্ত পূর্ণ" : columnFillMode === "free_flow" ? "ফ্রি ফ্লো" : "ব্যালান্স"})</span>
            <span>ফন্ট: <strong>{selectedFont}</strong> ({fontSizePt}pt)</span>
            <span>নিচের মার্জিন: <strong>{customBottomMarginMm}mm</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-300 font-sans flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-blue-400" />
              <span>আন্ডো (Ctrl+Z) / রিডো (Ctrl+Y) সক্রিয়</span>
            </span>
            <span>শব্দ: {toBanglaNumber(wordCount)}</span>
            <span>অক্ষর: {toBanglaNumber(charCount)}</span>
            <span className="text-emerald-400 font-sans font-bold">✓ প্রস্তুত</span>
          </div>
        </div>

      </div>

      {/* ISOLATED PRINT STYLES */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: ${pageSize} ${orientation};
              margin: ${currentMargin.top} ${currentMargin.right} ${currentMargin.bottom} ${currentMargin.left} !important;
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
              column-gap: 20px !important;
              column-rule: ${hasColumnDivider && columns > 1 ? "1.2px solid #64748b" : "none"} !important;
              column-fill: ${columnFillMode === "full_height" ? "auto" : columnFillMode === "free_flow" ? "auto" : "balance"} !important;
              height: ${columnFillMode === "full_height" ? `${targetAvailableHeightMm + 8}mm` : "auto"} !important;
            }
          }
        `
      }} />
    </div>
  );
}
