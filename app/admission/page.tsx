"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  FileText,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Printer,
  Download,
  Phone,
  User,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { submitAdmissionApplication, searchAdmissionPublic } from "@/app/actions/admissions";
import { getClasses } from "@/app/actions/students";

export default function PublicAdmissionPage() {
  const [activeTab, setActiveTab] = useState<"apply" | "search">("apply");
  const [classes, setClasses] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    applicant_name_bn: "",
    applicant_name_en: "",
    date_of_birth: "",
    gender: "MALE" as "MALE" | "FEMALE",
    blood_group: "",
    birth_reg_no: "",
    father_name: "",
    father_occupation: "",
    mother_name: "",
    guardian_name: "",
    guardian_relation: "পিতা",
    guardian_phone: "",
    emergency_phone: "",
    present_address: "",
    permanent_address: "",
    target_class_id: "",
    target_class_name: "",
    residential_status: "আবাসিক" as "আবাসিক" | "অনাবাসিক" | "ডে-কেয়ার",
    previous_institution: "",
    previous_class_or_para: "",
  });

  useEffect(() => {
    getClasses().then((data) => {
      const clsList = data && data.length > 0 ? data : [
        { id: "cls_noorani", name: "নূরানী ১ম-৩য় জামাত" },
        { id: "cls_hifz", name: "হিফজুল কুরআন বিভাগ" },
        { id: "cls_najera", name: "নাজেরা ও ক্বেরাত বিভাগ" },
        { id: "cls_ibtidai", name: "ইবতিদাইয়্যাহ (প্রাথমিক জামাত)" },
        { id: "cls_mutawassita", name: "মুতাওয়াসসিতাহ (মিযান-নাহবেমীর)" },
        { id: "cls_sanabia", name: "সানাবিয়া (হিদায়া-জালালাইন)" },
        { id: "cls_dawra", name: "দাওরায়ে হাদীস (মাস্টার্স)" },
      ];
      setClasses(clsList);
      if (clsList.length > 0 && !formData.target_class_id) {
        setFormData((prev) => ({
          ...prev,
          target_class_id: clsList[0].id,
          target_class_name: clsList[0].name,
        }));
      }
    });
  }, []);

  const handleClassChange = (classId: string) => {
    const selected = classes.find((c) => c.id === classId);
    setFormData((prev) => ({
      ...prev,
      target_class_id: classId,
      target_class_name: selected ? selected.name : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!formData.applicant_name_bn || !formData.father_name || !formData.guardian_phone || !formData.present_address) {
      setErrorMessage("দয়া করে সকল বাধ্যতামূলক তথ্য (তারকাচিহ্নিত) সঠিকভাবে পূরণ করুন।");
      setIsSubmitting(false);
      return;
    }

    const res = await submitAdmissionApplication(formData);
    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSubmissionSuccess(res);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchAdmissionPublic(searchQuery);
    setSearchResults(results);
    setHasSearched(true);
    setIsSearching(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 text-slate-800">
      {/* Header Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg sm:text-xl text-slate-900 leading-tight">
                অনলাইন ভর্তি ও প্রবেশপত্র পোর্টাল
              </h1>
              <p className="text-xs text-slate-500">
                নতুন শিক্ষাবর্ষ ১৪৪৭-৪৮ হিজরি (২০২৬-২৭) • কওমি মাদরাসা ভর্তি ব্যবস্থা
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition"
            >
              অফিস লগইন
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl max-w-md mx-auto">
          <button
            onClick={() => {
              setActiveTab("apply");
              setSubmissionSuccess(null);
            }}
            className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === "apply"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ভর্তি আবেদন ফরম</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === "search"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>প্রবেশপত্র ও ফলাফল খুঁজুন</span>
          </button>
        </div>

        {/* Tab 1: Apply Section */}
        {activeTab === "apply" && (
          <div className="space-y-6">
            {submissionSuccess ? (
              /* Success State Card */
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 sm:p-10 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h2 className="text-2xl font-bold text-slate-900">ভর্তি আবেদন সফলভাবে গৃহীত হয়েছে!</h2>
                  <p className="text-slate-600 text-sm">
                    আলহামদুলিল্লাহ, আপনার আবেদনটি নিবন্ধিত হয়েছে। ভর্তি পরীক্ষার প্রবেশপত্র তৈরি প্রস্তুত।
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-lg mx-auto grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">আবেদন নম্বর (Application ID):</span>
                    <p className="text-base sm:text-lg font-bold text-emerald-700 font-mono">
                      {submissionSuccess.application_no}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">পরীক্ষার রোল (Exam Roll):</span>
                    <p className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                      {submissionSuccess.roll_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">শিক্ষার্থী:</span>
                    <p className="text-sm font-semibold text-slate-800">
                      {submissionSuccess.application?.applicant_name_bn}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">আবেদনকৃত জামাত:</span>
                    <p className="text-sm font-semibold text-slate-800">
                      {submissionSuccess.application?.target_class_name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href={`/admission/card/${submissionSuccess.application?.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>প্রবেশপত্র (Admit Card) প্রিন্ট করুন</span>
                  </Link>

                  <button
                    onClick={() => {
                      setSubmissionSuccess(null);
                      setFormData({
                        applicant_name_bn: "",
                        applicant_name_en: "",
                        date_of_birth: "",
                        gender: "MALE",
                        blood_group: "",
                        birth_reg_no: "",
                        father_name: "",
                        father_occupation: "",
                        mother_name: "",
                        guardian_name: "",
                        guardian_relation: "পিতা",
                        guardian_phone: "",
                        emergency_phone: "",
                        present_address: "",
                        permanent_address: "",
                        target_class_id: classes[0]?.id || "",
                        target_class_name: classes[0]?.name || "",
                        residential_status: "আবাসিক",
                        previous_institution: "",
                        previous_class_or_para: "",
                      });
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
                  >
                    <span>নতুন আবেদন করুন</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Main Admission Form */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span>অনলাইনে ভর্তি ফরম পূরণ (১৪৪৭-৪৮ হিজরি)</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    নিচের তথ্যগুলো যথাযথভাবে পূরণ করুন। আবেদন সম্পন্ন হলে তাৎক্ষণিক প্রবেশপত্র ডাউনলোড করা যাবে।
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Step 1: Academic Choice */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">
                      ১. জামাত ও আবাসিক তথ্য
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ভর্তির জন্য আবেদনকৃত জামাত <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.target_class_id}
                          onChange={(e) => handleClassChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                          required
                        >
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          আবাসিক অবস্থা <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.residential_status}
                          onChange={(e) =>
                            setFormData({ ...formData, residential_status: e.target.value as any })
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                          required
                        >
                          <option value="আবাসিক">আবাসিক (বোর্ডিং ও ছাত্রাবাস সুবিধা)</option>
                          <option value="অনাবাসিক">অনাবাসিক (বাসা থেকে আসা-যাওয়া)</option>
                          <option value="ডে-কেয়ার">ডে-কেয়ার (সকাল থেকে আসর)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Student Details */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">
                      ২. শিক্ষার্থীর ব্যক্তিগত তথ্য
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          শিক্ষার্থীর পূর্ণ নাম (বাংলায়) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="যেমন: মুহাম্মদ তাহমিদ হাসান"
                          value={formData.applicant_name_bn}
                          onChange={(e) => setFormData({ ...formData, applicant_name_bn: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          শিক্ষার্থীর নাম (ইংরেজিতে - বড় হাতের অক্ষরে)
                        </label>
                        <input
                          type="text"
                          placeholder="MUHAMMAD TAHMID HASAN"
                          value={formData.applicant_name_en}
                          onChange={(e) => setFormData({ ...formData, applicant_name_en: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          জন্ম তারিখ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          রক্তের গ্রুপ
                        </label>
                        <select
                          value={formData.blood_group}
                          onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          <option value="">নির্বাচন করুন</option>
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

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          জন্ম নিবন্ধন নম্বর (১৭ ডিজিট)
                        </label>
                        <input
                          type="text"
                          placeholder="১৭ ডিজিটের জন্ম সনদ নম্বর"
                          value={formData.birth_reg_no}
                          onChange={(e) => setFormData({ ...formData, birth_reg_no: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          পূর্ববর্তী মাদরাসা বা স্কুলের নাম
                        </label>
                        <input
                          type="text"
                          placeholder="যদি পূর্বে কোথাও পড়ে থাকে"
                          value={formData.previous_institution}
                          onChange={(e) => setFormData({ ...formData, previous_institution: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Parents & Guardian */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">
                      ৩. পিতা, মাতা ও অভিভাবকের তথ্য
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          পিতার নাম <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="পিতার পূর্ণ নাম"
                          value={formData.father_name}
                          onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          পিতার পেশা
                        </label>
                        <input
                          type="text"
                          placeholder="যেমন: ব্যবসা / চাকরি / ইমামতি"
                          value={formData.father_occupation}
                          onChange={(e) => setFormData({ ...formData, father_occupation: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          মাতার নাম
                        </label>
                        <input
                          type="text"
                          placeholder="মাতার পূর্ণ নাম"
                          value={formData.mother_name}
                          onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          অভিভাবকের মোবাইল নম্বর <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="017XXXXXXXX"
                          value={formData.guardian_phone}
                          onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          বর্তমান ঠিকানা <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="গ্রাম/বাড়ি, ডাকঘর, থানা, জেলা"
                          value={formData.present_address}
                          onChange={(e) => setFormData({ ...formData, present_address: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          জরুরি যোগাযোগ নম্বর
                        </label>
                        <input
                          type="tel"
                          placeholder="বিকল্প ফোন নম্বর"
                          value={formData.emergency_phone}
                          onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submission note */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>ঘোষণা:</span>
                    </p>
                    <p>
                      আমি অঙ্গীকার করছি যে উপরে প্রদত্ত সকল তথ্য সত্য ও নির্ভুল। মাদরাসার নিয়মকানুন মেনে চলতে বাধ্য থাকব। আবেদন দাখিল করার সাথে সাথেই পরীক্ষার রোল ও প্রবেশপত্র জেনারেট হবে।
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>আবেদন জমা হচ্ছে...</span>
                      ) : (
                        <>
                          <span>আবেদন দাখিল ও প্রবেশপত্র তৈরি করুন</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Search Admit Card & Result */}
        {activeTab === "search" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="max-w-xl mx-auto text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-900">প্রবেশপত্র ও এন্ট্রি টেস্ট ফলাফল অনুসন্ধান</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                আপনার আবেদন নম্বর (যেমন ADM-2026-0001), পরীক্ষার রোল নম্বর বা অভিভাবকের মোবাইল নম্বর লিখে খুঁজুন।
              </p>
            </div>

            <form onSubmit={handleSearch} className="max-w-lg mx-auto flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="আবেদন নং / রোল নং / ফোন নম্বর লিখুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition cursor-pointer"
              >
                {isSearching ? "খোঁজা হচ্ছে..." : "অনুসন্ধান"}
              </button>
            </form>

            {hasSearched && (
              <div className="space-y-4 pt-4">
                {searchResults.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-semibold">কোনো আবেদন পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400">
                      দয়া করে আবেদন নম্বর বা মোবাইল নম্বরটি পুনরায় যাচাই করুন।
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.map((app) => (
                      <div
                        key={app.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 hover:border-emerald-300 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              {app.application_no}
                            </span>
                            <h4 className="font-bold text-slate-900 text-base mt-1">
                              {app.applicant_name_bn}
                            </h4>
                            <p className="text-xs text-slate-500">জামাত: {app.target_class_name}</p>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">পরীক্ষার রোল</span>
                            <span className="font-mono font-bold text-slate-800 text-sm">
                              {app.roll_number}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                          <div>
                            <span className="text-slate-500">অবস্থা: </span>
                            {app.status === "CONFIRMED" ? (
                              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                ভর্তি নিশ্চিত হয়েছে
                              </span>
                            ) : app.status === "MERIT_SELECTED" ? (
                              <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                মেধাতালিকায় নির্বাচিত
                              </span>
                            ) : app.status === "REJECTED" ? (
                              <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                অনুপযুক্ত / বাতিল
                              </span>
                            ) : (
                              <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                                প্রবেশপত্র ইস্যু হয়েছে
                              </span>
                            )}
                          </div>

                          {app.test_evaluation && (
                            <span className="text-xs font-bold text-slate-700">
                              প্রাপ্ত নম্বর: {toBanglaNumber(app.test_evaluation.total_marks || 0)}/১০০
                            </span>
                          )}
                        </div>

                        {/* Action Link */}
                        <div className="pt-1">
                          <Link
                            href={`/admission/card/${app.id}`}
                            target="_blank"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>প্রবেশপত্র (Admit Card) প্রিন্ট করুন</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
