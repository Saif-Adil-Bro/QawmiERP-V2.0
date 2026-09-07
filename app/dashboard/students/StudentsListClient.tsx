"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Plus,
  Search,
  Edit2,
  Eye,
  Trash2,
  GraduationCap,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  Printer,
  Download,
  CheckSquare,
  Square,
  Users,
  Home,
  BookOpen,
  ArrowUpDown,
  Phone,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  X,
  UserCheck,
  Building2,
  Sparkles,
} from "lucide-react";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";
import { deleteStudent } from "@/app/actions/students";

interface ClassItem {
  id: string;
  name: string;
  description?: string;
}

interface SessionItem {
  id: string;
  name: string;
  is_current?: boolean;
  status?: string;
}

interface MadrasaInfo {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  established_year?: string;
  reg_no?: string;
}

interface StudentsListClientProps {
  initialStudents: any[];
  classes: ClassItem[];
  sessions: SessionItem[];
  currentSession: SessionItem | null;
  madrasaInfo: MadrasaInfo;
}

export default function StudentsListClient({
  initialStudents,
  classes,
  sessions,
  currentSession,
  madrasaInfo,
}: StudentsListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for students list (to support instant optimistic deletion)
  const [students, setStudents] = useState<any[]>(initialStudents || []);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter States initialized from URL or defaults
  const [searchQuery, setSearchQuery] = useState<string>(searchParams?.get("q") || "");
  const [selectedClass, setSelectedClass] = useState<string>(searchParams?.get("class") || "ALL");
  const [selectedSession, setSelectedSession] = useState<string>(
    searchParams?.get("session") || "ALL"
  );
  const [selectedSystem, setSelectedSystem] = useState<string>(
    searchParams?.get("system") || "ALL"
  );
  const [selectedFeeCategory, setSelectedFeeCategory] = useState<string>(
    searchParams?.get("fee") || "ALL"
  );
  const [selectedResidential, setSelectedResidential] = useState<string>(
    searchParams?.get("residential") || "ALL"
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    searchParams?.get("status") || "ALL"
  );
  const [selectedGender, setSelectedGender] = useState<string>(
    searchParams?.get("gender") || "ALL"
  );
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>(
    searchParams?.get("blood") || "ALL"
  );

  // Sorting & Layout States
  const [sortBy, setSortBy] = useState<string>("roll_asc");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Update URL search parameters when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedClass !== "ALL") params.set("class", selectedClass);
    if (selectedSystem !== "ALL") params.set("system", selectedSystem);
    if (selectedFeeCategory !== "ALL") params.set("fee", selectedFeeCategory);
    if (selectedSession !== "ALL") params.set("session", selectedSession);
    if (selectedResidential !== "ALL") params.set("residential", selectedResidential);
    if (selectedStatus !== "ALL") params.set("status", selectedStatus);
    if (selectedGender !== "ALL") params.set("gender", selectedGender);
    if (selectedBloodGroup !== "ALL") params.set("blood", selectedBloodGroup);

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [
    searchQuery,
    selectedClass,
    selectedSystem,
    selectedFeeCategory,
    selectedSession,
    selectedResidential,
    selectedStatus,
    selectedGender,
    selectedBloodGroup,
    pathname,
    router,
  ]);

  // Derive consolidated classes list with student counts
  const consolidatedClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    const idToNameMap = new Map<string, string>();

    // Add registered classes first
    (classes || []).forEach((c) => {
      if (c && c.name) {
        const trimmed = c.name.trim();
        map.set(trimmed, { id: c.id, name: trimmed, count: 0 });
        if (c.id) idToNameMap.set(c.id, trimmed);
      }
    });

    // Count students matching classes
    students.forEach((s) => {
      let cName =
        (Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name) ||
        s.class_name ||
        "";

      if (!cName && s.class_id && idToNameMap.has(s.class_id)) {
        cName = idToNameMap.get(s.class_id) || "";
      }

      if (cName && cName.trim()) {
        const trimmed = cName.trim();
        if (!map.has(trimmed)) {
          map.set(trimmed, { id: s.class_id || trimmed, name: trimmed, count: 0 });
        }
        const existing = map.get(trimmed)!;
        existing.count += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "bn"));
  }, [classes, students]);

  // System/Department classification helper
  const getStudentSystem = (student: any): "হিফজ" | "কিতাব" | "নূরানী" | "নাজেরা" | "সাধারণ" => {
    const cName = (
      (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) ||
      student.class_name ||
      ""
    ).toLowerCase();

    if (cName.includes("হিফজ") || cName.includes("তাহফিজ") || cName.includes("কুরআন")) {
      return "হিফজ";
    }
    if (cName.includes("নাজেরা")) {
      return "নাজেরা";
    }
    if (cName.includes("নূরানী") || cName.includes("মক্তব") || cName.includes("শিশু")) {
      return "নূরানী";
    }
    if (
      cName.includes("মীযান") ||
      cName.includes("নাহবেমীর") ||
      cName.includes("হেদায়াত") ||
      cName.includes("কাফিয়া") ||
      cName.includes("শরহে") ||
      cName.includes("দহম") ||
      cName.includes("ইয়াযদাহুম") ||
      cName.includes("জালালাইন") ||
      cName.includes("মেশকাত") ||
      cName.includes("দাওরা") ||
      cName.includes("ইফতা") ||
      cName.includes("কিতাব")
    ) {
      return "কিতাব";
    }
    return "সাধারণ";
  };

  // Fee category classification helper
  const getStudentFeeCategory = (student: any): "লিল্লাহ_ফ্রি" | "মওকুফপ্রাপ্ত" | "পেইং" => {
    const bType = String(student.boarding_type || "");
    const discount = Number(student.fee_discount || 0);
    const monthlyFee = Number(student.monthly_fee || 0);
    const isFree =
      bType === "লিল্লাহ" ||
      student.is_free ||
      student.free_student ||
      (monthlyFee === 0 && discount > 0);

    if (isFree) return "লিল্লাহ_ফ্রি";
    if (discount > 0 || bType.includes("হাফ") || bType.includes("মওকুফ")) return "মওকুফপ্রাপ্ত";
    return "পেইং";
  };

  // Quick stats calculation
  const stats = useMemo(() => {
    const total = students.length;
    let residential = 0;
    let nonResidential = 0;
    let female = 0;
    let hifzCount = 0;
    let kitabCount = 0;
    let nooraniCount = 0;
    let nazeraCount = 0;
    let freeCount = 0;
    let discountedCount = 0;

    students.forEach((s) => {
      if (s.residential_status === "আবাসিক" || s.is_boarding) {
        residential++;
      } else {
        nonResidential++;
      }
      if (s.gender === "FEMALE") female++;

      const sys = getStudentSystem(s);
      if (sys === "হিফজ") hifzCount++;
      else if (sys === "কিতাব") kitabCount++;
      else if (sys === "নূরানী") nooraniCount++;
      else if (sys === "নাজেরা") nazeraCount++;

      const feeCat = getStudentFeeCategory(s);
      if (feeCat === "লিল্লাহ_ফ্রি") freeCount++;
      else if (feeCat === "মওকুফপ্রাপ্ত") discountedCount++;
    });

    return {
      total,
      residential,
      nonResidential,
      female,
      hifzCount,
      kitabCount,
      nooraniCount,
      nazeraCount,
      freeCount,
      discountedCount,
      classesCount: consolidatedClasses.length,
    };
  }, [students, consolidatedClasses]);

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedClass !== "ALL") count++;
    if (selectedSystem !== "ALL") count++;
    if (selectedFeeCategory !== "ALL") count++;
    if (selectedSession !== "ALL") count++;
    if (selectedResidential !== "ALL") count++;
    if (selectedStatus !== "ALL") count++;
    if (selectedGender !== "ALL") count++;
    if (selectedBloodGroup !== "ALL") count++;
    return count;
  }, [
    searchQuery,
    selectedClass,
    selectedSystem,
    selectedFeeCategory,
    selectedSession,
    selectedResidential,
    selectedStatus,
    selectedGender,
    selectedBloodGroup,
  ]);

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedClass("ALL");
    setSelectedSystem("ALL");
    setSelectedFeeCategory("ALL");
    setSelectedSession("ALL");
    setSelectedResidential("ALL");
    setSelectedStatus("ALL");
    setSelectedGender("ALL");
    setSelectedBloodGroup("ALL");
    setSortBy("roll_asc");
  };

  // Filter & Sort students
  const filteredStudents = useMemo(() => {
    return students
      .filter((student) => {
        // 1. Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
          const roll = String(student.roll_number || "").toLowerCase();
          const phone = String(student.parent_phone || "").toLowerCase();
          const father = String(student.father_name || "").toLowerCase();
          const className = String(
            (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) ||
              student.class_name ||
              ""
          ).toLowerCase();
          const studentId = getStudentIdNumber(student, students).toLowerCase();
          const studentIdBn = convertToBanglaNumber(studentId).toLowerCase();

          const matches =
            fullName.includes(q) ||
            roll.includes(q) ||
            phone.includes(q) ||
            father.includes(q) ||
            className.includes(q) ||
            studentId.includes(q) ||
            studentIdBn.includes(q);

          if (!matches) return false;
        }

        // 2. Class Filter
        if (selectedClass !== "ALL") {
          const cName = (
            (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) ||
            student.class_name ||
            ""
          ).trim();
          const cId = student.class_id || (student.classes && student.classes.id);
          const matchedClassObj = (classes || []).find((c) => c.id === cId || c.name === cName);
          const resolvedName = cName || matchedClassObj?.name || "";

          const matchesClass =
            resolvedName === selectedClass ||
            cName === selectedClass ||
            cId === selectedClass ||
            (matchedClassObj && matchedClassObj.name === selectedClass) ||
            (selectedClass === "UNASSIGNED" && !resolvedName && !cId);

          if (!matchesClass) return false;
        }

        // 3. System / Department Filter
        if (selectedSystem !== "ALL") {
          const sys = getStudentSystem(student);
          if (selectedSystem === "HIFZ" && sys !== "হিফজ") return false;
          if (selectedSystem === "KITAB" && sys !== "কিতাব") return false;
          if (selectedSystem === "NOORANI" && sys !== "নূরানী") return false;
          if (selectedSystem === "NAZERA" && sys !== "নাজেরা") return false;
        }

        // 4. Fee / Scholarship Category Filter
        if (selectedFeeCategory !== "ALL") {
          const feeCat = getStudentFeeCategory(student);
          if (selectedFeeCategory === "FREE" && feeCat !== "লিল্লাহ_ফ্রি") return false;
          if (selectedFeeCategory === "DISCOUNTED" && feeCat !== "মওকুফপ্রাপ্ত") return false;
          if (selectedFeeCategory === "PAYING" && feeCat !== "পেইং") return false;
        }

        // 5. Academic Session Filter
        if (selectedSession !== "ALL") {
          const studentSessionId = student.session_id || student.academic_session_id;
          if (studentSessionId && studentSessionId !== selectedSession) {
            return false;
          }
        }

        // 6. Residential Status Filter
        if (selectedResidential !== "ALL") {
          const resStatus = student.residential_status || (student.is_boarding ? "আবাসিক" : "অনাবাসিক");
          if (selectedResidential === "আবাসিক" && resStatus !== "আবাসিক") return false;
          if (selectedResidential === "অনাবাসিক" && resStatus !== "অনাবাসিক") return false;
          if (selectedResidential === "ডে-কেয়ার" && resStatus !== "ডে-কেয়ার") return false;
        }

        // 7. Student Status Filter
        if (selectedStatus !== "ALL") {
          const st = (student.student_status || "ACTIVE").toUpperCase();
          if (selectedStatus === "ACTIVE" && st !== "ACTIVE") return false;
          if (selectedStatus === "INACTIVE" && st !== "INACTIVE") return false;
          if (selectedStatus === "ALUMNI" && st !== "ALUMNI") return false;
        }

        // 8. Gender Filter
        if (selectedGender !== "ALL") {
          const g = (student.gender || "MALE").toUpperCase();
          if (g !== selectedGender.toUpperCase()) return false;
        }

        // 9. Blood Group Filter
        if (selectedBloodGroup !== "ALL") {
          if ((student.blood_group || "") !== selectedBloodGroup) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "roll_asc") {
          const rollA = parseInt(String(a.roll_number || "999999"), 10) || 999999;
          const rollB = parseInt(String(b.roll_number || "999999"), 10) || 999999;
          return rollA - rollB;
        }
        if (sortBy === "roll_desc") {
          const rollA = parseInt(String(a.roll_number || "0"), 10) || 0;
          const rollB = parseInt(String(b.roll_number || "0"), 10) || 0;
          return rollB - rollA;
        }
        if (sortBy === "name_asc") {
          const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim();
          const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim();
          return nameA.localeCompare(nameB, "bn");
        }
        if (sortBy === "id_asc" || sortBy === "id_desc") {
          const idA = getStudentIdNumber(a, students);
          const idB = getStudentIdNumber(b, students);
          return sortBy === "id_asc" ? idA.localeCompare(idB) : idB.localeCompare(idA);
        }
        if (sortBy === "date_desc") {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        }
        return 0;
      });
  }, [
    students,
    searchQuery,
    selectedClass,
    selectedSession,
    selectedResidential,
    selectedStatus,
    selectedGender,
    selectedBloodGroup,
    sortBy,
  ]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Student Delete Handler
  const handleDeleteStudent = async (student: any) => {
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    if (
      !confirm(
        `আপনি কি নিশ্চিত যে "${studentName}"-কে তালিকা থেকে মুছে ফেলতে চান?\n\nএই ক্রিয়াটি অপরিবর্তনীয়।`
      )
    ) {
      return;
    }

    setDeletingId(student.id);
    try {
      const res = await deleteStudent(student.id);
      if (res && res.error) {
        alert(`মুছতে ব্যর্থ হয়েছে: ${res.error}`);
      } else {
        // Optimistic UI removal
        setStudents((prev) => prev.filter((s) => s.id !== student.id));
        setSelectedStudentIds((prev) => {
          const next = new Set(prev);
          next.delete(student.id);
          return next;
        });
      }
    } catch (err: any) {
      console.error("Delete student error:", err);
      alert("শিক্ষার্থী মুছতে সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setDeletingId(null);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const listToExport =
      selectedStudentIds.size > 0
        ? filteredStudents.filter((s) => selectedStudentIds.has(s.id))
        : filteredStudents;

    if (listToExport.length === 0) {
      alert("এক্সপোর্ট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।");
      return;
    }

    const headers = [
      "ক্রমিক নং",
      "আইডি নম্বর",
      "রোল নম্বর",
      "শিক্ষার্থীর পূর্ণ নাম",
      "জামাত / শ্রেণি",
      "আবাসিক অবস্থা",
      "পিতার নাম",
      "মাতার নাম",
      "অভিভাবকের ফোন নম্বর",
      "জরুরি যোগাযোগ",
      "রক্তের গ্রুপ",
      "জন্ম তারিখ",
      "ঠিকানা",
    ];

    const rows = listToExport.map((s, idx) => {
      const idNum = getStudentIdNumber(s, students);
      const cName =
        (Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name) ||
        s.class_name ||
        "অনির্ধারিত";
      return [
        idx + 1,
        idNum,
        s.roll_number || "-",
        `"${(`${s.first_name || ""} ${s.last_name || ""}`).replace(/"/g, '""').trim()}"`,
        `"${cName.replace(/"/g, '""')}"`,
        s.residential_status || (s.is_boarding ? "আবাসিক" : "অনাবাসিক"),
        `"${(s.father_name || "-").replace(/"/g, '""')}"`,
        `"${(s.mother_name || "-").replace(/"/g, '""')}"`,
        s.parent_phone || "-",
        s.emergency_contact || "-",
        s.blood_group || "-",
        s.date_of_birth || "-",
        `"${(s.address || "-").replace(/"/g, '""')}"`,
      ];
    });

    // Add UTF-8 BOM for Bengali support in MS Excel
    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const classNameSuffix =
      selectedClass !== "ALL" ? `_${selectedClass.replace(/\s+/g, "_")}` : "";
    link.setAttribute(
      "download",
      `শিক্ষার্থী_তালিকা${classNameSuffix}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              শিক্ষার্থী তালিকা
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
              {convertToBanglaNumber(filteredStudents.length)} জন
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            সকল নিবন্ধিত শিক্ষার্থীর জামাতভিত্তিক তালিকা ও একাডেমিক প্রোফাইল
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Print Button */}
          <button
            onClick={() => setShowPrintModal(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer"
            title="তালিকা প্রিন্ট ও অফিশিয়াল রিপোর্ট"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden xs:inline">প্রিন্ট</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer"
            title="এক্সেল বা সিএসভি ডাউনলোড"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden xs:inline">এক্সপোর্ট</span>
          </button>

          {/* Student Promotion */}
          <Link
            href="/dashboard/students/promotion"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>শিক্ষার্থী প্রমোশন</span>
          </Link>

          {/* New Student Registration */}
          <Link
            href="/dashboard/students/new"
            className="bg-slate-900 text-white px-3.5 py-2 rounded-xl hover:bg-slate-800 flex items-center space-x-1.5 text-xs sm:text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন শিক্ষার্থী</span>
          </Link>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">মোট শিক্ষার্থী</p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {convertToBanglaNumber(stats.total)}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">আবাসিক শিক্ষার্থী</p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {convertToBanglaNumber(stats.residential)}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">অনাবাসিক শিক্ষার্থী</p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {convertToBanglaNumber(stats.nonResidential)}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">সক্রিয় জামাত/বিভাগ</p>
            <p className="text-lg font-bold text-slate-900 font-mono">
              {convertToBanglaNumber(stats.classesCount)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Filter & Control Center */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Primary Filter Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-200 space-y-3">
          {/* Row 1: Search, Class Filter, Residential Filter, and Action Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Live Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম, শ্রেণি রোল, আইডি নম্বর বা ফোন দিয়ে খুঁজুন..."
                className="w-full pl-9.5 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="flex items-center flex-wrap gap-2">
              {/* 1. Class / Jamat Filter Dropdown */}
              <div className="relative min-w-[140px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  জামাত / শ্রেণি
                </label>
                <div className="relative">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">সকল জামাত ({convertToBanglaNumber(students.length)})</option>
                    {consolidatedClasses.map((cls) => (
                      <option key={cls.name} value={cls.name}>
                        {cls.name} ({convertToBanglaNumber(cls.count)})
                      </option>
                    ))}
                    <option value="UNASSIGNED">জামাত অনির্ধারিত</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 2. Department / System Filter Dropdown */}
              <div className="relative min-w-[145px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  বিভাগ / সিস্টেম
                </label>
                <div className="relative">
                  <select
                    value={selectedSystem}
                    onChange={(e) => setSelectedSystem(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">সকল বিভাগ/সিস্টেম</option>
                    <option value="HIFZ">হিফজুল কুরআন বিভাগ ({convertToBanglaNumber(stats.hifzCount)})</option>
                    <option value="KITAB">কিতাব বিভাগ ({convertToBanglaNumber(stats.kitabCount)})</option>
                    <option value="NOORANI">নূরানী ও মক্তব ({convertToBanglaNumber(stats.nooraniCount)})</option>
                    <option value="NAZERA">নাজেরা বিভাগ ({convertToBanglaNumber(stats.nazeraCount)})</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 3. Residential Status Filter Dropdown */}
              <div className="relative min-w-[125px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  আবাসিক অবস্থা
                </label>
                <div className="relative">
                  <select
                    value={selectedResidential}
                    onChange={(e) => setSelectedResidential(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">সকল ধরন</option>
                    <option value="আবাসিক">আবাসিক ({convertToBanglaNumber(stats.residential)})</option>
                    <option value="অনাবাসিক">অনাবাসিক ({convertToBanglaNumber(stats.nonResidential)})</option>
                    <option value="ডে-কেয়ার">ডে-কেয়ার</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 4. Fee / Scholarship Category Dropdown */}
              <div className="relative min-w-[135px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  ফি / বৃত্তি ব্যবস্থা
                </label>
                <div className="relative">
                  <select
                    value={selectedFeeCategory}
                    onChange={(e) => setSelectedFeeCategory(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">সকল ফি ব্যবস্থা</option>
                    <option value="FREE">লিল্লাহ বোর্ডিং / ফ্রি ({convertToBanglaNumber(stats.freeCount)})</option>
                    <option value="DISCOUNTED">মওকুফ / ছাড়প্রাপ্ত ({convertToBanglaNumber(stats.discountedCount)})</option>
                    <option value="PAYING">সাধারণ পেইং</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 5. Academic Session Filter Dropdown */}
              <div className="relative min-w-[135px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  শিক্ষাবর্ষ / সেশন
                </label>
                <div className="relative">
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">সকল শিক্ষাবর্ষ</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_current ? "(চলতি)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 6. Sort By Dropdown */}
              <div className="relative min-w-[130px] flex-1 sm:flex-initial">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">
                  সাজানো (Sort)
                </label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                  >
                    <option value="roll_asc">রোল: ১ → ৯৯</option>
                    <option value="roll_desc">রোল: ৯৯ → ১</option>
                    <option value="name_asc">নাম: অ → হ (A-Z)</option>
                    <option value="id_asc">আইডি: ছোট → বড়</option>
                    <option value="id_desc">আইডি: বড় → ছোট</option>
                    <option value="date_desc">নতুন ভর্তি আগে</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Mobile More Filters Toggle Button */}
              <div className="self-end pb-0.5">
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                    showMobileFilters || activeFiltersCount > 3
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                  title="অতিরিক্ত ফিল্টার (লিঙ্গ, রক্তের গ্রুপ, স্ট্যাটাস)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">আরও ফিল্টার</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* View Mode Toggle (Table / Card) */}
              <div className="self-end pb-0.5 flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "table"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="টেবিল ভিউ"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "card"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="কার্ড ভিউ"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Expandable Extra Filters (Gender, Blood Group, Student Status) */}
          {showMobileFilters && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white/60 p-3 rounded-xl">
              {/* Gender Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  লিঙ্গ
                </label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                >
                  <option value="ALL">সকল লিঙ্গ</option>
                  <option value="MALE">ছাত্র (Male)</option>
                  <option value="FEMALE">ছাত্রী (Female)</option>
                </select>
              </div>

              {/* Student Status */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  শিক্ষার্থী স্ট্যাটাস
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                >
                  <option value="ALL">সকল স্ট্যাটাস</option>
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় / টিসি</option>
                  <option value="ALUMNI">প্রাক্তন (Alumni)</option>
                </select>
              </div>

              {/* Blood Group */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  রক্তের গ্রুপ
                </label>
                <select
                  value={selectedBloodGroup}
                  onChange={(e) => setSelectedBloodGroup(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                >
                  <option value="ALL">সকল রক্ত গ্রুপ</option>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Action */}
              <div className="flex items-end">
                <button
                  onClick={resetFilters}
                  className="w-full py-2 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  ফিল্টার রিসেট
                </button>
              </div>
            </div>
          )}

          {/* Jamat / Class Horizontal Filter Ribbon */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-emerald-600" />
                জামাত অনুযায়ী দ্রুত ফিল্টার:
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                মোট {convertToBanglaNumber(consolidatedClasses.length)}টি জামাত
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
              {/* All Classes Chip */}
              <button
                type="button"
                onClick={() => setSelectedClass("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  selectedClass === "ALL"
                    ? "bg-emerald-700 text-white shadow-xs font-bold ring-2 ring-emerald-600/30"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <span>সকল জামাত</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    selectedClass === "ALL" ? "bg-emerald-800 text-emerald-100" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {convertToBanglaNumber(students.length)}
                </span>
              </button>

              {/* Class Chips */}
              {consolidatedClasses.map((c) => {
                const isSelected = selectedClass === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedClass(isSelected ? "ALL" : c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-700 text-white shadow-xs font-bold ring-2 ring-emerald-600/30"
                        : "bg-white text-emerald-900 border border-emerald-200/80 hover:bg-emerald-50/80 hover:border-emerald-300"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected ? "bg-emerald-800 text-emerald-100" : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {convertToBanglaNumber(c.count)}
                    </span>
                  </button>
                );
              })}

              {/* Unassigned Class Chip */}
              <button
                type="button"
                onClick={() => setSelectedClass(selectedClass === "UNASSIGNED" ? "ALL" : "UNASSIGNED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  selectedClass === "UNASSIGNED"
                    ? "bg-rose-700 text-white shadow-xs font-bold"
                    : "bg-white text-rose-800 border border-rose-200 hover:bg-rose-50"
                }`}
              >
                <span>জামাতবিহীন</span>
              </button>
            </div>
          </div>

          {/* Department / System & Residential Filter Ribbon */}
          <div className="pt-1.5 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              বিভাগ ও ধরন:
            </span>

            {/* All systems */}
            <button
              type="button"
              onClick={() => {
                setSelectedSystem("ALL");
                setSelectedResidential("ALL");
                setSelectedFeeCategory("ALL");
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer ${
                selectedSystem === "ALL" && selectedResidential === "ALL" && selectedFeeCategory === "ALL"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              সকল ধরন
            </button>

            {/* Department Quick Chips */}
            <button
              type="button"
              onClick={() => setSelectedSystem(selectedSystem === "HIFZ" ? "ALL" : "HIFZ")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedSystem === "HIFZ"
                  ? "bg-teal-700 text-white shadow-2xs font-bold"
                  : "bg-white text-teal-800 border border-teal-200 hover:bg-teal-50"
              }`}
            >
              <span>📖 হিফজুল কুরআন</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.hifzCount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSystem(selectedSystem === "KITAB" ? "ALL" : "KITAB")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedSystem === "KITAB"
                  ? "bg-blue-700 text-white shadow-2xs font-bold"
                  : "bg-white text-blue-800 border border-blue-200 hover:bg-blue-50"
              }`}
            >
              <span>📚 কিতাব বিভাগ</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.kitabCount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSystem(selectedSystem === "NOORANI" ? "ALL" : "NOORANI")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedSystem === "NOORANI"
                  ? "bg-emerald-700 text-white shadow-2xs font-bold"
                  : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <span>🌱 নূরানী ও মক্তব</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.nooraniCount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedSystem(selectedSystem === "NAZERA" ? "ALL" : "NAZERA")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedSystem === "NAZERA"
                  ? "bg-cyan-700 text-white shadow-2xs font-bold"
                  : "bg-white text-cyan-800 border border-cyan-200 hover:bg-cyan-50"
              }`}
            >
              <span>✨ নাজেরা</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.nazeraCount)})</span>
            </button>

            {/* Residential Quick Chips */}
            <button
              type="button"
              onClick={() => setSelectedResidential(selectedResidential === "আবাসিক" ? "ALL" : "আবাসিক")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedResidential === "আবাসিক"
                  ? "bg-indigo-700 text-white shadow-2xs font-bold"
                  : "bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              <span>🏠 আবাসিক</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.residential)})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedResidential(selectedResidential === "অনাবাসিক" ? "ALL" : "অনাবাসিক")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedResidential === "অনাবাসিক"
                  ? "bg-amber-700 text-white shadow-2xs font-bold"
                  : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
              }`}
            >
              <span>🚶 অনাবাসিক</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.nonResidential)})</span>
            </button>

            {/* Fee Category Quick Chips */}
            <button
              type="button"
              onClick={() => setSelectedFeeCategory(selectedFeeCategory === "FREE" ? "ALL" : "FREE")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedFeeCategory === "FREE"
                  ? "bg-purple-700 text-white shadow-2xs font-bold"
                  : "bg-white text-purple-800 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              <span>🎁 লিল্লাহ/ফ্রি</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.freeCount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFeeCategory(selectedFeeCategory === "DISCOUNTED" ? "ALL" : "DISCOUNTED")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                selectedFeeCategory === "DISCOUNTED"
                  ? "bg-violet-700 text-white shadow-2xs font-bold"
                  : "bg-white text-violet-800 border border-violet-200 hover:bg-violet-50"
              }`}
            >
              <span>🔖 মওকুফপ্রাপ্ত</span>
              <span className="text-[10px] opacity-90">({convertToBanglaNumber(stats.discountedCount)})</span>
            </button>
          </div>

          {/* Active Filter Tags & Count Summary Bar */}
          {activeFiltersCount > 0 && (
            <div className="pt-2 border-t border-slate-200/80 flex items-center flex-wrap justify-between gap-2 bg-emerald-50/50 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 p-2.5 sm:px-4">
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">সক্রিয় ফিল্টার:</span>

                {selectedClass !== "ALL" && (
                  <span className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-md font-semibold text-xs shadow-2xs">
                    জামাত: {selectedClass === "UNASSIGNED" ? "অনির্ধারিত" : selectedClass}
                    <button
                      type="button"
                      onClick={() => setSelectedClass("ALL")}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedSystem !== "ALL" && (
                  <span className="inline-flex items-center gap-1 bg-white border border-blue-300 text-blue-800 px-2 py-0.5 rounded-md font-semibold text-xs shadow-2xs">
                    বিভাগ:{" "}
                    {selectedSystem === "HIFZ"
                      ? "হিফজ"
                      : selectedSystem === "KITAB"
                      ? "কিতাব"
                      : selectedSystem === "NOORANI"
                      ? "নূরানী"
                      : "নাজেরা"}
                    <button
                      type="button"
                      onClick={() => setSelectedSystem("ALL")}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedFeeCategory !== "ALL" && (
                  <span className="inline-flex items-center gap-1 bg-white border border-purple-300 text-purple-800 px-2 py-0.5 rounded-md font-semibold text-xs shadow-2xs">
                    ফি:{" "}
                    {selectedFeeCategory === "FREE"
                      ? "লিল্লাহ/ফ্রি"
                      : selectedFeeCategory === "DISCOUNTED"
                      ? "মওকুফপ্রাপ্ত"
                      : "পেইং"}
                    <button
                      type="button"
                      onClick={() => setSelectedFeeCategory("ALL")}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedResidential !== "ALL" && (
                  <span className="inline-flex items-center gap-1 bg-white border border-indigo-300 text-indigo-800 px-2 py-0.5 rounded-md font-semibold text-xs shadow-2xs">
                    ধরন: {selectedResidential}
                    <button
                      type="button"
                      onClick={() => setSelectedResidential("ALL")}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {searchQuery && (
                  <span className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-semibold text-xs shadow-2xs">
                    অনুসন্ধান: &ldquo;{searchQuery}&rdquo;
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  পাওয়া গেছে:{" "}
                  <span className="text-emerald-700 font-mono text-sm">
                    {convertToBanglaNumber(filteredStudents.length)}
                  </span>{" "}
                  জন
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-1 rounded-md text-xs font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  ফিল্টার মুছুন
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Action Bar (When rows are selected) */}
        {selectedStudentIds.size > 0 && (
          <div className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="font-bold bg-emerald-700 px-2 py-0.5 rounded-md text-emerald-100">
                {convertToBanglaNumber(selectedStudentIds.size)}
              </span>
              <span>জন শিক্ষার্থী নির্বাচিত</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/academic/id-cards"
                className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1 text-xs"
              >
                <span>আইডি কার্ড প্রিন্ট</span>
              </Link>

              <Link
                href="/dashboard/communication/sms"
                className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1 text-xs"
              >
                <span>এসএমএস পাঠান</span>
              </Link>

              <button
                onClick={() => setShowPrintModal(true)}
                className="bg-white text-emerald-950 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 text-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>নির্বাচিতদের প্রিন্ট</span>
              </button>

              <button
                onClick={() => setSelectedStudentIds(new Set())}
                className="text-emerald-300 hover:text-white p-1 ml-1"
                title="সিলেকশন বাতিল করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs select-none">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-slate-500 hover:text-slate-800 transition cursor-pointer"
                      title={
                        selectedStudentIds.size === filteredStudents.length
                          ? "সব আনসিলেক্ট করুন"
                          : "সব সিলেক্ট করুন"
                      }
                    >
                      {selectedStudentIds.size > 0 &&
                      selectedStudentIds.size === filteredStudents.length ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">আইডি নম্বর</th>
                  <th className="px-4 py-3.5">রোল</th>
                  <th className="px-5 py-3.5">শিক্ষার্থীর নাম</th>
                  <th className="px-5 py-3.5">জামাত / ক্লাস</th>
                  <th className="px-4 py-3.5">ধরন</th>
                  <th className="px-5 py-3.5">অভিভাবক ও ফোন</th>
                  <th className="px-5 py-3.5 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const studentId = getStudentIdNumber(student, students);
                    const studentIdBn = convertToBanglaNumber(studentId);
                    const className =
                      (Array.isArray(student.classes)
                        ? student.classes[0]?.name
                        : student.classes?.name) ||
                      student.class_name ||
                      "অনির্ধারিত";
                    const isSelected = selectedStudentIds.has(student.id);
                    const isDeleting = deletingId === student.id;

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-slate-50/80 transition group ${
                          isSelected ? "bg-emerald-50/50" : ""
                        } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleSelect(student.id)}
                            className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* ID Number */}
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {studentIdBn}
                        </td>

                        {/* Roll Number */}
                        <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                          {student.roll_number
                            ? convertToBanglaNumber(student.roll_number)
                            : "-"}
                        </td>

                        {/* Name & Photo */}
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            {student.photo_url ? (
                              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                <Image
                                  src={student.photo_url}
                                  alt={student.first_name || ""}
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                                {(student.first_name || "শ")[0]}
                              </div>
                            )}

                            <div>
                              <Link
                                href={`/dashboard/students/${student.id}`}
                                className="hover:text-emerald-700 hover:underline flex items-center gap-1.5 transition"
                              >
                                <span>
                                  {student.first_name} {student.last_name}
                                </span>
                                {student.gender === "FEMALE" && (
                                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-full font-semibold">
                                    ছাত্রী
                                  </span>
                                )}
                              </Link>
                              {student.father_name && (
                                <p className="text-[11px] font-normal text-slate-400">
                                  পিতা: {student.father_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Class Badge (Clickable to filter!) */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedClass(className)}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                            title={`শুধুমাত্র "${className}" জামাতের তালিকা দেখুন`}
                          >
                            {className}
                          </button>
                        </td>

                        {/* Residential Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              student.residential_status === "আবাসিক" || student.is_boarding
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : student.residential_status === "ডে-কেয়ার"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {student.residential_status ||
                              (student.is_boarding ? "আবাসিক" : "অনাবাসিক")}
                          </span>
                        </td>

                        {/* Parent Phone */}
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {student.parent_phone ? (
                            <a
                              href={`tel:${student.parent_phone}`}
                              className="hover:text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{student.parent_phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            {/* View Profile */}
                            <Link
                              href={`/dashboard/students/${student.id}`}
                              className="text-slate-600 hover:text-emerald-700 font-medium transition p-1.5 rounded-lg hover:bg-emerald-50"
                              title="বিস্তারিত প্রোফাইল ও ইতিহাস"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {/* Edit Student */}
                            <Link
                              href={`/dashboard/students/${student.id}/edit`}
                              className="text-blue-600 hover:text-blue-800 font-medium transition p-1.5 rounded-lg hover:bg-blue-50"
                              title="তথ্য সম্পাদনা"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>

                            {/* Delete Student */}
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="text-red-500 hover:text-red-700 font-medium transition p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                              title="শিক্ষার্থী মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="text-slate-700 font-bold text-base">
                          কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি
                        </p>
                        <p className="text-xs text-slate-500">
                          {activeFiltersCount > 0
                            ? "প্রদত্ত ফিল্টার বা সার্চের সাথে মিল রয়েছে এমন কোনো রেকর্ড নেই। ফিল্টার রিসেট করে দেখুন।"
                            : "বর্তমানে কোনো শিক্ষার্থী নিবন্ধিত নেই। নতুন শিক্ষার্থী নিবন্ধন করুন।"}
                        </p>
                        {activeFiltersCount > 0 && (
                          <button
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            সব ফিল্টার ক্লিয়ার করুন
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Card View (Mobile Friendly Layout) */}
        {viewMode === "card" && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/50">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => {
                const studentId = getStudentIdNumber(student, students);
                const studentIdBn = convertToBanglaNumber(studentId);
                const className =
                  (Array.isArray(student.classes)
                    ? student.classes[0]?.name
                    : student.classes?.name) ||
                  student.class_name ||
                  "অনির্ধারিত";
                const isSelected = selectedStudentIds.has(student.id);

                return (
                  <div
                    key={student.id}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition space-y-3 relative ${
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleToggleSelect(student.id)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        {student.photo_url ? (
                          <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 border border-slate-200">
                            <Image
                              src={student.photo_url}
                              alt={student.first_name || ""}
                              fill
                              sizes="44px"
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-sm shrink-0">
                            {(student.first_name || "শ")[0]}
                          </div>
                        )}

                        <div>
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-700 text-sm line-clamp-1"
                          >
                            {student.first_name} {student.last_name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono font-semibold text-emerald-700">
                              {studentIdBn}
                            </span>
                            <span>•</span>
                            <span>
                              রোল:{" "}
                              {student.roll_number
                                ? convertToBanglaNumber(student.roll_number)
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedClass(className)}
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0"
                      >
                        {className}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <div>
                        {student.parent_phone ? (
                          <a
                            href={`tel:${student.parent_phone}`}
                            className="hover:text-emerald-700 flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{student.parent_phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">ফোন অনির্ধারিত</span>
                        )}
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                          student.residential_status === "আবাসিক" || student.is_boarding
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {student.residential_status ||
                          (student.is_boarding ? "আবাসিক" : "অনাবাসিক")}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {student.father_name ? `পিতা: ${student.father_name}` : ""}
                      </span>

                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
                          title="বিস্তারিত দেখুন"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/dashboard/students/${student.id}/edit`}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                কোনো শিক্ষার্থী পাওয়া যায়নি
              </div>
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            মোট প্রদর্শিত:{" "}
            <span className="font-bold text-slate-800">
              {convertToBanglaNumber(filteredStudents.length)}
            </span>{" "}
            জন (মোট {convertToBanglaNumber(students.length)} জনের মধ্যে)
          </div>

          <div className="flex items-center gap-3">
            {currentSession && (
              <span className="text-slate-600">
                শিক্ষাবর্ষ:{" "}
                <strong className="text-slate-900">{currentSession.name}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Official Printable View Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  শিক্ষার্থী তালিকা প্রিন্ট প্রিভিউ
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>এখনই প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div className="p-6 overflow-y-auto print:p-0 print:m-0" id="printable-student-list">
              {/* Official Madrasa Header */}
              <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1">
                {madrasaInfo.logo_url && (
                  <div className="w-14 h-14 mx-auto relative mb-1.5">
                    <Image
                      src={madrasaInfo.logo_url}
                      alt={madrasaInfo.name}
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>
                )}
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {madrasaInfo.name}
                </h2>
                {madrasaInfo.address && (
                  <p className="text-xs text-slate-600">{madrasaInfo.address}</p>
                )}
                <div className="flex items-center justify-center gap-3 text-xs text-slate-500 pt-0.5">
                  {madrasaInfo.phone && <span>মোবাইল: {madrasaInfo.phone}</span>}
                  {madrasaInfo.established_year && (
                    <span>স্থাপিত: {madrasaInfo.established_year}</span>
                  )}
                </div>
                <div className="pt-2">
                  <span className="inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide">
                    শিক্ষার্থীদের অফিশিয়াল তালিকা
                  </span>
                </div>
              </div>

              {/* Filter / Meta Recap */}
              <div className="grid grid-cols-3 gap-2 py-3 text-xs border-b border-slate-200 font-medium text-slate-700">
                <div>
                  জামাত:{" "}
                  <strong className="text-slate-900 font-bold">
                    {selectedClass === "ALL" ? "সকল জামাত" : selectedClass}
                  </strong>
                </div>
                <div className="text-center">
                  শিক্ষাবর্ষ:{" "}
                  <strong className="text-slate-900 font-bold">
                    {currentSession ? currentSession.name : "চলতি শিক্ষাবর্ষ"}
                  </strong>
                </div>
                <div className="text-right">
                  মোট শিক্ষার্থী:{" "}
                  <strong className="text-slate-900 font-bold">
                    {convertToBanglaNumber(
                      selectedStudentIds.size > 0
                        ? selectedStudentIds.size
                        : filteredStudents.length
                    )}{" "}
                    জন
                  </strong>
                </div>
              </div>

              {/* Printable Table */}
              <div className="mt-4">
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center w-10">ক্রম</th>
                      <th className="border border-slate-300 p-2 text-center">আইডি নং</th>
                      <th className="border border-slate-300 p-2 text-center">রোল</th>
                      <th className="border border-slate-300 p-2 text-left">শিক্ষার্থীর নাম</th>
                      <th className="border border-slate-300 p-2 text-left">জামাত / শ্রেণি</th>
                      <th className="border border-slate-300 p-2 text-left">পিতার নাম</th>
                      <th className="border border-slate-300 p-2 text-center">ধরন</th>
                      <th className="border border-slate-300 p-2 text-center">অভিভাবকের ফোন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedStudentIds.size > 0
                      ? filteredStudents.filter((s) => selectedStudentIds.has(s.id))
                      : filteredStudents
                    ).map((st, idx) => {
                      const idNum = getStudentIdNumber(st, students);
                      const className =
                        (Array.isArray(st.classes)
                          ? st.classes[0]?.name
                          : st.classes?.name) ||
                        st.class_name ||
                        "-";
                      return (
                        <tr key={st.id} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-2 text-center font-mono">
                            {convertToBanglaNumber(idx + 1)}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                            {convertToBanglaNumber(idNum)}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-bold">
                            {st.roll_number ? convertToBanglaNumber(st.roll_number) : "-"}
                          </td>
                          <td className="border border-slate-300 p-2 font-bold text-slate-900">
                            {st.first_name} {st.last_name}
                          </td>
                          <td className="border border-slate-300 p-2">{className}</td>
                          <td className="border border-slate-300 p-2">{st.father_name || "-"}</td>
                          <td className="border border-slate-300 p-2 text-center">
                            {st.residential_status || (st.is_boarding ? "আবাসিক" : "অনাবাসিক")}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono">
                            {st.parent_phone || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-16 text-center text-xs text-slate-800 font-bold">
                <div>
                  <div className="w-40 border-t border-slate-400 mx-auto pt-1">
                    শ্রেণি শিক্ষক / নাজেমে তালিমাত
                  </div>
                </div>
                <div>
                  <div className="w-40 border-t border-slate-400 mx-auto pt-1">
                    মুহতামিম / অধ্যক্ষ
                  </div>
                </div>
              </div>

              <div className="text-center pt-8 text-[10px] text-slate-400">
                মুদ্রণের তারিখ: {new Date().toLocaleDateString("bn-BD")} | প্রস্তুতকৃত: কওমি
                ম্যানেজার
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
