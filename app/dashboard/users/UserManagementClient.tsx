"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Edit,
  Copy,
  Check,
  Phone,
  Mail,
  Shield,
  GraduationCap,
  Sparkles,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";
import {
  createUserAccount,
  updateUserAccount,
  resetUserPassword,
  deleteUserAccount,
  MadrasaUser,
} from "@/app/actions/users";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialUsers: MadrasaUser[];
  teachers: any[];
  students: any[];
}

const roleLabels: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  super_admin: { label: "সুপার অ্যাডমিন", bg: "bg-purple-100", text: "text-purple-800", icon: Shield },
  admin: { label: "অ্যাডমিন", bg: "bg-indigo-100", text: "text-indigo-800", icon: Shield },
  muhtamim: { label: "মুহতামিম / প্রধান", bg: "bg-amber-100", text: "text-amber-800", icon: Shield },
  teacher: { label: "শিক্ষক (Teacher)", bg: "bg-emerald-100", text: "text-emerald-800", icon: GraduationCap },
  parent: { label: "অভিভাবক (Parent)", bg: "bg-blue-100", text: "text-blue-800", icon: Users },
  student: { label: "শিক্ষার্থী (Student)", bg: "bg-teal-100", text: "text-teal-800", icon: GraduationCap },
  accountant: { label: "হিসাবরক্ষক", bg: "bg-orange-100", text: "text-orange-800", icon: UserCheck },
  hostel_manager: { label: "বোর্ডিং পরিচালক", bg: "bg-rose-100", text: "text-rose-800", icon: UserCheck },
  library_manager: { label: "গ্রন্থাগারিক", bg: "bg-cyan-100", text: "text-cyan-800", icon: UserCheck },
};

export default function UserManagementClient({ initialUsers, teachers, students }: Props) {
  const [usersList, setUsersList] = useState<MadrasaUser[]>(initialUsers || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MadrasaUser | null>(null);

  // Form states
  const [createMode, setCreateMode] = useState<"teacher" | "student" | "parent" | "custom">("teacher");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("teacher");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback states
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    pin: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick stats
  const stats = useMemo(() => {
    const total = usersList.length;
    const teacherCount = usersList.filter((u) => u.role === "teacher").length;
    const parentCount = usersList.filter((u) => u.role === "parent").length;
    const studentCount = usersList.filter((u) => u.role === "student").length;
    const adminCount = usersList.filter((u) => ["admin", "super_admin", "muhtamim", "accountant"].includes(u.role)).length;
    return { total, teacherCount, parentCount, studentCount, adminCount };
  }, [usersList]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchesSearch =
        (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone || "").includes(searchQuery);

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      if (activeTab === "teacher") return u.role === "teacher";
      if (activeTab === "parent") return u.role === "parent";
      if (activeTab === "student") return u.role === "student";
      if (activeTab === "staff") return ["admin", "super_admin", "muhtamim", "accountant", "hostel_manager", "library_manager"].includes(u.role);

      return true;
    });
  }, [usersList, searchQuery, activeTab]);

  // Generate a random 6-digit easy PIN or password
  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setPassword(pin);
  };

  // Handle auto-population when selecting a teacher
  const handleTeacherSelect = (tId: string) => {
    setSelectedTeacherId(tId);
    const teacher = teachers.find((t) => t.id === tId);
    if (teacher) {
      setFullName(`${teacher.first_name || ""} ${teacher.last_name || ""}`.trim());
      setPhone(teacher.phone || "");
      setRole("teacher");
      if (teacher.email) {
        setEmail(teacher.email);
      } else if (teacher.phone) {
        const cleanPhone = teacher.phone.replace(/[^0-9]/g, "");
        setEmail(`teacher_${cleanPhone}@qawmi.app`);
      } else {
        const cleanName = `${teacher.first_name}_${teacher.last_name}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        setEmail(`${cleanName || "teacher"}@qawmi.app`);
      }
      generateRandomPin();
    }
  };

  // Handle auto-population when selecting a student/parent
  const handleStudentSelect = (sId: string, asParent = true) => {
    setSelectedStudentId(sId);
    const student = students.find((s) => s.id === sId);
    if (student) {
      if (asParent) {
        setFullName(student.father_name || `${student.first_name}-এর অভিভাবক`);
        setPhone(student.parent_phone || student.phone || "");
        setRole("parent");
        const cleanPhone = (student.parent_phone || student.phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone.length >= 6) {
          setEmail(`parent_${cleanPhone}@qawmi.app`);
        } else {
          setEmail(`parent_roll${student.roll_number || student.student_id || student.id.slice(0, 4)}@qawmi.app`);
        }
      } else {
        setFullName(`${student.first_name || ""} ${student.last_name || ""}`.trim());
        setPhone(student.phone || student.parent_phone || "");
        setRole("student");
        const cleanRoll = student.roll_number || student.student_id || student.id.slice(0, 4);
        setEmail(`student_${cleanRoll}@qawmi.app`);
      }
      generateRandomPin();
    }
  };

  // Open Create Modal
  const openCreateModal = (mode: "teacher" | "student" | "parent" | "custom" = "teacher") => {
    setCreateMode(mode);
    setSelectedTeacherId("");
    setSelectedStudentId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setRole(mode === "custom" ? "teacher" : mode);
    generateRandomPin();
    setCreatedCredential(null);
    setIsCreateOpen(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createUserAccount(null, formData);
      if (res.error) {
        setNotification({ type: "error", text: res.error });
      } else {
        setNotification({ type: "success", text: res.message || "ইউজার সফলভাবে তৈরি হয়েছে!" });
        if (res.createdUser) {
          setCreatedCredential({
            name: res.createdUser.full_name,
            email: res.createdUser.email,
            phone: res.createdUser.phone || "",
            role: res.createdUser.role,
            pin: res.createdUser.password,
          });
          setUsersList((prev) => [res.createdUser as any, ...prev]);
        }
      }
    });
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("user_id", selectedUser.id);

    startTransition(async () => {
      const res = await updateUserAccount(null, formData);
      if (res.error) {
        setNotification({ type: "error", text: res.error });
      } else {
        setNotification({ type: "success", text: "ইউজার প্রোফাইল সফলভাবে আপডেট হয়েছে!" });
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  full_name: (formData.get("full_name") as string) || u.full_name,
                  phone: (formData.get("phone") as string) || u.phone,
                  role: ((formData.get("role") as string) || u.role) as any,
                }
              : u
          )
        );
        setIsEditOpen(false);
      }
    });
  };

  // Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const newPass = password;

    startTransition(async () => {
      const res = await resetUserPassword(selectedUser.id, newPass);
      if (res.error) {
        setNotification({ type: "error", text: res.error });
      } else {
        setNotification({ type: "success", text: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!" });
        setCreatedCredential({
          name: selectedUser.full_name,
          email: selectedUser.email,
          phone: selectedUser.phone || "",
          role: selectedUser.role,
          pin: newPass,
        });
        setIsResetPassOpen(false);
      }
    });
  };

  // Delete User Submit
  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;

    startTransition(async () => {
      const res = await deleteUserAccount(selectedUser.id);
      if (res.error) {
        setNotification({ type: "error", text: res.error });
      } else {
        setNotification({ type: "success", text: "ইউজার অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে।" });
        setUsersList((prev) => prev.filter((u) => u.id !== selectedUser.id));
        setIsDeleteOpen(false);
      }
    });
  };

  // Copy Login Credentials
  const copyCredentials = (user: MadrasaUser | null, pin?: string) => {
    if (!user) return;
    const portalUrl = window.location.origin + (user.role === "teacher" ? "/teacher-portal" : user.role === "parent" || user.role === "student" ? "/portal" : "/dashboard");
    const text = `মাদরাসা পোর্টাল লগইন তথ্য:
নাম: ${user.full_name}
রোল: ${roleLabels[user.role]?.label || user.role}
লগইন আইডি/ইমেইল: ${user.email}
পাসওয়ার্ড/পিন: ${pin || "******"}
পোর্টাল লিংক: ${portalUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border shadow-sm animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ইউজার আইডি ও একাউন্ট ম্যানেজমেন্ট</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            শিক্ষক, অভিভাবক ও শিক্ষার্থীদের জন্য ম্যানুয়ালি লগইন আইডি তৈরি, পাসওয়ার্ড রিসেট ও পারমিশন কন্ট্রোল করুন।
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => openCreateModal("teacher")}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ শিক্ষক ইউজার</span>
          </button>
          <button
            onClick={() => openCreateModal("parent")}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-950/40 transition active:scale-95"
          >
            <Users className="w-4 h-4" />
            <span>+ অভিভাবক ইউজার</span>
          </button>
          <button
            onClick={() => openCreateModal("custom")}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-700 transition active:scale-95"
          >
            <span>অন্যান্য / কাস্টম</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">মোট ইউজার</p>
            <p className="text-xl font-bold text-slate-900">{toBanglaNumber(stats.total)} জন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 uppercase">শিক্ষক অ্যাকাউন্ট</p>
            <p className="text-xl font-bold text-slate-900">{toBanglaNumber(stats.teacherCount)} জন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-blue-700 uppercase">অভিভাবক অ্যাকাউন্ট</p>
            <p className="text-xl font-bold text-slate-900">{toBanglaNumber(stats.parentCount)} জন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-teal-700 uppercase">শিক্ষার্থী অ্যাকাউন্ট</p>
            <p className="text-xl font-bold text-slate-900">{toBanglaNumber(stats.studentCount)} জন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-indigo-700 uppercase">স্টাফ ও অ্যাডমিন</p>
            <p className="text-xl font-bold text-slate-900">{toBanglaNumber(stats.adminCount)} জন</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Role Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ইমেইল বা মোবাইল দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold no-scrollbar">
          {[
            { id: "all", label: `সকল (${stats.total})` },
            { id: "teacher", label: `শিক্ষক (${stats.teacherCount})` },
            { id: "parent", label: `অভিভাবক (${stats.parentCount})` },
            { id: "student", label: `শিক্ষার্থী (${stats.studentCount})` },
            { id: "staff", label: `স্টাফ ও অ্যাডমিন (${stats.adminCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Success Credential Popup Card (if user created recently) */}
      {createdCredential && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950 text-sm sm:text-base">ইউজার লগইন তথ্য তৈরি হয়েছে!</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                নাম: <strong>{createdCredential.name}</strong> | আইডি: <strong>{createdCredential.email}</strong> | পাসওয়ার্ড/পিন: <strong>{createdCredential.pin}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const text = `মাদরাসা পোর্টাল লগইন তথ্য:\nনাম: ${createdCredential.name}\nলগইন আইডি: ${createdCredential.email}\nপাসওয়ার্ড/পিন: ${createdCredential.pin}\nপোর্টাল লিংক: ${window.location.origin}/login`;
                navigator.clipboard.writeText(text);
                setCopiedId("new_created");
                setTimeout(() => setCopiedId(null), 2500);
              }}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              {copiedId === "new_created" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedId === "new_created" ? "কপি হয়েছে!" : "লগইন তথ্য কপি করুন"}</span>
            </button>
            <button
              onClick={() => setCreatedCredential(null)}
              className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">ব্যবহারকারীর নাম ও প্রোফাইল</th>
                <th className="px-4 py-3.5">রোল (Role)</th>
                <th className="px-4 py-3.5">লগইন আইডি / ইমেইল</th>
                <th className="px-4 py-3.5">মোবাইল নম্বর</th>
                <th className="px-4 py-3.5">তৈরির তারিখ</th>
                <th className="px-4 py-3.5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm">কোন ইউজার পাওয়া যায়নি</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery ? "সার্চ ফিল্টার রিসেট করুন" : "নতুন শিক্ষক বা অভিভাবক ইউজার তৈরি করুন"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleMeta = roleLabels[u.role] || {
                    label: u.role,
                    bg: "bg-slate-100",
                    text: "text-slate-800",
                    icon: Shield,
                  };
                  const RoleIcon = roleMeta.icon;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      {/* Name & Avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {(u.full_name || "ইউ")[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{u.full_name}</div>
                            {u.phone && <div className="text-xs text-slate-400 font-mono sm:hidden">{u.phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${roleMeta.bg} ${roleMeta.text}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          <span>{roleMeta.label}</span>
                        </span>
                      </td>

                      {/* Login Email / ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.email}
                          </span>
                          <button
                            onClick={() => copyCredentials(u)}
                            title="লগইন আইডি কপি করুন"
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                          >
                            {copiedId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {u.phone ? toBanglaNumber(u.phone) : "-"}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("bn-BD") : "-"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              generateRandomPin();
                              setIsResetPassOpen(true);
                            }}
                            title="পাসওয়ার্ড / পিন পরিবর্তন করুন"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Edit User */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setFullName(u.full_name);
                              setPhone(u.phone || "");
                              setRole(u.role);
                              setIsEditOpen(true);
                            }}
                            title="তথ্য সম্পাদনা করুন"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete User */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDeleteOpen(true);
                            }}
                            title="ইউজার অ্যাকাউন্ট মুছে ফেলুন"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">নতুন ইউজার অ্যাকাউন্ট তৈরি করুন</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Profile Linking Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ইউজার ক্যাটাগরি / ধরন বেছে নিন <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("teacher");
                      setRole("teacher");
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      createMode === "teacher"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>শিক্ষক</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("parent");
                      setRole("parent");
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      createMode === "parent"
                        ? "bg-blue-50 border-blue-500 text-blue-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>অভিভাবক</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode("custom");
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      createMode === "custom"
                        ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>কাস্টম / স্টাফ</span>
                  </button>
                </div>
              </div>

              {/* Fast Link for Teacher */}
              {createMode === "teacher" && teachers.length > 0 && (
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-1.5">
                  <label className="block text-xs font-bold text-emerald-900">
                    বিদ্যমান শিক্ষক নির্বাচন করুন (১-ক্লিকে ফর্ম পূরণ)
                  </label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => handleTeacherSelect(e.target.value)}
                    className="w-full p-2 border border-emerald-300 rounded-lg text-xs sm:text-sm bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- শিক্ষক বেছে নিন --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name} {t.designation ? `(${t.designation})` : ""} {t.phone ? ` - ${t.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fast Link for Parent / Student */}
              {createMode === "parent" && students.length > 0 && (
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-1.5">
                  <label className="block text-xs font-bold text-blue-900">
                    শিক্ষার্থী বেছে নিন (অভিভাবক তথ্য স্বয়ংক্রিয়ভাবে বসবে)
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => handleStudentSelect(e.target.value, true)}
                    className="w-full p-2 border border-blue-300 rounded-lg text-xs sm:text-sm bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- শিক্ষার্থী বেছে নিন --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} (রোল: {s.roll_number || "-"}, জামাত: {s.class_name || "-"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পুরো নাম (Full Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="যেমন: মুফতি আব্দুল্লাহ / মুহাম্মদ হাসান"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              {/* Role Select */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ইউজার রোল (Role) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="teacher">শিক্ষক (Teacher Portal)</option>
                    <option value="parent">অভিভাবক (Parent Portal)</option>
                    <option value="student">শিক্ষার্থী (Student Portal)</option>
                    <option value="admin">অ্যাডমিন (Admin)</option>
                    <option value="muhtamim">মুহতামিম / প্রিন্সিপাল</option>
                    <option value="accountant">হিসাবরক্ষক (Accountant)</option>
                    <option value="hostel_manager">বোর্ডিং ম্যানেজার</option>
                    <option value="library_manager">গ্রন্থাগারিক</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email / Login ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  লগইন আইডি / ইমেইল (Login Email) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@qawmi.app বা নিজস্ব ইমেইল"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  ইউজার এই ইমেইল / লগইন আইডি দিয়ে অ্যাপে সাইন ইন করবেন।
                </p>
              </div>

              {/* Password / PIN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    লগইন পাসওয়ার্ড / পিন (Password / PIN) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>পিন জেনারেট করুন</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="অন্তত ৬ অক্ষরের পাসওয়ার্ড"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Hidden linking fields */}
              {selectedTeacherId && <input type="hidden" name="teacher_id" value={selectedTeacherId} />}
              {selectedStudentId && <input type="hidden" name="student_id" value={selectedStudentId} />}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>ইউজার তৈরি করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">ইউজার তথ্য সম্পাদনা</h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পুরো নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="text"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  রোল (Role)
                </label>
                <select
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="teacher">শিক্ষক (Teacher)</option>
                  <option value="parent">অভিভাবক (Parent)</option>
                  <option value="student">শিক্ষার্থী (Student)</option>
                  <option value="admin">অ্যাডমিন (Admin)</option>
                  <option value="muhtamim">মুহতামিম / প্রিন্সিপাল</option>
                  <option value="accountant">হিসাবরক্ষক</option>
                  <option value="hostel_manager">বোর্ডিং ম্যানেজার</option>
                  <option value="library_manager">গ্রন্থাগারিক</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>আপডেট করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPassOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">পাসওয়ার্ড বা পিন পরিবর্তন করুন</h3>
              </div>
              <button
                onClick={() => setIsResetPassOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-600">
                  ইউজার: <strong>{selectedUser.full_name}</strong>
                </p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  আইডি: {selectedUser.email}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    নতুন পাসওয়ার্ড / পিন <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>নতুন পিন জেনারেট করুন</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsResetPassOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>পাসওয়ার্ড সেট করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base">ইউজার অ্যাকাউন্ট মুছে ফেলা</h3>
              </div>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="p-1 text-red-200 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700">
                আপনি কি নিশ্চিত যে <strong>{selectedUser.full_name}</strong> ({selectedUser.email})-এর অ্যাকাউন্ট মুছে ফেলতে চান?
              </p>
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                ⚠️ সতর্কতা: এই অ্যাকাউন্ট মুছে ফেললে ব্যবহারকারী আর পোর্টাল বা ড্যাশবোর্ডে লগইন করতে পারবেন না।
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={isPending}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>হ্যাঁ, মুছে ফেলুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
