"use client";

import { useState, useTransition, useMemo } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  Sparkles,
  Edit,
  Trash2,
  Share2,
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Building,
  AlertCircle,
  BookOpen,
  Eye,
  Archive,
  RotateCcw,
  ArrowUpDown,
  FileSpreadsheet,
  Copy,
  Check,
  CheckSquare,
  Square,
} from "lucide-react";
import { AlumniMember } from "@/lib/alumni";
import {
  saveAlumniMember,
  deleteAlumniMember,
  toggleArchiveAlumniMember,
  bulkUpdateAlumni,
} from "@/app/actions/alumni";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface AlumniClientProps {
  initialAlumni: AlumniMember[];
}

export default function AlumniClient({ initialAlumni }: AlumniClientProps) {
  const [alumniList, setAlumniList] = useState<AlumniMember[]>(initialAlumni);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGraduation, setFilterGraduation] = useState("ALL");
  const [filterOccupation, setFilterOccupation] = useState("ALL");
  const [filterArchiveStatus, setFilterArchiveStatus] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [filterMahfilOnly, setFilterMahfilOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"NEWEST" | "YEAR_DESC" | "YEAR_ASC" | "NAME_ASC">("NEWEST");
  const [isPending, startTransition] = useTransition();

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<AlumniMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<AlumniMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<AlumniMember | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Form Data
  const [formData, setFormData] = useState<Partial<AlumniMember>>({
    name_bn: "",
    name_en: "",
    graduation_type: "DAWRA_HADITH",
    graduation_year_hijri: "১৪৪৬ হিজরি",
    graduation_year_ce: "২০২৫",
    phone: "",
    alternative_phone: "",
    email: "",
    blood_group: "O+",
    present_address: "",
    permanent_address: "",
    district: "",
    current_occupation_type: "IMAM_KHATIB",
    designation_title: "",
    institution_or_org: "",
    workplace_address: "",
    is_active_donor: false,
    mahfil_invite_preferred: true,
    willing_to_mentor: true,
    notes_or_achievements: "",
  });

  // Filtered & Sorted list
  const filteredAlumni = useMemo(() => {
    return alumniList
      .filter((member) => {
        // Archive filter
        if (filterArchiveStatus === "ACTIVE" && member.is_archived) return false;
        if (filterArchiveStatus === "ARCHIVED" && !member.is_archived) return false;

        // Graduation filter
        if (filterGraduation !== "ALL" && member.graduation_type !== filterGraduation) {
          return false;
        }

        // Occupation filter
        if (filterOccupation !== "ALL" && member.current_occupation_type !== filterOccupation) {
          return false;
        }

        // Mahfil invitation filter
        if (filterMahfilOnly && !member.mahfil_invite_preferred) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            member.name_bn.toLowerCase().includes(q) ||
            (member.name_en && member.name_en.toLowerCase().includes(q)) ||
            member.phone.includes(q) ||
            member.designation_title.toLowerCase().includes(q) ||
            member.institution_or_org.toLowerCase().includes(q) ||
            (member.district && member.district.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "YEAR_DESC") {
          return (Number(b.graduation_year_ce) || 0) - (Number(a.graduation_year_ce) || 0);
        }
        if (sortBy === "YEAR_ASC") {
          return (Number(a.graduation_year_ce) || 0) - (Number(b.graduation_year_ce) || 0);
        }
        if (sortBy === "NAME_ASC") {
          return a.name_bn.localeCompare(b.name_bn, "bn");
        }
        return 0;
      });
  }, [alumniList, filterArchiveStatus, filterGraduation, filterOccupation, filterMahfilOnly, searchQuery, sortBy]);

  // Overall statistics
  const totalAlumni = alumniList.length;
  const activeCount = alumniList.filter((m) => !m.is_archived).length;
  const dawraCount = alumniList.filter((m) => m.graduation_type === "DAWRA_HADITH").length;
  const hifzCount = alumniList.filter((m) => m.graduation_type === "HIFZ_COMPLETION").length;
  const mahfilInviteCount = alumniList.filter((m) => m.mahfil_invite_preferred).length;
  const donorsCount = alumniList.filter((m) => m.is_active_donor).length;

  // Toggle selection for bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAlumni.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAlumni.map((m) => m.id));
    }
  };

  // Bulk Mahfil Toggle
  const handleBulkMahfil = (enable: boolean) => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateAlumni(selectedIds, { mahfil_invite_preferred: enable });
      if (res.success) {
        setAlumniList((prev) =>
          prev.map((m) =>
            selectedIds.includes(m.id) ? { ...m, mahfil_invite_preferred: enable } : m
          )
        );
        setSelectedIds([]);
      }
    });
  };

  // Bulk Archive / Restore
  const handleBulkArchive = (archive: boolean) => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateAlumni(selectedIds, { is_archived: archive });
      if (res.success) {
        setAlumniList((prev) =>
          prev.map((m) =>
            selectedIds.includes(m.id) ? { ...m, is_archived: archive } : m
          )
        );
        setSelectedIds([]);
      }
    });
  };

  // Single Archive / Restore
  const handleToggleArchive = (member: AlumniMember) => {
    const nextState = !member.is_archived;
    startTransition(async () => {
      const res = await toggleArchiveAlumniMember(member.id, nextState);
      if (res.success) {
        setAlumniList((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, is_archived: nextState } : m))
        );
      }
    });
  };

  // Copy phone helper
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = (recordsToExport: AlumniMember[] = filteredAlumni) => {
    const headers = [
      "নাম (বাংলা)",
      "নাম (ইংরেজি)",
      "ফারেগীন বিভাগ",
      "হিজরি সন",
      "ইংরেজি সন",
      "মোবাইল নম্বর",
      "বিকল্প মোবাইল",
      "রক্তের গ্রুপ",
      "পেশা / খেদমত",
      "পদবি",
      "প্রতিষ্ঠান / কর্মস্থল",
      "জেলা",
      "বর্তমান ঠিকানা",
      "স্থায়ী ঠিকানা",
      "বার্ষিক মাহফিলে আমন্ত্রণ",
      "মাদরাসার নিয়মিত দাতা",
      "পরামর্শ প্রদানে আগ্রহী",
      "মন্তব্য ও অর্জন",
      "স্ট্যাটাস",
    ];

    const escapeCSV = (val?: string | boolean | number) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = recordsToExport.map((m) => [
      escapeCSV(m.name_bn),
      escapeCSV(m.name_en),
      escapeCSV(m.graduation_type),
      escapeCSV(m.graduation_year_hijri),
      escapeCSV(m.graduation_year_ce),
      escapeCSV(m.phone),
      escapeCSV(m.alternative_phone),
      escapeCSV(m.blood_group),
      escapeCSV(m.current_occupation_type),
      escapeCSV(m.designation_title),
      escapeCSV(m.institution_or_org),
      escapeCSV(m.district),
      escapeCSV(m.present_address || m.workplace_address),
      escapeCSV(m.permanent_address),
      escapeCSV(m.mahfil_invite_preferred ? "হ্যাঁ" : "না"),
      escapeCSV(m.is_active_donor ? "হ্যাঁ" : "না"),
      escapeCSV(m.willing_to_mentor ? "হ্যাঁ" : "না"),
      escapeCSV(m.notes_or_achievements),
      escapeCSV(m.is_archived ? "আর্কাইভকৃত" : "সক্রিয়"),
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `qawmi_alumni_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setSelectedMember(null);
    setFormData({
      name_bn: "",
      name_en: "",
      graduation_type: "DAWRA_HADITH",
      graduation_year_hijri: "১৪৪৬ হিজরি",
      graduation_year_ce: "২০২৫",
      phone: "",
      alternative_phone: "",
      email: "",
      blood_group: "O+",
      present_address: "",
      permanent_address: "",
      district: "",
      current_occupation_type: "IMAM_KHATIB",
      designation_title: "ইমাম ও খতীব",
      institution_or_org: "",
      workplace_address: "",
      is_active_donor: false,
      mahfil_invite_preferred: true,
      willing_to_mentor: true,
      notes_or_achievements: "",
    });
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (member: AlumniMember) => {
    setSelectedMember(member);
    setFormData({ ...member });
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Submit Save Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_bn?.trim() || !formData.phone?.trim()) {
      setFormError("শিক্ষার্থীর পূর্ণ নাম (বাংলা) এবং মোবাইল নম্বর আবশ্যক।");
      return;
    }

    startTransition(async () => {
      const res = await saveAlumniMember({
        ...formData,
        id: selectedMember?.id,
        name_bn: formData.name_bn!,
        phone: formData.phone!,
        graduation_type: formData.graduation_type || "DAWRA_HADITH",
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess("ফারিগীন সদস্যের তথ্য সফলভাবে সংরক্ষিত হয়েছে!");
        if (selectedMember) {
          setAlumniList((prev) =>
            prev.map((m) => (m.id === selectedMember.id ? ({ ...m, ...formData } as AlumniMember) : m))
          );
        } else if (res.id) {
          const newObj: AlumniMember = {
            id: res.id,
            madrasa_id: "default",
            name_bn: formData.name_bn!,
            name_en: formData.name_en || "",
            graduation_type: formData.graduation_type || "DAWRA_HADITH",
            graduation_year_hijri: formData.graduation_year_hijri || "১৪৪৬ হিজরি",
            graduation_year_ce: formData.graduation_year_ce || "২০২৫",
            phone: formData.phone!,
            alternative_phone: formData.alternative_phone || "",
            email: formData.email || "",
            blood_group: formData.blood_group || "",
            present_address: formData.present_address || "",
            permanent_address: formData.permanent_address || "",
            district: formData.district || "",
            current_occupation_type: formData.current_occupation_type || "OTHER",
            designation_title: formData.designation_title || "খেদমতগুজার",
            institution_or_org: formData.institution_or_org || "",
            workplace_address: formData.workplace_address || "",
            is_active_donor: Boolean(formData.is_active_donor),
            mahfil_invite_preferred: formData.mahfil_invite_preferred ?? true,
            willing_to_mentor: formData.willing_to_mentor ?? true,
            notes_or_achievements: formData.notes_or_achievements || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setAlumniList((prev) => [newObj, ...prev]);
        }
        setTimeout(() => setIsModalOpen(false), 800);
      }
    });
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    startTransition(async () => {
      const res = await deleteAlumniMember(memberToDelete.id);
      if (res.success) {
        setAlumniList((prev) => prev.filter((m) => m.id !== memberToDelete.id));
        setIsDeleteModalOpen(false);
        setMemberToDelete(null);
      }
    });
  };

  const getGraduationBadge = (type: AlumniMember["graduation_type"]) => {
    switch (type) {
      case "DAWRA_HADITH":
        return <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">দাওরায়ে হাদিস ফারিগ</span>;
      case "HIFZ_COMPLETION":
        return <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">হিফজ সমাপ্ত (হাফেজ)</span>;
      case "FAZILAT":
        return <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">ফযীলত জামাত</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">প্রাক্তন শিক্ষার্থী</span>;
    }
  };

  const getOccupationBadge = (type: AlumniMember["current_occupation_type"]) => {
    switch (type) {
      case "IMAM_KHATIB":
        return "ইমাম ও খতীব";
      case "MUHADDIS_TEACHER":
        return "মুহাদ্দিস / শিক্ষক";
      case "HAFIZ_TEACHER":
        return "হিফজ শিক্ষক";
      case "BUSINESS":
        return "ব্যবসা ও বাণিজ্য";
      case "HIGHER_ISLAMIC_STUDIES":
        return "উচ্চতর গবেষণা (ইফতা/আদব)";
      case "ABROAD_KHEDMAT":
        return "প্রবাসে দ্বীনি খেদমত";
      default:
        return "অন্যান্য খেদমত";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden print:hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ফারিগীন ও অ্যালামনাই নেটওয়ার্ক (Alumni Management)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            মাদরাসার ফারিগীন ও প্রাক্তন শিক্ষার্থী রেজিস্টার
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-2xl">
            হিফজুল কুরআন সমাপ্তকারী হাফেজ ও দাওরায়ে হাদিস পাসকৃত উলামায়ে কেরামের বর্তমান কর্মস্থল, খেদমত ও যোগাযোগের পূর্ণাঙ্গ ডিরেক্টরি — যা বার্ষিক মাহফিল, দাতা সমন্বয় ও সার্বিক পরামর্শে অপরিহার্য।
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/20 transition flex items-center gap-2"
            title="CSV / Excel ফাইল ডাউনলোড করুন"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">এক্সেল / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/20 transition flex items-center gap-2"
            title="প্রিন্ট প্রিভিউ"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">প্রিন্ট / PDF</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন তৈরি করুন</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">মোট ফারিগীন</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{toBanglaNumber(totalAlumni)} জন</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">হিফজ সম্পন্নকারী</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{toBanglaNumber(hifzCount)} জন</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">দাওরায়ে হাদিস</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{toBanglaNumber(dawraCount)} জন</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">মাহফিল আমন্ত্রণ তালিকা</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-700">{toBanglaNumber(mahfilInviteCount)} জন</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">নিয়মিত দাতা / শুভাকাঙ্ক্ষী</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-700">{toBanglaNumber(donorsCount)} জন</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="নাম, ফোন, পদবি, প্রতিষ্ঠান বা জেলা দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status: Active / Archived / All */}
            <select
              value={filterArchiveStatus}
              onChange={(e) => setFilterArchiveStatus(e.target.value as any)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="ACTIVE">সক্রিয় সদস্য ({toBanglaNumber(activeCount)})</option>
              <option value="ARCHIVED">আর্কাইভকৃত সদস্য ({toBanglaNumber(totalAlumni - activeCount)})</option>
              <option value="ALL">সকল সদস্য ({toBanglaNumber(totalAlumni)})</option>
            </select>

            {/* Graduation Type */}
            <select
              value={filterGraduation}
              onChange={(e) => setFilterGraduation(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">সকল ফারিগীন বিভাগ</option>
              <option value="DAWRA_HADITH">দাওরায়ে হাদিস</option>
              <option value="HIFZ_COMPLETION">হিফজুল কুরআন</option>
              <option value="FAZILAT">ফযীলত</option>
              <option value="OTHER">অন্যান্য</option>
            </select>

            {/* Occupation Filter */}
            <select
              value={filterOccupation}
              onChange={(e) => setFilterOccupation(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">সকল কর্মস্থল / খেদমত</option>
              <option value="IMAM_KHATIB">ইমাম ও খতীব</option>
              <option value="MUHADDIS_TEACHER">মুহাদ্দিস / শিক্ষক</option>
              <option value="HAFIZ_TEACHER">হিফজ শিক্ষক</option>
              <option value="BUSINESS">ব্যবসা ও বাণিজ্য</option>
              <option value="HIGHER_ISLAMIC_STUDIES">উচ্চতর গবেষণা</option>
              <option value="ABROAD_KHEDMAT">প্রবাসে খেদমত</option>
            </select>

            {/* Sorting */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="NEWEST">নতুন সংযোজন (সর্বশেষ)</option>
                <option value="YEAR_DESC">পাসের সন (সর্বশেষ)</option>
                <option value="YEAR_ASC">পাসের সন (প্রাচীনতম)</option>
                <option value="NAME_ASC">নামের ক্রমানুসারে (ক-হ)</option>
              </select>
            </div>

            {/* Mahfil Toggle */}
            <button
              type="button"
              onClick={() => setFilterMahfilOnly(!filterMahfilOnly)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center gap-1.5 ${
                filterMahfilOnly
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>মাহফিল তালিকা</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-emerald-700 font-bold"
            >
              {selectedIds.length === filteredAlumni.length && filteredAlumni.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>সব নির্বাচন ({toBanglaNumber(filteredAlumni.length)})</span>
            </button>
            {selectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                {toBanglaNumber(selectedIds.length)} জন নির্বাচিত
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleBulkMahfil(true)}
                disabled={isPending}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold transition disabled:opacity-50"
              >
                + মাহফিল তালিকায় যুক্ত
              </button>
              <button
                type="button"
                onClick={() => handleBulkMahfil(false)}
                disabled={isPending}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition disabled:opacity-50"
              >
                মাহফিল তালিকা থেকে বাদ
              </button>
              <button
                type="button"
                onClick={() => handleBulkArchive(filterArchiveStatus !== "ARCHIVED")}
                disabled={isPending}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 rounded-lg font-bold transition disabled:opacity-50"
              >
                {filterArchiveStatus === "ARCHIVED" ? "পুনরুদ্ধার করুন" : "একসাথে আর্কাইভ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const toExport = alumniList.filter((m) => selectedIds.includes(m.id));
                  handleExportCSV(toExport);
                }}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold transition"
              >
                নির্বাচিতদের CSV ডাউনলোড
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block mb-6 border-b pb-4 text-center">
        <h2 className="text-xl font-bold">মাদরাসা ফারিগীন ও অ্যালামনাই রেজিস্টার</h2>
        <p className="text-xs text-slate-600 mt-1">
          তারিখ: {new Date().toLocaleDateString("bn-BD")} | মোট তালিকাভুক্ত: {toBanglaNumber(filteredAlumni.length)} জন
        </p>
      </div>

      {/* Alumni Members Cards Grid */}
      {filteredAlumni.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center print:hidden">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">কোনো ফারিগীন সদস্য পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            আপনার অনুসন্ধান বা ফিল্টারের সাথে মিল রেখে কোনো রেকর্ড নেই। ফিল্টার পরিবর্তন করুন অথবা নতুন ফারিগীন সদস্য যুক্ত করুন।
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন তৈরি করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlumni.map((member) => {
            const isSelected = selectedIds.includes(member.id);
            return (
              <div
                key={member.id}
                className={`bg-white rounded-2xl border transition shadow-xs hover:shadow-md p-5 flex flex-col justify-between group relative ${
                  isSelected ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/10" : "border-slate-200 hover:border-emerald-500/60"
                } ${member.is_archived ? "opacity-75 bg-slate-50/80" : ""}`}
              >
                <div>
                  {/* Card Top: Checkbox, Badges & Year */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(member.id)}
                        className="text-slate-400 hover:text-emerald-600 transition print:hidden"
                        title="নির্বাচন করুন"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>
                      {getGraduationBadge(member.graduation_type)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {member.is_archived && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          আর্কাইভ
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {member.graduation_year_hijri || `${toBanglaNumber(member.graduation_year_ce)} ইংরেজি`}
                      </span>
                    </div>
                  </div>

                  {/* Name and Designation */}
                  <h3
                    onClick={() => setViewingMember(member)}
                    className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition cursor-pointer flex items-center justify-between"
                  >
                    <span>{member.name_bn}</span>
                  </h3>
                  {member.name_en && (
                    <p className="text-xs text-slate-400 font-medium">{member.name_en}</p>
                  )}

                  {/* Current Occupation / Khedmat Box */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-start gap-2 text-xs">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">{member.designation_title}</span>
                        <span className="text-slate-500 block text-[11px]">
                          {getOccupationBadge(member.current_occupation_type)}
                        </span>
                      </div>
                    </div>

                    {member.institution_or_org && (
                      <div className="flex items-start gap-2 text-xs text-slate-600">
                        <Building className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{member.institution_or_org}</span>
                      </div>
                    )}

                    {(member.district || member.present_address) && (
                      <div className="flex items-start gap-2 text-[11px] text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{member.district ? `জেলা: ${member.district}` : member.present_address}</span>
                      </div>
                    )}
                  </div>

                  {/* Contact Pills */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <div className="inline-flex items-center rounded-lg bg-emerald-50 text-emerald-800 font-bold">
                      <a
                        href={`tel:${member.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 hover:bg-emerald-100 rounded-l-lg transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{member.phone}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(member.phone)}
                        className="p-1.5 hover:bg-emerald-200/60 rounded-r-lg border-l border-emerald-200 transition"
                        title="ফোন নম্বর কপি করুন"
                      >
                        {copiedPhone === member.phone ? (
                          <Check className="w-3 h-3 text-emerald-700" />
                        ) : (
                          <Copy className="w-3 h-3 text-emerald-600" />
                        )}
                      </button>
                    </div>

                    {member.blood_group && (
                      <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px]">
                        গ্রুপ: {member.blood_group}
                      </span>
                    )}
                  </div>

                  {/* Engagement Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    {member.mahfil_invite_preferred && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        ✓ মাহফিলে আমন্ত্রণ
                      </span>
                    )}
                    {member.is_active_donor && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        ★ মাদরাসার দাতা
                      </span>
                    )}
                    {member.willing_to_mentor && (
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                        ✓ তাদরীব ও পরামর্শ
                      </span>
                    )}
                  </div>

                  {member.notes_or_achievements && (
                    <p className="mt-2 text-[11px] text-slate-500 line-clamp-2 italic">
                      "{member.notes_or_achievements}"
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between print:hidden">
                  <div className="flex items-center gap-1.5">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setViewingMember(member)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      title="বিস্তারিত দেখুন"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">বিস্তারিত</span>
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(member)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      title="সম্পাদনা করুন"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>সম্পাদনা</span>
                    </button>

                    {/* Archive / Restore */}
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(member)}
                      className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                      title={member.is_archived ? "পুনরুদ্ধার করুন" : "আর্কাইভ করুন"}
                    >
                      {member.is_archived ? (
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        setMemberToDelete(member);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <a
                    href={`https://wa.me/88${member.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition text-xs font-bold"
                    title="WhatsApp বার্তা পাঠান"
                  >
                    <Share2 className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW FULL PROFILE MODAL */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
                  {viewingMember.name_bn.slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{viewingMember.name_bn}</h3>
                  {viewingMember.name_en && (
                    <p className="text-xs text-slate-400">{viewingMember.name_en}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {getGraduationBadge(viewingMember.graduation_type)}
                    <span className="text-xs font-bold text-slate-500">
                      পাসের সন: {viewingMember.graduation_year_hijri || toBanglaNumber(viewingMember.graduation_year_ce)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs sm:text-sm">
              {/* Profession and Organization */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <h4 className="font-bold text-emerald-950 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-700" />
                  <span>বর্তমান খেদমত ও কর্মস্থল</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">পদবি</span>
                    <span className="font-bold text-slate-900">{viewingMember.designation_title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">খেদমতের ধরণ</span>
                    <span className="font-semibold">{getOccupationBadge(viewingMember.current_occupation_type)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">প্রতিষ্ঠান / মসজিদ</span>
                    <span className="font-semibold text-slate-900">{viewingMember.institution_or_org || "—"}</span>
                  </div>
                  {viewingMember.workplace_address && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">কর্মস্থলের পূর্ণ ঠিকানা</span>
                      <span>{viewingMember.workplace_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-teal-600" />
                  <span>যোগাযোগের বিবরণ</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">প্রধান মোবাইল নম্বর</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a href={`tel:${viewingMember.phone}`} className="font-bold text-emerald-700 hover:underline">
                        {viewingMember.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(viewingMember.phone)}
                        className="text-slate-400 hover:text-emerald-600"
                        title="কপি করুন"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {viewingMember.alternative_phone && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">বিকল্প মোবাইল</span>
                      <span className="font-semibold">{viewingMember.alternative_phone}</span>
                    </div>
                  )}
                  {viewingMember.email && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">ইমেইল</span>
                      <span>{viewingMember.email}</span>
                    </div>
                  )}
                  {viewingMember.blood_group && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">রক্তের গ্রুপ</span>
                      <span className="font-bold text-rose-600">{viewingMember.blood_group}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Addresses */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>ঠিকানা সংক্রান্ত তথ্য</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">নিজ জেলা</span>
                    <span className="font-bold">{viewingMember.district || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">বর্তমান ঠিকানা</span>
                    <span>{viewingMember.present_address || "—"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">স্থায়ী ঠিকানা</span>
                    <span>{viewingMember.permanent_address || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Notes and Madrasa Engagement */}
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                <h4 className="font-bold text-purple-950 mb-2">মাদরাসার সাথে সংশ্লিষ্টতা ও মূল্যায়ন</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    viewingMember.mahfil_invite_preferred ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-500"
                  }`}>
                    {viewingMember.mahfil_invite_preferred ? "✓ মাহফিলে আমন্ত্রণ তালিকাভুক্ত" : "✗ মাহফিল তালিকার বাইরে"}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    viewingMember.is_active_donor ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"
                  }`}>
                    {viewingMember.is_active_donor ? "★ নিয়মিত দাতা ও শুভাকাঙ্ক্ষী" : "সাধারণ সদস্য"}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    viewingMember.willing_to_mentor ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
                  }`}>
                    {viewingMember.willing_to_mentor ? "✓ দিকনির্দেশনা ও তালিম প্রদানে আগ্রহী" : "পরামর্শে অনীহা"}
                  </span>
                </div>
                {viewingMember.notes_or_achievements && (
                  <p className="text-xs text-slate-600 italic mt-2 bg-white/80 p-3 rounded-xl border border-purple-100">
                    "{viewingMember.notes_or_achievements}"
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const m = viewingMember;
                  setViewingMember(null);
                  handleOpenEdit(m);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>সম্পাদনা করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingMember(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedMember ? "ফারিগীন সদস্যের তথ্য সম্পাদনা" : "+ নতুন ফারিগীন সদস্য তৈরি করুন"}
                  </h3>
                  <p className="text-xs text-slate-500">প্রাক্তন শিক্ষার্থীর কর্মস্থল, খেদমত ও যোগাযোগ তথ্য সংরক্ষণ করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              {/* Row 1: Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শিক্ষার্থীর পূর্ণ নাম (বাংলায়) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ মাওলানা আব্দুল্লাহ আল মামুন"
                    value={formData.name_bn || ""}
                    onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ইংরেজিতে নাম (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maulana Abdullah Al Mamun"
                    value={formData.name_en || ""}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: Graduation Type & Years */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ফারেগীন বিভাগ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.graduation_type || "DAWRA_HADITH"}
                    onChange={(e) => setFormData({ ...formData, graduation_type: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DAWRA_HADITH">দাওরায়ে হাদিস (মাস্টার্স সমমান)</option>
                    <option value="HIFZ_COMPLETION">হিফজুল কুরআন সমাপ্ত</option>
                    <option value="FAZILAT">ফযীলত জামাত</option>
                    <option value="SANWIYA">সানাবিয়া জামাত</option>
                    <option value="OTHER">অন্যান্য বিভাগ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    হিজরি শিক্ষাবর্ষ
                  </label>
                  <input
                    type="text"
                    placeholder="উদাঃ ১৪৪৬ হিজরি"
                    value={formData.graduation_year_hijri || ""}
                    onChange={(e) => setFormData({ ...formData, graduation_year_hijri: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ইংরেজি সন <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ ২০২৪"
                    value={formData.graduation_year_ce || ""}
                    onChange={(e) => setFormData({ ...formData, graduation_year_ce: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বিকল্প মোবাইল (ঐচ্ছিক)
                  </label>
                  <input
                    type="tel"
                    placeholder="018XXXXXXXX"
                    value={formData.alternative_phone || ""}
                    onChange={(e) => setFormData({ ...formData, alternative_phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    রক্তের গ্রুপ
                  </label>
                  <select
                    value={formData.blood_group || "O+"}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Current Khedmat & Work */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বর্তমান খেদমত / পেশার ধরণ
                  </label>
                  <select
                    value={formData.current_occupation_type || "IMAM_KHATIB"}
                    onChange={(e) => setFormData({ ...formData, current_occupation_type: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="IMAM_KHATIB">ইমাম ও খতীব</option>
                    <option value="MUHADDIS_TEACHER">মুহাদ্দিস / কিতাব শিক্ষক</option>
                    <option value="HAFIZ_TEACHER">হিফজ শিক্ষক / তারাবীহ ইমাম</option>
                    <option value="BUSINESS">ব্যবসা ও বাণিজ্য</option>
                    <option value="HIGHER_ISLAMIC_STUDIES">উচ্চতর ইসলামিক গবেষণা (ইফতা)</option>
                    <option value="ABROAD_KHEDMAT">প্রবাসে দ্বীনি খেদমত</option>
                    <option value="OTHER">অন্যান্য পেশা / খেদমত</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বর্তমান পদবি <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ ইমাম ও খতীব / মুহাদ্দিস"
                    value={formData.designation_title || ""}
                    onChange={(e) => setFormData({ ...formData, designation_title: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বর্তমান কর্মস্থল / মসজিদ / প্রতিষ্ঠান
                  </label>
                  <input
                    type="text"
                    placeholder="উদাঃ বায়তুল আমান জামে মসজিদ"
                    value={formData.institution_or_org || ""}
                    onChange={(e) => setFormData({ ...formData, institution_or_org: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 5: District & Present Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    নিজ জেলা
                  </label>
                  <input
                    type="text"
                    placeholder="উদাঃ ফেনী, কুমিল্লা, ময়মনসিংহ"
                    value={formData.district || ""}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বর্তমান কর্মস্থলের পূর্ণ ঠিকানা
                  </label>
                  <input
                    type="text"
                    placeholder="উদাঃ মিরপুর-১, ঢাকা"
                    value={formData.workplace_address || ""}
                    onChange={(e) => setFormData({ ...formData, workplace_address: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 6: Madrasa Support Toggles */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-800">মাদরাসার সাথে সংশ্লিষ্টতা ও অংশগ্রহণ:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.mahfil_invite_preferred)}
                      onChange={(e) => setFormData({ ...formData, mahfil_invite_preferred: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700 font-semibold">বার্ষিক মাহফিলে আমন্ত্রণ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.is_active_donor)}
                      onChange={(e) => setFormData({ ...formData, is_active_donor: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700 font-semibold">মাদরাসার নিয়মিত দাতা</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.willing_to_mentor)}
                      onChange={(e) => setFormData({ ...formData, willing_to_mentor: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700 font-semibold">দিকনির্দেশনা ও তালিম প্রদান</span>
                  </label>
                </div>
              </div>

              {/* Row 7: Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিশেষ খেদমত, সাফল্য ও মূল্যায়ন নোট
                </label>
                <textarea
                  rows={2}
                  placeholder="উদাঃ কেন্দ্রীয় পরীক্ষায় মেধা তালিকায় ১ম বিভাগ, চমৎকার ওয়াজ ও কিরাত পরিবেশন করেন..."
                  value={formData.notes_or_achievements || ""}
                  onChange={(e) => setFormData({ ...formData, notes_or_achievements: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-bold transition"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/30 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? "সংরক্ষণ হচ্ছে..." : selectedMember ? "হালনাগাদ সম্পন্ন করুন" : "+ সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && memberToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ফারিগীন সদস্য মুছে ফেলতে চান?</h3>
            <p className="text-xs text-slate-500 mt-1">
              <strong>{memberToDelete.name_bn}</strong>-এর যাবতীয় রেকর্ড ডিরেক্টরি থেকে স্থায়ীভাবে মুছে যাবে।
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isPending ? "মুছে ফেলা হচ্ছে..." : "হ্যাঁ, মুছে ফেলুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
