"use client";

import { useActionState, useEffect, useState } from "react";
import { updateStudent } from "@/app/actions/students";
import { useRouter } from "next/navigation";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";
import ImageUploader from "@/components/ImageUploader";
import { 
  User, 
  Home, 
  Utensils, 
  Users, 
  HeartPulse, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

const initialState: { error?: string; success?: boolean } = {};

interface EditStudentFormProps {
  student: any;
  classes: any[];
  allStudents: any[];
}

export default function EditStudentForm({
  student,
  classes,
  allStudents,
}: EditStudentFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateStudent,
    initialState
  );
  const router = useRouter();

  // Controlled states for residential and boarding synchronization
  const initialResidential = student.residential_status || "অনাবাসিক";
  const [residentialStatus, setResidentialStatus] = useState<string>(initialResidential);

  const initialIsBoarding = student.is_boarding !== undefined 
    ? Boolean(student.is_boarding) 
    : (initialResidential === "আবাসিক");
  const [isBoarding, setIsBoarding] = useState<boolean>(initialIsBoarding);

  const [boardingType, setBoardingType] = useState<string>(
    student.boarding_type || (initialIsBoarding ? "সাধারণ পেইং" : "অনাবাসিক")
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/students");
      router.refresh();
    }
  }, [state, router]);

  const handleResidentialChange = (newVal: string) => {
    setResidentialStatus(newVal);
    if (newVal === "আবাসিক") {
      setIsBoarding(true);
      if (boardingType === "অনাবাসিক") {
        setBoardingType("সাধারণ পেইং");
      }
    } else if (newVal === "অনাবাসিক") {
      setIsBoarding(false);
      setBoardingType("অনাবাসিক");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">শিক্ষার্থী প্রোফাইল সম্পাদন</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ছাত্রের সমস্ত প্রাতিষ্ঠানিক, আবাসিক, বোর্ডিং ও পারিবারিক তথ্য নির্ভুলভাবে আপডেট করুন
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">আইডি নম্বর</p>
            <p className="text-base font-bold text-blue-700 font-mono">
              {convertToBanglaNumber(getStudentIdNumber(student, allStudents))}
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
            Auto ID
          </span>
        </div>
      </div>

      <form action={formAction} className="p-6 md:p-8 space-y-8">
        <input type="hidden" name="id" value={student.id} />
        {/* Hidden inputs to guarantee state synchronization */}
        <input type="hidden" name="residential_status" value={residentialStatus} />
        <input type="hidden" name="is_boarding" value={isBoarding ? "true" : "false"} />
        <input type="hidden" name="boarding_type" value={boardingType} />

        {state?.error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        {/* ========================================================
            SECTION 1: একাডেমিক ও মৌলিক তথ্য
        ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-semibold text-base">
            <User className="w-5 h-5 text-indigo-600" />
            <span>১. মৌলিক ও একাডেমিক তথ্য</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="first_name" className="text-xs font-semibold text-slate-700">
                প্রথম নাম <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                required
                defaultValue={student.first_name || ""}
                placeholder="যেমন: মুহাম্মদ"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="last_name" className="text-xs font-semibold text-slate-700">
                শেষ নাম / পদবী <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                required
                defaultValue={student.last_name || ""}
                placeholder="যেমন: আব্দুল্লাহ"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.class_id || ""}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
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
              <label htmlFor="roll_number" className="text-xs font-semibold text-slate-700">
                শ্রেণি রোল নম্বর
              </label>
              <input
                type="text"
                id="roll_number"
                name="roll_number"
                defaultValue={student.roll_number || ""}
                placeholder="যেমন: ১২"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="student_status" className="text-xs font-semibold text-slate-700">
                শিক্ষার্থীর বর্তমান স্ট্যাটাস
              </label>
              <select
                id="student_status"
                name="student_status"
                defaultValue={student.student_status || "ACTIVE"}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
              >
                <option value="ACTIVE">নিয়মিত শিক্ষার্থী (Active)</option>
                <option value="IRREGULAR">অনিয়মিত (Irregular)</option>
                <option value="GRADUATED">ফারিগ / সমাপনকারী (Graduated)</option>
                <option value="DROPOUT">ছাড়পত্রপ্রাপ্ত / স্থগিত (Transferred/Dropout)</option>
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
                defaultValue={student.previous_madrasa || ""}
                placeholder="যেমন: জামিয়া ইসলামিয়া ঢাকা"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 2: আবাসিক ও বোর্ডিং ম্যানেজমেন্ট তথ্য (User Requested Highlight!)
        ======================================================== */}
        <div className="space-y-4 bg-amber-50/50 p-5 rounded-xl border border-amber-200/80">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
              <Home className="w-5 h-5 text-amber-600" />
              <span>২. আবাসিক ও বোর্ডিং ব্যবস্থাপনা তথ্য (Residential & Boarding)</span>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              {residentialStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* আবাসিক ধরন */}
            <div className="space-y-1.5">
              <label htmlFor="residential_status_select" className="text-xs font-semibold text-slate-800">
                আবাসিক অবস্থান (Residential Status) <span className="text-red-500">*</span>
              </label>
              <select
                id="residential_status_select"
                value={residentialStatus}
                onChange={(e) => handleResidentialChange(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white font-medium text-slate-800"
              >
                <option value="অনাবাসিক">অনাবাসিক (Non-Residential)</option>
                <option value="আবাসিক">আবাসিক (Residential / Hostel)</option>
                <option value="ডে-কেয়ার">ডে-কেয়ার (Day Care)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                আবাসিক নির্বাচন করলে বোর্ডিং ও মিল সুবিধা সক্রিয় হবে
              </p>
            </div>

            {/* বোর্ডিং সুবিধা চালু / বন্ধ */}
            <div className="space-y-1.5">
              <label htmlFor="is_boarding_select" className="text-xs font-semibold text-slate-800">
                বোর্ডিং ও মিল সুবিধা (Boarding/Meals)
              </label>
              <select
                id="is_boarding_select"
                value={isBoarding ? "true" : "false"}
                onChange={(e) => {
                  const val = e.target.value === "true";
                  setIsBoarding(val);
                  if (!val) setBoardingType("অনাবাসিক");
                  else if (boardingType === "অনাবাসিক") setBoardingType("সাধারণ পেইং");
                }}
                className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white font-semibold ${
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
              <label htmlFor="boarding_type_select" className="text-xs font-semibold text-slate-800">
                বোর্ডিং ক্যাটাগরি (Boarding Type)
              </label>
              <select
                id="boarding_type_select"
                value={boardingType}
                onChange={(e) => setBoardingType(e.target.value)}
                disabled={!isBoarding}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white disabled:bg-slate-100 disabled:text-slate-400 font-medium"
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
                defaultValue={student.room_no || ""}
                placeholder="যেমন: দারুল উলূম - ১০৫"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white"
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
                defaultValue={student.seat_no || ""}
                placeholder="যেমন: সিট নং-৩"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition bg-white"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-orange-600 shrink-0" />
                <span>
                  {isBoarding 
                    ? "এই ছাত্রের জন্য দৈনিক মিল ট্র্যাকিং স্বয়ংক্রিয়ভাবে সক্রিয় রয়েছে।" 
                    : "এই ছাত্র দৈনিক মিল ট্র্যাকিংয়ে অনাবাসিক হিসেবে থাকবে।"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 3: অভিভাবক ও পারিবারিক বিবরণ
        ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-semibold text-base">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>৩. পিতা, মাতা ও অভিভাবকের বিবরণ</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="father_name" className="text-xs font-semibold text-slate-700">
                পিতার নাম
              </label>
              <input
                type="text"
                id="father_name"
                name="father_name"
                defaultValue={student.father_name || ""}
                placeholder="পিতার নাম লিখুন"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.mother_name || ""}
                placeholder="মাতার নাম লিখুন"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.parent_phone || ""}
                placeholder="017XXXXXXXX"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.guardian_name || ""}
                placeholder="অভিভাবকের নাম"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.guardian_relation || ""}
                placeholder="যেমন: পিতা / চাচা / বড় ভাই"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.emergency_contact || ""}
                placeholder="বিকল্প ফোন নম্বর"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 4: ব্যক্তিগত ও স্বাস্থ্য বিবরণ
        ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-semibold text-base">
            <HeartPulse className="w-5 h-5 text-indigo-600" />
            <span>৪. ব্যক্তিগত ও স্বাস্থ্য বিবরণ</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="blood_group" className="text-xs font-semibold text-slate-700">
                রক্তের গ্রুপ (Blood Group)
              </label>
              <select
                id="blood_group"
                name="blood_group"
                defaultValue={student.blood_group || ""}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
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
                defaultValue={student.date_of_birth || ""}
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.nid_or_birth_cert || ""}
                placeholder="১৭ ডিজিটের জন্ম নিবন্ধন নং"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.medical_notes || ""}
                placeholder="যেমন: ধুলাবালিতে শ্বাসকষ্ট আছে বা চিংড়ি মাছে অ্যালার্জি"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 5: ঠিকানা ও অন্যান্য তথ্য
        ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-semibold text-base">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <span>৫. ঠিকানা ও মন্তব্য</span>
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
                defaultValue={student.address || ""}
                placeholder="গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
                defaultValue={student.remarks || ""}
                placeholder="শিক্ষার্থী সম্পর্কিত বিশেষ কোনো নির্দেশনা বা নোট"
                className="w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 6: ছবি আপলোড (ডিজিটাল আইডি কার্ড ও নথির জন্য)
        ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b text-slate-900 font-semibold text-base">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>৬. শিক্ষার্থীর ছবি (ডিজিটাল আইডি কার্ড ও নথিপত্রের জন্য)</span>
          </div>

          <div>
            <ImageUploader
              name="photo_url"
              label="শিক্ষার্থীর প্রোফাইল ছবি"
              subLabel="পাসপোর্ট বা স্কয়ার সাইজ ছবি আপলোড করুন (স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড হয়ে ডিজিটাল আইডি কার্ডে দৃশ্যমান হবে)"
              defaultValue={student.photo_url || ""}
              type="general"
              aspectRatio="portrait"
              placeholder="উদা: https://iili.io/xyz.png অথবা https://files.catbox.moe/abc.jpg"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            বাতিল করুন
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center px-7 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>আপডেট হচ্ছে...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>সমস্ত তথ্য আপডেট ও সেভ করুন</span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
