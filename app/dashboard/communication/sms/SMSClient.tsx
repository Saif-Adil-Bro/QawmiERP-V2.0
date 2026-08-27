"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Send,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Smartphone,
  Users,
  User,
  HelpCircle,
  FileText,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  PhoneCall,
  Calendar,
  DollarSign,
  Building,
  RefreshCw,
} from "lucide-react";
import {
  AVAILABLE_SMS_TAGS,
  DEFAULT_SMS_TEMPLATES,
  SMSTemplate,
  SMSTag,
  renderDynamicTemplate,
  calculateSMSParts,
  toBengaliNumber,
  getBengaliDateContext,
  BENGALI_MONTHS,
  StudentContextData,
} from "@/lib/sms-template-helper";
import {
  sendSMS,
  sendBulkSMS,
  saveSMSTemplate,
  deleteSMSTemplate,
} from "@/app/actions/communication";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";

interface Props {
  initialStudents: any[];
  initialClasses: any[];
  initialTemplates: SMSTemplate[];
  initialLogs: any[];
  madrasaInfo: {
    name?: string;
    phone?: string;
  };
}

export default function SMSClient({
  initialStudents,
  initialClasses,
  initialTemplates,
  initialLogs,
  madrasaInfo,
}: Props) {
  const [activeTab, setActiveTab] = useState<"send" | "builder" | "logs">("send");
  const [sendMode, setSendMode] = useState<"single" | "bulk">("single");

  // Date context info
  const dateCtx = useMemo(() => getBengaliDateContext(), []);

  // Template State
  const [templates, setTemplates] = useState<SMSTemplate[]>(
    initialTemplates && initialTemplates.length > 0 ? initialTemplates : DEFAULT_SMS_TEMPLATES
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("all");

  // Template Builder Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCategory, setModalCategory] = useState<any>("Fee");
  const [modalCategoryBangla, setModalCategoryBangla] = useState("ফি বকেয়া");
  const [modalTemplateContent, setModalTemplateContent] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveMessage, setTemplateSaveMessage] = useState<string | null>(null);

  // Due Month Selector State (From Month to To Month)
  const [monthSelectionMode, setMonthSelectionMode] = useState<"single" | "range">("range");
  const [fromMonth, setFromMonth] = useState<string>("জানুয়ারি");
  const [toMonth, setToMonth] = useState<string>(dateCtx.month);

  // SMS Sending Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");
  const [messageType, setMessageType] = useState<string>("Fee");
  const [messageContent, setMessageContent] = useState<string>(
    DEFAULT_SMS_TEMPLATES[0].message_template
  );
  const [customDueAmount, setCustomDueAmount] = useState<string>("");

  // Bulk options
  const [bulkFilter, setBulkFilter] = useState<"all" | "class" | "due">("all");
  const [bulkClassId, setBulkClassId] = useState<string>("");

  // Status & Logs
  const [logs, setLogs] = useState<any[]>(initialLogs || []);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Textarea Refs for tag insertion
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Active selected student object
  const activeStudent: StudentContextData | null = useMemo(() => {
    if (!selectedStudentId) {
      if (initialStudents.length > 0) return initialStudents[0];
      return null;
    }
    return initialStudents.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, initialStudents]);

  // Number of months in the selected range
  const calculatedMonthsCount = useMemo(() => {
    if (fromMonth === toMonth) return 1;
    const fromIdx = BENGALI_MONTHS.indexOf(fromMonth);
    const toIdx = BENGALI_MONTHS.indexOf(toMonth);
    if (fromIdx !== -1 && toIdx !== -1) {
      return toIdx >= fromIdx ? toIdx - fromIdx + 1 : 12 - fromIdx + toIdx + 1;
    }
    return 1;
  }, [fromMonth, toMonth]);

  // Bulk target students
  const bulkRecipients = useMemo(() => {
    let list = [...initialStudents];
    if (bulkFilter === "class" && bulkClassId) {
      list = list.filter((s) => s.class_id === bulkClassId);
    } else if (bulkFilter === "due") {
      list = list.filter((s) => Number(s.due_amount || s.monthly_fee || 0) > 0);
    }
    return list.filter((s) => s.parent_phone && s.parent_phone.trim().length >= 10);
  }, [initialStudents, bulkFilter, bulkClassId]);

  // Dynamic preview text for current single student
  const livePreviewText = useMemo(() => {
    return renderDynamicTemplate(messageContent, activeStudent, {
      madrasaName: madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন",
      madrasaPhone: madrasaInfo.phone || "০১৮১২৩৪৫৬৭৮",
      dueAmount: customDueAmount || undefined,
      fromMonth,
      toMonth,
    });
  }, [messageContent, activeStudent, madrasaInfo, customDueAmount, fromMonth, toMonth]);

  // Dynamic preview text for modal builder
  const modalPreviewText = useMemo(() => {
    return renderDynamicTemplate(modalTemplateContent, activeStudent || initialStudents[0] || null, {
      madrasaName: madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন",
      madrasaPhone: madrasaInfo.phone || "০১৮১২৩৪৫৬৭৮",
      fromMonth,
      toMonth,
    });
  }, [modalTemplateContent, activeStudent, initialStudents, madrasaInfo, fromMonth, toMonth]);

  // SMS Stats
  const smsStats = useMemo(() => {
    return calculateSMSParts(livePreviewText);
  }, [livePreviewText]);

  const modalSmsStats = useMemo(() => {
    return calculateSMSParts(modalPreviewText);
  }, [modalPreviewText]);

  // Handle student selection change
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (!studentId) {
      setRecipientName("");
      setRecipientPhone("");
      return;
    }
    const student = initialStudents.find((s) => s.id === studentId);
    if (student) {
      setRecipientName(`${student.first_name || ""} ${student.last_name || ""}`.trim());
      setRecipientPhone(student.parent_phone || "");
      if (student.due_amount) {
        setCustomDueAmount(String(student.due_amount));
      } else if (student.monthly_fee) {
        setCustomDueAmount(String(Number(student.monthly_fee) * calculatedMonthsCount));
      }
    }
  };

  // Quick Preset Handlers
  const handleApplyMonthPreset = (preset: "current" | "last2" | "last3" | "last6" | "yearToDate" | "fullYear") => {
    const currentMonthIdx = dateCtx.monthIndex ?? BENGALI_MONTHS.indexOf(dateCtx.month);
    const currIdx = currentMonthIdx !== -1 ? currentMonthIdx : 7; // default August

    if (preset === "current") {
      setMonthSelectionMode("single");
      setFromMonth(BENGALI_MONTHS[currIdx]);
      setToMonth(BENGALI_MONTHS[currIdx]);
    } else if (preset === "last2") {
      setMonthSelectionMode("range");
      const startIdx = Math.max(0, currIdx - 1);
      setFromMonth(BENGALI_MONTHS[startIdx]);
      setToMonth(BENGALI_MONTHS[currIdx]);
    } else if (preset === "last3") {
      setMonthSelectionMode("range");
      const startIdx = Math.max(0, currIdx - 2);
      setFromMonth(BENGALI_MONTHS[startIdx]);
      setToMonth(BENGALI_MONTHS[currIdx]);
    } else if (preset === "last6") {
      setMonthSelectionMode("range");
      const startIdx = Math.max(0, currIdx - 5);
      setFromMonth(BENGALI_MONTHS[startIdx]);
      setToMonth(BENGALI_MONTHS[currIdx]);
    } else if (preset === "yearToDate") {
      setMonthSelectionMode("range");
      setFromMonth(BENGALI_MONTHS[0]); // January
      setToMonth(BENGALI_MONTHS[currIdx]);
    } else if (preset === "fullYear") {
      setMonthSelectionMode("range");
      setFromMonth(BENGALI_MONTHS[0]); // January
      setToMonth(BENGALI_MONTHS[11]); // December
    }
  };

  // Auto calculate total amount from monthly fee * count
  const handleCalculateAmountFromFee = () => {
    const monthlyFee = Number(activeStudent?.monthly_fee || 1200);
    const total = monthlyFee * calculatedMonthsCount;
    setCustomDueAmount(String(total));
  };

  // Insert tag at cursor position
  const insertTagAtCursor = (
    tag: string,
    target: "message" | "modal"
  ) => {
    const textarea = target === "message" ? messageTextareaRef.current : modalTextareaRef.current;
    if (!textarea) {
      if (target === "message") setMessageContent((prev) => prev + tag);
      else setModalTemplateContent((prev) => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const updated = currentVal.substring(0, start) + tag + currentVal.substring(end);

    if (target === "message") {
      setMessageContent(updated);
    } else {
      setModalTemplateContent(updated);
    }

    // Return focus & set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);

    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  // Apply a template directly to the SMS sender
  const handleApplyTemplate = (tpl: SMSTemplate) => {
    setSelectedTemplateId(tpl.id);
    setMessageContent(tpl.message_template);
    if (tpl.category) {
      setMessageType(tpl.category);
    }
    setActiveTab("send");
  };

  // Open Modal for New Template
  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setModalTitle("");
    setModalCategory("Fee");
    setModalCategoryBangla("ফি বকেয়া");
    setModalTemplateContent("সম্মানিত অভিভাবক, {StudentName} (রোল: {Id})-এর {DueMonths} মাস পর্যন্ত মোট {DueAmount} টাকা বেতন বকেয়া রয়েছে। দ্রুত পরিশোধের অনুরোধ করা হলো। - {MadrasaName}");
    setTemplateSaveMessage(null);
    setIsModalOpen(true);
  };

  // Open Modal for Editing Template
  const handleOpenEditTemplate = (tpl: SMSTemplate) => {
    setEditingTemplate(tpl);
    setModalTitle(tpl.title);
    setModalCategory(tpl.category || "Custom");
    setModalCategoryBangla(tpl.category_bangla || "সাধারণ");
    setModalTemplateContent(tpl.message_template);
    setTemplateSaveMessage(null);
    setIsModalOpen(true);
  };

  // Save Template Action
  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalTemplateContent.trim()) {
      alert("অনুগ্রহ করে টেমপ্লেট শিরোনাম এবং মেসেজ কন্টেন্ট পূরণ করুন");
      return;
    }

    setIsSavingTemplate(true);
    setTemplateSaveMessage(null);

    const formData = new FormData();
    if (editingTemplate && !editingTemplate.id.startsWith("tpl-")) {
      formData.append("id", editingTemplate.id);
    }
    formData.append("title", modalTitle.trim());
    formData.append("category", modalCategory);
    formData.append("category_bangla", modalCategoryBangla);
    formData.append("message_template", modalTemplateContent.trim());

    try {
      await saveSMSTemplate(formData);

      // Update local state
      if (editingTemplate) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id
              ? {
                  ...t,
                  title: modalTitle.trim(),
                  category: modalCategory,
                  category_bangla: modalCategoryBangla,
                  message_template: modalTemplateContent.trim(),
                }
              : t
          )
        );
      } else {
        const newTpl: SMSTemplate = {
          id: `custom-${Date.now()}`,
          title: modalTitle.trim(),
          category: modalCategory,
          category_bangla: modalCategoryBangla,
          message_template: modalTemplateContent.trim(),
          is_default: false,
          created_at: new Date().toISOString(),
        };
        setTemplates((prev) => [newTpl, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert("টেমপ্লেট সেভ করতে ত্রুটি হয়েছে: " + err.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (id.startsWith("tpl-")) {
      alert("ডিফল্ট সিস্টেম টেমপ্লেট মুছে ফেলা যাবে না।");
      return;
    }
    if (!confirm("আপনি কি নিশ্চিতভাবে এই টেমপ্লেটটি মুছে ফেলতে চান?")) return;

    try {
      await deleteSMSTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId("");
      }
    } catch (err: any) {
      alert("টেমপ্লেট মুছতে ত্রুটি: " + err.message);
    }
  };

  // Send Single SMS
  const handleSendSingleSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone || !recipientPhone.trim()) {
      setSendErrorMessage("প্রাপকের মোবাইল নম্বর প্রদান করুন।");
      return;
    }

    const resolvedMessage = renderDynamicTemplate(messageContent, activeStudent, {
      madrasaName: madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন",
      madrasaPhone: madrasaInfo.phone || "০১৮১২৩৪৫৬৭৮",
      dueAmount: customDueAmount || undefined,
      fromMonth,
      toMonth,
    });

    setIsSending(true);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    const formData = new FormData();
    formData.append("recipient_name", recipientName || "অজ্ঞাত");
    formData.append("recipient_phone", recipientPhone.trim());
    formData.append("message", resolvedMessage);
    formData.append("message_type", messageType);

    try {
      await sendSMS(formData);
      setSendSuccessMessage(`সফলভাবে "${recipientName || recipientPhone}" নম্বরে এসএমএস পাঠানো হয়েছে!`);
      // Update logs
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          recipient_name: recipientName || "অজ্ঞাত",
          recipient_phone: recipientPhone,
          message: resolvedMessage,
          message_type: messageType,
          status: "Sent",
          sent_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      setSendErrorMessage(err.message || "এসএমএস পাঠাতে ব্যর্থ হয়েছে");
    } finally {
      setIsSending(false);
    }
  };

  // Send Bulk SMS
  const handleSendBulkSMS = async () => {
    if (bulkRecipients.length === 0) {
      alert("কোনো বৈধ মোবাইল নম্বর পাওয়া যায়নি।");
      return;
    }

    if (
      !confirm(
        `আপনি কি নিশ্চিত যে ${toBengaliNumber(
          bulkRecipients.length
        )} জন শিক্ষার্থীর অভিভাবককে এই ডাইনামিক মেসেজ পাঠাতে চান?`
      )
    ) {
      return;
    }

    setIsSending(true);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    const messagesToSend = bulkRecipients.map((st) => {
      const personalizedMsg = renderDynamicTemplate(messageContent, st, {
        madrasaName: madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন",
        madrasaPhone: madrasaInfo.phone || "০১৮১২৩৪৫৬৭৮",
        dueAmount: st.due_amount || (st.monthly_fee ? Number(st.monthly_fee) * calculatedMonthsCount : customDueAmount),
        fromMonth,
        toMonth,
      });

      return {
        recipient_name: `${st.first_name || ""} ${st.last_name || ""}`.trim(),
        recipient_phone: st.parent_phone,
        message: personalizedMsg,
        message_type: messageType,
      };
    });

    try {
      await sendBulkSMS(messagesToSend);
      setSendSuccessMessage(
        `অভিনন্দন! মোট ${toBengaliNumber(
          messagesToSend.length
        )} জন অভিভাবকের নিকট ডাইনামিক এসএমএস সফলভাবে প্রেরণ করা হয়েছে।`
      );

      // Add to logs
      const newLogs = messagesToSend.map((m, idx) => ({
        id: `bulk-log-${Date.now()}-${idx}`,
        recipient_name: m.recipient_name,
        recipient_phone: m.recipient_phone,
        message: m.message,
        message_type: m.message_type,
        status: "Sent",
        sent_at: new Date().toISOString(),
      }));
      setLogs((prev) => [...newLogs, ...prev]);
    } catch (err: any) {
      setSendErrorMessage(err.message || "বাল্ক এসএমএস পাঠাতে ব্যর্থ হয়েছে");
    } finally {
      setIsSending(false);
    }
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch =
        tpl.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.message_template.toLowerCase().includes(templateSearch.toLowerCase());
      const matchCat =
        templateCategoryFilter === "all" || tpl.category === templateCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [templates, templateSearch, templateCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              ডাইনামিক এসএমএস ও বকেয়া বেতন টেমপ্লেট বিল্ডার
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            বকেয়া মাসের নাম সেলেক্টর (অমুক মাস হতে অমুক মাস), রোল, শিক্ষার্থী নাম ও বকেয়া পরিমাণ স্বয়ংক্রিয়ভাবে মেসেজে সেট করুন
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("send")}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
              activeTab === "send"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>মেসেজ পাঠান</span>
          </button>

          <button
            onClick={() => setActiveTab("builder")}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
              activeTab === "builder"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>টেমপ্লেট বিল্ডার</span>
            <span className="ml-1 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[10px] rounded-full font-bold">
              {templates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition ${
              activeTab === "logs"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>লগস ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: SEND SMS WITH DYNAMIC TAGS ===================== */}
      {activeTab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Dynamic Tag Inserter */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode selection (Single vs Bulk) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-800 flex items-center">
                  <Send className="w-4 h-4 mr-2 text-blue-600" />
                  এসএমএস পাঠানোর অপশন
                </h2>
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSendMode("single")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      sendMode === "single"
                        ? "bg-white text-blue-600 shadow-2xs"
                        : "text-slate-600"
                    }`}
                  >
                    একক শিক্ষার্থী
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("bulk")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      sendMode === "bulk"
                        ? "bg-white text-blue-600 shadow-2xs"
                        : "text-slate-600"
                    }`}
                  >
                    বাল্ক (একত্রে অনেকের কাছে)
                  </button>
                </div>
              </div>

              {/* Success / Error alerts */}
              {sendSuccessMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>{sendSuccessMessage}</div>
                </div>
              )}

              {sendErrorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{sendErrorMessage}</div>
                </div>
              )}

              {/* SINGLE MODE RECIPIENT */}
              {sendMode === "single" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <StudentSearchSelector
                      students={initialStudents || []}
                      value={selectedStudentId}
                      onChange={(id) => handleStudentSelect(id)}
                      label="শিক্ষার্থী নির্বাচন করুন"
                      placeholder="শিক্ষার্থী বেছে নিন (নাম বা রোল লিখে খুঁজুন)..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      মোবাইল নম্বর <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="০১৭১২৩৪৫৬৭৮"
                      className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              ) : (
                /* BULK MODE FILTER */
                <div className="space-y-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                  <div className="text-xs font-semibold text-blue-900">
                    বাল্ক প্রাপক ফিল্টার:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkFilter("all")}
                      className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition ${
                        bulkFilter === "all"
                          ? "bg-white border-blue-500 text-blue-700 shadow-2xs"
                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div>সকল শিক্ষার্থী</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        মোট {initialStudents.length} জন
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkFilter("class")}
                      className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition ${
                        bulkFilter === "class"
                          ? "bg-white border-blue-500 text-blue-700 shadow-2xs"
                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div>নির্দিষ্ট জামাত / ক্লাস</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        জামাত অনুযায়ী
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkFilter("due")}
                      className={`p-2.5 text-xs font-semibold rounded-lg border text-left transition ${
                        bulkFilter === "due"
                          ? "bg-white border-blue-500 text-blue-700 shadow-2xs"
                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div>বকেয়া বেতনধারী</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        যাদের ফি বাকি রয়েছে
                      </div>
                    </button>
                  </div>

                  {bulkFilter === "class" && (
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        জামাত নির্বাচন করুন:
                      </label>
                      <select
                        value={bulkClassId}
                        onChange={(e) => setBulkClassId(e.target.value)}
                        className="w-full p-2 text-xs sm:text-sm border rounded-lg bg-white"
                      >
                        <option value="">-- জামাত নির্বাচন করুন --</option>
                        {initialClasses?.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="text-xs text-blue-800 font-medium flex items-center justify-between pt-1 border-t border-blue-100">
                    <span>
                      প্রাপক সংখ্যা: <strong>{toBengaliNumber(bulkRecipients.length)}</strong> জন অভিভাবক
                    </span>
                    <span className="text-[11px] text-blue-600">
                      (প্রতিটি মেসেজে নিজ নিজ নাম ও বকেয়া স্বয়ংক্রিয়ভাবে বসবে)
                    </span>
                  </div>
                </div>
              )}

              {/* ================= NEW: DUE MONTH RANGE SELECTOR ================= */}
              <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">
                        বকেয়া বেতনের মাস সেলেক্টর (Due Months Selector)
                      </span>
                      <span className="text-[11px] text-amber-700">
                        শুরুর মাস থেকে শেষের মাস নির্বাচন করুন (মেসেজে স্বয়ংক্রিয়ভাবে বসবে)
                      </span>
                    </div>
                  </div>

                  {/* Single vs Range Toggle */}
                  <div className="flex items-center space-x-1 bg-amber-100/80 p-0.5 rounded-lg self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setMonthSelectionMode("range")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                        monthSelectionMode === "range"
                          ? "bg-white text-amber-900 shadow-2xs"
                          : "text-amber-800 hover:text-amber-950"
                      }`}
                    >
                      মাস পরিসীমা (শুরু - শেষ)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMonthSelectionMode("single");
                        setFromMonth(toMonth);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                        monthSelectionMode === "single"
                          ? "bg-white text-amber-900 shadow-2xs"
                          : "text-amber-800 hover:text-amber-950"
                      }`}
                    >
                      একক মাস
                    </button>
                  </div>
                </div>

                {/* Dropdowns */}
                {monthSelectionMode === "range" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        ১. বকেয়া শুরুর মাস (From Month):
                      </label>
                      <select
                        value={fromMonth}
                        onChange={(e) => setFromMonth(e.target.value)}
                        className="w-full p-2 text-xs sm:text-sm border border-amber-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-amber-500/20"
                      >
                        {BENGALI_MONTHS.map((m) => (
                          <option key={`from-${m}`} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        ২. বকেয়া শেষের মাস (To Month):
                      </label>
                      <select
                        value={toMonth}
                        onChange={(e) => setToMonth(e.target.value)}
                        className="w-full p-2 text-xs sm:text-sm border border-amber-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-amber-500/20"
                      >
                        {BENGALI_MONTHS.map((m) => (
                          <option key={`to-${m}`} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      নির্দিষ্ট বকেয়া মাস নির্বাচন করুন:
                    </label>
                    <select
                      value={toMonth}
                      onChange={(e) => {
                        setToMonth(e.target.value);
                        setFromMonth(e.target.value);
                      }}
                      className="w-full p-2 text-xs sm:text-sm border border-amber-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-amber-500/20"
                    >
                      {BENGALI_MONTHS.map((m) => (
                        <option key={`single-${m}`} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    দ্রুত নির্বাচন (Quick Presets):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyMonthPreset("current")}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium transition shadow-2xs"
                    >
                      চলতি মাস ({dateCtx.month})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMonthPreset("last2")}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium transition shadow-2xs"
                    >
                      বিগত ২ মাস
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMonthPreset("last3")}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium transition shadow-2xs"
                    >
                      বিগত ৩ মাস
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMonthPreset("yearToDate")}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium transition shadow-2xs"
                    >
                      বছরের শুরু হতে (জানুয়ারি - {dateCtx.month})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyMonthPreset("fullYear")}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium transition shadow-2xs"
                    >
                      সম্পূর্ণ বছর (জানু - ডিসে)
                    </button>
                  </div>
                </div>

                {/* Calculated Banner & Due Amount Input */}
                <div className="bg-white/80 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs text-amber-950 font-bold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      মেসেজে বসবে:{" "}
                      <span className="ml-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {fromMonth === toMonth ? fromMonth : `${fromMonth} হতে ${toMonth}`}
                      </span>
                      <span className="ml-1.5 text-[11px] text-slate-500 font-normal">
                        ({toBengaliNumber(calculatedMonthsCount)} মাসের)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      ভ্যারিয়েবল: <code className="text-indigo-600 bg-indigo-50 px-1 rounded">{"{DueMonths}"}</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">{"{FromMonth}"}</code>, <code className="text-indigo-600 bg-indigo-50 px-1 rounded">{"{ToMonth}"}</code>
                    </div>
                  </div>

                  {/* Due Amount field & Auto calculator */}
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        বকেয়া টাকা (৳)
                      </label>
                      <input
                        type="number"
                        value={customDueAmount}
                        onChange={(e) => setCustomDueAmount(e.target.value)}
                        placeholder="যেমন: ৩০০০"
                        className="w-28 p-1.5 text-xs sm:text-sm font-bold text-slate-800 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCalculateAmountFromFee}
                      title="মাসিক ফি দিয়ে মোট বকেয়া স্বয়ংক্রিয় হিসাব করুন"
                      className="mt-4 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-2xs whitespace-nowrap"
                    >
                      স্বয়ংক্রিয় হিসাব
                    </button>
                  </div>
                </div>
              </div>

              {/* Template Quick Loader */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    তৈরি টেমপ্লেট থেকে বেছে নিন
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab("builder")}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    + নতুন টেমপ্লেট বানান
                  </button>
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) handleApplyTemplate(tpl);
                    else setSelectedTemplateId("");
                  }}
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                >
                  <option value="">-- কোনো টেমপ্লেট নির্বাচন করতে পারেন --</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tpl.category_bangla || tpl.category}] {tpl.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* DYNAMIC VARIABLES CLICK-TO-INSERT TOOLBAR */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    ডাইনামিক ভ্যারিয়েবল (ক্লিক করে মেসেজে যোগ করুন):
                  </span>
                  {copiedTag && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                      যোগ হয়েছে: {copiedTag}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_SMS_TAGS.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertTagAtCursor(item.tag, "message")}
                      title={item.description}
                      className="inline-flex items-center px-2 py-1 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 hover:text-indigo-700 transition shadow-2xs cursor-pointer group"
                    >
                      <Plus className="w-3 h-3 mr-1 text-indigo-500 group-hover:scale-125 transition-transform" />
                      <span className="font-mono text-[10px] text-indigo-600 mr-1">{item.tag}</span>
                      <span className="text-slate-500 text-[10px]">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    মেসেজ টেমপ্লেট ড্রাফট <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    ভ্যারিয়েবলগুলো স্বয়ংক্রিয়ভাবে পরিবর্তিত হবে
                  </span>
                </div>
                <textarea
                  ref={messageTextareaRef}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={5}
                  required
                  placeholder="আপনার মেসেজ লিখুন... যেমন: সম্মানিত অভিভাবক, আপনার সন্তান {StudentName}-এর {DueMonths} মাস বাবদ মোট {DueAmount} টাকা বেতন বকেয়া রয়েছে।"
                  className="w-full p-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans transition bg-white leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {sendMode === "single" ? (
                  <button
                    type="button"
                    onClick={handleSendSingleSMS}
                    disabled={isSending}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center shadow-sm"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        এসএমএস পাঠানো হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        একক এসএমএস পাঠান
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendBulkSMS}
                    disabled={isSending || bulkRecipients.length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center shadow-sm"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        বাল্ক মেসেজ পাঠানো হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        একত্রে {toBengaliNumber(bulkRecipients.length)} জন অভিভাবককে এসএমএস পাঠান
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Smartphone Preview & Real-time SMS Analytics */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Phone Preview Box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800 flex items-center">
                  <Smartphone className="w-4 h-4 mr-2 text-indigo-600" />
                  লাইভ প্রিভিউ (মোবাইল স্ক্রিন)
                </h2>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                  রিয়েল-টাইম কনভার্সন
                </span>
              </div>

              {/* Simulated Mobile Mockup */}
              <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-3xl p-3 shadow-xl border-4 border-slate-800">
                {/* Phone Speaker & Camera Notch */}
                <div className="flex justify-center items-center mb-2">
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full"></div>
                </div>

                {/* Phone Screen Canvas */}
                <div className="bg-slate-100 rounded-2xl p-3 min-h-[260px] flex flex-col justify-between">
                  {/* SMS Header */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80 text-center shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-800">
                      {madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন"}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      প্রাপক: {activeStudent ? `${activeStudent.first_name || ""} ${activeStudent.last_name || ""}` : "মোঃ আব্দুল্লাহ"} ({activeStudent?.parent_phone || recipientPhone || "০১৭১২৩৪৫৬৭৮"})
                    </div>
                  </div>

                  {/* SMS Message Bubble */}
                  <div className="my-3 flex justify-start">
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl rounded-tl-xs text-xs sm:text-[13px] leading-relaxed shadow-sm max-w-[95%]">
                      {livePreviewText || "আপনার মেসেজ ড্রাফট এখানে রিয়েল-টাইম কনভার্ট হয়ে দেখাবে..."}
                      <div className="text-[9px] text-emerald-200 text-right mt-1.5 flex items-center justify-end space-x-1">
                        <span>{dateCtx.dayName}, {dateCtx.month}</span>
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  </div>

                  {/* Phone Bottom Pill */}
                  <div className="text-center text-[10px] text-slate-400 font-mono">
                    SMS Carrier Network
                  </div>
                </div>
              </div>

              {/* SMS Metrics & Count Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">মোট অক্ষর (Characters):</span>
                  <span className="font-bold text-slate-900">{toBengaliNumber(smsStats.charCount)} টি</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">এনকোডিং (Encoding):</span>
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                    {smsStats.encoding === "Unicode" ? "বাংলা (Unicode)" : "English (GSM)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">প্রয়োজনীয় এসএমএস সংখ্যা:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {toBengaliNumber(smsStats.smsCount)} টি
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  💡 <strong>টিপস:</strong> ইউনিকোড (বাংলা) এসএমএসে প্রথম এসএমএস ৭০ অক্ষর এবং পরবর্তীগুলো ৬৭ অক্ষর করে হিসাব করা হয়।
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: TEMPLATE BUILDER ===================== */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          {/* Action Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  এসএমএস টেমপ্লেট সংগ্রহশালা
                </h2>
                <p className="text-xs text-slate-500">
                  আপনার প্রয়োজনমতো নতুন টেমপ্লেট যোগ করুন, এডিট করুন বা মুছে ফেলুন
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenNewTemplate}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              + নতুন টেমপ্লেট তৈরি করুন
            </button>
          </div>

          {/* Search & Category Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="টেমপ্লেটের নাম বা বিষয় দিয়ে খুঁজুন..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                className="p-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700"
              >
                <option value="all">সকল ক্যাটাগরি</option>
                <option value="Fee">ফি বকেয়া (Due Fee)</option>
                <option value="Attendance">হাজিরা (Attendance)</option>
                <option value="Result">ফলাফল (Result)</option>
                <option value="Notice">নোটিশ (Notice)</option>
                <option value="Holiday">ছুটি (Holiday)</option>
                <option value="Custom">কাস্টম / অন্যান্য</option>
              </select>
            </div>
          </div>

          {/* Templates Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-indigo-200 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100 mb-1.5">
                        {tpl.category_bangla || tpl.category}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-indigo-600 transition">
                        {tpl.title}
                      </h3>
                    </div>
                    {tpl.is_default && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-medium">
                        সিস্টেম
                      </span>
                    )}
                  </div>

                  {/* Raw template format */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans mb-3">
                    {tpl.message_template}
                  </div>

                  {/* Dynamic simulated sample */}
                  <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100 text-[11px] text-emerald-800">
                    <span className="font-semibold block text-[10px] text-emerald-600 uppercase mb-0.5">
                      লাইভ স্যাম্পল আউটপুট:
                    </span>
                    {renderDynamicTemplate(tpl.message_template, activeStudent || initialStudents[0], {
                      madrasaName: madrasaInfo.name || "মাদ্রাসাতুল মুসলিমীন",
                      fromMonth,
                      toMonth,
                    })}
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    মেসেজ পাঠান
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTemplate(tpl)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="সম্পাদনা করুন"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!tpl.is_default && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm">কোনো টেমপ্লেট খুঁজে পাওয়া যায়নি</p>
              <button
                onClick={handleOpenNewTemplate}
                className="mt-3 text-xs text-indigo-600 font-bold hover:underline"
              >
                + নতুন টেমপ্লেট যোগ করুন
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 3: SMS LOGS & HISTORY ===================== */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                এসএমএস পাঠানোর ইতিহাস (SMS Logs)
              </h2>
              <p className="text-xs text-slate-500">
                সাম্প্রতিক পাঠানো সকল এসএমএস এবং ডেলিভারি স্ট্যাটাস
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              মোট প্রেরিত: {toBengaliNumber(logs.length)} টি
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <tr>
                  <th className="p-4">তারিখ ও সময়</th>
                  <th className="p-4">প্রাপকের তথ্য</th>
                  <th className="p-4">মেসেজ কন্টেন্ট</th>
                  <th className="p-4">ধরন</th>
                  <th className="p-4 text-right">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 whitespace-nowrap text-xs text-slate-500">
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString("bn-BD", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "সাম্প্রতিক"}
                    </td>
                    <td className="p-4 whitespace-nowrap font-medium text-slate-900">
                      <div>{log.recipient_name || "অজ্ঞাত"}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {log.recipient_phone}
                      </div>
                    </td>
                    <td className="p-4 text-xs max-w-xs md:max-w-md font-sans leading-relaxed text-slate-600">
                      {log.message}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                        {log.message_type || "General"}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                        সফল (Sent)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>এখনও কোনো মেসেজ পাঠানো হয়নি।</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: TEMPLATE BUILDER MODAL ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingTemplate ? "টেমপ্লেট সম্পাদনা করুন" : "নতুন এসএমএস টেমপ্লেট তৈরি করুন"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ডাইনামিক ভ্যারিয়েবল যোগ করে পুনরায় ব্যবহারের জন্য টেমপ্লেট সেভ করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    টেমপ্লেটের নাম / শিরোনাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="যেমন: ৩ মাসের বকেয়া বেতন তাগাদা"
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্যাটাগরি
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => {
                      setModalCategory(e.target.value);
                      const map: Record<string, string> = {
                        Fee: "ফি বকেয়া",
                        Attendance: "হাজিরা",
                        Result: "ফলাফল",
                        Notice: "নোটিশ",
                        Holiday: "ছুটি",
                        Custom: "সাধারণ",
                      };
                      setModalCategoryBangla(map[e.target.value] || "সাধারণ");
                    }}
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="Fee">ফি বকেয়া (Due Fee)</option>
                    <option value="Attendance">হাজিরা (Attendance)</option>
                    <option value="Result">ফলাফল (Result)</option>
                    <option value="Notice">নোটিশ (Notice)</option>
                    <option value="Holiday">ছুটি (Holiday)</option>
                    <option value="Custom">কাস্টম / অন্যান্য</option>
                  </select>
                </div>
              </div>

              {/* Tag Toolbar for Modal */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>ভ্যারিয়েবল ট্যাগ (ক্লিক করে যোগ করুন):</span>
                  {copiedTag && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      যোগ হয়েছে: {copiedTag}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_SMS_TAGS.map((item) => (
                    <button
                      key={`modal-${item.tag}`}
                      type="button"
                      onClick={() => insertTagAtCursor(item.tag, "modal")}
                      className="inline-flex items-center px-2 py-0.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md text-[10px] font-medium text-slate-700 hover:text-indigo-700 transition"
                    >
                      <Plus className="w-2.5 h-2.5 mr-0.5 text-indigo-500" />
                      <span className="font-mono text-indigo-600 mr-1">{item.tag}</span>
                      <span className="text-slate-400">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Textarea */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  মেসেজ ড্রাফট <span className="text-rose-500">*</span>
                </label>
                <textarea
                  ref={modalTextareaRef}
                  required
                  rows={4}
                  value={modalTemplateContent}
                  onChange={(e) => setModalTemplateContent(e.target.value)}
                  placeholder="মেসেজ কন্টেন্ট লিখুন..."
                  className="w-full p-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition leading-relaxed font-sans"
                />
              </div>

              {/* Modal Live Preview */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>লাইভ টেস্ট প্রিভিউ:</span>
                  <span className="text-indigo-600">
                    {toBengaliNumber(modalSmsStats.charCount)} অক্ষর ({toBengaliNumber(modalSmsStats.smsCount)} টি এসএমএস)
                  </span>
                </div>
                <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed font-sans">
                  {modalPreviewText || "প্রিভিউ দেখতে মেসেজ টাইপ করুন..."}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center"
                >
                  {isSavingTemplate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      সংরক্ষণ করুন
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
