"use client";

import React, { useState, useEffect, useRef } from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  Camera,
  Upload,
  Sparkles,
  Printer,
  Copy,
  Check,
  Plus,
  Trash2,
  Table as TableIcon,
  RefreshCw,
  Eye,
  Edit3,
  X,
  FileText,
  AlertCircle,
  Maximize2,
  Minimize2,
  Download,
  BookOpen,
  Key,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Globe,
  FileCode,
  Layers,
} from "lucide-react";
import { parseRawTextToQuestionPaper, OCRProgress } from "@/lib/tesseract-ocr";

export interface QuestionTable {
  title?: string | null;
  headers: string[];
  rows: string[][];
}

export interface SubQuestion {
  label: string;
  text: string;
  marks?: string;
}

export interface QuestionItem {
  id: string;
  questionNo: string;
  marks: string;
  questionText: string;
  arabicText?: string | null;
  subQuestions?: SubQuestion[];
  table?: QuestionTable | null;
}

export interface QuestionPaperData {
  header: {
    madrasaName: string;
    examName: string;
    subject: string;
    className: string;
    time: string;
    totalMarks: string;
    bismillahText?: string;
  };
  generalInstructions?: string;
  questions: QuestionItem[];
  rawSummary?: string;
  rawText?: string;
  engineUsed?: "gemini" | "paddle";
}

const SAMPLE_DEMO_DATA: QuestionPaperData = {
  header: {
    madrasaName: "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা",
    examName: "বার্ষিক পরীক্ষা — ২০২৬",
    subject: "আল-কুরআন ও আকাঈদ",
    className: "হিফজ ও কিতাব বিভাগ",
    time: "২ ঘণ্টা ৩০ মিনিট",
    totalMarks: "১০০",
    bismillahText: "بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ",
  },
  generalInstructions: "যেকোনো ৫টি প্রশ্নের উত্তর দাও। ডানপাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক।",
  questions: [
    {
      id: "q1",
      questionNo: "১",
      marks: "২০",
      questionText: "কুরআন মাজিদ তিলাওয়াত ও হিফজের ফজিলত সম্পর্কে আলোচনা কর।",
      arabicText: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
      subQuestions: [
        { label: "ক", text: "কুরআন শব্দের আভিধানিক ও পারিভাষিক অর্থ কী?", marks: "৫" },
        { label: "খ", text: "উক্ত হাদিস শরিফটির সরল অনুবাদ ও সংক্ষিপ্ত ব্যাখ্যা লিখ।", marks: "১৫" },
      ],
      table: null,
    },
    {
      id: "q2",
      questionNo: "২",
      marks: "১৫",
      questionText: "বাম পাশের বাক্যাংশের সাথে ডান পাশের সঠিক বাক্যাংশ মিল করে পূর্ণ বাক্য তৈরি কর:",
      arabicText: null,
      subQuestions: [],
      table: {
        title: "ক-স্তম্ভ ও খ-স্তম্ভ মিলকরণ",
        headers: ["ক-স্তম্ভ (বাম পাশ)", "খ-স্তম্ভ (ডান পাশ)"],
        rows: [
          ["১. নামাজ ইসলামের", "দ্বীনের মজবুত খুঁটি"],
          ["২. রোজা মুমিনের জন্য", "জাহান্নাম থেকে রক্ষাকারী ঢাল"],
          ["৩. সত্যবাদিতা মানুষকে", "মুক্তির পথে পরিচালিত করে"],
          ["৪. পিতা-মাতার খেদমত", "জান্নাত লাভের সর্বোত্তম উপায়"],
        ],
      },
    },
    {
      id: "q3",
      questionNo: "৩",
      marks: "১৫",
      questionText: "নিচের ছকে উল্লেখিত আরবি শব্দগুলোর অর্থ ও বচন (ওয়াহেদ/জমা) লিখ:",
      arabicText: null,
      subQuestions: [],
      table: {
        title: "শব্দার্থ ও বচন ছক",
        headers: ["আরবি শব্দ", "বাংলা অর্থ", "বচন (واحد/جمع)"],
        rows: [
          ["كِتَابٌ (কিতাব)", "বই / গ্রন্থ", "واحد (একবচন)"],
          ["عُلَمَاءُ (উলামা)", "আলেমগণ / পণ্ডিতবর্গ", "جمع (বহুবচন)"],
          ["مَسْجِدٌ (মাসজিদ)", "সেজদার স্থান / মসজিদ", "واحد (একবচন)"],
          ["أَبْوَابٌ (আবওয়াব)", "দরজাসমূহ", "جمع (বহুবচন)"],
        ],
      },
    },
    {
      id: "q4",
      questionNo: "৪",
      marks: "২০",
      questionText: "সংক্ষিপ্ত উত্তর দাও (যেকোনো ৪টি):",
      arabicText: null,
      subQuestions: [
        { label: "ক", text: "ঈমানের মূল স্তম্ভ কয়টি ও কী কী?", marks: "৫" },
        { label: "খ", text: "ওযুর ফরজ কয়টি এবং সেগুলো কী?", marks: "৫" },
        { label: "গ", text: "তাজবীদ অনুযায়ী গুন্নাহ কাকে বলে?", marks: "৫" },
        { label: "ঘ", text: "কালিমায়ে তাইয়্যেবা অর্থসহ লিখ।", marks: "৫" },
      ],
      table: null,
    },
  ],
};

interface AIQuestionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMadrasaName?: string;
}

export function AIQuestionScannerModal({
  isOpen,
  onClose,
  initialMadrasaName = "কওমি মাদরাসা",
}: AIQuestionScannerModalProps) {
  const [activeTab, setActiveTab] = useState<"scan" | "editor" | "preview">("scan");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<number>(0);
  const [aiProgress, setAiProgress] = useState<number>(0);
  const [scanError, setScanError] = useState<string | null>(null);

  // PaddleOCR Engine states
  const [selectedEngine, setSelectedEngine] = useState<"gemini" | "paddle">("gemini");
  const [paddleLang, setPaddleLang] = useState<"bn" | "ar" | "en">("bn");
  const [paddleProgress, setPaddleProgress] = useState<OCRProgress | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  // Custom Gemini API Key configuration for hosted environments (e.g. Railway)
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);
  const [apiKeySaveSuccess, setApiKeySaveSuccess] = useState(false);
  const [showRailwayGuide, setShowRailwayGuide] = useState(false);

  const [questionData, setQuestionData] = useState<QuestionPaperData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOriginalPhoto, setShowOriginalPhoto] = useState(true);
  const [madrasaLogo, setMadrasaLogo] = useState<string | null>(null);
  const [madrasaName, setMadrasaName] = useState<string>(initialMadrasaName);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("madrasa_gemini_api_key");
      if (stored) {
        setCustomApiKey(stored);
        setApiKeyInput(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/madrasa-info")
      .then((res) => res.json())
      .then((data) => {
        if (data?.name) setMadrasaName(data.name);
        if (data?.logo_url) setMadrasaLogo(data.logo_url);
      })
      .catch(() => {});
  }, []);

  const handleSaveApiKey = (newKey?: string) => {
    const val = (newKey !== undefined ? newKey : apiKeyInput).trim();
    setCustomApiKey(val);
    try {
      if (val) {
        localStorage.setItem("madrasa_gemini_api_key", val);
      } else {
        localStorage.removeItem("madrasa_gemini_api_key");
      }
    } catch {}
    setApiKeySaveSuccess(true);
    setTimeout(() => setApiKeySaveSuccess(false), 2500);
    if (val) {
      setScanError(null);
    }
  };

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setImageFile(file);
    setScanError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreviewUrl(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartScan = async () => {
    if (!imageBase64) {
      setScanError("অনুগ্রহ করে প্রথমে একটি প্রশ্নপত্রের ছবি আপলোড করুন বা ছবি তুলুন।");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanStep(1);
    setAiProgress(12);

    const stepInterval = setInterval(() => {
      setScanStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    const progressInterval = setInterval(() => {
      setAiProgress((prev) => {
        if (prev >= 92) return prev;
        const step = prev < 45 ? 7 : prev < 75 ? 4 : 2;
        return Math.min(92, prev + step);
      });
    }, 550);

    try {
      const response = await fetch("/api/gemini/scan-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-gemini-api-key": customApiKey } : {}),
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageFile?.type || "image/jpeg",
          madrasaName,
          customApiKey: customApiKey || undefined,
        }),
      });

      clearInterval(stepInterval);
      clearInterval(progressInterval);
      setScanStep(4);
      setAiProgress(100);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "এআই স্ক্যানিং সফল হয়নি। অনুগ্রহ করে পরিষ্কার ছবি দিয়ে পুনরায় চেষ্টা করুন।");
      }

      setQuestionData(result.data);
      setActiveTab("editor");
    } catch (err: any) {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      setScanError(err.message || "ছবি প্রসেস করার সময় ত্রুটি ঘটেছে।");
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartPaddleScan = async () => {
    if (!imageBase64 && !imageFile) {
      setScanError("অনুগ্রহ করে প্রথমে একটি প্রশ্নপত্রের ছবি আপলোড করুন বা ছবি তুলুন।");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setPaddleProgress({ status: "ওসিআর প্রো সার্ভারে ছবি পাঠানো হচ্ছে...", progress: 15 });

    const progressTimer = setInterval(() => {
      setPaddleProgress((prev) => {
        if (!prev || prev.progress >= 90) return prev;
        const nextProg = Math.min(90, prev.progress + (prev.progress < 50 ? 12 : 5));
        const nextStatus =
          nextProg < 45
            ? "ওসিআর প্রো ইঞ্জিনে ছবি প্রক্রিয়াকরণ চলছে..."
            : "বাংলা / আরবি / ইংরেজি টেক্সট ও লাইন বিন্যাস শনাক্ত হচ্ছে...";
        return { status: nextStatus, progress: nextProg };
      });
    }, 500);

    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append("file", imageFile, imageFile.name || "question.jpg");
      } else if (imageBase64) {
        const resBlob = await fetch(imageBase64).then((r) => r.blob());
        formData.append("file", resBlob, "question.jpg");
      }
      formData.append("lang", paddleLang);

      const response = await fetch("/api/ocr/paddle", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);
      setPaddleProgress({ status: "প্রশ্নপত্র কাঠামো তৈরি হচ্ছে...", progress: 100 });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "ওসিআর প্রো সার্ভিস থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
        );
      }

      const fullText = result.full_text || "";
      if (!fullText.trim()) {
        throw new Error("ছবি থেকে কোনো লেখা শনাক্ত করা সম্ভব হয়নি। অনুগ্রহ করে পরিষ্কার ও পর্যাপ্ত আলোর ছবি দিন।");
      }

      setRawExtractedText(fullText);

      const parsedData = parseRawTextToQuestionPaper(fullText, madrasaName);
      setQuestionData(parsedData);
      setActiveTab("editor");
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("OCR Pro scan error:", err);
      setScanError(
        err.message ||
          "ওসিআর প্রো সার্ভিসের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
      );
    } finally {
      setIsScanning(false);
      setPaddleProgress(null);
    }
  };

  const loadSampleDemo = () => {
    setQuestionData(SAMPLE_DEMO_DATA);
    setImagePreviewUrl("https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80");
    setActiveTab("editor");
  };

  // Printing Function using isolated iframe
  const handlePrint = () => {
    if (!questionData) return;

    try {
      const printIframe = document.createElement("iframe");
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "0";
      document.body.appendChild(printIframe);

      const qHtml = questionData.questions
        .map((q) => {
          let subQuestionsHtml = "";
          if (q.subQuestions && q.subQuestions.length > 0) {
            subQuestionsHtml = `
              <div class="sub-questions" style="margin-top:6px; padding-left:14px;">
                ${q.subQuestions
                  .map(
                    (sq) => `
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
                    <div><b>(${sq.label})</b> ${sq.text}</div>
                    ${sq.marks ? `<div style="font-weight:bold; white-space:nowrap; padding-left:10px;">[${sq.marks}]</div>` : ""}
                  </div>
                `
                  )
                  .join("")}
              </div>
            `;
          }

          let tableHtml = "";
          if (q.table && q.table.headers && q.table.rows) {
            tableHtml = `
              <div style="margin:8px 0; overflow-x:auto;">
                ${q.table.title ? `<div style="font-size:11px; font-weight:bold; margin-bottom:3px;">${q.table.title}</div>` : ""}
                <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:4px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      ${q.table.headers.map((h) => `<th style="border:1px solid #000; padding:5px 8px; text-align:center;">${h}</th>`).join("")}
                    </tr>
                  </thead>
                  <tbody>
                    ${q.table.rows
                      .map(
                        (row) => `
                      <tr>
                        ${row.map((cell) => `<td style="border:1px solid #000; padding:5px 8px; text-align:center;">${cell}</td>`).join("")}
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `;
          }

          let arabicHtml = "";
          if (q.arabicText) {
            arabicHtml = `
              <div dir="rtl" style="font-family:'Amiri', serif; font-size:15px; font-weight:bold; color:#0f172a; margin:4px 0; text-align:center;">
                « ${q.arabicText} »
              </div>
            `;
          }

          return `
            <div class="question-block" style="margin-bottom:12px; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-size:13px; font-weight:bold; line-height:1.5;">
                  ${q.questionNo}। ${q.questionText}
                </div>
                ${q.marks ? `<div style="font-size:13px; font-weight:bold; white-space:nowrap; padding-left:12px;">[${q.marks}]</div>` : ""}
              </div>
              ${arabicHtml}
              ${tableHtml}
              ${subQuestionsHtml}
            </div>
          `;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="utf-8" />
          <title>${questionData.header.subject} - প্রশ্নপত্র</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Hind Siliguri', 'SolaimanLipi', sans-serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 13px;
              line-height: 1.5;
            }
            .paper-container {
              border: 2px solid #000;
              padding: 16px 20px;
              min-height: 98vh;
              position: relative;
            }
            .header-bismillah {
              text-align: center;
              font-family: 'Amiri', serif;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .institute-name {
              text-align: center;
              font-size: 20px;
              font-weight: 800;
              margin: 2px 0;
              letter-spacing: -0.2px;
            }
            .exam-title {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 6px;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 4px 6px;
              font-size: 12px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .instructions {
              text-align: center;
              font-size: 11px;
              font-style: italic;
              margin-bottom: 14px;
              color: #222;
            }
          </style>
        </head>
        <body>
          <div class="paper-container">
            <div class="header-bismillah">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
            <div class="institute-name">${questionData.header.madrasaName || madrasaName}</div>
            <div class="exam-title">${questionData.header.examName}</div>
            
            <div class="meta-bar">
              <div>বিষয়: <b>${questionData.header.subject}</b></div>
              <div>জামাত: <b>${questionData.header.className}</b></div>
              <div>সময়: <b>${questionData.header.time}</b></div>
              <div>পূর্ণমান: <b>${questionData.header.totalMarks}</b></div>
            </div>

            ${questionData.generalInstructions ? `<div class="instructions">[ দ্রষ্টব্য: ${questionData.generalInstructions} ]</div>` : ""}

            <div class="questions-body">
              ${qHtml}
            </div>
          </div>
        </body>
        </html>
      `;

      const doc = printIframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(printIframe);
          }, 1500);
        }, 600);
      }
    } catch (err) {
      console.error("Print error:", err);
    }
  };

  const copyToClipboard = () => {
    if (!questionData) return;
    let text = `${questionData.header.bismillahText || "بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ"}\n`;
    text += `${questionData.header.madrasaName}\n`;
    text += `${questionData.header.examName}\n`;
    text += `বিষয়: ${questionData.header.subject} | জামাত: ${questionData.header.className} | সময়: ${questionData.header.time} | পূর্ণমান: ${questionData.header.totalMarks}\n\n`;
    if (questionData.generalInstructions) {
      text += `নির্দেশনা: ${questionData.generalInstructions}\n\n`;
    }
    questionData.questions.forEach((q) => {
      text += `${q.questionNo}। ${q.questionText} [${q.marks}]\n`;
      if (q.arabicText) text += `   ${q.arabicText}\n`;
      if (q.table) {
        text += `   [টেবিল: ${q.table.headers.join(" | ")}]\n`;
        q.table.rows.forEach((r) => {
          text += `   ${r.join(" | ")}\n`;
        });
      }
      if (q.subQuestions) {
        q.subQuestions.forEach((sq) => {
          text += `   (${sq.label}) ${sq.text} [${sq.marks || ""}]\n`;
        });
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Editor mutation helpers
  const updateHeaderField = (field: keyof QuestionPaperData["header"], value: string) => {
    if (!questionData) return;
    setQuestionData({
      ...questionData,
      header: {
        ...questionData.header,
        [field]: value,
      },
    });
  };

  const updateQuestionText = (qIndex: number, text: string) => {
    if (!questionData) return;
    const updated = [...questionData.questions];
    updated[qIndex].questionText = text;
    setQuestionData({ ...questionData, questions: updated });
  };

  const updateQuestionMarks = (qIndex: number, marks: string) => {
    if (!questionData) return;
    const updated = [...questionData.questions];
    updated[qIndex].marks = marks;
    setQuestionData({ ...questionData, questions: updated });
  };

  const updateArabicText = (qIndex: number, arabic: string) => {
    if (!questionData) return;
    const updated = [...questionData.questions];
    updated[qIndex].arabicText = arabic;
    setQuestionData({ ...questionData, questions: updated });
  };

  const addQuestion = () => {
    if (!questionData) return;
    const nextNo = (questionData.questions.length + 1).toLocaleString("bn-BD");
    const newQ: QuestionItem = {
      id: `q_${Date.now()}`,
      questionNo: nextNo,
      marks: "১০",
      questionText: "নতুন প্রশ্নের বিবরণ এখানে লিখুন...",
      subQuestions: [],
      table: null,
    };
    setQuestionData({
      ...questionData,
      questions: [...questionData.questions, newQ],
    });
  };

  const removeQuestion = (qIndex: number) => {
    if (!questionData) return;
    const updated = questionData.questions.filter((_, idx) => idx !== qIndex);
    setQuestionData({ ...questionData, questions: updated });
  };

  const addSubQuestion = (qIndex: number) => {
    if (!questionData) return;
    const updated = [...questionData.questions];
    const labels = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
    const currentSubs = updated[qIndex].subQuestions || [];
    const nextLabel = labels[currentSubs.length] || `${currentSubs.length + 1}`;
    updated[qIndex].subQuestions = [
      ...currentSubs,
      { label: nextLabel, text: "উপ-প্রশ্নের টেক্সট...", marks: "৫" },
    ];
    setQuestionData({ ...questionData, questions: updated });
  };

  const removeSubQuestion = (qIndex: number, subIdx: number) => {
    if (!questionData) return;
    const updated = [...questionData.questions];
    if (updated[qIndex].subQuestions) {
      updated[qIndex].subQuestions = updated[qIndex].subQuestions!.filter((_, idx) => idx !== subIdx);
      setQuestionData({ ...questionData, questions: updated });
    }
  };

  const updateTableCell = (qIndex: number, rowIdx: number, colIdx: number, val: string) => {
    if (!questionData || !questionData.questions[qIndex].table) return;
    const updated = [...questionData.questions];
    const table = updated[qIndex].table!;
    table.rows[rowIdx][colIdx] = val;
    setQuestionData({ ...questionData, questions: updated });
  };

  const addTableRow = (qIndex: number) => {
    if (!questionData || !questionData.questions[qIndex].table) return;
    const updated = [...questionData.questions];
    const table = updated[qIndex].table!;
    const newRow = new Array(table.headers.length).fill("তথ্য লিখুন");
    table.rows.push(newRow);
    setQuestionData({ ...questionData, questions: updated });
  };

  const removeTableRow = (qIndex: number, rowIdx: number) => {
    if (!questionData || !questionData.questions[qIndex].table) return;
    const updated = [...questionData.questions];
    const table = updated[qIndex].table!;
    table.rows = table.rows.filter((_, idx) => idx !== rowIdx);
    setQuestionData({ ...questionData, questions: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[96vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-emerald-300/30 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>এআই প্রশ্নপত্র ও টেবিল স্ক্যানার</span>
                <span className="text-[10px] bg-amber-400 text-emerald-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Vision OCR
                </span>
              </h2>
              <p className="text-[11px] text-emerald-100 hidden sm:block">
                হাতে লেখা বা প্রিন্ট করা প্রশ্নের ছবি তুলে এক ক্লিকে বাংলা টেক্সট ও টেবিল ডিজিটাইজ করুন
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex bg-black/20 p-1 rounded-xl text-xs">
              <button
                onClick={() => setActiveTab("scan")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "scan"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-emerald-100 hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">১. ছবি আপলোড</span>
              </button>

              <button
                onClick={() => questionData && setActiveTab("editor")}
                disabled={!questionData}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "editor"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : questionData
                    ? "text-emerald-100 hover:text-white"
                    : "text-emerald-300/40 cursor-not-allowed"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">২. এডিটর</span>
              </button>

              <button
                onClick={() => questionData && setActiveTab("preview")}
                disabled={!questionData}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "preview"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : questionData
                    ? "text-emerald-100 hover:text-white"
                    : "text-emerald-300/40 cursor-not-allowed"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">৩. প্রিন্ট প্রিভিউ</span>
              </button>
            </div>

            {/* API Key Settings Button */}
            <button
              onClick={() => setShowApiKeyConfig(!showApiKeyConfig)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ml-1 ${
                customApiKey
                  ? "bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-400/40"
                  : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30"
              }`}
              title="OpenRouter API Key কনফিগারেশন"
            >
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden md:inline">{customApiKey ? "API Key সক্রিয়" : "API Key সেটআপ"}</span>
              <span className="md:hidden">Key</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors ml-1"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
          {/* ================= TAB 1: UPLOAD & SCAN ================= */}
          {activeTab === "scan" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* API Key Configuration Panel */}
              {(showApiKeyConfig || (scanError && scanError.includes("OPENROUTER_API_KEY"))) && (
                <div className="p-4 sm:p-5 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-400/80 dark:border-amber-700 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                        <Key className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-100">
                          OpenRouter Vision AI কনফিগারেশন
                        </h4>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          রেলওয়ে (Railway) বা লাইভ সার্ভারে <code className="font-mono font-bold">OPENROUTER_API_KEY</code> সেট করা থাকলে আলাদাভাবে এখানে কিছু দেওয়ার প্রয়োজন নেই।
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowApiKeyConfig(false)}
                      className="text-amber-700 hover:text-amber-900 dark:text-amber-300 p-1"
                      title="লুকান"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Railway Permanent Setup Guide Accordion */}
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                    <button
                      onClick={() => setShowRailwayGuide(!showRailwayGuide)}
                      className="w-full flex items-center justify-between text-left text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:underline py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>রেলওয়ে (Railway.app)-তে স্থায়ীভাবে OPENROUTER_API_KEY সেট করার সহজ নিয়ম</span>
                      </span>
                      {showRailwayGuide ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                    </button>

                    {showRailwayGuide && (
                      <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          রেলওয়ে ড্যাশবোর্ডে ভ্যারিয়েবল সেট করার ৩টি ধাপ:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 pl-1">
                          <li>
                            <b>railway.app</b> ড্যাশবোর্ডে লগইন করে আপনার মাদরাসা অ্যাপ সার্ভিসটিতে ক্লিক করুন।
                          </li>
                          <li>উপরের মেনু থেকে <b>Variables</b> ট্যাবে যান।</li>
                          <li>
                            <b>+ New Variable</b> বাটনে চাপ দিন এবং Name লিখুন: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-rose-600 font-mono font-bold">OPENROUTER_API_KEY</code>
                          </li>
                          <li>
                            Value বক্সে আপনার OpenRouter API Key (<code className="font-mono">sk-or-v1-...</code>) পেস্ট করে <b>Add</b> দিন।
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* OCR Engine Selection Tabs */}
              <div className="bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex flex-col sm:flex-row gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedEngine("gemini")}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedEngine === "gemini"
                        ? "bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-300 dark:border-emerald-600"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>এআই ভিশন স্ক্যানার</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">
                      টেবিল ও হরকত
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEngine("paddle")}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedEngine === "paddle"
                        ? "bg-white dark:bg-slate-800 text-indigo-800 dark:text-indigo-300 shadow-xs border border-indigo-400 dark:border-indigo-600"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>ওসিআর প্রো</span>
                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                      হাই-একুরেসি
                    </span>
                  </button>
                </div>

                {/* Engine Info & Controls */}
                {selectedEngine === "paddle" ? (
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                        <span>ওসিআর প্রো — বাংলা, আরবি ও ইংরেজি হাই-একুরেসি স্ক্যানার</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        ছবি থেকে দ্রুত ও নির্ভুলভাবে লেখা শনাক্ত করে সরাসরি এডিটেবল প্রশ্নপত্রে রূপান্তর করে।
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">ভাষা:</span>
                      <select
                        value={paddleLang}
                        onChange={(e) => setPaddleLang(e.target.value as "bn" | "ar" | "en")}
                        className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                      >
                        <option value="bn">বাংলা (bn)</option>
                        <option value="ar">আরবি (ar)</option>
                        <option value="en">ইংরেজি (en)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>এআই ভিশন স্ক্যানার দিয়ে জটিল টেবিল, বাংলা ও আরবি হরকত সহজে গঠন করে।</span>
                    <button
                      type="button"
                      onClick={() => setShowApiKeyConfig(!showApiKeyConfig)}
                      className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" />
                      <span>সেটআপ গাইড</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dropzone Card */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-emerald-400/80 hover:border-emerald-600 bg-white dark:bg-slate-900 rounded-2xl p-8 text-center cursor-pointer transition-all shadow-sm group hover:shadow-md"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-emerald-200 dark:border-emerald-800">
                  <Upload className="w-8 h-8" />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                  প্রশ্নপত্রের ছবি এখানে টেনে আনুন বা ক্লিক করুন
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                  হাতে লেখা খসড়া বা প্রিন্ট করা প্রশ্নের ছবি তুলুন। ছবি থেকে বাংলা টেক্সট, আরবি হরফ ও টেবিল স্বয়ংক্রিয়ভাবে শনাক্ত হবে।
                </p>

                <div className="flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>গ্যালারি / ফাইল থেকে পছন্দ করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-300" />
                    <span>ক্যামেরা দিয়ে সরাসরি ছবি তুলুন</span>
                  </button>
                </div>
              </div>

              {/* Demo Sample Quick Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>এখনই কোনো প্রশ্নপত্রের ছবি না থাকলে নমুনা দিয়ে কার্যকারিতা যাচাই করতে পারেন:</span>
                </div>
                <button
                  onClick={loadSampleDemo}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 transition-colors shadow-xs"
                >
                  নমুনা প্রশ্নপত্র লোড করুন
                </button>
              </div>

              {/* Uploaded Preview & Start Scan Bar */}
              {imagePreviewUrl && (
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        নির্বাচিত ছবি: {imageFile?.name || "ছবি ক্যাপচার"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreviewUrl(null);
                        setImageBase64(null);
                      }}
                      className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>ছবি পরিবর্তন</span>
                    </button>
                  </div>

                  <div className="relative max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                    <img
                      src={imagePreviewUrl}
                      alt="Question Paper Preview"
                      className="max-h-72 w-auto object-contain mx-auto"
                    />
                    
                    {/* OCR Pro Live Progress Overlay */}
                    {isScanning && paddleProgress && (
                      <div className="absolute inset-0 bg-indigo-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 text-center z-20">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600/50 border-2 border-indigo-400 flex items-center justify-center mb-3 animate-pulse">
                          <Cpu className="w-7 h-7 text-amber-300 animate-spin" />
                        </div>
                        <h4 className="font-bold text-sm sm:text-base mb-1">
                          ওসিআর প্রো স্ক্যান চলছে...
                        </h4>
                        <p className="text-xs text-indigo-200 mb-3 max-w-sm">
                          {paddleProgress.status}
                        </p>
                        <div className="w-64 max-w-full bg-indigo-900/80 rounded-full h-3 overflow-hidden border border-indigo-700 shadow-inner">
                          <div
                            className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 h-3 rounded-full transition-all duration-300 shadow-sm"
                            style={{ width: `${Math.max(5, paddleProgress.progress)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-indigo-300 mt-1.5 font-mono font-bold">
                          {toBanglaNumber(paddleProgress.progress)}% সম্পন্ন
                        </span>
                      </div>
                    )}

                    {/* AI Vision Scanner Live Progress Overlay */}
                    {isScanning && !paddleProgress && (
                      <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 text-center z-20">
                        <div className="relative w-14 h-14 mb-3">
                          <div className="w-14 h-14 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
                          <Sparkles className="w-5 h-5 text-amber-300 absolute inset-0 m-auto" />
                        </div>
                        <h4 className="font-bold text-sm sm:text-base mb-1">
                          এআই ভিশন স্ক্যানার প্রশ্নপত্র স্ক্যান করছে...
                        </h4>
                        <p className="text-xs text-emerald-200 mb-3 max-w-sm animate-pulse">
                          {scanStep === 1 && "১. ছবি প্রস্তুত ও এআই ভিশন স্ক্যানারে পাঠানো হচ্ছে..."}
                          {scanStep === 2 && "২. বাংলা, আরবি হরকত ও উর্দু লেখা শনাক্ত করা হচ্ছে..."}
                          {scanStep === 3 && "৩. প্রশ্ন নম্বর, মান ও টেবিল কাঠামো সাজানো হচ্ছে..."}
                          {scanStep >= 4 && "৪. এডিটেবল প্রশ্নপত্রে রূপান্তর সম্পন্ন হচ্ছে..."}
                        </p>
                        <div className="w-64 max-w-full bg-emerald-900/80 rounded-full h-3 overflow-hidden border border-emerald-700 shadow-inner">
                          <div
                            className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 h-3 rounded-full transition-all duration-300 shadow-sm"
                            style={{ width: `${Math.max(8, aiProgress)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-emerald-200 mt-1.5 font-mono font-bold">
                          {toBanglaNumber(aiProgress)}% সম্পন্ন
                        </span>
                      </div>
                    )}
                  </div>

                  {scanError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span className="font-bold">{scanError}</span>
                        </div>
                        {scanError.includes("OPENROUTER_API_KEY") && (
                          <button
                            type="button"
                            onClick={() => setShowApiKeyConfig(true)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition-colors shadow-xs"
                          >
                            সেটআপ গাইড
                          </button>
                        )}
                      </div>
                      
                      {/* One-click OCR Pro Fallback Button */}
                      <div className="pt-1 border-t border-rose-200/80 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-700 font-medium">
                          বিকল্প হিসেবে ওসিআর প্রো দিয়ে স্ক্যান করতে চান?
                        </span>
                        <button
                          type="button"
                          onClick={handleStartPaddleScan}
                          disabled={isScanning}
                          className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                        >
                          <Cpu className="w-3.5 h-3.5 text-amber-300" />
                          <span>ওসিআর প্রো দিয়ে এখনই স্ক্যান করুন</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dual Action Scan Buttons */}
                  {selectedEngine === "paddle" ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleStartPaddleScan}
                        disabled={isScanning}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>ওসিআর প্রো দিয়ে স্ক্যান চলছে...</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-4 h-4 text-amber-300" />
                            <span>ওসিআর প্রো দিয়ে স্ক্যান করুন</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEngine("gemini");
                            handleStartScan();
                          }}
                          disabled={isScanning}
                          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5 font-semibold py-1"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>অথবা এআই ভিশন স্ক্যানার দিয়ে স্ক্যান করুন (উন্নত টেবিল ও কাঠামো)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleStartScan}
                        disabled={isScanning}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>এআই স্ক্যানিং চলছে ({toBanglaNumber(aiProgress)}%)...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>এআই ভিশন স্ক্যানার দিয়ে স্ক্যান করুন (টেবিল ও ফরমেট)</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-center pt-1">
                        <button
                          type="button"
                          onClick={handleStartPaddleScan}
                          disabled={isScanning}
                          className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1.5 font-bold py-1 bg-indigo-50 dark:bg-indigo-950/50 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                        >
                          <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                          <span>অথবা ওসিআর প্রো দিয়ে স্ক্যান করুন</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: DUAL VIEW & EDITOR ================= */}
          {activeTab === "editor" && questionData && (
            <div className="space-y-4">
              {/* Control Toolbar */}
              <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowOriginalPhoto(!showOriginalPhoto)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                      showOriginalPhoto
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                        : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{showOriginalPhoto ? "আসল ছবি লুকান" : "আসল ছবি দেখুন (ডুয়েল ভিউ)"}</span>
                  </button>

                  {/* Engine Badge */}
                  {questionData.engineUsed === "paddle" ? (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ওসিআর প্রো</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>এআই ভিশন স্ক্যানার</span>
                    </span>
                  )}

                  {/* Raw Text Toggle Button if available */}
                  {(rawExtractedText || questionData.rawText) && (
                    <button
                      onClick={() => setShowRawText(!showRawText)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-all ${
                        showRawText
                          ? "bg-slate-800 text-white border-slate-900"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <FileCode className="w-3 h-3 text-slate-400" />
                      <span>{showRawText ? "আসল টেক্সট লুকান" : "আসল স্ক্যানকৃত টেক্সট (Raw)"}</span>
                    </button>
                  )}

                  <span className="text-xs text-slate-400">
                    মোট প্রশ্ন: {questionData.questions.length}টি
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={addQuestion}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>নতুন প্রশ্ন যোগ করুন</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("preview")}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>প্রিন্ট প্রিভিউতে যান</span>
                  </button>
                </div>
              </div>

              {/* Raw Extracted Text Viewer Panel */}
              {showRawText && (rawExtractedText || questionData.rawText) && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-300">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span>ছবি থেকে সরাসরি স্ক্যানকৃত মূল টেক্সট (OCR Raw Output):</span>
                    </div>
                    <button
                      onClick={() => {
                        const txt = rawExtractedText || questionData.rawText || "";
                        navigator.clipboard.writeText(txt);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "কপি হয়েছে!" : "টেক্সট কপি করুন"}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-black/50 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed border border-slate-800">
                    {rawExtractedText || questionData.rawText}
                  </pre>
                </div>
              )}

              {/* Dual Layout: Left Original Photo, Right Live Editor */}
              <div className={`grid gap-4 ${showOriginalPhoto && imagePreviewUrl ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"}`}>
                {/* Left: Original Photo */}
                {showOriginalPhoto && imagePreviewUrl && (
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm h-fit sticky top-2">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>মূল আপলোডকৃত ছবি</span>
                      </span>
                      <span className="text-[10px] text-slate-400">মিলিয়ে দেখার জন্য</span>
                    </div>
                    <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center p-2">
                      <img
                        src={imagePreviewUrl}
                        alt="Original Question Paper"
                        className="w-full h-auto object-contain rounded-lg shadow-inner"
                      />
                    </div>
                  </div>
                )}

                {/* Right: Live Interactive Editor */}
                <div className={`${showOriginalPhoto && imagePreviewUrl ? "lg:col-span-7" : "w-full"} space-y-4`}>
                  {/* Header Edit Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 flex items-center justify-between">
                      <span>প্রশ্নপত্রের শিরোনাম ও সময়-নম্বর তথ্য</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                        হেডার সেকশন
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">মাদরাসার নাম:</label>
                        <input
                          type="text"
                          value={questionData.header.madrasaName}
                          onChange={(e) => updateHeaderField("madrasaName", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">পরীক্ষার নাম:</label>
                        <input
                          type="text"
                          value={questionData.header.examName}
                          onChange={(e) => updateHeaderField("examName", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">বিষয়:</label>
                        <input
                          type="text"
                          value={questionData.header.subject}
                          onChange={(e) => updateHeaderField("subject", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">জামাত / শ্রেণি:</label>
                        <input
                          type="text"
                          value={questionData.header.className}
                          onChange={(e) => updateHeaderField("className", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">সময়:</label>
                        <input
                          type="text"
                          value={questionData.header.time}
                          onChange={(e) => updateHeaderField("time", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">পূর্ণমান:</label>
                        <input
                          type="text"
                          value={questionData.header.totalMarks}
                          onChange={(e) => updateHeaderField("totalMarks", e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সাধারণ নির্দেশনা:</label>
                      <input
                        type="text"
                        value={questionData.generalInstructions || ""}
                        onChange={(e) => setQuestionData({ ...questionData, generalInstructions: e.target.value })}
                        placeholder="যেকোনো ৫টি প্রশ্নের উত্তর দাও..."
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {questionData.questions.map((q, qIdx) => (
                      <div
                        key={q.id || qIdx}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                              {q.questionNo}
                            </span>
                            <span className="text-xs font-bold text-slate-800">প্রশ্ন নং {q.questionNo}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-slate-500 text-[11px]">নম্বর:</span>
                              <input
                                type="text"
                                value={q.marks}
                                onChange={(e) => updateQuestionMarks(qIdx, e.target.value)}
                                className="w-12 p-1 text-center font-bold border border-slate-200 rounded-md bg-slate-50 text-xs"
                              />
                            </div>
                            <button
                              onClick={() => removeQuestion(qIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="প্রশ্ন মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Main Question Text */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">প্রশ্নের বিবরণ:</label>
                          <textarea
                            value={q.questionText}
                            onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                            rows={2}
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-medium text-slate-900"
                          />
                        </div>

                        {/* Optional Arabic Text */}
                        {q.arabicText !== undefined && (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              আরবি আয়াত / হাদিস (যদি থাকে):
                            </label>
                            <input
                              type="text"
                              dir="rtl"
                              value={q.arabicText || ""}
                              onChange={(e) => updateArabicText(qIdx, e.target.value)}
                              placeholder="আরবি টেক্সট লিখুন..."
                              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm font-amiri font-bold text-slate-900"
                            />
                          </div>
                        )}

                        {/* Table Editor (if table exists) */}
                        {q.table && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                                <span>টেবিল / স্তম্ভ ছক এডিটর</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => addTableRow(qIdx)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition-colors"
                                >
                                  + নতুন সারি (Row)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...questionData.questions];
                                    updated[qIdx].table = null;
                                    setQuestionData({ ...questionData, questions: updated });
                                  }}
                                  className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[11px] font-semibold hover:bg-rose-200 transition-colors"
                                >
                                  টেবিল সরান
                                </button>
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border border-slate-300 bg-white">
                                <thead>
                                  <tr className="bg-slate-100">
                                    {q.table.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="border border-slate-300 p-1.5 text-center font-bold">
                                        <input
                                          type="text"
                                          value={h}
                                          onChange={(e) => {
                                            const updated = [...questionData.questions];
                                            updated[qIdx].table!.headers[hIdx] = e.target.value;
                                            setQuestionData({ ...questionData, questions: updated });
                                          }}
                                          className="w-full text-center font-bold bg-transparent border-0 focus:ring-1 focus:ring-emerald-500"
                                        />
                                      </th>
                                    ))}
                                    <th className="border border-slate-300 w-8 text-center">#</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {q.table.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="border border-slate-300 p-1">
                                          <input
                                            type="text"
                                            value={cell}
                                            onChange={(e) => updateTableCell(qIdx, rIdx, cIdx, e.target.value)}
                                            className="w-full p-1 text-center bg-transparent border-0 focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </td>
                                      ))}
                                      <td className="border border-slate-300 p-1 text-center">
                                        <button
                                          type="button"
                                          onClick={() => removeTableRow(qIdx, rIdx)}
                                          className="text-slate-400 hover:text-rose-600"
                                        >
                                          <Trash2 className="w-3 h-3 mx-auto" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Sub-questions List */}
                        {q.subQuestions && q.subQuestions.length > 0 && (
                          <div className="space-y-1.5 pl-2 border-l-2 border-emerald-300">
                            <span className="text-[11px] font-semibold text-slate-500">উপ-প্রশ্নসমূহ:</span>
                            {q.subQuestions.map((sq, sqIdx) => (
                              <div key={sqIdx} className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-emerald-800">({sq.label})</span>
                                <input
                                  type="text"
                                  value={sq.text}
                                  onChange={(e) => {
                                    const updated = [...questionData.questions];
                                    updated[qIdx].subQuestions![sqIdx].text = e.target.value;
                                    setQuestionData({ ...questionData, questions: updated });
                                  }}
                                  className="flex-1 p-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs"
                                />
                                <input
                                  type="text"
                                  value={sq.marks || ""}
                                  placeholder="নম্বর"
                                  onChange={(e) => {
                                    const updated = [...questionData.questions];
                                    updated[qIdx].subQuestions![sqIdx].marks = e.target.value;
                                    setQuestionData({ ...questionData, questions: updated });
                                  }}
                                  className="w-12 p-1.5 text-center font-bold border border-slate-200 rounded-lg bg-slate-50 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSubQuestion(qIdx, sqIdx)}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons inside question card */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-[11px]">
                          <button
                            type="button"
                            onClick={() => addSubQuestion(qIdx)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>উপ-প্রশ্ন যোগ (ক/খ)</span>
                          </button>

                          {!q.table && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...questionData.questions];
                                updated[qIdx].table = {
                                  title: "মিলকরণ ছক",
                                  headers: ["ক-স্তম্ভ", "খ-স্তম্ভ"],
                                  rows: [
                                    ["তথ্য ১", "তথ্য ২"],
                                    ["তথ্য ৩", "তথ্য ৪"],
                                  ],
                                };
                                setQuestionData({ ...questionData, questions: updated });
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <TableIcon className="w-3 h-3 text-emerald-600" />
                              <span>টেবিল যোগ করুন</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: A4 PRINT PREVIEW ================= */}
          {activeTab === "preview" && questionData && (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Top Print Actions */}
              <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    A4 অফিসিয়াল মাদরাসা প্রশ্নপত্র লেআউট
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "কপি হয়েছে!" : "টেক্সট কপি"}</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>প্রিন্ট করুন / PDF সংরক্ষণ</span>
                  </button>
                </div>
              </div>

              {/* Realistic A4 White Paper Canvas */}
              <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-md border-2 border-slate-900 min-h-[90vh] font-sans relative">
                {/* Bismillah Calligraphy */}
                <div className="text-center font-amiri font-bold text-lg text-slate-900 mb-1">
                  {questionData.header.bismillahText || "بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ"}
                </div>

                {/* Madrasa Title */}
                <h1 className="text-center text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  {questionData.header.madrasaName || madrasaName}
                </h1>
                <p className="text-center text-xs sm:text-sm font-bold text-slate-800 mb-3">
                  {questionData.header.examName}
                </p>

                {/* Exam Meta Header Bar */}
                <div className="flex flex-wrap items-center justify-between border-y-2 border-black py-1.5 text-xs font-semibold mb-3">
                  <div>বিষয়: <b className="font-bold">{questionData.header.subject}</b></div>
                  <div>জামাত: <b className="font-bold">{questionData.header.className}</b></div>
                  <div>সময়: <b>{questionData.header.time}</b></div>
                  <div>পূর্ণমান: <b className="font-bold">{questionData.header.totalMarks}</b></div>
                </div>

                {/* Instructions */}
                {questionData.generalInstructions && (
                  <div className="text-center text-xs italic text-slate-700 mb-5">
                    [ দ্রষ্টব্য: {questionData.generalInstructions} ]
                  </div>
                )}

                {/* Questions Body */}
                <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
                  {questionData.questions.map((q) => (
                    <div key={q.id} className="space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-slate-900 flex-1">
                          {q.questionNo}। {q.questionText}
                        </div>
                        {q.marks && (
                          <div className="font-bold text-slate-900 pl-4 shrink-0">
                            [{q.marks}]
                          </div>
                        )}
                      </div>

                      {q.arabicText && (
                        <div dir="rtl" className="font-amiri font-bold text-base text-slate-950 text-center my-1.5">
                          « {q.arabicText} »
                        </div>
                      )}

                      {/* Render Table in Printable Format */}
                      {q.table && (
                        <div className="my-2.5 overflow-x-auto">
                          {q.table.title && (
                            <div className="font-bold text-xs mb-1 text-slate-800">{q.table.title}</div>
                          )}
                          <table className="w-full border-collapse border border-black text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                {q.table.headers.map((h, idx) => (
                                  <th key={idx} className="border border-black p-1.5 text-center font-bold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {q.table.rows.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="border border-black p-1.5 text-center">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Sub-questions */}
                      {q.subQuestions && q.subQuestions.length > 0 && (
                        <div className="space-y-1 pl-4 pt-1">
                          {q.subQuestions.map((sq, sqIdx) => (
                            <div key={sqIdx} className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold">({sq.label})</span> {sq.text}
                              </div>
                              {sq.marks && (
                                <span className="font-bold pl-2 text-slate-800">[{sq.marks}]</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
