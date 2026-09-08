"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  GraduationCap,
  Heart,
  Calendar,
  Layers,
  MapPin,
  IdCard,
  Eye,
  Copy,
  Check,
  X,
  ExternalLink,
  UserCheck,
  Building2,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { resolveStudentIdBn, getStudentIdNumber } from "@/lib/student-utils";

interface Props {
  classes: any[];
  students: any[];
  currentClassId: string;
  madrasaName?: string;
}

export default function StudentDirectoryClient({
  classes,
  students,
  currentClassId,
  madrasaName,
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/teacher-portal/students?class_id=${e.target.value}`);
  };

  const copyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((s) => {
      const phone = s.parent_phone || s.guardian_phone || s.phone || "";
      const guardian = s.guardian_name || s.father_name || "";
      const address = s.address || "";
      return (
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        guardian.toLowerCase().includes(q) ||
        phone.includes(q) ||
        address.toLowerCase().includes(q) ||
        String(s.roll_number || "").includes(q) ||
        String(s.student_id || "").toLowerCase().includes(q) ||
        resolveStudentIdBn(s, students).includes(q) ||
        getStudentIdNumber(s, students).toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery]);

  const totalCount = students.length;
  const withPhotoCount = useMemo(
    () => students.filter((s) => Boolean(s.photo_url)).length,
    [students]
  );
  const withPhoneCount = useMemo(
    () => students.filter((s) => Boolean(s.parent_phone || s.guardian_phone || s.phone)).length,
    [students]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">শিক্ষার্থী ও অভিভাবক ডিরেক্টরি</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                শিক্ষার্থীদের আইডি ফটো, রোল, রক্তের গ্রুপ এবং অভিভাবকদের সাথে সরাসরি যোগাযোগ।
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 border border-slate-200/60">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>মোট: {toBanglaNumber(totalCount)} জন</span>
          </span>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-semibold flex items-center gap-1.5 border border-blue-200/60">
            <IdCard className="w-3.5 h-3.5 text-blue-600" />
            <span>ফটোযুক্ত: {toBanglaNumber(withPhotoCount)}</span>
          </span>
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl font-semibold flex items-center gap-1.5 border border-emerald-200/60">
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>ফোনযুক্ত: {toBanglaNumber(withPhoneCount)}</span>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-64 shrink-0">
          <select
            value={currentClassId}
            onChange={handleClassChange}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            <option value="">সকল জামাত / শ্রেণি</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            placeholder="শিক্ষার্থীর নাম, রোল, অভিভাবক বা ফোন নম্বর দিয়ে সার্চ করুন..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((s) => {
            const phone = s.parent_phone || s.guardian_phone || s.phone || "";
            const guardian = s.guardian_name || s.father_name || "";
            const cleanPhone = phone.replace(/[^0-9]/g, "");

            return (
              <div
                key={s.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                {/* Top Info: Photo + Name + ID */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Student Photo Avatar */}
                    <div
                      onClick={() => setSelectedStudent(s)}
                      className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-800 font-bold text-base flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-2xs cursor-pointer group relative"
                      title="আইডি ফটো ও বিস্তারিত দেখতে ক্লিক করুন"
                    >
                      {s.photo_url ? (
                        <img
                          src={s.photo_url}
                          alt={`${s.first_name || ""} ${s.last_name || ""}`}
                          className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <span className="text-blue-700 font-bold">{(s.first_name || "শ")[0]}</span>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-2xl">
                        <Eye className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3
                        onClick={() => setSelectedStudent(s)}
                        className="font-bold text-slate-900 text-sm sm:text-base leading-tight hover:text-blue-600 cursor-pointer transition truncate"
                      >
                        {s.first_name} {s.last_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        রোল: <strong className="text-slate-800">{toBanglaNumber(s.roll_number || "-")}</strong> | আইডি: {resolveStudentIdBn(s, students)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                    {s.status === "Active" ? "সক্রিয়" : "অধ্যয়নরত"}
                  </span>
                </div>

                {/* Details Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">জামাত:</span>
                    <span className="font-semibold text-slate-900">{s.classes?.name || s.class_name || "হিফজ"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">অভিভাবকের নাম:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                      {guardian || "তথ্য সংরক্ষিত নেই"}
                      {s.guardian_relation && guardian ? ` (${s.guardian_relation})` : ""}
                    </span>
                  </div>

                  {/* Phone Number Display */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">মোবাইল নম্বর:</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 font-normal font-sans">যুক্ত নেই</span>
                      )}
                    </span>
                  </div>

                  {s.blood_group && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">রক্তের গ্রুপ:</span>
                      <span className="font-bold text-red-600 flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current" />
                        {s.blood_group}
                      </span>
                    </div>
                  )}

                  {s.address && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50">
                      <span className="text-slate-400">ঠিকানা:</span>
                      <span className="text-slate-600 truncate max-w-[180px]">{s.address}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons: 1-click Call & SMS */}
                {phone ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${phone}`}
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>কল দিন</span>
                      </a>
                      <a
                        href={`sms:${phone}`}
                        className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>SMS পাঠান</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyPhone(phone)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      >
                        {copiedPhone === phone ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>নম্বর কপি</span>
                          </>
                        )}
                      </button>

                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone.startsWith("88") ? cleanPhone : "88" + cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                          title="WhatsApp এ মেসেজ দিন"
                        >
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedStudent(s)}
                        className="py-1.5 px-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                        title="আইডি কার্ড ও বিস্তারিত প্রোফাইল"
                      >
                        <IdCard className="w-3 h-3" />
                        <span>আইডি</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="text-center py-2 bg-slate-100 text-slate-400 text-xs rounded-xl font-medium">
                      মোবাইল নম্বর যুক্ত নেই
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className="w-full py-1.5 px-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <IdCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>আইডি কার্ড ও বিস্তারিত তথ্য</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700">কোন শিক্ষার্থী পাওয়া যায়নি</h4>
            <p className="text-xs text-slate-400 mt-1">অন্য জামাত নির্বাচন করুন অথবা সার্চ কুয়েরি পরিবর্তন করুন।</p>
          </div>
        )}
      </div>

      {/* Student ID & Full Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <IdCard className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base">শিক্ষার্থী আইডি ও পরিচিতি কার্ড</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* ID Card Box */}
              <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-blue-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

                {/* Madrasa Title */}
                <div className="text-center pb-4 border-b border-blue-800/60">
                  <h4 className="text-xs uppercase tracking-widest text-blue-300 font-semibold">ডিজিটাল স্টুডেন্ট আইডি</h4>
                  <h2 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                    {madrasaName || "মাদরাসা ম্যানেজমেন্ট সিস্টেম"}
                  </h2>
                </div>

                {/* Photo & Core ID */}
                <div className="pt-4 flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-24 h-28 rounded-2xl bg-white/10 border-2 border-white/30 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                    {selectedStudent.photo_url ? (
                      <img
                        src={selectedStudent.photo_url}
                        alt={selectedStudent.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-black text-white/50">
                        {(selectedStudent.first_name || "শ")[0]}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                    <h3 className="text-lg font-black text-white tracking-tight">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </h3>
                    <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/40">
                      আইডি: {resolveStudentIdBn(selectedStudent, students)}
                    </div>
                    <div className="text-xs text-blue-200/90 pt-1 space-y-0.5 font-medium">
                      <div>জামাত: <strong>{selectedStudent.classes?.name || selectedStudent.class_name || "হিফজ"}</strong></div>
                      <div>রোল নম্বর: <strong>{toBanglaNumber(selectedStudent.roll_number || "-")}</strong></div>
                      {selectedStudent.blood_group && (
                        <div>রক্তের গ্রুপ: <strong className="text-rose-300">{selectedStudent.blood_group}</strong></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comprehensive Details Table */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">পিতার নাম:</span>
                  <span className="font-semibold text-slate-900">{selectedStudent.father_name || "তথ্য সংরক্ষিত নেই"}</span>
                </div>
                {selectedStudent.mother_name && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">মাতার নাম:</span>
                    <span className="font-semibold text-slate-900">{selectedStudent.mother_name}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">অভিভাবক:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedStudent.guardian_name || selectedStudent.father_name || "তথ্য সংরক্ষিত নেই"}
                    {selectedStudent.guardian_relation ? ` (${selectedStudent.guardian_relation})` : ""}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">যোগাযোগ নম্বর:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedStudent.parent_phone || selectedStudent.guardian_phone || selectedStudent.phone || "যুক্ত নেই"}
                  </span>
                </div>
                {selectedStudent.address && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">ঠিকানা:</span>
                    <span className="font-medium text-slate-800 text-right max-w-[220px]">{selectedStudent.address}</span>
                  </div>
                )}
                {selectedStudent.date_of_birth && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">জন্ম তারিখ:</span>
                    <span className="font-medium text-slate-800">{selectedStudent.date_of_birth}</span>
                  </div>
                )}
              </div>

              {/* Actions inside modal */}
              {(selectedStudent.parent_phone || selectedStudent.guardian_phone || selectedStudent.phone) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={`tel:${selectedStudent.parent_phone || selectedStudent.guardian_phone || selectedStudent.phone}`}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <Phone className="w-4 h-4" />
                    <span>কল দিন</span>
                  </a>
                  <a
                    href={`sms:${selectedStudent.parent_phone || selectedStudent.guardian_phone || selectedStudent.phone}`}
                    className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>SMS পাঠান</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
