"use client";

import { useState, useEffect, useMemo } from "react";
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
  Building2,
  Phone,
  Globe,
  Upload,
  Check,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { convertToBanglaNumber, getStudentIdNumber } from "@/lib/student-utils";
import {
  StudentIDCard,
  IDCardStatus,
  IDCardAuditLog,
  normalizeStudentIdCode,
  IDCardFieldVisibility,
  IDCardBuilderConfig,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_BUILDER_CONFIG,
} from "@/lib/id-card-management";
import {
  issueStudentIdCard,
  bulkGenerateIdCards,
  reissueStudentIdCard,
  updateIdCardStatus,
  saveIdCardBuilderConfig,
  resetIdCardBuilderConfig,
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
    builderConfig?: IDCardBuilderConfig;
  };
  allStudents: any[];
  classes: { id: string; name: string }[];
  users: any[];
  userType: string;
  madrasaInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    website?: string;
    principal_name?: string;
    signature_url?: string;
    principal_signature_url?: string;
  };
}

export default function IdCardClient({
  initialData,
  allStudents,
  classes,
  users,
  userType,
  madrasaInfo,
}: IdCardClientProps) {
  const cfg = initialData?.builderConfig;

  const [activeTab, setActiveTab] = useState<"cards" | "generator" | "builder" | "audit">("cards");
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
  const [issueModalSearch, setIssueModalSearch] = useState("");
  const [issueModalClassFilter, setIssueModalClassFilter] = useState("ALL");
  const [issueModalCardFilter, setIssueModalCardFilter] = useState<"ALL" | "UNISSUED" | "ISSUED">("ALL");
  const [bulkClassId, setBulkClassId] = useState("ALL");
  const [reissueReason, setReissueReason] = useState("");
  const [cardToReissue, setCardToReissue] = useState<StudentIDCard | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Card Mapping
  const activeCardStudentIds = useMemo(() => {
    return new Set(cards.filter((c) => c.status === "ACTIVE").map((c) => c.student_id));
  }, [cards]);

  // Filtered Students for Modal 1 (Issue ID Card)
  const filteredStudentsForIssue = useMemo(() => {
    return (allStudents || []).filter((s, idx) => {
      const sId = s.student_id || (s.roll_number ? `480${String(s.roll_number).padStart(3, "0")}` : `480${String(idx + 1).padStart(3, "0")}`);
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = String(s.roll_number || "");
      const q = issueModalSearch.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || sId.toLowerCase().includes(q) || roll.includes(q);
      const matchesClass = issueModalClassFilter === "ALL" || s.class_id === issueModalClassFilter || s.classes?.id === issueModalClassFilter;
      const hasActiveCard = activeCardStudentIds.has(s.id);
      const matchesCardStatus =
        issueModalCardFilter === "ALL"
          ? true
          : issueModalCardFilter === "UNISSUED"
          ? !hasActiveCard
          : hasActiveCard;

      return matchesSearch && matchesClass && matchesCardStatus;
    });
  }, [allStudents, issueModalSearch, issueModalClassFilter, issueModalCardFilter, activeCardStudentIds]);

  // Print Generator Customization States
  const [template, setTemplate] = useState(cfg?.template || "classic_islamic");
  const [themeColor, setThemeColor] = useState(cfg?.themeColor || "emerald");
  const [madrasaNameSize, setMadrasaNameSize] = useState(cfg?.madrasaNameSize || "medium");
  const [cardSide, setCardSide] = useState<"front" | "back" | "both">(cfg?.cardSide || "both");
  const [banglaFont, setBanglaFont] = useState(cfg?.banglaFont || "font-solaiman");
  const [titleFontSize, setTitleFontSize] = useState(11);
  const [addressFontSize, setAddressFontSize] = useState(8.5);
  const [nameFontSize, setNameFontSize] = useState(12.5);
  const [detailsFontSize, setDetailsFontSize] = useState(9.5);
  const [detailsGap, setDetailsGap] = useState(3);
  const [backFontSize, setBackFontSize] = useState(7.5);
  const [backLineGap, setBackLineGap] = useState(3);
  const [showEditor, setShowEditor] = useState(false);

  // ID Card Builder & Customizer State
  const [editableMadrasaInfo, setEditableMadrasaInfo] = useState({
    name: cfg?.editableMadrasaInfo?.name || madrasaInfo?.name || "মাদ্রাসাতুল মুসলিমীন",
    name_arabic: cfg?.editableMadrasaInfo?.name_arabic || "الجامعة الإسلامية دار العلوم",
    address: cfg?.editableMadrasaInfo?.address || madrasaInfo?.address || "কাটিয়ারচর, কিশোরগঞ্জ",
    phone: cfg?.editableMadrasaInfo?.phone || madrasaInfo?.phone || "01600989555",
    website: cfg?.editableMadrasaInfo?.website || madrasaInfo?.website || "www.qawmierp.app",
    logo_url: cfg?.editableMadrasaInfo?.logo_url || madrasaInfo?.logo_url || "",
    principal_name: cfg?.editableMadrasaInfo?.principal_name !== undefined ? cfg.editableMadrasaInfo.principal_name : (madrasaInfo?.principal_name || ""),
    signature_url: cfg?.editableMadrasaInfo?.signature_url || madrasaInfo?.signature_url || madrasaInfo?.principal_signature_url || "",
  });

  useEffect(() => {
    if (madrasaInfo && !cfg?.editableMadrasaInfo) {
      setEditableMadrasaInfo((prev) => ({
        ...prev,
        name: madrasaInfo.name || prev.name,
        address: madrasaInfo.address || prev.address,
        phone: madrasaInfo.phone || prev.phone,
        website: madrasaInfo.website || prev.website,
        logo_url: madrasaInfo.logo_url || prev.logo_url,
        principal_name: madrasaInfo.principal_name !== undefined ? madrasaInfo.principal_name : prev.principal_name,
        signature_url: madrasaInfo.signature_url || madrasaInfo.principal_signature_url || prev.signature_url,
      }));
    }
  }, [madrasaInfo, cfg]);

  const [signatureTitle, setSignatureTitle] = useState(cfg?.signatureTitle || "মুহতামিম / অধ্যক্ষ");
  const [qrLabel, setQrLabel] = useState(cfg?.qrLabel || "যাচাই করুন");
  const [customExpiryDate, setCustomExpiryDate] = useState(cfg?.customExpiryDate || "31-08-2027");

  // Field Selection Visibility (Customizable Card Fields)
  const [fieldVisibility, setFieldVisibility] = useState<IDCardFieldVisibility>(
    cfg?.fieldVisibility ? { ...DEFAULT_FIELD_VISIBILITY, ...cfg.fieldVisibility } : DEFAULT_FIELD_VISIBILITY
  );

  // Sample overrides for interactive canvas preview
  const [sampleCustomBloodGroup, setSampleCustomBloodGroup] = useState<string>("");
  const [sampleCustomFatherName, setSampleCustomFatherName] = useState<string>("");
  const [sampleCustomPhone, setSampleCustomPhone] = useState<string>("");
  const [sampleCustomDob, setSampleCustomDob] = useState<string>("");

  const [builderSampleStudentId, setBuilderSampleStudentId] = useState<string>(
    (users && users[0]?.id) || (allStudents && allStudents[0]?.id) || ""
  );
  const [builderSide, setBuilderSide] = useState<"front" | "back">("front");
  const [builderZoom, setBuilderZoom] = useState<number>(1.25);
  const [editorSubTab, setEditorSubTab] = useState<"template" | "branding" | "fields" | "backside" | "advanced">("template");
  const [newInstructionText, setNewInstructionText] = useState("");

  const [customInstructions, setCustomInstructions] = useState<string[]>(
    cfg?.customInstructions && cfg.customInstructions.length > 0
      ? cfg.customInstructions
      : [
          "মাদরাসায় অবস্থানকালীন সময়ে কার্ডটি পরিধান করা বাধ্যতামূলক।",
          "এই কার্ডটি মাদরাসার সম্পত্তি এবং এটি হস্তান্তরযোগ্য নয়।",
          "কার্ড হারিয়ে গেলে কর্তৃপক্ষকে অবিলম্বে অবহিত করতে হবে।",
          "কার্ডটি পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।",
        ]
  );

  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    cfg?.termsAndConditions ||
      "This identity card is issued by the authority. It is non-transferable and must be returned if found."
  );

  const handleAddInstruction = () => {
    if (!newInstructionText.trim()) return;
    setCustomInstructions([...customInstructions, newInstructionText.trim()]);
    setNewInstructionText("");
  };

  const handleRemoveInstruction = (index: number) => {
    setCustomInstructions(customInstructions.filter((_, i) => i !== index));
  };

  const handleResetBuilderDefaults = async () => {
    setIsSavingBuilder(true);
    setActionMessage(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("qm_id_card_builder_config");
      }
    } catch {}

    const res = await resetIdCardBuilderConfig();
    setIsSavingBuilder(false);

    setTemplate("classic_islamic");
    setThemeColor("emerald");
    setMadrasaNameSize("medium");
    setBanglaFont("font-solaiman");
    setCardSide("both");
    setFieldVisibility(DEFAULT_FIELD_VISIBILITY);
    setEditableMadrasaInfo({
      name: madrasaInfo?.name || "মাদ্রাসাতুল মুসলিমীন",
      name_arabic: "الجامعة الإسلامية دار العلوم",
      address: madrasaInfo?.address || "কাটিয়ারচর, কিশোরগঞ্জ",
      phone: madrasaInfo?.phone || "01600989555",
      website: madrasaInfo?.website || "www.qawmierp.app",
      logo_url: madrasaInfo?.logo_url || "",
      principal_name: madrasaInfo?.principal_name || "",
      signature_url: madrasaInfo?.signature_url || madrasaInfo?.principal_signature_url || "",
    });
    setSignatureTitle("মুহতামিম / অধ্যক্ষ");
    setQrLabel("যাচাই করুন");
    setCustomExpiryDate("31-08-2027");
    setCustomInstructions([
      "মাদরাসায় অবস্থানকালীন সময়ে কার্ডটি পরিধান করা বাধ্যতামূলক।",
      "এই কার্ডটি মাদরাসার সম্পত্তি এবং এটি হস্তান্তরযোগ্য নয়।",
      "কার্ড হারিয়ে গেলে কর্তৃপক্ষকে অবিলম্বে অবহিত করতে হবে।",
      "কার্ডটি পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।",
    ]);
    setTermsAndConditions(
      "This identity card is issued by the authority. It is non-transferable and must be returned if found."
    );

    if (res.error) {
      setActionMessage({ type: "error", text: res.error });
    } else {
      setActionMessage({ type: "success", text: "ডিফল্ট কাস্টমাইজেশন ডাটাবেজ সহ রিস্টোর করা হয়েছে!" });
    }
  };

  const handleSaveBuilderSettings = async () => {
    setIsSavingBuilder(true);
    setActionMessage(null);

    const configToSave: IDCardBuilderConfig = {
      template,
      themeColor,
      madrasaNameSize,
      banglaFont,
      cardSide,
      fieldVisibility,
      editableMadrasaInfo,
      signatureTitle,
      qrLabel,
      customExpiryDate,
      customInstructions,
      termsAndConditions,
      updated_at: new Date().toISOString(),
    };

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("qm_id_card_builder_config", JSON.stringify(configToSave));
      }
    } catch {}

    const res = await saveIdCardBuilderConfig(configToSave);
    setIsSavingBuilder(false);

    if (res.error) {
      setActionMessage({ type: "error", text: res.error });
    } else {
      setActionMessage({
        type: "success",
        text: "আইডি কার্ডের টেমপ্লেট ও কাস্টম ফিল্ড টিকমার্ক ডিজাইন সেটিংস সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে!",
      });
    }
  };

  const handlePrintTestCard = () => {
    const element = document.getElementById("builder-test-card-container");
    if (!element) return;
    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = element.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.style.position = "fixed";
    clone.style.top = "50%";
    clone.style.left = "50%";
    clone.style.transform = "translate(-50%, -50%)";
    clone.style.zIndex = "99999";
    clone.style.background = "white";
    clone.style.padding = "20px";
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

  const selectedSampleUser =
    (users || []).find((u) => u.id === builderSampleStudentId) || users?.[0] || allStudents?.[0];

  const sampleStudentCode = normalizeStudentIdCode(
    selectedSampleUser?.student_id || selectedSampleUser?.id_number || (selectedSampleUser?.roll_number ? `480${String(selectedSampleUser.roll_number).padStart(3, "0")}` : "480001"),
    1
  );
  const sampleCardNum = `QM-${sampleStudentCode}`;

  const builderSampleCard: StudentIDCard = {
    id: selectedSampleUser?.id || "sample-001",
    madrasa_id: "m-001",
    student_id: selectedSampleUser?.id || "s-001",
    session_id: "sess-1",
    card_number: sampleCardNum,
    student_number: sampleStudentCode,
    issue_date: "2026-09-01",
    expiry_date: "2027-08-31",
    status: "ACTIVE",
    photo_url: getDirectPhotoUrl(selectedSampleUser?.photo_url),
    verification_id: selectedSampleUser?.id || "demo-verify-id",
    template_id: template,
    issued_by: "অফিস",
    snapshot: {
      student_name: selectedSampleUser
        ? `${selectedSampleUser.first_name || ""} ${selectedSampleUser.last_name || ""}`.trim()
        : "আবু বকর সিদ্দিক",
      student_id_code: sampleStudentCode,
      roll_number: selectedSampleUser?.roll_number ? String(selectedSampleUser.roll_number) : "১২",
      class_name: selectedSampleUser?.classes?.name || "শরহে বেকায়া",
      session_name: "১৪৪৭-৪৮ হিজরি",
      father_name: sampleCustomFatherName || selectedSampleUser?.father_name || "মুহাম্মদ উসমান",
      parent_phone: sampleCustomPhone || selectedSampleUser?.phone || selectedSampleUser?.guardian_phone || "01711-223344",
      blood_group: sampleCustomBloodGroup || selectedSampleUser?.blood_group || "B+",
      date_of_birth: sampleCustomDob || selectedSampleUser?.date_of_birth || "12-05-2010",
      address: selectedSampleUser?.address || "ঢাকা, বাংলাদেশ",
      photo_url: getDirectPhotoUrl(selectedSampleUser?.photo_url),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Printable A4 Cards Generator List
  const allCardsList = (users || []).flatMap((user, idx) => {
    const uCode = normalizeStudentIdCode(
      user.student_id || user.id_number || (user.roll_number ? `480${String(user.roll_number).padStart(3, "0")}` : 480000 + idx + 1),
      idx + 1
    );
    const uCardNum = `QM-${uCode}`;

    const cardObj: StudentIDCard = {
      id: user.id,
      madrasa_id: user.madrasa_id || "",
      student_id: user.id,
      session_id: "",
      card_number: uCardNum,
      student_number: uCode,
      issue_date: "2026-09-01",
      expiry_date: "2027-08-31",
      status: "ACTIVE",
      photo_url: getDirectPhotoUrl(user.photo_url),
      verification_id: user.id,
      template_id: template,
      issued_by: "অফিস",
      snapshot: {
        student_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "শিক্ষার্থীর নাম",
        student_id_code: uCode,
        roll_number: user.roll_number ? String(user.roll_number) : "—",
        class_name: user.classes?.name || "জামাতহীন",
        session_name: "১৪৪৭-৪৮ হিজরি",
        father_name: user.father_name,
        parent_phone: user.phone || user.guardian_phone,
        blood_group: user.blood_group,
        date_of_birth: user.date_of_birth,
        address: user.address,
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

  const printPages = chunkArray(allCardsList, 6);

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
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "builder"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>আইডি কার্ড বিল্ডার ও এডিটর</span>
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
                      const cleanStuId = normalizeStudentIdCode(
                        card.snapshot?.student_id_code || card.student_number || card.card_number,
                        1
                      );
                      const displayCardNum = `QM-${cleanStuId}`;

                      return (
                        <tr key={card.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">
                            {displayCardNum}
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
                              <div>
                                <span>{card.snapshot.student_name}</span>
                                <span className="block text-[11px] text-slate-400 font-mono font-normal">
                                  আইডি: {cleanStuId}
                                </span>
                              </div>
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
                              onClick={() => {
                                const matchingStudent = allStudents.find((s) => s.id === card.student_id);
                                const currentPhoto = matchingStudent?.photo_url || card.photo_url || card.snapshot?.photo_url;
                                setPreviewCard({
                                  ...card,
                                  photo_url: currentPhoto,
                                  snapshot: {
                                    ...card.snapshot,
                                    photo_url: currentPhoto,
                                  },
                                });
                              }}
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
                onClick={() => setActiveTab("builder")}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                ডিজাইন কাস্টমাইজ করুন
              </button>

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
                    themeColor={themeColor}
                    madrasaNameSize={madrasaNameSize}
                    fieldVisibility={fieldVisibility}
                    customExpiryDate={customExpiryDate}
                    madrasaInfo={editableMadrasaInfo}
                    customInstructions={customInstructions}
                    signatureTitle={signatureTitle}
                    qrLabel={qrLabel}
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
                className="a4-id-card-sheet bg-white p-4 grid grid-cols-2 gap-4 justify-items-center"
                style={{ pageBreakAfter: pageIndex < printPages.length - 1 ? "always" : "auto" }}
              >
                {pageCards.map((c, i) => (
                  <div key={i} className="border border-dashed border-slate-300 p-1 rounded-xl inline-block bg-white print-break-inside-avoid">
                    <StudentIdCardTemplate
                      card={c.card}
                      side={c.type}
                      templateId={template}
                      themeColor={themeColor}
                      madrasaNameSize={madrasaNameSize}
                      fieldVisibility={fieldVisibility}
                      customExpiryDate={customExpiryDate}
                      madrasaInfo={editableMadrasaInfo}
                      customInstructions={customInstructions}
                      signatureTitle={signatureTitle}
                      qrLabel={qrLabel}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ID CARD BUILDER & CUSTOM EDITOR */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          {/* Top Banner & Action Controls */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>লাইভ কার্ড কাস্টমাইজেশন ইঞ্জি‌ন</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                আইডি কার্ড বিল্ডার ও ডিজাইন এডিটর
              </h2>
              <p className="text-xs text-slate-300">
                রিয়েল-টাইম ক্যানভাসে লোগো, শিরোনাম, স্বাক্ষর, বারকোড/QR লেবেল এবং নিয়মাবলী সরাসরি পরিবর্তন করুন।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handlePrintTestCard}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>টেস্ট কার্ড প্রিন্ট</span>
              </button>

              <button
                type="button"
                onClick={handleSaveBuilderSettings}
                disabled={isSavingBuilder}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingBuilder ? "সংরক্ষণ হচ্ছে..." : "ডিজাইন সেভ করুন"}</span>
              </button>

              <button
                type="button"
                onClick={handleResetBuilderDefaults}
                disabled={isSavingBuilder}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="ডিফল্ট সেটিংস রিসেট করুন"
              >
                <RotateCcw className="w-4 h-4" />
                <span>রিসেট</span>
              </button>
            </div>
          </div>

          {/* Builder Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Card Stage Preview (5 Cols) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 sticky top-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>লাইভ কার্ড প্রাকদর্শন (Live Canvas)</span>
                </h3>
                <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  CR80 PVC (2.125" x 3.375")
                </span>
              </div>

              {/* Controls Bar above card */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Front / Back Switcher */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBuilderSide("front")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                      builderSide === "front"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    সামনের দিক
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilderSide("back")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                      builderSide === "back"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    পিছনের দিক
                  </button>
                </div>

                {/* Scale Switcher */}
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <span>জুম:</span>
                  <button
                    type="button"
                    onClick={() => setBuilderZoom(1)}
                    className={`px-2 py-1 rounded cursor-pointer ${builderZoom === 1 ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                  >
                    ১×
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilderZoom(1.25)}
                    className={`px-2 py-1 rounded cursor-pointer ${builderZoom === 1.25 ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                  >
                    ১.২৫×
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilderZoom(1.4)}
                    className={`px-2 py-1 rounded cursor-pointer ${builderZoom === 1.4 ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                  >
                    ১.৪×
                  </button>
                </div>
              </div>

              {/* Student Selector to test live card */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 block">নমুনা শিক্ষার্থী পরিবর্তন করুন:</label>
                <select
                  value={builderSampleStudentId}
                  onChange={(e) => setBuilderSampleStudentId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="">-- প্রথম শিক্ষার্থী --</option>
                  {(users || []).map((u, idx) => {
                    const stuCode = u.student_id || (u.roll_number ? `480${String(u.roll_number).padStart(3, "0")}` : `480${String(idx + 1).padStart(3, "0")}`);
                    return (
                      <option key={u.id} value={u.id}>
                        [আইডি: {stuCode}] {u.first_name} {u.last_name || ""} ({u.classes?.name || "জামাতহীন"} - রোল: {u.roll_number || "-"})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* The Rendered Card Canvas */}
              <div className="bg-slate-900/95 p-8 rounded-3xl border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[380px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                <div
                  id="builder-test-card-container"
                  className="transition-all duration-300 transform shadow-2xl rounded-[12px] overflow-hidden border-2 border-amber-400/40 relative z-10 hover:scale-[1.28]"
                  style={{
                    transform: `scale(${builderZoom})`,
                    transformOrigin: "center",
                  }}
                >
                  <StudentIdCardTemplate
                    card={builderSampleCard}
                    side={builderSide}
                    templateId={template}
                    themeColor={themeColor}
                    madrasaNameSize={madrasaNameSize}
                    fieldVisibility={fieldVisibility}
                    customExpiryDate={customExpiryDate}
                    madrasaInfo={editableMadrasaInfo}
                    customInstructions={customInstructions}
                    signatureTitle={signatureTitle}
                    qrLabel={qrLabel}
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>রেডি ফর এডিটিং অ্যান্ড প্রিন্টিং</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  ডানপাশের প্যানেলে যেকোনো পরিবর্তন করা মাত্রই বামপাশের এই ক্যানভাসে তা সাথে সাথে দেখতে পাবেন।
                </p>
              </div>
            </div>

            {/* Right Column: Customization Editor Controls (7 Cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              {/* Sub-Tabs Bar */}
              <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setEditorSubTab("template")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editorSubTab === "template"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>১. টেমপ্লেট ও কালার</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditorSubTab("branding")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editorSubTab === "branding"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>২. ব্র্যান্ডিং ও লোগো</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditorSubTab("fields")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editorSubTab === "fields"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>৩. তথ্যের ফিল্ড নির্বাচন</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditorSubTab("backside")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editorSubTab === "backside"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>৪. পিছনের নির্দেশাবলী</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditorSubTab("advanced")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    editorSubTab === "advanced"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>৫. লেবেল ও স্বাক্ষর</span>
                </button>
              </div>

              {/* SUB TAB 1: TEMPLATE & COLORS */}
              {editorSubTab === "template" && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Select Template Style */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      আইডি কার্ডের টেমপ্লেট নির্বাচন করুন:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Template 1 */}
                      <button
                        type="button"
                        onClick={() => setTemplate("classic_islamic")}
                        className={`p-4 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                          template === "classic_islamic"
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-xs text-slate-900">🕌 ক্লাসিক ইসলামিক</span>
                          {template === "classic_islamic" && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          ঐতিহ্যবাহী সবুজ ও সোনালী নকশা এবং ইসলামিক ওয়াটারমার্ক সহ।
                        </p>
                      </button>

                      {/* Template 2 */}
                      <button
                        type="button"
                        onClick={() => setTemplate("modern_minimal")}
                        className={`p-4 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                          template === "modern_minimal"
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-xs text-slate-900">⚡ মডার্ন মিনিমাল</span>
                          {template === "modern_minimal" && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          পরিচ্ছন্ন আধুনিক সাদা ব্যাকগ্রাউন্ড ও মিনিমাল হেডার।
                        </p>
                      </button>

                      {/* Template 3 */}
                      <button
                        type="button"
                        onClick={() => setTemplate("premium_madrasa")}
                        className={`p-4 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                          template === "premium_madrasa"
                            ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-xs text-slate-900">👑 প্রিমিয়াম মাদরাসা</span>
                          {template === "premium_madrasa" && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          গোল্ডেন রিবন ব্যানার ও গাড় ডার্ক এমারেল্ড থিম।
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Accent Color Palette */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      প্রাইমারি কালার থিম:
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      {[
                        { id: "emerald", name: "মরু সবুজ (Emerald)", color: "bg-emerald-700" },
                        { id: "blue", name: "রয়েল ব্লু (Royal Blue)", color: "bg-blue-700" },
                        { id: "indigo", name: "ইনডিগো (Indigo)", color: "bg-indigo-700" },
                        { id: "rose", name: "রুবি রেড (Ruby Rose)", color: "bg-rose-700" },
                        { id: "slate", name: "ডিপ ডার্ক (Dark Slate)", color: "bg-slate-800" },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setThemeColor(c.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            themeColor === c.id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${c.color} shrink-0`} />
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Choice */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      বাংলা ফন্ট স্টাইল:
                    </label>

                    <select
                      value={banglaFont}
                      onChange={(e) => setBanglaFont(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold bg-slate-50"
                    >
                      <option value="font-solaiman">SolaimanLipi (সোলাইমান লিপি - ক্লাসিক)</option>
                      <option value="font-sans">Noto Sans Bengali (আধুনিক ডিজিটাল)</option>
                      <option value="font-serif">Kalpurush (কালপুরুষ - সাহিত্য)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* SUB TAB 2: BRANDING & LOGO */}
              {editorSubTab === "branding" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">মাদরাসার নাম (বাংলা):</label>
                      <input
                        type="text"
                        value={editableMadrasaInfo.name}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, name: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">মাদরাসার নামের সাইজ (Font Size):</label>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: "small", label: "ছোট (৮px)" },
                          { id: "medium", label: "সাধারণ (৯.৫px)" },
                          { id: "large", label: "বড় (১১.৫px)" },
                          { id: "xlarge", label: "অনেক বড় (১৩px)" },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setMadrasaNameSize(s.id)}
                            className={`flex-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                              madrasaNameSize === s.id
                                ? "border-emerald-600 bg-emerald-700 text-white shadow-2xs"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">আরবি / ইংরেজি নাম:</label>
                      <input
                        type="text"
                        value={editableMadrasaInfo.name_arabic}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, name_arabic: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">ঠিকানা:</label>
                      <input
                        type="text"
                        value={editableMadrasaInfo.address}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, address: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">ফোন নম্বর:</label>
                      <input
                        type="text"
                        value={editableMadrasaInfo.phone}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, phone: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">মুহতামিম / অধ্যক্ষের নাম:</label>
                      <input
                        type="text"
                        value={editableMadrasaInfo.principal_name || ""}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, principal_name: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white"
                        placeholder="যেমন: আল্লামা মুফতি আব্দুল কাইয়ুম"
                      />
                    </div>
                  </div>

                  {/* Logo Image URL */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>মাদরাসার লোগো লিংক (Logo URL):</span>
                      {editableMadrasaInfo.logo_url && (
                        <button
                          type="button"
                          onClick={() => setEditableMadrasaInfo({ ...editableMadrasaInfo, logo_url: "" })}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          লোগো সরান
                        </button>
                      )}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="https://example.com/logo.png"
                        value={editableMadrasaInfo.logo_url}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, logo_url: e.target.value })}
                        className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white font-mono"
                      />
                      {editableMadrasaInfo.logo_url && (
                        <img
                          src={editableMadrasaInfo.logo_url}
                          alt="Logo Preview"
                          className="w-9 h-9 object-contain rounded-lg border p-1 bg-white shrink-0"
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      পিএনজি (PNG) বা জেপিইজি (JPG) ফাইলের ডিরেক্ট ওয়েব লিংক দিন।
                    </p>
                  </div>

                  {/* Principal / Mohtamim Signature Image URL */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>মুহতামিম/অধ্যক্ষের স্বাক্ষর লিংক (Signature URL):</span>
                      {editableMadrasaInfo.signature_url && (
                        <button
                          type="button"
                          onClick={() => setEditableMadrasaInfo({ ...editableMadrasaInfo, signature_url: "" })}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          স্বাক্ষর সরান
                        </button>
                      )}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="https://example.com/signature.png"
                        value={editableMadrasaInfo.signature_url}
                        onChange={(e) => setEditableMadrasaInfo({ ...editableMadrasaInfo, signature_url: e.target.value })}
                        className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white font-mono"
                      />
                      {editableMadrasaInfo.signature_url && (
                        <img
                          src={editableMadrasaInfo.signature_url}
                          alt="Signature Preview"
                          className="h-9 max-w-[80px] object-contain rounded-lg border p-1 bg-white shrink-0"
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      স্বচ্ছ ব্যাকগ্রাউন্ডসহ (Transparent PNG) ডিজিটাল স্বাক্ষরের ছবি দিলে প্রিন্ট সুন্দর দেখাবে।
                    </p>
                  </div>
                </div>
              )}

              {/* SUB TAB 3: CUSTOMIZABLE FIELDS VISIBILITY */}
              {editorSubTab === "fields" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">আইডি কার্ডে তথ্যের ফিল্ড কাস্টমাইজেশন</h4>
                      <p className="text-[11px] text-slate-500">
                        কার্ডে কোন কোন তথ্য প্রদর্শন করতে চান তা টিক দিন। প্রয়োজনে লাইভ প্রিভিউতে টেস্ট মান দিয়ে যাচাই করতে পারেন।
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setFieldVisibility({
                            photo: true,
                            student_id: true,
                            class: true,
                            roll: true,
                            session: true,
                            blood_group: true,
                            father_name: false,
                            phone: false,
                            dob: false,
                            address: false,
                            qr_code: true,
                          })
                        }
                        className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                      >
                        ডিফল্ট
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFieldVisibility({
                            photo: true,
                            student_id: true,
                            class: true,
                            roll: true,
                            session: false,
                            blood_group: true,
                            father_name: true,
                            phone: true,
                            dob: false,
                            address: false,
                            qr_code: true,
                          })
                        }
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg cursor-pointer transition"
                      >
                        অভিভাবক সহ
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFieldVisibility({
                            photo: true,
                            student_id: true,
                            class: true,
                            roll: true,
                            session: false,
                            blood_group: false,
                            father_name: false,
                            phone: false,
                            dob: false,
                            address: false,
                            qr_code: true,
                          })
                        }
                        className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                      >
                        মিনিমাল
                      </button>
                    </div>
                  </div>

                  {/* Fields Grid Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Class */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.class ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.class}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, class: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">১. জামাত / শ্রেণি (Class)</span>
                        <span className="text-[10.5px] text-slate-500">শিক্ষার্থীর শ্রেণি বা বিভাগ কার্ডে দৃশ্যমান হবে</span>
                      </div>
                    </label>

                    {/* 2. Roll */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.roll ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.roll}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, roll: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">২. রোল নম্বর (Roll Number)</span>
                        <span className="text-[10.5px] text-slate-500">শিক্ষার্থীর ক্লাসের রোল নম্বর</span>
                      </div>
                    </label>

                    {/* 3. Session */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.session ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.session}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, session: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">৩. শিক্ষাবর্ষ (Academic Session)</span>
                        <span className="text-[10.5px] text-slate-500">চলতি হিজরি/ইংরেজি সেশন (যেমন: ১৪৪৭-৪৮)</span>
                      </div>
                    </label>

                    {/* 4. Blood Group */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.blood_group ? "bg-rose-50/50 border-rose-300 ring-1 ring-rose-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.blood_group}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, blood_group: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                          <span>৪. রক্তের গ্রুপ (Blood Group)</span>
                          <span className="text-[9px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.2 rounded-md">জরুরি</span>
                        </span>
                        <span className="text-[10.5px] text-slate-500">জরুরি প্রয়োজনে ব্লাড গ্রুপ (A+, B+, O+, AB+ ইত্যাদি)</span>
                      </div>
                    </label>

                    {/* 5. Father's Name */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.father_name ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.father_name}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, father_name: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">৫. পিতার নাম (Father's Name)</span>
                        <span className="text-[10.5px] text-slate-500">শিক্ষার্থীর অভিভাবক/পিতার নাম</span>
                      </div>
                    </label>

                    {/* 6. Phone */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.phone ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.phone}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, phone: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">৬. অভিভাবকের ফোন (Guardian Phone)</span>
                        <span className="text-[10.5px] text-slate-500">জরুরি যোগাযোগের মোবাইল নম্বর</span>
                      </div>
                    </label>

                    {/* 7. Date of Birth */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.dob ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.dob}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, dob: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">৭. জন্ম তারিখ (Date of Birth)</span>
                        <span className="text-[10.5px] text-slate-500">শিক্ষার্থীর জন্ম তারিখ</span>
                      </div>
                    </label>

                    {/* 8. Address */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.address ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.address}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, address: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">৮. স্থায়ী ঠিকানা (Address)</span>
                        <span className="text-[10.5px] text-slate-500">গ্রাম/জেলা অথবা মাদরাসার এলাকা</span>
                      </div>
                    </label>

                    {/* 9. QR Code */}
                    <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      fieldVisibility.qr_code ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20" : "bg-slate-50 border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={fieldVisibility.qr_code}
                        onChange={(e) => setFieldVisibility({ ...fieldVisibility, qr_code: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                          <span>৯. QR ভেরিফিকেশন কোড</span>
                        </span>
                        <span className="text-[10.5px] text-slate-500">স্ক্যান করে আইডি যাচাইকরণ বারকোড/QR</span>
                      </div>
                    </label>
                  </div>

                  {/* Interactive Test Overrides for Canvas */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>ক্যানভাস প্রিভিউতে টেস্ট মান পরীক্ষা করুন (Interactive Preview Overrides):</span>
                      </span>
                      {(sampleCustomBloodGroup || sampleCustomFatherName || sampleCustomPhone || sampleCustomDob) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSampleCustomBloodGroup("");
                            setSampleCustomFatherName("");
                            setSampleCustomPhone("");
                            setSampleCustomDob("");
                          }}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          রিসেট টেস্ট মান
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">রক্তের গ্রুপ (টেস্ট):</label>
                        <select
                          value={sampleCustomBloodGroup}
                          onChange={(e) => setSampleCustomBloodGroup(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                        >
                          <option value="">-- শিক্ষার্থীর আসল গ্রুপ --</option>
                          <option value="A+">A+ (A Positive)</option>
                          <option value="A-">A- (A Negative)</option>
                          <option value="B+">B+ (B Positive)</option>
                          <option value="B-">B- (B Negative)</option>
                          <option value="O+">O+ (O Positive)</option>
                          <option value="O-">O- (O Negative)</option>
                          <option value="AB+">AB+ (AB Positive)</option>
                          <option value="AB-">AB- (AB Negative)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">পিতার নাম (টেস্ট):</label>
                        <input
                          type="text"
                          placeholder="যেমন: মুহাম্মদ উসমান"
                          value={sampleCustomFatherName}
                          onChange={(e) => setSampleCustomFatherName(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">অভিভাবকের ফোন (টেস্ট):</label>
                        <input
                          type="text"
                          placeholder="যেমন: 01711-223344"
                          value={sampleCustomPhone}
                          onChange={(e) => setSampleCustomPhone(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB 4: BACKSIDE INSTRUCTIONS */}
              {editorSubTab === "backside" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      কার্ডের পিছনের নির্দেশাবলী (Back Side Instructions):
                    </label>

                    <div className="space-y-2">
                      {customInstructions.map((instruction, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                          <span className="font-bold text-slate-400 w-5">{idx + 1}.</span>
                          <span className="flex-1 text-slate-800 font-medium">{instruction}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInstruction(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="নতুন নির্দেশাবলী লিখুন..."
                        value={newInstructionText}
                        onChange={(e) => setNewInstructionText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddInstruction()}
                        className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddInstruction}
                        className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                      >
                        + যুক্ত করুন
                      </button>
                    </div>
                  </div>

                  {/* Manual Expiry Date Option */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-200">
                    <label className="text-xs font-bold text-slate-800 block">
                      কার্ডের মেয়াদ (Expiry Date):
                    </label>
                    <input
                      type="text"
                      value={customExpiryDate}
                      onChange={(e) => setCustomExpiryDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white"
                      placeholder="যেমন: 31-08-2027"
                    />
                    <p className="text-[11px] text-slate-400">
                      কার্ডের পিছনের অংশে প্রদর্শিত মেয়াদ ম্যানুয়ালি পরিবর্তন করতে পারেন।
                    </p>
                  </div>
                </div>
              )}

              {/* SUB TAB 4: ADVANCED & LABELS */}
              {editorSubTab === "advanced" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">স্বাক্ষরকারীর পদবী লেবেল:</label>
                      <input
                        type="text"
                        value={signatureTitle}
                        onChange={(e) => setSignatureTitle(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white"
                        placeholder="যেমন: মুহতামিম / অধ্যক্ষ"
                      />
                      <p className="text-[10px] text-slate-400">ডিফল্ট: "মুহতামিম / অধ্যক্ষ"</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">QR কোড যাচাইকরণ লেবেল:</label>
                      <input
                        type="text"
                        value={qrLabel}
                        onChange={(e) => setQrLabel(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white"
                        placeholder="যেমন: যাচাই করুন"
                      />
                      <p className="text-[10px] text-slate-400">ডিফল্ট: "যাচাই করুন"</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResetBuilderDefaults}
                      className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl border border-rose-200 transition cursor-pointer"
                    >
                      ডিফল্ট ডিজাইনে রিসেট করুন
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveBuilderSettings}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>সেটিংস সেভ করুন</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {/* MODAL 1: Single Issue Modal with Search & Filters */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <IdCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">নতুন শিক্ষার্থী আইডি কার্ড ইস্যু</h3>
                  <p className="text-[11px] text-slate-500">শিক্ষার্থী খুঁজে বের করে ডিজিটাল আইডি কার্ড প্রস্তুত করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIssueModal(false);
                  setIssueModalSearch("");
                  setIssueModalClassFilter("ALL");
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Class Filters Bar */}
            <div className="space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={issueModalSearch}
                    onChange={(e) => setIssueModalSearch(e.target.value)}
                    placeholder="নাম, আইডি কোড বা রোল দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                  />
                  {issueModalSearch && (
                    <button
                      type="button"
                      onClick={() => setIssueModalSearch("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Class Filter Dropdown */}
                <div className="sm:w-44">
                  <select
                    value={issueModalClassFilter}
                    onChange={(e) => setIssueModalClassFilter(e.target.value)}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                  >
                    <option value="ALL">সকল জামাত</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setIssueModalCardFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    issueModalCardFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  সকল শিক্ষার্থী ({allStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIssueModalCardFilter("UNISSUED")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    issueModalCardFilter === "UNISSUED"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>কার্ড নেই ({allStudents.filter((s) => !activeCardStudentIds.has(s.id)).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssueModalCardFilter("ISSUED")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    issueModalCardFilter === "ISSUED"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>ইস্যুকৃত ({allStudents.filter((s) => activeCardStudentIds.has(s.id)).length})</span>
                </button>
              </div>
            </div>

            {/* Student List View */}
            <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[240px] pr-1 space-y-1.5 border border-slate-100 rounded-2xl p-1 bg-slate-50/50">
              {filteredStudentsForIssue.length > 0 ? (
                filteredStudentsForIssue.map((s, idx) => {
                  const sId = s.student_id || (s.roll_number ? `480${String(s.roll_number).padStart(3, "0")}` : `480${String(idx + 1).padStart(3, "0")}`);
                  const isSelected = selectedStudentForIssue === s.id;
                  const hasActiveCard = activeCardStudentIds.has(s.id);
                  const photoUrl = getDirectPhotoUrl(s.photo_url);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudentForIssue(s.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50/80 border-emerald-500 shadow-2xs ring-1 ring-emerald-500"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[11px] font-black text-slate-500">
                              {(s.first_name || "শ")[0]}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {s.first_name} {s.last_name || ""}
                            </p>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                              ID: {sId}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {s.classes?.name || "জামাতহীন"} • রোল: {s.roll_number || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges & Selection Indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {hasActiveCard ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            সচল কার্ড আছে
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            কার্ড নেই
                          </span>
                        )}

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center space-y-1">
                  <Search className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                  <p className="text-[10px] text-slate-400">ফিল্টার অথবা অনুসন্ধানের কি-ওয়ার্ড পরিবর্তন করুন</p>
                </div>
              )}
            </div>

            {/* Selected Student Confirmation Pill */}
            {selectedStudentForIssue && (
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">
                      {allStudents.find((s) => s.id === selectedStudentForIssue)?.first_name}{" "}
                      {allStudents.find((s) => s.id === selectedStudentForIssue)?.last_name || ""}
                    </span>
                    <span className="text-[11px] text-emerald-800 ml-1.5">
                      ({allStudents.find((s) => s.id === selectedStudentForIssue)?.classes?.name || "জামাতহীন"} - রোল:{" "}
                      {allStudents.find((s) => s.id === selectedStudentForIssue)?.roll_number || "—"})
                    </span>
                  </div>
                </div>
                {activeCardStudentIds.has(selectedStudentForIssue) && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    রি-ইস্যু হবে
                  </span>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowIssueModal(false);
                  setIssueModalSearch("");
                  setIssueModalClassFilter("ALL");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>

              <button
                type="button"
                onClick={handleIssueSingle}
                disabled={loadingAction || !selectedStudentForIssue}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loadingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>ইস্যু হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <IdCard className="w-4 h-4" />
                    <span>আইডি কার্ড ইস্যু করুন</span>
                  </>
                )}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150 relative my-auto max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setPreviewCard(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <h3 className="font-black text-slate-900 text-base">ডিজিটাল আইডি প্রিভিউ</h3>
              <p className="text-xs text-slate-400">{previewCard.snapshot.student_name}</p>
            </div>

            <DigitalIdCardView
              card={previewCard}
              madrasaInfo={editableMadrasaInfo}
              studentPhotoUrl={allStudents.find((s) => s.id === previewCard.student_id)?.photo_url || previewCard.photo_url || previewCard.snapshot?.photo_url}
              themeColor={themeColor}
              madrasaNameSize={madrasaNameSize}
              customExpiryDate={customExpiryDate}
              fieldVisibility={fieldVisibility}
              customInstructions={customInstructions}
              showActions={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
