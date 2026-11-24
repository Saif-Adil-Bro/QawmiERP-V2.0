"use client";

import { useState } from "react";
import {
  User,
  Wallet,
  BookOpen,
  Lock,
  Phone,
  Mail,
  Calendar,
  MapPin,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Award,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { changeGuardianPassword } from "@/app/actions/auth";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface TeacherProfileProps {
  profile: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    staffCode: string;
    joiningDate: string;
    department: string;
    bloodGroup: string;
    address: string;
    inChargeClasses: { id: string; name: string }[];
    assignedSubjects: {
      id: string;
      class_name: string;
      subject_name: string;
      subject_code?: string;
    }[];
    salaryStructure: {
      baseSalary: number;
      houseAllowance: number;
      medicalAllowance: number;
      transportAllowance: number;
      foodAllowance: number;
      totalGrossSalary: number;
    };
    salaryRecords: any[];
    libraryRecords: {
      id: string;
      book_title: string;
      author?: string;
      issue_date: string;
      due_date: string;
      return_date?: string | null;
      status: string;
    }[];
  };
}

export default function TeacherProfileClient({ profile }: TeacherProfileProps) {
  const [activeTab, setActiveTab] = useState<"PROFILE" | "SALARY" | "LIBRARY" | "PASSWORD">("PROFILE");

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passStatus, setPassStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPassStatus(null);
    try {
      const res = await changeGuardianPassword(currentPassword, newPassword, confirmPassword);
      if (!res.success) {
        setPassStatus({ type: "error", message: res.error || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।" });
      } else {
        setPassStatus({
          type: "success",
          message: res.message || "আলহামদুলিল্লাহ! আপনার পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setPassStatus({
        type: "error",
        message: err?.message || "পাসওয়ার্ড পরিবর্তনে একটি ত্রুটি হয়েছে।",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: "PROFILE" as const, label: "প্রোফাইল ও দায়িত্ব", icon: User },
    { id: "SALARY" as const, label: "বেতন ও পে-স্লিপ", icon: Wallet },
    { id: "LIBRARY" as const, label: "লাইব্রেরি রেকর্ড", icon: BookOpen },
    { id: "PASSWORD" as const, label: "পাসওয়ার্ড পরিবর্তন", icon: Lock },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Profile Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shrink-0 border border-emerald-400/30">
              {(profile.name || "উ")[0]}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight truncate">
                  {profile.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                  {profile.designation}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1.5">
                {profile.staffCode && (
                  <span className="font-mono text-emerald-300 font-semibold">
                    আইডি: {profile.staffCode}
                  </span>
                )}
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{profile.email}</span>
                  </span>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{profile.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.inChargeClasses.map((cls) => (
              <span
                key={cls.id}
                className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-emerald-200 flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>শ্রেণি জিম্মাদার: {cls.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center justify-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE & RESPONSIBILITIES */}
      {activeTab === "PROFILE" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>ব্যক্তিগত ও প্রাতিষ্ঠানিক তথ্য</span>
            </h2>
            <dl className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <dt className="text-slate-500 font-medium">পূর্ণ নাম</dt>
                <dd className="font-bold text-slate-900 text-right">{profile.name}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <dt className="text-slate-500 font-medium">পদবি</dt>
                <dd className="font-bold text-emerald-700 text-right">{profile.designation}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <dt className="text-slate-500 font-medium">বিভাগ</dt>
                <dd className="font-semibold text-slate-800 text-right">{profile.department}</dd>
              </div>
              {profile.phone && (
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">মোবাইল নম্বর</dt>
                  <dd className="font-semibold text-slate-800 text-right">{profile.phone}</dd>
                </div>
              )}
              {profile.email && (
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">লগইন ইমেইল</dt>
                  <dd className="font-mono text-xs text-slate-700 text-right break-all">
                    {profile.email}
                  </dd>
                </div>
              )}
              {profile.joiningDate && (
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">যোগদানের তারিখ</dt>
                  <dd className="font-semibold text-slate-800 text-right">{profile.joiningDate}</dd>
                </div>
              )}
              {profile.bloodGroup && (
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium">রক্তের গ্রুপ</dt>
                  <dd className="font-bold text-rose-600 text-right">{profile.bloodGroup}</dd>
                </div>
              )}
              {profile.address && (
                <div className="pt-1">
                  <dt className="text-slate-500 font-medium mb-1">ঠিকানা</dt>
                  <dd className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    {profile.address}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* In-Charge Classes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>শ্রেণি জিম্মাদারী (নেগরান উস্তাদ)</span>
              </h2>
              {profile.inChargeClasses.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  বর্তমানে আপনার নামে কোনো নির্দিষ্ট জামাতের শ্রেণি জিম্মাদারী বরাদ্দ নেই।
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.inChargeClasses.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-950">{c.name}</p>
                        <p className="text-xs text-emerald-700 font-medium">শ্রেণি জিম্মাদার (নেগরান)</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Subjects */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>বরাদ্দকৃত কিতাব ও বিষয়সমূহ</span>
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  মোট: {toBanglaNumber(profile.assignedSubjects.length)}টি
                </span>
              </div>
              {profile.assignedSubjects.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  আপনার নামে এখনো কোনো কিতাব বা বিষয় বরাদ্দ করা হয়নি।
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.assignedSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {sub.subject_name}
                        </p>
                        <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                          জামাত: {sub.class_name}
                        </p>
                      </div>
                      {sub.subject_code && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                          {sub.subject_code}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALARY & PAYSLIPS */}
      {activeTab === "SALARY" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>মাসিক হাদিয়া ও বেতন কাঠামো</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">মূল বেতন</p>
                <p className="text-base font-black text-slate-900 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.baseSalary)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">বাড়ি ভাড়া ভাতা</p>
                <p className="text-base font-bold text-slate-800 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.houseAllowance)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">চিকিৎসা ভাতা</p>
                <p className="text-base font-bold text-slate-800 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.medicalAllowance)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">যাতায়াত ভাতা</p>
                <p className="text-base font-bold text-slate-800 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.transportAllowance)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">খাদ্য/দস্তরখান ভাতা</p>
                <p className="text-base font-bold text-slate-800 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.foodAllowance)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-bold text-emerald-800">মোট মাসিক বেতন</p>
                <p className="text-base font-black text-emerald-950 mt-1">
                  ৳{toBanglaNumber(profile.salaryStructure.totalGrossSalary)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>বেতন পরিশোধ ও পে-স্লিপ ইতিহাস</span>
            </h2>
            {profile.salaryRecords.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200/70">
                <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  এখনো কোনো বেতন পরিশোধের রেকর্ড বা পে-স্লিপ পাওয়া যায়নি
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  হিসাব বিভাগ থেকে মাসিক বেতন পরিশোধ করা হলে তা এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.salaryRecords.map((rec: any, idx: number) => {
                  const amount = Number(
                    rec.net_payable ?? rec.paid_amount ?? rec.amount ?? rec.total_amount ?? 0
                  );
                  const monthLabel = rec.month_label || rec.salary_month || rec.month || "মাসিক বেতন";
                  const payDate = rec.payment_date || rec.paid_at?.slice(0, 10) || rec.created_at?.slice(0, 10) || "—";
                  return (
                    <div
                      key={rec.id || idx}
                      className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{monthLabel}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            পরিশোধিত
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          তারিখ: {payDate} • মাধ্যম: {rec.payment_method || "নগদ"}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-base font-black text-emerald-700">
                          ৳{toBanglaNumber(amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LIBRARY RECORDS */}
      {activeTab === "LIBRARY" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>মাদরাসা কুতুবখানা (লাইব্রেরি) কিতাব ইস্যু রেকর্ড</span>
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              মোট: {toBanglaNumber(profile.libraryRecords.length)}টি
            </span>
          </div>

          {profile.libraryRecords.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200/70">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                আপনার নামে বর্তমানে কুতুবখানা থেকে কোনো কিতাব ইস্যু করা নেই
              </p>
              <p className="text-xs text-slate-500 mt-1">
                গ্রন্থাগার থেকে আপনার নামে কিতাব ইস্যু করা হলে জমার তারিখ ও স্ট্যাটাস এখানে দেখা যাবে।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.libraryRecords.map((book) => {
                const isReturned =
                  book.status === "RETURNED" || book.status === "returned" || !!book.return_date;
                return (
                  <div
                    key={book.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{book.book_title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ইস্যুর তারিখ: {book.issue_date} • ফেরতের শেষ তারিখ: {book.due_date}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-center ${
                        isReturned
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isReturned ? "ফেরত দেওয়া হয়েছে" : "অধ্যয়নরত (হাতে আছে)"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PASSWORD CHANGE */}
      {activeTab === "PASSWORD" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs max-w-xl mx-auto space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">পোর্টাল পাসওয়ার্ড পরিবর্তন করুন</h2>
              <p className="text-xs text-slate-500">
                আপনার শিক্ষক পোর্টাল একাউন্টের নিরাপত্তার জন্য একটি শক্তিশালী পাসওয়ার্ড ব্যবহার করুন
              </p>
            </div>
          </div>

          {passStatus && (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
                passStatus.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {passStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{passStatus.message}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                বর্তমান পাসওয়ার্ড <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="আপনার বর্তমান পাসওয়ার্ড লিখুন"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর) <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="নতুন পাসওয়ার্ড লিখুন"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                নতুন পাসওয়ার্ড নিশ্চিত করুন <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="পুনরায় নতুন পাসওয়ার্ড লিখুন"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl py-2.5 px-4 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? "পাসওয়ার্ড আপডেট হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন সংরক্ষণ করুন"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
