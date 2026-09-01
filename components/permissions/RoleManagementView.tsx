"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Lock,
  Search,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Users,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  FileText,
  Clock,
  Eye,
  Settings,
} from "lucide-react";
import {
  RoleDefinition,
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_IDS,
  PERMISSION_MAP,
  DataScope,
  DEFAULT_SYSTEM_ROLES,
} from "@/lib/permissions";
import {
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from "@/app/actions/permissions";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  systemRoles: RoleDefinition[];
  customRoles: RoleDefinition[];
  allRoles: RoleDefinition[];
  userCountsByRole?: Record<string, number>;
  onRoleUpdated?: () => void;
}

const SCOPE_LABELS: Record<DataScope, { label: string; desc: string }> = {
  ALL: { label: "সকল তথ্য (All)", desc: "মাদ্রাসার সমস্ত রেকর্ড ও ক্লাসের তথ্য দেখতে পারবে" },
  ASSIGNED: { label: "নির্ধারিত দায়িত্ব (Assigned)", desc: "শুধুমাত্র নিজের ক্লাস/বিষয়ের তথ্য দেখতে পারবে" },
  CLASS: { label: "জামাতভিত্তিক (Class)", desc: "বরাদ্দকৃত নির্দিষ্ট জামাতের রেকর্ড" },
  DEPARTMENT: { label: "বিভাগভিত্তিক (Department)", desc: "নিজ বিভাগের স্টাফ ও সংশ্লিষ্ট রেকর্ড" },
  OWN: { label: "নিজ তৈরিকৃত (Own)", desc: "ব্যবহারকারীর নিজের তৈরি রেকর্ড" },
  LINKED: { label: "সংযুক্ত শিক্ষার্থী (Linked)", desc: "অভিভাবকের নিজের নিবন্ধিত সন্তানদের তথ্য" },
  SELF: { label: "কেবল নিজ প্রোফাইল (Self)", desc: "শুধুমাত্র নিজের ব্যক্তিগত প্রোফাইল ও রেকর্ড" },
};

const COLOR_PALETTES = [
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", name: "Emerald" },
  { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", name: "Blue" },
  { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", name: "Purple" },
  { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", name: "Amber" },
  { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", name: "Rose" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300", name: "Cyan" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300", name: "Indigo" },
];

export default function RoleManagementView({
  systemRoles = DEFAULT_SYSTEM_ROLES,
  customRoles = [],
  allRoles = [],
  userCountsByRole = {},
  onRoleUpdated,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<RoleDefinition | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<RoleDefinition | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);

  // Compare roles state
  const [compareRole1, setCompareRole1] = useState<string>("teacher");
  const [compareRole2, setCompareRole2] = useState<string>("exam_manager");

  // Form states for Create/Edit
  const [formName, setFormName] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScope, setFormScope] = useState<DataScope>("ALL");
  const [formColorIndex, setFormColorIndex] = useState(0);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    students: true,
    attendance: true,
    exam: true,
  });

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const combinedRolesList = useMemo(() => {
    return allRoles.length > 0 ? allRoles : [...systemRoles, ...customRoles];
  }, [allRoles, systemRoles, customRoles]);

  const filteredRoles = useMemo(() => {
    return combinedRolesList.filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [combinedRolesList, searchQuery]);

  const showToast = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenCreate = () => {
    setFormName("");
    setFormNameEn("");
    setFormDescription("");
    setFormScope("ALL");
    setFormColorIndex(0);
    setSelectedPermissions(new Set(["dashboard.view"]));
    setPermSearch("");
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (role: RoleDefinition) => {
    if (role.isSystem) {
      showToast("error", "সিস্টেম ডিফল্ট রোল সম্পাদনা করা যাবে না। আপনি এই রোলের ভিত্তিতে নতুন কাস্টম রোল তৈরি করতে পারেন।");
      return;
    }
    setRoleToEdit(role);
    setFormName(role.name);
    setFormNameEn(role.nameEn);
    setFormDescription(role.description);
    setFormScope(role.defaultDataScope || "ALL");
    setSelectedPermissions(new Set(role.permissions || []));
    setPermSearch("");
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (role: RoleDefinition) => {
    if (role.isSystem) {
      showToast("error", "সিস্টেম ডিফল্ট রোল মুছে ফেলা যাবে না।");
      return;
    }
    setRoleToDelete(role);
    setIsDeleteModalOpen(true);
  };

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const selectAllCategory = (catPermissions: string[]) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const p of catPermissions) {
        next.add(p);
      }
      return next;
    });
  };

  const clearCategory = (catPermissions: string[]) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const p of catPermissions) {
        next.delete(p);
      }
      return next;
    });
  };

  const selectAllAll = () => {
    setSelectedPermissions(new Set(ALL_PERMISSION_IDS));
  };

  const clearAllAll = () => {
    setSelectedPermissions(new Set());
  };

  const handleSaveCreate = () => {
    if (!formName.trim()) {
      showToast("error", "রোলের নাম দেওয়া আবশ্যক।");
      return;
    }
    if (selectedPermissions.size === 0) {
      showToast("error", "কমপক্ষে একটি পারমিশন সিলেক্ট করুন।");
      return;
    }

    startTransition(async () => {
      const chosenColor = COLOR_PALETTES[formColorIndex] || COLOR_PALETTES[0];
      const res = await createCustomRole({
        name: formName.trim(),
        nameEn: formNameEn.trim(),
        description: formDescription.trim(),
        permissions: Array.from(selectedPermissions),
        defaultDataScope: formScope,
        colorBg: chosenColor.bg,
        colorText: chosenColor.text,
      });

      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "কাস্টম রোল তৈরি হয়েছে!");
        setIsCreateModalOpen(false);
        if (onRoleUpdated) onRoleUpdated();
      }
    });
  };

  const handleSaveEdit = () => {
    if (!roleToEdit) return;
    if (!formName.trim()) {
      showToast("error", "রোলের নাম দেওয়া আবশ্যক।");
      return;
    }
    if (selectedPermissions.size === 0) {
      showToast("error", "কমপক্ষে একটি পারমিশন সিলেক্ট করুন।");
      return;
    }

    startTransition(async () => {
      const res = await updateCustomRole(roleToEdit.id, {
        name: formName.trim(),
        nameEn: formNameEn.trim(),
        description: formDescription.trim(),
        permissions: Array.from(selectedPermissions),
        defaultDataScope: formScope,
      });

      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "রোল আপডেট সম্পন্ন হয়েছে!");
        setIsEditModalOpen(false);
        if (onRoleUpdated) onRoleUpdated();
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!roleToDelete) return;
    startTransition(async () => {
      const res = await deleteCustomRole(roleToDelete.id);
      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "রোল মুছে ফেলা হয়েছে!");
        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
        if (onRoleUpdated) onRoleUpdated();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-md text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">রোল ও পারমিশন কন্ট্রোল</h2>
              <p className="text-xs text-slate-500">
                মাদ্রাসার দায়িত্বশীলদের পদ অনুযায়ী সুনির্দিষ্ট অধিকার ও ডাটা স্কোপ নির্ধারণ
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCompareModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200"
          >
            <ArrowRightLeft className="w-4 h-4 text-slate-600" />
            রোল তুলনা (Compare)
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            নতুন কাস্টম রোল তৈরি
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="রোল বা বিবরণ খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoles.map((role) => {
          const userCount = userCountsByRole[role.id] || 0;
          const permCount = role.permissions?.length || 0;
          const isSystem = role.isSystem;

          return (
            <div
              key={role.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        role.colorBg || "bg-slate-100"
                      } ${role.colorText || "text-slate-800"}`}
                    >
                      {role.name}
                    </span>
                    {isSystem ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Lock className="w-3 h-3 text-slate-400" />
                        সিস্টেম
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        <Sparkles className="w-3 h-3" />
                        কাস্টম
                      </span>
                    )}
                  </div>

                  {!isSystem && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(role)}
                        title="সম্পাদনা করুন"
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(role)}
                        title="মুছে ফেলুন"
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                  {role.description}
                </p>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">পারমিশন সংখ্যা</span>
                    <span className="font-bold text-slate-800">
                      {toBanglaNumber(permCount)} টি অধিকার
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">বরাদ্দকৃত ইউজার</span>
                    <span className="font-bold text-slate-800">
                      {toBanglaNumber(userCount)} জন
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  স্কোপ: <strong className="text-slate-700">{role.defaultDataScope || "ALL"}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedRoleForDetail(role)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  বিস্তারিত দেখুন
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedRoleForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-xl text-sm font-bold ${
                    selectedRoleForDetail.colorBg || "bg-slate-100"
                  } ${selectedRoleForDetail.colorText || "text-slate-800"}`}
                >
                  {selectedRoleForDetail.name}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({selectedRoleForDetail.id})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoleForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  রোলের বিবরণ
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedRoleForDetail.description}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    সক্রিয় পারমিশন তালিকা ({toBanglaNumber(selectedRoleForDetail.permissions?.length || 0)} টি)
                  </h4>
                </div>

                <div className="space-y-3">
                  {PERMISSION_CATEGORIES.map((cat) => {
                    const activeInCat = cat.permissions.filter((p) =>
                      selectedRoleForDetail.permissions?.includes(p.id)
                    );
                    if (activeInCat.length === 0) return null;

                    return (
                      <div
                        key={cat.id}
                        className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5"
                      >
                        <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {cat.title} ({activeInCat.length})
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {activeInCat.map((p) => (
                            <div
                              key={p.id}
                              className="text-xs text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between"
                            >
                              <span>{p.title}</span>
                              <code className="text-[10px] text-slate-400 font-mono">
                                {p.action}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRoleForDetail(null)}
                className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-medium transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Custom Role Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isCreateModalOpen ? "নতুন কাস্টম রোল তৈরি" : `রোল সম্পাদনা: ${roleToEdit?.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    নাম, বিবরণ, পারমিশন ও ডাটা এক্সেস স্কোপ নির্ধারণ করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    রোলের নাম (বাংলায়) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="যেমন: পরীক্ষা সহকারী, ক্যাশিয়ার"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    English Identifier / Name
                  </label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g. Exam Assistant"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    রোলের দায়িত্ব ও সংক্ষিপ্ত বিবরণ
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="এই রোলের প্রধান কাজ বা দায়িত্বসমূহ..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {isCreateModalOpen && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      কালার থিম (Badge Color)
                    </label>
                    <div className="flex items-center gap-2">
                      {COLOR_PALETTES.map((pal, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormColorIndex(idx)}
                          className={`w-7 h-7 rounded-lg ${pal.bg} ${pal.border} border flex items-center justify-center transition ${
                            formColorIndex === idx ? "ring-2 ring-emerald-600 scale-110" : ""
                          }`}
                        >
                          {formColorIndex === idx && <Check className="w-3.5 h-3.5 text-slate-800" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ডিফল্ট ডাটা স্কোপ (Data Scope)
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as DataScope)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {Object.entries(SCOPE_LABELS).map(([scopeKey, val]) => (
                      <option key={scopeKey} value={scopeKey}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {SCOPE_LABELS[formScope]?.desc}
                  </p>
                </div>
              </div>

              {/* Permissions Selector */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      অধিকারসমূহ নির্বাচন করুন ({toBanglaNumber(selectedPermissions.size)} / {toBanglaNumber(ALL_PERMISSION_IDS.length)} টি সিলেক্টেড)
                    </h4>
                    <p className="text-xs text-slate-500">
                      যেসব মডিউলে এই রোলের ব্যবহারকারী কাজ করতে পারবেন তা টিক দিন
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllAll}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition cursor-pointer"
                    >
                      সব সিলেক্ট করুন
                    </button>
                    <button
                      type="button"
                      onClick={clearAllAll}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    >
                      সব মুছুন
                    </button>
                  </div>
                </div>

                {/* Filter Perms Search */}
                <div className="relative mb-4">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="পারমিশন সার্চ করুন (যেমন: বেতন, হাজিরা, ফলাফল)..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Categorized Permissions Accordions */}
                <div className="space-y-3">
                  {PERMISSION_CATEGORIES.map((cat) => {
                    const filteredPerms = cat.permissions.filter((p) => {
                      if (!permSearch) return true;
                      const q = permSearch.toLowerCase();
                      return (
                        p.title.toLowerCase().includes(q) ||
                        p.titleEn.toLowerCase().includes(q) ||
                        p.description.toLowerCase().includes(q) ||
                        p.id.toLowerCase().includes(q)
                      );
                    });

                    if (filteredPerms.length === 0) return null;

                    const isExpanded = Boolean(expandedCategories[cat.id] || permSearch);
                    const allPermIds = cat.permissions.map((p) => p.id);
                    const selectedCountInCat = cat.permissions.filter((p) =>
                      selectedPermissions.has(p.id)
                    ).length;
                    const isAllSelected = selectedCountInCat === cat.permissions.length;

                    return (
                      <div
                        key={cat.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        <div
                          onClick={() => toggleCategoryExpand(cat.id)}
                          className="px-4 py-3 bg-slate-100/70 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition select-none"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-xs font-bold text-slate-800">{cat.title}</span>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                              {toBanglaNumber(selectedCountInCat)}/{toBanglaNumber(cat.permissions.length)}
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                isAllSelected
                                  ? clearCategory(allPermIds)
                                  : selectAllCategory(allPermIds)
                              }
                              className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 hover:underline cursor-pointer"
                            >
                              {isAllSelected ? "ক্লিয়ার" : "সব টিক দিন"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredPerms.map((perm) => {
                              const checked = selectedPermissions.has(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                                    checked
                                      ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                                      : "bg-slate-50/40 border-slate-200/70 text-slate-700 hover:bg-slate-100/60"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold leading-tight">
                                        {perm.title}
                                      </span>
                                      {perm.riskLevel === "CRITICAL" && (
                                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 shrink-0">
                                          সংবেদনশীল
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      {perm.description}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={isCreateModalOpen ? handleSaveCreate : handleSaveEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Comparison Tool Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    রোল তুলনা ম্যাট্রিক্স (Role Comparison)
                  </h3>
                  <p className="text-xs text-slate-500">
                    দুটি রোলের মধ্যে ক্ষমতার পার্থক্য ও অধিকার যাচাই করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Selectors */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    প্রথম রোল (Role A)
                  </label>
                  <select
                    value={compareRole1}
                    onChange={(e) => setCompareRole1(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {combinedRolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    দ্বিতীয় রোল (Role B)
                  </label>
                  <select
                    value={compareRole2}
                    onChange={(e) => setCompareRole2(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {combinedRolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comparison Matrix Table */}
              {(() => {
                const r1 = combinedRolesList.find((r) => r.id === compareRole1);
                const r2 = combinedRolesList.find((r) => r.id === compareRole2);
                if (!r1 || !r2) return null;

                const r1Perms = new Set(r1.permissions || []);
                const r2Perms = new Set(r2.permissions || []);

                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 p-3 text-xs font-bold text-slate-700 sticky top-0">
                      <div className="col-span-6">পারমিশন বিবরণ (Permission)</div>
                      <div className="col-span-3 text-center text-emerald-800">{r1.name}</div>
                      <div className="col-span-3 text-center text-purple-800">{r2.name}</div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                      {PERMISSION_CATEGORIES.map((cat) => (
                        <div key={cat.id}>
                          <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                            {cat.title}
                          </div>
                          {cat.permissions.map((perm) => {
                            const has1 = r1Perms.has(perm.id);
                            const has2 = r2Perms.has(perm.id);
                            return (
                              <div
                                key={perm.id}
                                className="grid grid-cols-12 p-2.5 text-xs items-center hover:bg-slate-50/70"
                              >
                                <div className="col-span-6">
                                  <span className="font-semibold text-slate-800">{perm.title}</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">{perm.id}</span>
                                </div>
                                <div className="col-span-3 flex justify-center">
                                  {has1 ? (
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                      ✕
                                    </span>
                                  )}
                                </div>
                                <div className="col-span-3 flex justify-center">
                                  {has2 ? (
                                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                      ✕
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && roleToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-2">কাস্টম রোল মুছে ফেলতে চান?</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              আপনি কি নিশ্চিত যে <strong>&quot;{roleToDelete.name}&quot;</strong> রোলটি মুছে ফেলতে চান? যদি কোন ইউজার এই রোলে নিযুক্ত থাকে, সিস্টেম এটি মুছে ফেলতে বাধা দেবে।
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
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
