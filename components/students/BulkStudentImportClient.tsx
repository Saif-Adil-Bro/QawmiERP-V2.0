"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  Check,
  X,
} from "lucide-react";
import { bulkCreateStudents, BulkStudentRowInput } from "@/app/actions/students";
import { useRouter } from "next/navigation";

interface ClassItem {
  id: string;
  name: string;
}

interface BulkStudentImportClientProps {
  classes: ClassItem[];
  onSuccess?: () => void;
}

interface StudentRow extends BulkStudentRowInput {
  id: string; // client temporary ID for keys
  isValid: boolean;
  errors?: string[];
}

export default function BulkStudentImportClient({
  classes,
  onSuccess,
}: BulkStudentImportClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [defaultClassId, setDefaultClassId] = useState<string>(
    classes.length > 0 ? classes[0].id : ""
  );

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error";
    text: string;
    count?: number;
  } | null>(null);

  // Helper to validate a row
  const validateRow = (row: Partial<BulkStudentRowInput>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!row.name || !row.name.trim()) {
      errors.push("শিক্ষার্থীর নাম আবশ্যক");
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Add an empty row for manual grid entry
  const addEmptyRow = () => {
    const newRow: StudentRow = {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      father_name: "",
      parent_phone: "",
      class_id: defaultClassId,
      roll_number: "",
      gender: "MALE",
      residential_status: "অনাবাসিক",
      isValid: false,
      errors: ["শিক্ষার্থীর নাম আবশ্যক"],
    };
    setRows((prev) => [...prev, newRow]);
  };

  // Update a single field in a row
  const updateRowField = (id: string, field: keyof BulkStudentRowInput, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        const validation = validateRow(updated);
        return {
          ...updated,
          isValid: validation.isValid,
          errors: validation.errors,
        };
      })
    );
  };

  // Delete a row
  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Clear all rows
  const clearAllRows = () => {
    setRows([]);
    setResultMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Normalize header strings
  const normalizeKey = (key: string): string => {
    const k = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (["নাম", "name", "studentname", "fullname", "শিক্ষার্থীরনাম"].includes(k)) return "name";
    if (["পিতারনাম", "পিতা", "fathername", "father", "অভিভাবক", "guardian"].includes(k)) return "father_name";
    if (["মোবাইল", "মোবাইলনম্বর", "ফোন", "ফোননম্বর", "phone", "mobile", "parentphone", "contact"].includes(k)) return "parent_phone";
    if (["শ্রেণি", "জামাত", "শ্রেণী", "class", "classname", "jamat"].includes(k)) return "class_name";
    if (["রোল", "রোলনম্বর", "roll", "rollnumber"].includes(k)) return "roll_number";
    if (["লিঙ্গ", "gender", "ছাত্রছাত্রী"].includes(k)) return "gender";
    if (["আবাসন", "ধরন", "residential", "residentialstatus", "boarding"].includes(k)) return "residential_status";
    if (["ঠিকানা", "address"].includes(k)) return "address";
    if (["মাসিকফি", "ফি", "বেতন", "monthlyfee", "fee"].includes(k)) return "monthly_fee";
    return k;
  };

  // Parse uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResultMessage(null);

    const fileName = file.name.toLowerCase();

    // 1. JSON parsing
    if (fileName.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          const arrayData = Array.isArray(parsed) ? parsed : parsed.students || [];

          const parsedRows: StudentRow[] = arrayData.map((item: any) => {
            const rowData: BulkStudentRowInput = {
              name: String(item.name || item["নাম"] || "").trim(),
              father_name: String(item.father_name || item["পিতার নাম"] || item["পিতা"] || "").trim(),
              parent_phone: String(item.parent_phone || item.phone || item.mobile || item["মোবাইল"] || item["মোবাইল নম্বর"] || "").trim(),
              class_name: String(item.class_name || item.class || item["শ্রেণি"] || item["জামাত"] || "").trim(),
              class_id: item.class_id || defaultClassId,
              roll_number: item.roll_number !== undefined ? item.roll_number : (item["রোল"] !== undefined ? item["রোল"] : ""),
              gender: String(item.gender || item["লিঙ্গ"] || "MALE").toUpperCase().includes("FEM") || item["লিঙ্গ"] === "ছাত্রী" ? "FEMALE" : "MALE",
              residential_status: item.residential_status || item["আবাসন"] || "অনাবাসিক",
              address: String(item.address || item["ঠিকানা"] || "").trim(),
              monthly_fee: Number(item.monthly_fee || item["মাসিক ফি"] || 0),
            };

            const val = validateRow(rowData);
            return {
              id: Math.random().toString(36).substring(2, 9),
              ...rowData,
              isValid: val.isValid,
              errors: val.errors,
            };
          });

          setRows(parsedRows);
        } catch (err) {
          setResultMessage({
            type: "error",
            text: "JSON ফাইলটি সঠিকভাবে পার্স করা যায়নি। অনুগ্রহ করে ফাইল ফরম্যাট যাচাই করুন।",
          });
        }
      };
      reader.readAsText(file);
      return;
    }

    // 2. Excel / CSV parsing
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          setResultMessage({
            type: "error",
            text: "ফাইলটিতে কোনো ডেটা পাওয়া যায়নি বা শিটটি খালি।",
          });
          return;
        }

        const parsedRows: StudentRow[] = rawJson.map((row) => {
          const mapped: any = {};
          Object.keys(row).forEach((k) => {
            const normalized = normalizeKey(k);
            mapped[normalized] = row[k];
          });

          const genderRaw = String(mapped.gender || "").trim();
          const isFemale = genderRaw.toLowerCase().includes("fem") || genderRaw.includes("ছাত্রী") || genderRaw.includes("মেয়ে");

          const rowData: BulkStudentRowInput = {
            name: String(mapped.name || "").trim(),
            father_name: String(mapped.father_name || "").trim(),
            parent_phone: String(mapped.parent_phone || "").trim(),
            class_name: String(mapped.class_name || "").trim(),
            class_id: defaultClassId,
            roll_number: mapped.roll_number !== undefined && mapped.roll_number !== "" ? String(mapped.roll_number).trim() : "",
            gender: isFemale ? "FEMALE" : "MALE",
            residential_status: String(mapped.residential_status || "").includes("আবাসিক") ? "আবাসিক" : "অনাবাসিক",
            address: String(mapped.address || "").trim(),
            monthly_fee: Number(mapped.monthly_fee || 0),
          };

          const val = validateRow(rowData);
          return {
            id: Math.random().toString(36).substring(2, 9),
            ...rowData,
            isValid: val.isValid,
            errors: val.errors,
          };
        });

        setRows(parsedRows);
      } catch (err: any) {
        setResultMessage({
          type: "error",
          text: `ফাইল পার্সিংয়ে ত্রুটি: ${err?.message || "ফাইলটি পড়া সম্ভব হয়নি"}`,
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Sample Excel Template
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        "নাম": "মুহাম্মদ আব্দুল্লাহ",
        "পিতার নাম": "মাওলানা রফিকুল ইসলাম",
        "মোবাইল নম্বর": "01711223344",
        "শ্রেণি": classes[0]?.name || "হিফজুল কুরআন",
        "রোল": "",
        "লিঙ্গ": "MALE",
        "আবাসন": "আবাসিক",
        "ঠিকানা": "ঢাকা, বাংলাদেশ",
        "মাসিক ফি": 2500,
      },
      {
        "নাম": "আহমদ হাসান",
        "পিতার নাম": "শফিকুল আলম",
        "মোবাইল নম্বর": "01812345678",
        "শ্রেণি": classes[0]?.name || "হিফজুল কুরআন",
        "রোল": "",
        "লিঙ্গ": "MALE",
        "আবাসন": "অনাবাসিক",
        "ঠিকানা": "উত্তরা, ঢাকা",
        "মাসিক ফি": 1200,
      },
      {
        "নাম": "উসমান গনি",
        "পিতার নাম": "মোঃ মোস্তাফিজুর রহমান",
        "মোবাইল নম্বর": "01911998877",
        "শ্রেণি": classes[1]?.name || classes[0]?.name || "নাজেরা",
        "রোল": "",
        "লিঙ্গ": "MALE",
        "আবাসন": "আবাসিক",
        "ঠিকানা": "মিরপুর, ঢাকা",
        "মাসিক ফি": 2000,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "শিক্ষার্থী_তালিকা");
    XLSX.writeFile(wb, "Student_Bulk_Admission_Template.xlsx");
  };

  // Download Sample JSON Template
  const downloadJsonTemplate = () => {
    const templateData = [
      {
        name: "মুহাম্মদ আব্দুল্লাহ",
        father_name: "মাওলানা রফিকুল ইসলাম",
        parent_phone: "01711223344",
        class_name: classes[0]?.name || "হিফজুল কুরআন",
        roll_number: "",
        gender: "MALE",
        residential_status: "আবাসিক",
        address: "ঢাকা, বাংলাদেশ",
        monthly_fee: 2500,
      },
      {
        name: "আহমদ হাসান",
        father_name: "শফিকুল আলম",
        parent_phone: "01812345678",
        class_name: classes[0]?.name || "হিফজুল কুরআন",
        roll_number: "",
        gender: "MALE",
        residential_status: "অনাবাসিক",
        address: "উত্তরা, ঢাকা",
        monthly_fee: 1200,
      },
    ];

    const blob = new Blob([JSON.stringify(templateData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_bulk_template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Bulk Data
  const handleSubmit = async () => {
    const validRows = rows.filter((r) => r.isValid && r.name.trim());
    if (validRows.length === 0) {
      setResultMessage({
        type: "error",
        text: "অন্তত একজন শিক্ষার্থীর সঠিক তথ্য (নাম আবশ্যক) পূরণ করুন।",
      });
      return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const payload: BulkStudentRowInput[] = validRows.map((r) => ({
        name: r.name.trim(),
        father_name: r.father_name?.trim() || "",
        parent_phone: r.parent_phone?.trim() || "",
        class_id: r.class_id || defaultClassId,
        class_name: r.class_name?.trim() || "",
        roll_number: r.roll_number || "",
        gender: r.gender || "MALE",
        residential_status: r.residential_status || "অনাবাসিক",
        address: r.address?.trim() || "",
        monthly_fee: Number(r.monthly_fee || 0),
      }));

      const res = await bulkCreateStudents(payload, defaultClassId);

      if (res.success) {
        setResultMessage({
          type: "success",
          text: res.message || `মোট ${res.count} জন শিক্ষার্থী সফলভাবে ভর্তি ও নিবন্ধিত হয়েছে!`,
          count: res.count,
        });
        setRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (onSuccess) {
          onSuccess();
        } else {
          setTimeout(() => {
            router.push("/dashboard/students");
          }, 1500);
        }
      } else {
        setResultMessage({
          type: "error",
          text: res.error || "বাল্ক আমদানিতে ত্রুটি দেখা দিয়েছে।",
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: "error",
        text: `সার্ভার ত্রুটি: ${err?.message || "অনাকাঙ্ক্ষিত ত্রুটি"}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = rows.filter((r) => r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Informative Header Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs mt-0.5">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>একসাথে একাধিক শিক্ষার্থী ভর্তি ও আমদানি</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  অটো-রোল ও আইডি সুবিধা
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                এক্সেল (<code className="text-emerald-700 font-mono font-bold">.xlsx / .xls / .csv</code>) বা <code className="text-blue-700 font-mono font-bold">.json</code> ফাইল আপলোড করে অথবা নিচে সরাসরি তালিকায় নাম, পিতার নাম ও মোবাইল নম্বর লিখে একসাথে শত শত শিক্ষার্থী দ্রুত ভর্তি করুন। রোল নম্বর ফাঁকা রাখলে তা ক্লাসের সর্বশেষ রোল অনুযায়ী স্বয়ংক্রিয়ভাবে সিরিয়াল হবে।
              </p>
            </div>
          </div>

          {/* Template Download Actions */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs hover:border-emerald-400"
              title="এক্সেল নমুনা ফাইল ডাউনলোড করুন"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>এক্সেল ফরম্যাট</span>
              <Download className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </button>
            <button
              type="button"
              onClick={downloadJsonTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold transition shadow-2xs hover:border-blue-400"
              title="JSON নমুনা ফাইল ডাউনলোড করুন"
            >
              <FileCode className="w-4 h-4 text-blue-600" />
              <span>JSON ফরম্যাট</span>
              <Download className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Dropzone & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upload Box */}
        <div className="lg:col-span-2 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 bg-slate-50/60 hover:bg-emerald-50/30 transition flex flex-col items-center justify-center text-center cursor-pointer group relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, .json"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="p-3.5 bg-white group-hover:bg-emerald-100 rounded-2xl shadow-2xs text-slate-600 group-hover:text-emerald-700 transition mb-3">
            <Upload className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            এক্সেল বা জেসন ফাইলটি টেনে এনে এখানে ছাড়ুন অথবা ক্লিক করুন
          </p>
          <p className="text-xs text-slate-500 mt-1">
            সমর্থিত ফরম্যাট: <span className="font-semibold text-slate-700">.xlsx, .xls, .csv, .json</span> (সর্বোচ্চ ৫০০ শিক্ষার্থী একসাথে)
          </p>
        </div>

        {/* Global Batch Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ডিফল্ট জামাত / শ্রেণি নির্ধারণ
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              ফাইলে কোনো শিক্ষার্থীর শ্রেণি উল্লেখ না থাকলে স্বয়ংক্রিয়ভাবে এই জামাতে যুক্ত হবে
            </p>
            <select
              value={defaultClassId}
              onChange={(e) => setDefaultClassId(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={addEmptyRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>একটি সারি যোগ করুন</span>
            </button>

            {rows.length > 0 && (
              <button
                type="button"
                onClick={clearAllRows}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50 transition"
              >
                সব খালি করুন
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {resultMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-3 transition animate-in fade-in ${
            resultMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {resultMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold">{resultMessage.text}</p>
            {resultMessage.type === "success" && (
              <p className="text-xs text-emerald-700 mt-1">
                শিক্ষার্থীদেরকে বর্তমান একাডেমিক সেশনে স্বয়ংক্রিয়ভাবে তালিকাভুক্ত ও স্থায়ী অফিসিয়াল আইডি প্রদান করা হয়েছে।
              </p>
            )}
          </div>
          <button
            onClick={() => setResultMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview Data Grid */}
      {rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Table Header Summary */}
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-800 text-sm">
                আমদানির জন্য প্রস্তুত তালিকা:
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                মোট {rows.length} জন (সঠিক: {validCount} জন)
              </span>
              {rows.length - validCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {rows.length - validCount} জনের নাম অনুপস্থিত
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || validCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>সংরক্ষণ করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{validCount} জন শিক্ষার্থী ভর্তি সম্পন্ন করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-2xs font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[150px]">শিক্ষার্থীর নাম <span className="text-red-500">*</span></th>
                  <th className="py-2.5 px-3 min-w-[140px]">পিতার নাম</th>
                  <th className="py-2.5 px-3 min-w-[120px]">মোবাইল নম্বর</th>
                  <th className="py-2.5 px-3 min-w-[130px]">জামাত / শ্রেণি</th>
                  <th className="py-2.5 px-3 min-w-[90px]">রোল নম্বর</th>
                  <th className="py-2.5 px-3 min-w-[90px]">আবাসন</th>
                  <th className="py-2.5 px-3 min-w-[90px]">মাসিক ফি</th>
                  <th className="py-2.5 px-3 w-12 text-center">মুছুন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50/80 transition ${
                      !row.isValid ? "bg-rose-50/40" : ""
                    }`}
                  >
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {index + 1}
                    </td>

                    {/* Student Name */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRowField(row.id, "name", e.target.value)}
                        placeholder="শিক্ষার্থীর নাম লিখুন"
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 ${
                          !row.name.trim()
                            ? "border-rose-300 bg-rose-50/50 focus:ring-rose-400"
                            : "border-slate-300 focus:ring-emerald-500"
                        }`}
                      />
                    </td>

                    {/* Father Name */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.father_name || ""}
                        onChange={(e) => updateRowField(row.id, "father_name", e.target.value)}
                        placeholder="পিতার নাম"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Mobile Phone */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.parent_phone || ""}
                        onChange={(e) => updateRowField(row.id, "parent_phone", e.target.value)}
                        placeholder="017xxxxxxxx"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Class */}
                    <td className="py-2 px-3">
                      <select
                        value={row.class_id || defaultClassId}
                        onChange={(e) => updateRowField(row.id, "class_id", e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Roll */}
                    <td className="py-2 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.roll_number || ""}
                          onChange={(e) => updateRowField(row.id, "roll_number", e.target.value)}
                          placeholder="অটো"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {!row.roll_number && (
                          <span className="absolute right-2 top-2 text-[10px] text-emerald-600 font-bold pointer-events-none">
                            অটো
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Residential */}
                    <td className="py-2 px-3">
                      <select
                        value={row.residential_status || "অনাবাসিক"}
                        onChange={(e) => updateRowField(row.id, "residential_status", e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="অনাবাসিক">অনাবাসিক</option>
                        <option value="আবাসিক">আবাসিক</option>
                        <option value="ডে-কেয়ার">ডে-কেয়ার</option>
                      </select>
                    </td>

                    {/* Monthly Fee */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        value={row.monthly_fee || ""}
                        onChange={(e) => updateRowField(row.id, "monthly_fee", e.target.value)}
                        placeholder="০"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="সারিটি মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={addEmptyRow}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>আরও শিক্ষার্থী যোগ করুন</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || validCount === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{validCount} জন শিক্ষার্থী ভর্তি সম্পন্ন করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Helpful Instructions */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>সহজ টিপস ও নির্দেশনা:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed pl-1">
          <li>
            <strong>অটো-রোল সুবিধা:</strong> এক্সেল বা তালিকায় রোলের ঘর খালি রাখলে কিংবা <code className="bg-slate-200 px-1 rounded">অটো</code> লিখলে সিস্টেম স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট জামাতের পরবর্তী খালি ক্রমিক রোল নম্বর প্রদান করবে।
          </li>
          <li>
            <strong>স্বতন্ত্র অফিশিয়াল আইডি:</strong> প্রত্যেক শিক্ষার্থীর জন্য স্বয়ংক্রিয়ভাবে মাদ্রাসার প্রিফিক্স সহ অফিশিয়াল আইডি (যেমন: <code className="bg-slate-200 px-1 rounded">AH-480012</code>) তৈরি হবে।
          </li>
          <li>
            <strong>ন্যূনতম প্রয়োজনীয় তথ্য:</strong> শুধুমাত্র শিক্ষার্থীর <strong>নাম</strong> আবশ্যক। তবে পিতার নাম, অভিভাবকের মোবাইল নম্বর ও শ্রেণি দিলে পূর্ণাঙ্গ রেকর্ড তৈরি হয়।
          </li>
        </ul>
      </div>
    </div>
  );
}
