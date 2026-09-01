"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit2,
  Calendar,
  GraduationCap,
  Award,
  Phone,
  MapPin,
  User,
  Clock,
  Printer,
  CheckCircle2,
  BookOpen,
  CreditCard,
  Check,
  History,
  IdCard,
  RefreshCw,
} from "lucide-react";
import { StudentEnrollment } from "@/lib/sessions";
import { convertToBanglaNumber, getStudentIdNumber } from "@/lib/student-utils";
import { getStudentDigitalId, issueStudentIdCard } from "@/app/actions/id-card-management";
import DigitalIdCardView from "@/app/components/DigitalIdCardView";

interface StudentProfileClientProps {
  student: any;
  currentEnrollment: StudentEnrollment | null;
  academicHistory: StudentEnrollment[];
  allStudents: any[];
}

export default function StudentProfileClient({
  student,
  currentEnrollment,
  academicHistory,
  allStudents,
}: StudentProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"history" | "personal" | "idcard">("history");
  const [digitalIdData, setDigitalIdData] = useState<any>(null);
  const [loadingIdCard, setLoadingIdCard] = useState(false);

  const studentIdNumber = getStudentIdNumber(student, allStudents);
  const studentIdBn = convertToBanglaNumber(studentIdNumber);

  useEffect(() => {
    if (activeTab === "idcard" && !digitalIdData) {
      loadDigitalId();
    }
  }, [activeTab]);

  const loadDigitalId = async () => {
    setLoadingIdCard(true);
    const res = await getStudentDigitalId(student.id);
    setDigitalIdData(res);
    setLoadingIdCard(false);
  };

  const handleIssueCard = async () => {
    setLoadingIdCard(true);
    await issueStudentIdCard({ student_id: student.id });
    await loadDigitalId();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>শিক্ষার্থীদের তালিকায় ফিরুন</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/students/${student.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition"
          >
            <Edit2 className="w-4 h-4" />
            <span>তথ্য সম্পাদনা</span>
          </Link>
        </div>
      </div>

      {/* Student Main Profile Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-emerald-300 shadow-inner shrink-0">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.first_name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <span>{student.first_name?.[0] || "শ"}</span>
            )}
          </div>

          {/* Info */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {student.first_name} {student.last_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                আইডি: {studentIdBn}
              </span>
            </div>

            <p className="text-sm text-slate-500 font-medium">
              পিতা: <strong className="text-slate-800">{student.father_name || "তথ্য নেই"}</strong> • মাতা:{" "}
              <strong className="text-slate-800">{student.mother_name || "তথ্য নেই"}</strong>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>
                  বর্তমান জামাত: <strong>{currentEnrollment?.class_name || student.classes?.name || "অনির্ধারিত"}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>
                  বর্তমান রোল: <strong>{student.roll_number ? convertToBanglaNumber(student.roll_number) : "-"}</strong>
                </span>
              </div>

              {student.parent_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>{student.parent_phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <History className="w-4 h-4" />
          <span>একাডেমিক ইতিহাস (Academic History)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "personal"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <User className="w-4 h-4" />
          <span>ব্যক্তিগত ও অভিভাবক তথ্য</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("idcard")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "idcard"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <IdCard className="w-4 h-4 text-emerald-400" />
          <span>ডিজিটাল আইডি কার্ড</span>
        </button>
      </div>

      {/* Tab Content: Academic History */}
      {activeTab === "history" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                  <span>শিক্ষাবর্ষভিত্তিক এনরোলমেন্ট ও প্রমোশন রেকর্ড</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  শিক্ষার্থীর সকল শিক্ষাবর্ষের শ্রেণি উন্নয়ন ও ফলাফল ইতিহাস
                </p>
              </div>

              <Link
                href="/dashboard/students/promotion"
                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition"
              >
                + প্রমোশন পরিচালনা
              </Link>
            </div>

            {/* Timeline View */}
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pl-6">
              {academicHistory.map((item, idx) => {
                const isCurrent = item.session?.is_current || idx === 0;
                const isPromoted = item.status === "PROMOTED";
                const isRepeat = item.status === "REPEAT";

                return (
                  <div key={item.id || idx} className="relative group">
                    {/* Timeline bullet */}
                    <div
                      className={`absolute -left-[31px] top-1 w-5 h-5 rounded-full border-4 border-white shadow flex items-center justify-center ${
                        isCurrent
                          ? "bg-emerald-500"
                          : isPromoted
                          ? "bg-blue-500"
                          : isRepeat
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                    />

                    <div className="bg-slate-50 hover:bg-slate-100/80 transition p-5 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">
                            {item.session?.name || "১৪৪৭-৪৮ হিজরি"}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-md">
                              বর্তমান সেশন
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            ({item.session?.academic_year || "২০২৬-২৭"})
                          </span>
                        </div>

                        <div>
                          {item.status === "ACTIVE" ? (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                              🟢 সক্রিয় / অধ্যয়নরত
                            </span>
                          ) : item.status === "PROMOTED" ? (
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                              ✅ উত্তীর্ণ হয়ে প্রমোশন প্রাপ্ত
                            </span>
                          ) : item.status === "REPEAT" ? (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                              🔄 একই জামাতে পুনরাবৃত্তি
                            </span>
                          ) : item.status === "GRADUATED" ? (
                            <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
                              🎓 সমাপ্ত / তাকমিল
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 text-xs font-bold rounded-full">
                              {item.status}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-2">
                        <div>
                          <span className="text-slate-400 block">জামাত:</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {item.class_name || item.classes?.name || "অনির্ধারিত"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block">রোল নম্বর:</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {item.roll_number ? convertToBanglaNumber(item.roll_number) : "-"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block">এনরোলমেন্ট তারিখ:</span>
                          <span className="font-medium text-slate-700">
                            {item.enrollment_date?.split("T")[0] || "-"}
                          </span>
                        </div>
                      </div>

                      {item.remarks && (
                        <div className="text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 mt-2">
                          <strong>মন্তব্য:</strong> {item.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Personal & Guardian Details */}
      {activeTab === "personal" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-150">
          <h3 className="text-lg font-bold text-slate-900">ব্যক্তিগত ও পারিবারিক তথ্য</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-xs">জন্ম তারিখ</span>
              <span className="font-bold text-slate-800 mt-1 block">
                {student.date_of_birth || "প্রদান করা হয়নি"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-xs">রক্তের গ্রুপ</span>
              <span className="font-bold text-slate-800 mt-1 block">
                {student.blood_group || "অজানা"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-xs">অভিভাবকের মোবাইল</span>
              <span className="font-bold text-slate-800 mt-1 block">
                {student.parent_phone || "-"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 sm:col-span-2 md:col-span-3">
              <span className="text-slate-400 block text-xs">স্থায়ী ঠিকানা</span>
              <span className="font-bold text-slate-800 mt-1 block">
                {student.address || "ঠিকানা প্রদান করা হয়নি"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Digital ID Card */}
      {activeTab === "idcard" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <IdCard className="w-5 h-5 text-emerald-600" />
                <span>শিক্ষার্থী ডিজিটাল আইডি ও কিউআর সিস্টেম</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                শিক্ষার্থীর সচল আইডি কার্ড, কিউআর ভেরিফিকেশন ও ইস্যু হিস্ট্রি
              </p>
            </div>

            <button
              type="button"
              onClick={handleIssueCard}
              disabled={loadingIdCard}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIdCard ? "animate-spin" : ""}`} />
              <span>{digitalIdData?.card ? "নতুন রি-ইস্যু করুন" : "আইডি কার্ড তৈরি করুন"}</span>
            </button>
          </div>

          {loadingIdCard ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-semibold">আইডি কার্ড লোড হচ্ছে...</p>
            </div>
          ) : digitalIdData?.card ? (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
              <DigitalIdCardView
                card={digitalIdData.card}
                madrasaInfo={digitalIdData.madrasaInfo}
                showActions={true}
              />
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 space-y-3">
              <p className="text-sm font-semibold">বর্তমানে এই শিক্ষার্থীর কোনো সচল আইডি কার্ড নেই।</p>
              <button
                type="button"
                onClick={handleIssueCard}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                + এখনই আইডি কার্ড ইস্যু করুন
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
