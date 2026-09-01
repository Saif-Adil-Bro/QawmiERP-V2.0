"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Lock,
  Plus,
  Trash2,
  Clock,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Key,
} from "lucide-react";
import {
  RoleDefinition,
  UserSecurityProfile,
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_IDS,
  PERMISSION_MAP,
  DataScope,
  UserAccountStatus,
  TemporaryPermission,
  calculateEffectivePermissions,
} from "@/lib/permissions";
import { assignUserSecurityProfile } from "@/app/actions/permissions";
import { MadrasaUser } from "@/app/actions/users";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  user: MadrasaUser;
  allRoles: RoleDefinition[];
  existingProfile?: Partial<UserSecurityProfile> | null;
  onClose: () => void;
  onSaved?: () => void;
}

const STATUS_LABELS: Record<UserAccountStatus, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: "সক্রিয় (Active)", bg: "bg-emerald-100", text: "text-emerald-800" },
  INVITED: { label: "আমন্ত্রিত (Invited)", bg: "bg-blue-100", text: "text-blue-800" },
  SUSPENDED: { label: "সাময়িক স্থগিত (Suspended)", bg: "bg-amber-100", text: "text-amber-800" },
  DISABLED: { label: "স্থায়ী বন্ধ (Disabled)", bg: "bg-rose-100", text: "text-rose-800" },
};

export default function UserSecurityModal({
  user,
  allRoles = [],
  existingProfile = null,
  onClose,
  onSaved,
}: Props) {
  const [activeTab, setActiveTab] = useState<"roles" | "direct" | "temporary" | "effective">("roles");

  // State
  const [primaryRole, setPrimaryRole] = useState<string>(
    existingProfile?.primaryRole || user.role || "teacher"
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    existingProfile?.roles && existingProfile.roles.length > 0
      ? existingProfile.roles
      : [existingProfile?.primaryRole || user.role || "teacher"]
  );
  const [status, setStatus] = useState<UserAccountStatus>(
    (existingProfile?.status as UserAccountStatus) || "ACTIVE"
  );
  const [directPermissions, setDirectPermissions] = useState<string[]>(
    existingProfile?.directPermissions || []
  );
  const [deniedPermissions, setDeniedPermissions] = useState<string[]>(
    existingProfile?.deniedPermissions || []
  );
  const [temporaryPermissions, setTemporaryPermissions] = useState<TemporaryPermission[]>(
    existingProfile?.temporaryPermissions || []
  );

  // Temporary Form state
  const [tempPermId, setTempPermId] = useState<string>("exam.marks.enter");
  const [tempExpiryDate, setTempExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [tempReason, setTempReason] = useState<string>("");

  // Search filter
  const [searchPerm, setSearchPerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calculated Preview
  const previewProfile: UserSecurityProfile = useMemo(() => {
    return {
      userId: user.id,
      madrasaId: user.madrasa_id,
      fullName: user.full_name,
      email: user.email,
      primaryRole: primaryRole,
      roles: selectedRoles,
      status: status,
      directPermissions: directPermissions,
      deniedPermissions: deniedPermissions,
      temporaryPermissions: temporaryPermissions,
    };
  }, [user, primaryRole, selectedRoles, status, directPermissions, deniedPermissions, temporaryPermissions]);

  const effectiveSummary = useMemo(() => {
    return calculateEffectivePermissions(previewProfile, allRoles);
  }, [previewProfile, allRoles]);

  const showToast = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleMultiRole = (roleId: string) => {
    if (roleId === primaryRole) return; // primary role cannot be unchecked from multi-roles
    setSelectedRoles((prev) => {
      if (prev.includes(roleId)) {
        return prev.filter((r) => r !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handlePrimaryRoleChange = (newPrimary: string) => {
    setPrimaryRole(newPrimary);
    if (!selectedRoles.includes(newPrimary)) {
      setSelectedRoles((prev) => [...prev, newPrimary]);
    }
  };

  const handleToggleDirectPerm = (permId: string) => {
    setDirectPermissions((prev) => {
      if (prev.includes(permId)) {
        return prev.filter((p) => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
    // Remove from deny if adding to direct
    setDeniedPermissions((prev) => prev.filter((p) => p !== permId));
  };

  const handleToggleDenyPerm = (permId: string) => {
    setDeniedPermissions((prev) => {
      if (prev.includes(permId)) {
        return prev.filter((p) => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
    // Remove from direct if denying
    setDirectPermissions((prev) => prev.filter((p) => p !== permId));
  };

  const handleAddTemporaryPerm = () => {
    if (!tempPermId) return;
    if (!tempExpiryDate) {
      showToast("error", "মেয়াদ শেষ হওয়ার তারিখ নির্বাচন করুন।");
      return;
    }

    const expiryIso = new Date(tempExpiryDate + "T23:59:59").toISOString();
    const newTemp: TemporaryPermission = {
      permission: tempPermId,
      grantedAt: new Date().toISOString(),
      expiresAt: expiryIso,
      grantedBy: "current_admin",
      reason: tempReason.trim() || "সাময়িক দায়িত্ব অর্পণ",
    };

    setTemporaryPermissions((prev) => [
      ...prev.filter((t) => t.permission !== tempPermId),
      newTemp,
    ]);
    setTempReason("");
    showToast("success", "সাময়িক অধিকার যোগ করা হয়েছে।");
  };

  const handleRemoveTemporaryPerm = (permId: string) => {
    setTemporaryPermissions((prev) => prev.filter((t) => t.permission !== permId));
  };

  const handleSaveAll = () => {
    startTransition(async () => {
      const res = await assignUserSecurityProfile(user.id, {
        primaryRole,
        roles: selectedRoles,
        status,
        directPermissions,
        deniedPermissions,
        temporaryPermissions,
      });

      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "নিরাপত্তা সেটিংস সংরক্ষিত হয়েছে!");
        setTimeout(() => {
          if (onSaved) onSaved();
          onClose();
        }, 600);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Toast */}
        {notification && (
          <div
            className={`p-3 text-xs font-semibold flex items-center justify-between border-b ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            <span>{notification.text}</span>
            <button type="button" onClick={() => setNotification(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{user.full_name}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    STATUS_LABELS[status]?.bg || "bg-slate-100"
                  } ${STATUS_LABELS[status]?.text || "text-slate-700"}`}
                >
                  {STATUS_LABELS[status]?.label}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                ইমেইল: {user.email} {user.phone ? `| ফোন: ${user.phone}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "roles"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            রোল নির্ধারণ ({selectedRoles.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "direct"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            সরাসরি অধিকার ও নিষেধ ({directPermissions.length}/{deniedPermissions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("temporary")}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "temporary"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            মেয়াদী অধিকার ({temporaryPermissions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("effective")}
            className={`py-3 px-3.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "effective"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            চূড়ান্ত ফলাফল ({effectiveSummary.effectivePermissions.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* TAB 1: ROLES & STATUS */}
          {activeTab === "roles" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ইউজার অ্যাকাউন্ট স্ট্যাটাস
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserAccountStatus)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="ACTIVE">সক্রিয় (Active - নিয়মিত ব্যবহার)</option>
                    <option value="SUSPENDED">সাময়িক স্থগিত (Suspended - সাময়িক ব্লক)</option>
                    <option value="DISABLED">স্থায়ী বন্ধ (Disabled - সম্পূর্ণ নিষ্ক্রিয়)</option>
                    <option value="INVITED">আমন্ত্রিত (Invited - পাসওয়ার্ড পেন্ডিং)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মূল পদবী / Primary Role
                  </label>
                  <select
                    value={primaryRole}
                    onChange={(e) => handlePrimaryRoleChange(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {allRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  মাল্টিপল রোল বরাদ্দ (অতিরিক্ত পদবীসমূহ)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allRoles.map((r) => {
                    const isPrimary = r.id === primaryRole;
                    const isChecked = selectedRoles.includes(r.id);

                    return (
                      <label
                        key={r.id}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                            : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isPrimary}
                          onChange={() => handleToggleMultiRole(r.id)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300 cursor-pointer disabled:opacity-70"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{r.name}</span>
                            {isPrimary && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                মূল পদ
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {r.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT PERMISSIONS & EXPLICIT DENY */}
          {activeTab === "direct" && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>সরাসরি অনুমোদন (Direct Allow):</strong> রোল পরিবর্তন না করেই নির্দিষ্ট বিশেষ ক্ষমতা দিতে ব্যবহৃত হয়। <br />
                  <strong>সরাসরি নিষেধ (Explicit Deny):</strong> রোলে থাকলেও ইউজারের জন্য ওই নির্দিষ্ট কাজটি কঠোরভাবে নিষিদ্ধ করে।
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="পারমিশন খুঁজুন..."
                  value={searchPerm}
                  onChange={(e) => setSearchPerm(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* List */}
              <div className="space-y-3">
                {PERMISSION_CATEGORIES.map((cat) => {
                  const filtered = cat.permissions.filter(
                    (p) =>
                      !searchPerm ||
                      p.title.toLowerCase().includes(searchPerm.toLowerCase()) ||
                      p.id.toLowerCase().includes(searchPerm.toLowerCase())
                  );
                  if (filtered.length === 0) return null;

                  return (
                    <div key={cat.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <h5 className="text-xs font-bold text-slate-800 mb-2">{cat.title}</h5>
                      <div className="space-y-1.5">
                        {filtered.map((perm) => {
                          const isDirect = directPermissions.includes(perm.id);
                          const isDenied = deniedPermissions.includes(perm.id);

                          return (
                            <div
                              key={perm.id}
                              className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800">{perm.title}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {perm.id}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleDirectPerm(perm.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                    isDirect
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                                  }`}
                                >
                                  {isDirect ? "✓ সরাসরি অনুমোদিত" : "+ বিশেষ অনুমতি"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleDenyPerm(perm.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                    isDenied
                                      ? "bg-rose-600 text-white shadow-xs"
                                      : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                                  }`}
                                >
                                  {isDenied ? "✕ নিষিদ্ধ (Deny)" : "নিষেধ করুন"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TEMPORARY TIMED ACCESS */}
          {activeTab === "temporary" && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  নতুন মেয়াদী অধিকার বরাদ্দ (Temporary Access)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      পারমিশন সিলেক্ট করুন
                    </label>
                    <select
                      value={tempPermId}
                      onChange={(e) => setTempPermId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      {ALL_PERMISSION_IDS.map((pId) => {
                        const def = PERMISSION_MAP[pId];
                        return (
                          <option key={pId} value={pId}>
                            {def?.title || pId}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      মেয়াদ শেষ হওয়ার তারিখ
                    </label>
                    <input
                      type="date"
                      value={tempExpiryDate}
                      onChange={(e) => setTempExpiryDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      কারণ / দায়িত্বের বিবরণ
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="যেমন: বার্ষিক পরীক্ষার জন্য খাতা দেখা ও নম্বর তোলার সাময়িক দায়িত্ব"
                        value={tempReason}
                        onChange={(e) => setTempReason(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddTemporaryPerm}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        + যোগ করুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Temporary Permissions List */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  বর্তমানে সক্রিয় মেয়াদী অধিকার ({temporaryPermissions.length})
                </h4>

                {temporaryPermissions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    কোন মেয়াদী অধিকার সক্রিয় নেই।
                  </div>
                ) : (
                  <div className="space-y-2">
                    {temporaryPermissions.map((temp) => {
                      const def = PERMISSION_MAP[temp.permission];
                      const isExpired = new Date(temp.expiresAt).getTime() < new Date().getTime();

                      return (
                        <div
                          key={temp.permission}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            isExpired
                              ? "bg-slate-100/60 border-slate-200 text-slate-400"
                              : "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{def?.title || temp.permission}</span>
                              {isExpired ? (
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                                  মেয়াদোত্তীর্ণ
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                  সক্রিয়
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              মেয়াদ: {new Date(temp.expiresAt).toLocaleDateString("bn-BD")} পর্যন্ত | কারণ: {temp.reason || "অনির্দিষ্ট"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveTemporaryPerm(temp.permission)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EFFECTIVE PERMISSIONS BREAKDOWN */}
          {activeTab === "effective" && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">মোট সক্রিয় কার্যকর অধিকার</span>
                  <span className="text-base font-bold text-slate-900">
                    {toBanglaNumber(effectiveSummary.effectivePermissions.length)} টি
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">সরাসরি নিষিদ্ধ (Denied)</span>
                  <span className="text-base font-bold text-rose-600">
                    {toBanglaNumber(effectiveSummary.deniedPermissions.length)} টি
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {PERMISSION_CATEGORIES.map((cat) => {
                  const allowedInCat = cat.permissions.filter((p) =>
                    effectiveSummary.effectivePermissions.includes(p.id)
                  );
                  if (allowedInCat.length === 0) return null;

                  return (
                    <div key={cat.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                      <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                        <span>{cat.title}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {allowedInCat.length} টি অধিকার
                        </span>
                      </h5>
                      <div className="space-y-1">
                        {allowedInCat.map((p) => {
                          const src = effectiveSummary.permissionSources[p.id];
                          return (
                            <div
                              key={p.id}
                              className="text-xs p-2 rounded-lg bg-slate-50 flex items-center justify-between gap-2"
                            >
                              <span className="text-slate-800">{p.title}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                                {src?.source === "ROLE" ? `পদবী: ${src.roleName}` : src?.source === "TEMPORARY" ? "মেয়াদী" : "সরাসরি"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSaveAll}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPending ? "সংরক্ষণ হচ্ছে..." : "নিরাপত্তা সেটিংস সেভ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
