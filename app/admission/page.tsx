"use client";

import { useState, useEffect, useRef } from "react";
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
  Upload,
  Camera,
  X,
  BookOpen,
  HelpCircle,
  Check,
  Building,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { submitAdmissionApplication, searchAdmissionPublic } from "@/app/actions/admissions";
import { getClasses } from "@/app/actions/students";
import { calculateBanglaAge, ADMISSION_STATUS_MAP } from "@/lib/admissions";

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

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [uploadProvider, setUploadProvider] = useState<string>("");

  // Form State
  const [formData, setFormData] = useState({
    applicant_name_bn: "",
    applicant_name_en: "",
    date_of_birth: "",
    gender: "MALE" as "MALE" | "FEMALE",
    blood_group: "",
    birth_reg_no: "",
    photo_url: "",
    father_name: "",
    father_occupation: "",
    mother_name: "",
    guardian_name: "",
    guardian_relation: "পিতা",
    guardian_phone: "",
    emergency_phone: "",
    email: "",
    present_address: "",
    permanent_address: "",
    target_class_id: "",
    target_class_name: "",
    residential_status: "আবাসিক" as "আবাসিক" | "অনাবাসিক" | "ডে-কেয়ার",
    previous_institution: "",
    previous_class_or_para: "",
    department_category: "general" as "hifz" | "kitab" | "general",
    hifz_para_memorized: "",
    hifz_tajweed_quality: "উত্তম",
    kitab_previous_kitab: "",
    kitab_previous_grade: "মুমতাজ (১ম বিভাগ)",
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
        const firstCls = clsList[0];
        const isHifz = firstCls.name.includes("হিফজ") || firstCls.name.includes("নাজেরা");
        const isKitab = firstCls.name.includes("মিযান") || firstCls.name.includes("কিতাব") || firstCls.name.includes("সানাবিয়া") || firstCls.name.includes("দাওরা");
        const cat = isHifz ? "hifz" : isKitab ? "kitab" : "general";

        setFormData((prev) => ({
          ...prev,
          target_class_id: firstCls.id,
          target_class_name: firstCls.name,
          department_category: cat,
        }));
      }
    });
  }, []);

  const handleClassChange = (classId: string) => {
    const selected = classes.find((c) => c.id === classId);
    const clsName = selected ? selected.name : "";
    const isHifz = clsName.includes("হিফজ") || clsName.includes("নাজেরা");
    const isKitab = clsName.includes("মিযান") || clsName.includes("কিতাব") || clsName.includes("সানাবিয়া") || clsName.includes("দাওরা") || clsName.includes("হিদায়া");
    const cat = isHifz ? "hifz" : isKitab ? "kitab" : "general";

    setFormData((prev) => ({
      ...prev,
      target_class_id: classId,
      target_class_name: clsName,
      department_category: cat,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারবে।");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        setIsUploadingPhoto(true);
        setUploadProvider("");

        try {
          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              filename: file.name,
            }),
          });
          const data = await res.json();
          if (data.url) {
            setFormData((prev) => ({ ...prev, photo_url: data.url }));
            setUploadProvider(data.provider || "Free Image Host");
          } else {
            setFormData((prev) => ({ ...prev, photo_url: base64 }));
          }
        } catch (err) {
          console.warn("Failed to upload to external host, saving local data URL:", err);
          setFormData((prev) => ({ ...prev, photo_url: base64 }));
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoPreview("");
    setUploadProvider("");
    setFormData((prev) => ({ ...prev, photo_url: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const computedAge = formData.date_of_birth
    ? calculateBanglaAge(formData.date_of_birth)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!formData.applicant_name_bn.trim() || !formData.father_name.trim() || !formData.guardian_phone.trim() || !formData.present_address.trim()) {
      setErrorMessage("দয়া করে সকল বাধ্যতামূলক তথ্য (তারকাচিহ্নিত) সঠিকভাবে পূরণ করুন।");
      setIsSubmitting(false);
      return;
    }

    const res = await submitAdmissionApplication({
      ...formData,
      status: "PENDING", // By default stays in pending review
    });
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
                অনলাইন ভর্তি ও ফলাফল পোর্টাল
              </h1>
              <p className="text-xs text-slate-500">
                শিক্ষাবর্ষ ১৪৪৭-৪৮ হিজরি (২০২৬-২৭) • কওমি মাদরাসা ভর্তি ব্যবস্থা
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition"
            >
              মাদরাসা লগইন
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
            className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
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
            className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
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
                    আলহামদুলিল্লাহ, আপনার আবেদনটি নিবন্ধিত হয়েছে। মাদরাসা কর্তৃপক্ষ তথ্য পর্যালোচনা করে পরীক্ষার সময়সূচি চূড়ান্ত করবে।
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
                    <span className="text-xs text-slate-500 font-medium">পরীক্ষার সম্ভাব্য রোল:</span>
                    <p className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                      {submissionSuccess.roll_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">শিক্ষার্থীর নাম:</span>
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

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-lg mx-auto text-xs text-amber-800 text-left space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>পরবর্তী করণীয়:</span>
                  </p>
                  <p>
                    আপনার আবেদন নম্বর <span className="font-mono font-bold text-amber-900">{submissionSuccess.application_no}</span> টি সংরক্ষণ করুন। মাদরাসা অফিস থেকে আবেদন অনুমোদিত হলে আপনি &quot;প্রবেশপত্র খুঁজুন&quot; ট্যাব থেকে প্রবেশপত্র প্রিন্ট করতে পারবেন।
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href={`/admission/card/${submissionSuccess.application?.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>প্রবেশপত্র ভিউ / প্রিন্ট</span>
                  </Link>

                  <button
                    onClick={() => {
                      setSubmissionSuccess(null);
                      setPhotoPreview("");
                      setFormData({
                        applicant_name_bn: "",
                        applicant_name_en: "",
                        date_of_birth: "",
                        gender: "MALE",
                        blood_group: "",
                        birth_reg_no: "",
                        photo_url: "",
                        father_name: "",
                        father_occupation: "",
                        mother_name: "",
                        guardian_name: "",
                        guardian_relation: "পিতা",
                        guardian_phone: "",
                        emergency_phone: "",
                        email: "",
                        present_address: "",
                        permanent_address: "",
                        target_class_id: classes[0]?.id || "",
                        target_class_name: classes[0]?.name || "",
                        residential_status: "আবাসিক",
                        previous_institution: "",
                        previous_class_or_para: "",
                        department_category: "general",
                        hifz_para_memorized: "",
                        hifz_tajweed_quality: "উত্তম",
                        kitab_previous_kitab: "",
                        kitab_previous_grade: "মুমতাজ (১ম বিভাগ)",
                      });
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition cursor-pointer"
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
                    নিচের তথ্যগুলো যথাযথভাবে পূরণ করুন। তারকাচিহ্নিত (*) ফিল্ডগুলো পূরণ করা আবশ্যক।
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
                      ১. জামাত ও আবাসিক ধরন
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ভর্তির জন্য আবেদনকৃত জামাত <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.target_class_id}
                          onChange={(e) => handleClassChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
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

                  {/* Step 2: Student Personal Details & Photo */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">
                      ২. শিক্ষার্থীর ব্যক্তিগত তথ্য ও ছবি
                    </h3>

                    {/* Photo Upload Box */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center relative shrink-0">
                        {photoPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoPreview}
                              alt="Applicant"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={removePhoto}
                              className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 shadow-md hover:bg-rose-700 cursor-pointer"
                              title="ছবি মুছুন"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center text-slate-400 p-2">
                            <Camera className="w-6 h-6 mx-auto mb-1 opacity-70" />
                            <span className="text-[10px] block font-medium">ছবি যুক্ত করুন</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id="applicant-photo-upload"
                          />
                          <label
                            htmlFor="applicant-photo-upload"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 rounded-lg text-xs font-semibold text-slate-700 hover:text-emerald-700 transition cursor-pointer shadow-2xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>ডিভাইস থেকে ছবি আপলোড</span>
                          </label>

                          {isUploadingPhoto && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-medium animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              ইমেজ সার্ভারে আপলোড হচ্ছে...
                            </span>
                          )}

                          {!isUploadingPhoto && uploadProvider && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                              ✓ {uploadProvider}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          পাসপোর্ট সাইজের রঙিন ছবি (সর্বোচ্চ ২ মেগাবাইট)। ছবিটি স্বয়ংক্রিয়ভাবে ক্লাউড ইমেজ হোস্টিং সার্ভারে (iili.io / FreeImage / ImgBB) আপলোড হয়ে লিংক যুক্ত হবে।
                        </p>
                      </div>
                    </div>

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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            জন্ম তারিখ <span className="text-rose-500">*</span>
                          </label>
                          {computedAge && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              বয়স: {computedAge.formattedBn}
                            </span>
                          )}
                        </div>
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

                  {/* Step 3: Dynamic Department Specific Fields */}
                  {formData.department_category === "hifz" && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                        <BookOpen className="w-4 h-4 text-emerald-700" />
                        <span>হিফজুল কুরআন বিভাগ সম্পর্কিত তথ্য</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            পূর্বে কত পারা মুখস্থ আছে? (যদি থাকে)
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: ৩ পারা সমাপ্ত / নতুন শুরু"
                            value={formData.hifz_para_memorized}
                            onChange={(e) => setFormData({ ...formData, hifz_para_memorized: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            নাজেরা ও তিলাওয়াত মান
                          </label>
                          <select
                            value={formData.hifz_tajweed_quality}
                            onChange={(e) => setFormData({ ...formData, hifz_tajweed_quality: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="মাখরাজ ও তাজবীদসহ বিশুদ্ধ">মাখরাজ ও তাজবীদসহ বিশুদ্ধ</option>
                            <option value="সাধারণ নাজেরা তিলাওয়াত">সাধারণ নাজেরা তিলাওয়াত</option>
                            <option value="প্রাথমিক কায়দা সমাপ্ত">প্রাথমিক কায়দা সমাপ্ত</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.department_category === "kitab" && (
                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                        <BookOpen className="w-4 h-4 text-blue-700" />
                        <span>কিতাব বিভাগ সম্পর্কিত পূর্ববর্তী অভিজ্ঞতা</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            বিগত জামাতে পঠিত কিতাবসমূহ
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: মিযান, মুনশাইব, নাহবেমীর"
                            value={formData.kitab_previous_kitab}
                            onChange={(e) => setFormData({ ...formData, kitab_previous_kitab: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            বিগত বার্ষিক পরীক্ষার ফলাফল
                          </label>
                          <select
                            value={formData.kitab_previous_grade}
                            onChange={(e) => setFormData({ ...formData, kitab_previous_grade: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="মুমতাজ (১ম বিভাগ)">মুমতাজ (১ম বিভাগ)</option>
                            <option value="জায়্যিদ জিদ্দান (২য় বিভাগ)">জায়্যিদ জিদ্দান (২য় বিভাগ)</option>
                            <option value="জায়্যিদ (৩য় বিভাগ)">জায়্যিদ (৩য় বিভাগ)</option>
                            <option value="মাকবুল (উত্তীর্ণ)">মাকবুল (উত্তীর্ণ)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Parents & Guardian */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">
                      ৪. পিতা, মাতা ও অভিভাবকের তথ্য
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
                      আমি অঙ্গীকার করছি যে উপরে প্রদত্ত সকল তথ্য সত্য ও নির্ভুল। মাদরাসার নিয়মকানুন মেনে চলতে বাধ্য থাকব। আবেদন দাখিল করার পর মাদরাসা অফিস থেকে প্রবেশপত্র ও পরীক্ষার তারিখ অনুমোদন করা হবে।
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
                          <span>অনলাইন ভর্তি আবেদন দাখিল করুন</span>
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
                      দয়া করে আবেদন নম্বর বা মোবাইল নম্বরটি সঠিক ফরম্যাটে লিখে পুনরায় অনুসন্ধান করুন।
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.map((app) => {
                      const statusConfig = ADMISSION_STATUS_MAP[app.status as keyof typeof ADMISSION_STATUS_MAP] || ADMISSION_STATUS_MAP.PENDING;
                      const hasAdmitCard = app.status === "ADMIT_ISSUED" || app.status === "MERIT_SELECTED" || app.status === "CONFIRMED";

                      return (
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

                          {/* Status and description */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-200">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">বর্তমান অবস্থা: </span>
                              <span className={`font-bold px-2.5 py-0.5 rounded-full border text-xs ${statusConfig.badge}`}>
                                {statusConfig.labelBn}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {statusConfig.description}
                            </p>
                          </div>

                          {app.test_evaluation && (
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                              <span className="text-slate-600 font-medium">ভর্তি পরীক্ষার মোট নম্বর:</span>
                              <span className="font-bold text-emerald-800 font-mono">
                                {toBanglaNumber(app.test_evaluation.total_marks || 0)} / ১০০
                              </span>
                            </div>
                          )}

                          {/* Action Link */}
                          <div className="pt-1">
                            {hasAdmitCard ? (
                              <Link
                                href={`/admission/card/${app.id}`}
                                target="_blank"
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>প্রবেশপত্র (Admit Card) প্রিন্ট করুন</span>
                              </Link>
                            ) : (
                              <div className="w-full py-2 bg-amber-100/70 border border-amber-200 text-amber-800 rounded-lg text-xs text-center font-medium">
                                মাদরাসা অফিস থেকে প্রবেশপত্র অনুমোদনের অপেক্ষায়
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

