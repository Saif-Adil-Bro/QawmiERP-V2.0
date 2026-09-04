"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import { createStudent, getClasses, getNextClassRoll, checkRollAvailability } from "@/app/actions/students";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import {
  ArrowLeft,
  User,
  Home,
  Users,
  CreditCard,
  HeartPulse,
  MapPin,
  FileText,
  Lock,
  CheckCircle2,
  Utensils,
  Bus,
  Coins,
  Calculator,
  AlertCircle,
  Sparkles,
  Bed,
  RefreshCw,
  Gift,
  Percent,
} from "lucide-react";

const initialState: { error?: string; success?: boolean } = {};

export default function NewStudentPage() {
  const [state, formAction, isPending] = useActionState(
    createStudent,
    initialState,
  );
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);

  // Class & Roll Auto-increment & Duplicate check states
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [rollNumber, setRollNumber] = useState<string>("");
  const [isFetchingRoll, setIsFetchingRoll] = useState<boolean>(false);
  const [rollWarning, setRollWarning] = useState<string | null>(null);

  // Residential & Boarding interactive state
  const [residentialStatus, setResidentialStatus] = useState<string>("অনাবাসিক");
  const [isBoarding, setIsBoarding] = useState<boolean>(false);
  const [boardingType, setBoardingType] = useState<string>("অনাবাসিক");

  // Fee structure state for interactive real-time calculation
  const [admissionFee, setAdmissionFee] = useState<number>(0);
  const [monthlyFee, setMonthlyFee] = useState<number>(1000);
  const [khorakiFee, setKhorakiFee] = useState<number>(0);
  const [accommodationFee, setAccommodationFee] = useState<number>(0);
  const [transportFee, setTransportFee] = useState<number>(0);
  const [otherFee, setOtherFee] = useState<number>(0);
  const [feeDiscount, setFeeDiscount] = useState<number>(0);
  const [feeDiscountReason, setFeeDiscountReason] = useState<string>("");

  useEffect(() => {
    getClasses().then((data) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/students");
    }
  }, [state, router]);

  // Handle Class Change with auto-roll generation
  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    if (classId) {
      setIsFetchingRoll(true);
      try {
        const { nextRoll } = await getNextClassRoll(classId);
        setRollNumber(nextRoll);
        setRollWarning(null);
      } catch (err) {
        console.error("Error fetching next roll:", err);
      } finally {
        setIsFetchingRoll(false);
      }
    } else {
      setRollNumber("");
      setRollWarning(null);
    }
  };

  // Handle manual roll editing with duplicate checking
  const handleRollChange = async (newRoll: string) => {
    setRollNumber(newRoll);
    if (selectedClassId && newRoll.trim()) {
      const check = await checkRollAvailability(selectedClassId, newRoll);
      if (!check.available) {
        setRollWarning(`⚠️ সতর্কবার্তা: '${newRoll}' রোল নম্বরটি এই জামাতে ইতিমধ্যে ${check.conflictStudentName}-এর জন্য নির্ধারিত আছে!`);
      } else {
        setRollWarning(null);
      }
    } else {
      setRollWarning(null);
    }
  };

  // Quick Fee Preset Handlers
  const applyFullFreePreset = () => {
    setMonthlyFee(0);
    setAdmissionFee(0);
    setKhorakiFee(0);
    setAccommodationFee(0);
    setTransportFee(0);
    setOtherFee(0);
    setFeeDiscount(0);
    setFeeDiscountReason("১০০% সম্পূর্ণ ফ্রি / অবৈতনিক শিক্ষার্থী (এতিম ও দরিদ্র তহবিল)");
  };

  const applyHalfFreePreset = () => {
    const base = monthlyFee > 0 ? monthlyFee : 1000;
    setMonthlyFee(base);
    setFeeDiscount(Math.round(base * 0.5));
    setFeeDiscountReason("হাফ-ফ্রি সুবিধা (৫০% মাসিক বেতন মওকুফ)");
  };

  const applyLillahBoardingPreset = () => {
    setResidentialStatus("আবাসিক");
    setIsBoarding(true);
    setBoardingType("লিল্লাহ বোর্ডিং");
    setKhorakiFee(0);
    setAccommodationFee(0);
    setFeeDiscountReason("লিল্লাহ বোর্ডিং সুবিধা (বিনামূল্যে খাবার ও বোর্ডিং)");
  };

  const applyStandardPreset = () => {
    setMonthlyFee(1000);
    setFeeDiscount(0);
    setFeeDiscountReason("");
    if (residentialStatus === "আবাসিক") {
      setKhorakiFee(2000);
      setAccommodationFee(500);
      setBoardingType("সাধারণ পেইং");
    } else {
      setKhorakiFee(0);
      setAccommodationFee(0);
      setBoardingType("অনাবাসিক");
    }
  };

  // Handle residential change
  const handleResidentialChange = (val: string) => {
    setResidentialStatus(val);
    if (val === "আবাসিক") {
      setIsBoarding(true);
      if (boardingType === "অনাবাসিক") {
        setBoardingType("সাধারণ পেইং");
      }
      if (khorakiFee === 0 && !feeDiscountReason.includes("লিল্লাহ")) setKhorakiFee(2000);
      if (accommodationFee === 0 && !feeDiscountReason.includes("লিল্লাহ")) setAccommodationFee(500);
    } else if (val === "অনাবাসিক") {
      setIsBoarding(false);
      setBoardingType("অনাবাসিক");
      setKhorakiFee(0);
      setAccommodationFee(0);
    } else if (val === "ডে-কেয়ার") {
      setIsBoarding(false);
      setBoardingType("অনাবাসিক");
      setAccommodationFee(0);
    }
  };

  // Handle Boarding Type change
  const handleBoardingTypeChange = (val: string) => {
    setBoardingType(val);
    if (val === "লিল্লাহ বোর্ডিং") {
      setKhorakiFee(0);
      setFeeDiscountReason("লিল্লাহ বোর্ডিং (বিনামূল্যে খাবার)");
    } else if (val === "হাফ-ফ্রি") {
      setFeeDiscountReason("হাফ-ফ্রি বোর্ডিং (৫০% ছাড়)");
    }
  };

  // Live Monthly Total Calculation
  const totalMonthlyCalculated = useMemo(() => {
    const gross = (monthlyFee || 0) + (khorakiFee || 0) + (accommodationFee || 0) + (transportFee || 0) + (otherFee || 0);
    return Math.max(0, gross - (feeDiscount || 0));
  }, [monthlyFee, khorakiFee, accommodationFee, transportFee, otherFee, feeDiscount]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/students"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            title="শিক্ষার্থী তালিকায় ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>নতুন শিক্ষার্থী যুক্ত করুন</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                নতুন ভর্তি ও নিবন্ধন
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              মাদ্রাসায় নতুন শিক্ষার্থীর পূর্ণাঙ্গ ব্যক্তিগত, একাডেমিক, আবাসন ও ফি সংক্রান্ত চুক্তি তথ্য এন্ট্রি করুন
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <form action={formAction} className="p-6 sm:p-8 space-y-8">
          {state?.error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">ত্রুটি:</strong> {state.error}
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION 1: মৌলিক ও একাডেমিক তথ্য
          ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-bold text-base">
              <User className="w-5 h-5 text-indigo-600" />
              <span>১. মৌলিক ও একাডেমিক তথ্য (Academic Information)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="text-xs font-semibold text-slate-700">
                  প্রথম নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  required
                  placeholder="যেমন: মুহাম্মদ"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="last_name" className="text-xs font-semibold text-slate-700">
                  শেষ নাম / পদবী <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  placeholder="যেমন: আব্দুল্লাহ"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="class_id" className="text-xs font-semibold text-slate-700">
                  জামাত / শ্রেণি <span className="text-red-500">*</span>
                </label>
                <select
                  id="class_id"
                  name="class_id"
                  required
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white font-medium"
                >
                  <option value="">ক্লাস নির্বাচন করুন</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="roll_number" className="text-xs font-semibold text-slate-700">
                    শ্রেণি রোল নম্বর
                  </label>
                  {selectedClassId && (
                    <button
                      type="button"
                      onClick={() => handleClassChange(selectedClassId)}
                      disabled={isFetchingRoll}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold cursor-pointer"
                      title="স্বয়ংক্রিয় পরবর্তী রোল নম্বর লোড করুন"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingRoll ? "animate-spin" : ""}`} />
                      <span>অটো রোল</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  id="roll_number"
                  name="roll_number"
                  value={rollNumber}
                  onChange={(e) => handleRollChange(e.target.value)}
                  placeholder="শ্রেণি সিলেক্ট করলে অটো আসবে (যেমন: ১)"
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition ${
                    rollWarning ? "border-amber-500 focus:ring-amber-500 bg-amber-50/50" : "focus:ring-slate-900"
                  }`}
                />
                {rollWarning ? (
                  <p className="text-[11px] text-amber-700 font-medium animate-in fade-in">
                    {rollWarning}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    জামাত অনুযায়ী পরবর্তী রোল স্বয়ংক্রিয়ভাবে বসবে, প্রয়োজনে এডিট করতে পারেন
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="student_status" className="text-xs font-semibold text-slate-700">
                  শিক্ষার্থীর প্রাথমিক স্ট্যাটাস
                </label>
                <select
                  id="student_status"
                  name="student_status"
                  defaultValue="ACTIVE"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
                >
                  <option value="ACTIVE">নিয়মিত শিক্ষার্থী (Active)</option>
                  <option value="IRREGULAR">অনিয়মিত (Irregular)</option>
                  <option value="GRADUATED">ফারিগ / সমাপনকারী (Graduated)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="previous_madrasa" className="text-xs font-semibold text-slate-700">
                  পূর্ববর্তী প্রতিষ্ঠান / মাদ্রাসা
                </label>
                <input
                  type="text"
                  id="previous_madrasa"
                  name="previous_madrasa"
                  placeholder="যেমন: দারুল উলূম ঢাকা"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 2: ফি কাঠামো ও আর্থিক চুক্তি
          ======================================================== */}
          <div className="space-y-4 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 p-5 sm:p-6 rounded-2xl border border-emerald-200/90 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/80">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <CreditCard className="w-5 h-5 text-emerald-700" />
                <span>২. ফি কাঠামো ও নির্ধারিত মাসিক চার্জ (Fee Structure & Charges)</span>
              </div>
              <div className="flex items-center gap-2">
                {totalMonthlyCalculated === 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
                    ✓ ১০০% অবৈতনিক / ফ্রি শিক্ষার্থী
                  </span>
                )}
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>প্রাক্কলিত মাসিক ফি: {totalMonthlyCalculated.toLocaleString()} ৳</span>
                </span>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>দ্রুত ফি প্যাকেজ / ফ্রি সুবিধা নির্বাচন (Quick Presets):</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyFullFreePreset}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>১০০% সম্পূর্ণ ফ্রি / অবৈতনিক</span>
                </button>
                <button
                  type="button"
                  onClick={applyHalfFreePreset}
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>৫০% হাফ-ফ্রি স্কলারশিপ</span>
                </button>
                <button
                  type="button"
                  onClick={applyLillahBoardingPreset}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>লিল্লাহ বোর্ডিং (খাবার ফ্রি)</span>
                </button>
                <button
                  type="button"
                  onClick={applyStandardPreset}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <span>সাধারণ পেইং (Standard)</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              ভর্তিকালীন ফি এবং প্রতি মাসের নির্ধারিত বেতন, খোরাকি ও অন্যান্য ফি নির্ধারণ করুন। এটি স্বয়ংক্রিয়ভাবে শিক্ষার্থী প্রোফাইল ও প্রধান হিসাব বিভাগে সিংক থাকবে।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {/* ভর্তি ফি (এককালীন) */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="admission_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>ভর্তি ফি (Admission Fee)</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">এককালীন</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="admission_fee"
                    name="admission_fee"
                    min="0"
                    step="50"
                    value={admissionFee}
                    onChange={(e) => setAdmissionFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">ভর্তির সময় প্রদেয় এককালীন ফি</p>
              </div>

              {/* মাসিক বেতন / টিউশন ফি */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="monthly_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>মাসিক বেতন (Monthly Tuition) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">মাসিক</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="monthly_fee"
                    name="monthly_fee"
                    required
                    min="0"
                    step="50"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value) || 0)}
                    placeholder="1000"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">মাসিক সাধারণ পাঠদান ফি (ফ্রি হলে ০ দিন)</p>
              </div>

              {/* খোরাকি / খাবার চার্জ */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="khoraki_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5 text-orange-600" />
                    <span>খোরাকি / খাবার চার্জ (Meal Fee)</span>
                  </span>
                  <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-medium">মাসিক</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="khoraki_fee"
                    name="khoraki_fee"
                    min="0"
                    step="50"
                    value={khorakiFee}
                    onChange={(e) => setKhorakiFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">বোর্ডিং ছাত্রদের জন্য মাসিক খাবার বিল</p>
              </div>

              {/* আবাসন ফি / হোস্টেল চার্জ */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="accommodation_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5 text-amber-600" />
                    <span>আবাসন ফি / সিট ভাড়া (Hostel)</span>
                  </span>
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">মাসিক</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="accommodation_fee"
                    name="accommodation_fee"
                    min="0"
                    step="50"
                    value={accommodationFee}
                    onChange={(e) => setAccommodationFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">ছাত্রাবাস অবস্থান ও বিদ্যুৎ/পানি চার্জ</p>
              </div>

              {/* গাড়ি ভাড়া / পরিবহন ফি */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="transport_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>গাড়ি ভাড়া / পরিবহন ফি (Transport)</span>
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">মাসিক</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="transport_fee"
                    name="transport_fee"
                    min="0"
                    step="50"
                    value={transportFee}
                    onChange={(e) => setTransportFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">মাদ্রাসার বাস বা ভ্যান পরিবহন ভাড়া</p>
              </div>

              {/* অন্যান্য / বিবিধ ফি */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="other_fee" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-slate-600" />
                    <span>অন্যান্য / বিবিধ চার্জ (Misc Fee)</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">মাসিক</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="other_fee"
                    name="other_fee"
                    min="0"
                    step="50"
                    value={otherFee}
                    onChange={(e) => setOtherFee(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">চিকিৎসা, পাঠাগার বা অন্যান্য সেবা</p>
              </div>

              {/* মাসিক ফি ছাড় / মওকুফ */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                <label htmlFor="fee_discount" className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="text-red-700">বিশেষ ছাড় / স্কলারশিপ (Discount)</span>
                  <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">মওকুফ</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="fee_discount"
                    name="fee_discount"
                    min="0"
                    step="50"
                    value={feeDiscount}
                    onChange={(e) => setFeeDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition text-red-700"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                </div>
                <p className="text-[11px] text-slate-500">এতিম / দরিদ্র বা হাফেজ সুবিধা</p>
              </div>

              {/* ছাড়ের কারণ */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-emerald-200/60 shadow-2xs sm:col-span-2">
                <label htmlFor="fee_discount_reason" className="text-xs font-bold text-slate-800">
                  ছাড়ের কারণ বা শর্ত (Discount Note)
                </label>
                <input
                  type="text"
                  id="fee_discount_reason"
                  name="fee_discount_reason"
                  value={feeDiscountReason}
                  onChange={(e) => setFeeDiscountReason(e.target.value)}
                  placeholder="যেমন: এতিম শিক্ষার্থী / হাফেজ কোটায় ৫০% মওকুফ"
                  className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                />
                <p className="text-[11px] text-slate-500">বিশেষ বিবেচনার কারণ উল্লেখ করুন</p>
              </div>
            </div>

            {/* Live Calculation Summary Banner */}
            <div className="p-4 bg-white rounded-xl border-2 border-emerald-300 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">
                    নির্ধারিত মোট মাসিক প্রদেয় ফি: <span className="text-emerald-700 font-extrabold">{totalMonthlyCalculated.toLocaleString()} ৳/মাস</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    বেতন ({monthlyFee}৳) + খোরাকি ({khorakiFee}৳) + আবাসন ({accommodationFee}৳) + গাড়ি ({transportFee}৳) + অন্যান্য ({otherFee}৳) - ছাড় ({feeDiscount}৳)
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">ভর্তিকালীন এককালীন ফি</span>
                <span className="font-extrabold text-slate-800 text-sm">{admissionFee.toLocaleString()} ৳</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 3: আবাসিক ও বোর্ডিং ব্যবস্থাপনা তথ্য
          ======================================================== */}
          <div className="space-y-4 bg-amber-50/50 p-5 sm:p-6 rounded-2xl border border-amber-200/80">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Home className="w-5 h-5 text-amber-600" />
                <span>৩. আবাসিক ও বোর্ডিং ব্যবস্থাপনা তথ্য (Residential & Boarding)</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {residentialStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {/* আবাসিক ধরন */}
              <div className="space-y-1.5">
                <label htmlFor="residential_status" className="text-xs font-semibold text-slate-800">
                  আবাসিক অবস্থান (Residential Status) <span className="text-red-500">*</span>
                </label>
                <select
                  id="residential_status"
                  name="residential_status"
                  value={residentialStatus}
                  onChange={(e) => handleResidentialChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white font-medium text-slate-800"
                >
                  <option value="অনাবাসিক">অনাবাসিক (Non-Residential)</option>
                  <option value="আবাসিক">আবাসিক (Residential / Hostel)</option>
                  <option value="ডে-কেয়ার">ডে-কেয়ার (Day Care)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  আবাসিক নির্বাচন করলে বোর্ডিং ও মিল সুবিধা স্বয়ংক্রিয়ভাবে সক্রিয় হবে
                </p>
              </div>

              {/* বোর্ডিং সুবিধা চালু / বন্ধ */}
              <div className="space-y-1.5">
                <label htmlFor="is_boarding" className="text-xs font-semibold text-slate-800">
                  বোর্ডিং ও মিল সুবিধা (Boarding/Meals)
                </label>
                <select
                  id="is_boarding"
                  name="is_boarding"
                  value={isBoarding ? "true" : "false"}
                  onChange={(e) => {
                    const val = e.target.value === "true";
                    setIsBoarding(val);
                    if (!val) setBoardingType("অনাবাসিক");
                    else if (boardingType === "অনাবাসিক") setBoardingType("সাধারণ পেইং");
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white font-semibold ${
                    isBoarding ? "text-orange-700 bg-orange-50/50" : "text-slate-600"
                  }`}
                >
                  <option value="true">চালু (বোর্ডিং খাবার চালু)</option>
                  <option value="false">বন্ধ (খাবার প্রয়োজন নেই)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  মাদ্রাসার দৈনিক মিল তালিকায় স্বয়ংক্রিয় গণনা হবে
                </p>
              </div>

              {/* বোর্ডিং ধরন / ক্যাটাগরি */}
              <div className="space-y-1.5">
                <label htmlFor="boarding_type" className="text-xs font-semibold text-slate-800">
                  বোর্ডিং ক্যাটাগরি (Boarding Type)
                </label>
                <select
                  id="boarding_type"
                  name="boarding_type"
                  value={isBoarding ? boardingType : "অনাবাসিক"}
                  onChange={(e) => handleBoardingTypeChange(e.target.value)}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white font-medium ${
                    !isBoarding ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
                  }`}
                >
                  <option value="সাধারণ পেইং">সাধারণ পেইং বোর্ডিং (মাসিক ফি প্রযোজ্য)</option>
                  <option value="লিল্লাহ বোর্ডিং">লিল্লাহ বোর্ডিং (বিনামূল্যে খাবার)</option>
                  <option value="হাফ-ফ্রি">হাফ-ফ্রি বোর্ডিং (৫০% ছাড়)</option>
                  <option value="অনাবাসিক">অনাবাসিক (প্রযোজ্য নয়)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  মাসিক বিল ও হিসাবের জন্য নির্ধারণ করুন
                </p>
              </div>

              {/* হোস্টেল রুম নং */}
              <div className="space-y-1.5">
                <label htmlFor="room_no" className="text-xs font-semibold text-slate-800">
                  ছাত্রাবাস কক্ষ / রুম নম্বর (Hostel Room)
                </label>
                <input
                  type="text"
                  id="room_no"
                  name="room_no"
                  placeholder="যেমন: দারুল উলূম - ১০৫"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white"
                />
              </div>

              {/* সিট নং */}
              <div className="space-y-1.5">
                <label htmlFor="seat_no" className="text-xs font-semibold text-slate-800">
                  সিট / বিছানা নম্বর (Bed / Seat No)
                </label>
                <input
                  type="text"
                  id="seat_no"
                  name="seat_no"
                  placeholder="যেমন: সিট নং-৩"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>
                    {isBoarding
                      ? "এই ছাত্রের জন্য দৈনিক মিল ট্র্যাকিং স্বয়ংক্রিয়ভাবে সক্রিয় থাকবে।"
                      : "এই ছাত্র দৈনিক মিল ট্র্যাকিংয়ে খাবার সুবিধা বন্ধ হিসেবে থাকবে।"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 4: অভিভাবক ও পরিবারের বিবরণ
          ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-bold text-base">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>৪. পিতা, মাতা ও অভিভাবকের বিবরণ (Guardian Info)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="father_name" className="text-xs font-semibold text-slate-700">
                  পিতার নাম
                </label>
                <input
                  type="text"
                  id="father_name"
                  name="father_name"
                  placeholder="পিতার নাম লিখুন"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="father_occupation" className="text-xs font-semibold text-slate-700">
                  পিতার পেশা
                </label>
                <input
                  type="text"
                  id="father_occupation"
                  name="father_occupation"
                  placeholder="যেমন: শিক্ষক / ব্যবসায়ী / প্রবাসী"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mother_name" className="text-xs font-semibold text-slate-700">
                  মাতার নাম
                </label>
                <input
                  type="text"
                  id="mother_name"
                  name="mother_name"
                  placeholder="মাতার নাম লিখুন"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="parent_phone" className="text-xs font-semibold text-slate-700">
                  অভিভাবকের প্রধান মোবাইল নম্বর <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="parent_phone"
                  name="parent_phone"
                  required
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="guardian_name" className="text-xs font-semibold text-slate-700">
                  আইনগত অভিভাবকের নাম (পিতা ব্যতীত হলে)
                </label>
                <input
                  type="text"
                  id="guardian_name"
                  name="guardian_name"
                  placeholder="অভিভাবকের নাম"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="guardian_relation" className="text-xs font-semibold text-slate-700">
                  অভিভাবকের সাথে সম্পর্ক
                </label>
                <input
                  type="text"
                  id="guardian_relation"
                  name="guardian_relation"
                  placeholder="যেমন: পিতা / চাচা / বড় ভাই"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="emergency_contact" className="text-xs font-semibold text-slate-700">
                  জরুরি যোগাযোগ নম্বর (Emergency Contact)
                </label>
                <input
                  type="tel"
                  id="emergency_contact"
                  name="emergency_contact"
                  placeholder="বিকল্প ফোন নম্বর"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 5: ব্যক্তিগত ও স্বাস্থ্য বিবরণ
          ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-bold text-base">
              <HeartPulse className="w-5 h-5 text-indigo-600" />
              <span>৫. ব্যক্তিগত, স্বাস্থ্য ও ডিজিটাল এনআইডি তথ্য</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="blood_group" className="text-xs font-semibold text-slate-700">
                  রক্তের গ্রুপ (Blood Group)
                </label>
                <select
                  id="blood_group"
                  name="blood_group"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
                >
                  <option value="">নির্বাচন করুন (ঐচ্ছিক)</option>
                  <option value="A+">A+ (এ পজিটিভ)</option>
                  <option value="A-">A- (এ নেগেটিভ)</option>
                  <option value="B+">B+ (বি পজিটিভ)</option>
                  <option value="B-">B- (বি নেগেটিভ)</option>
                  <option value="O+">O+ (ও পজিটিভ)</option>
                  <option value="O-">O- (ও নেগেটিভ)</option>
                  <option value="AB+">AB+ (এবি পজিটিভ)</option>
                  <option value="AB-">AB- (এবি নেগেটিভ)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="date_of_birth" className="text-xs font-semibold text-slate-700">
                  জন্ম তারিখ (Date of Birth)
                </label>
                <input
                  type="date"
                  id="date_of_birth"
                  name="date_of_birth"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="nid_or_birth_cert" className="text-xs font-semibold text-slate-700">
                  জন্ম নিবন্ধন / এনআইডি নম্বর
                </label>
                <input
                  type="text"
                  id="nid_or_birth_cert"
                  name="nid_or_birth_cert"
                  placeholder="১৭ ডিজিটের জন্ম নিবন্ধন নং"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label htmlFor="medical_notes" className="text-xs font-semibold text-slate-700">
                  বিশেষ স্বাস্থ্য বা পথ্য সংক্রান্ত নোট (অ্যালার্জি, নিয়মিত ঔষধ বা সতর্কতা)
                </label>
                <input
                  type="text"
                  id="medical_notes"
                  name="medical_notes"
                  placeholder="যেমন: ধুলাবালিতে শ্বাসকষ্ট আছে বা চিংড়ি মাছে অ্যালার্জি"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 6: ঠিকানা ও মন্তব্য
          ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-bold text-base">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <span>৬. ঠিকানা ও মাদ্রাসার বিশেষ মন্তব্য</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="address" className="text-xs font-semibold text-slate-700">
                  স্থায়ী / বর্তমান ঠিকানা
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  placeholder="গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="remarks" className="text-xs font-semibold text-slate-700">
                  অতিরিক্ত মন্তব্য বা মাদ্রাসার নোট (ঐচ্ছিক)
                </label>
                <textarea
                  id="remarks"
                  name="remarks"
                  rows={3}
                  placeholder="শিক্ষার্থী সম্পর্কিত বিশেষ কোনো নির্দেশনা বা নোট"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 7: ছবি আপলোড (ডিজিটাল আইডি কার্ড ও নথির জন্য)
          ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-bold text-base">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>৭. শিক্ষার্থীর ছবি (ডিজিটাল আইডি কার্ড ও নথিপত্রের জন্য)</span>
            </div>

            <div>
              <ImageUploader
                name="photo_url"
                label="শিক্ষার্থীর প্রোফাইল ছবি"
                subLabel="পাসপোর্ট বা স্কয়ার সাইজ ছবি আপলোড করুন (স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড হয়ে ডিজিটাল আইডি কার্ডে দৃশ্যমান হবে)"
                type="general"
                aspectRatio="portrait"
                placeholder="উদা: https://iili.io/xyz.png অথবা https://files.catbox.moe/abc.jpg"
              />
            </div>
          </div>

          {/* ========================================================
              SECTION 8: অভিভাবক পোর্টাল লগইন অ্যাকাউন্ট (ঐচ্ছিক)
          ======================================================== */}
          <div className="space-y-4 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-900 font-bold text-base">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>৮. অভিভাবক পোর্টাল লগইন একাউন্ট (ঐচ্ছিক)</span>
            </div>

            <p className="text-xs text-slate-500">
              অভিভাবক যদি নিজে লগইন করে হাজিরা, ফলাফল ও ফি দেখতে চান তবে ইমেইল ও পাসওয়ার্ড প্রদান করুন
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="parent_email" className="text-xs font-semibold text-slate-700">
                  অভিভাবকের ইমেইল (লগইন ইউজারনেম)
                </label>
                <input
                  type="email"
                  id="parent_email"
                  name="parent_email"
                  placeholder="parent@example.com"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  পোর্টাল পাসওয়ার্ড
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  className="w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-200">
            <Link
              href="/dashboard/students"
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              বাতিল করুন
            </Link>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center px-8 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>সংরক্ষণ হচ্ছে...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>শিক্ষার্থী সংরক্ষণ ও নিবন্ধন সম্পন্ন করুন</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
