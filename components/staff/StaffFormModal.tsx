"use client";

import React, { useState } from "react";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  DEFAULT_STAFF_CATEGORIES,
  DEFAULT_STAFF_DEPARTMENTS,
  DEFAULT_STAFF_DESIGNATIONS,
  DEFAULT_RESPONSIBILITIES,
  EMPLOYMENT_TYPE_LABELS,
  STAFF_STATUS_LABELS,
  EmploymentType,
  StaffStatus,
} from "@/lib/staff-management";
import { createStaffMember, updateStaffMember } from "@/app/actions/staff";
import { X, UserPlus, Save, CheckCircle2, AlertCircle, Building2, Briefcase, Phone, Mail, DollarSign, Shield, BookOpen, Layers } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";

interface StaffFormModalProps {
  staff?: StaffMember | null;
  categories?: StaffCategory[];
  departments?: StaffDepartment[];
  designations?: StaffDesignation[];
  onClose: () => void;
  onSuccess: (savedStaffId?: string) => void;
}

export default function StaffFormModal({
  staff,
  categories = DEFAULT_STAFF_CATEGORIES,
  departments = DEFAULT_STAFF_DEPARTMENTS,
  designations = DEFAULT_STAFF_DESIGNATIONS,
  onClose,
  onSuccess,
}: StaffFormModalProps) {
  const isEditing = Boolean(staff);

  const [activeTab, setActiveTab] = useState<"personal" | "contact" | "employment" | "academic" | "salary" | "account">("personal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Personal Info Form State
  const [firstName, setFirstName] = useState(staff?.personal.first_name || "");
  const [lastName, setLastName] = useState(staff?.personal.last_name || "");
  const [fullNameBn, setFullNameBn] = useState(staff?.personal.full_name_bn || "");
  const [fullNameEn, setFullNameEn] = useState(staff?.personal.full_name_en || "");
  const [fullNameAr, setFullNameAr] = useState(staff?.personal.full_name_ar || "");
  const [photoUrl, setPhotoUrl] = useState(staff?.personal.photo_url || "");
  const [fatherName, setFatherName] = useState(staff?.personal.father_name || "");
  const [motherName, setMotherName] = useState(staff?.personal.mother_name || "");
  const [spouseName, setSpouseName] = useState(staff?.personal.spouse_name || "");
  const [dob, setDob] = useState(staff?.personal.date_of_birth || "");
  const [gender, setGender] = useState<"MALE" | "FEMALE">(staff?.personal.gender || "MALE");
  const [bloodGroup, setBloodGroup] = useState(staff?.personal.blood_group || "");
  const [nationality, setNationality] = useState(staff?.personal.nationality || "বাংলাদেশী");
  const [nidNumber, setNidNumber] = useState(staff?.personal.nid_number || "");
  const [maritalStatus, setMaritalStatus] = useState<"MARRIED" | "UNMARRIED" | "OTHER">(staff?.personal.marital_status || "MARRIED");

  // Contact Info Form State
  const [phone, setPhone] = useState(staff?.contact.phone || "");
  const [altPhone, setAltPhone] = useState(staff?.contact.alt_phone || "");
  const [email, setEmail] = useState(staff?.contact.email || "");
  const [presentAddress, setPresentAddress] = useState(staff?.contact.present_address || "");
  const [permanentAddress, setPermanentAddress] = useState(staff?.contact.permanent_address || "");
  const [emergencyContactName, setEmergencyContactName] = useState(staff?.contact.emergency_contact_name || "");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(staff?.contact.emergency_contact_relation || "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(staff?.contact.emergency_contact_phone || "");

  // Employment Info Form State
  const [categoryId, setCategoryId] = useState(staff?.employment.category_id || "cat-teaching");
  const [departmentId, setDepartmentId] = useState(staff?.employment.department_id || "dept-academic");
  const [designation, setDesignation] = useState(staff?.employment.designation || "সহকারী শিক্ষক (মুদাররিস)");
  const [joiningDate, setJoiningDate] = useState(staff?.employment.joining_date || new Date().toISOString().split("T")[0]);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(staff?.employment.employment_type || "FULL_TIME");
  const [status, setStatus] = useState<StaffStatus>(staff?.employment.status || "ACTIVE");
  const [reportingToName, setReportingToName] = useState(staff?.employment.reporting_to_name || "মুহতামিম সাহেব");
  const [responsibilities, setResponsibilities] = useState<string[]>(staff?.responsibilities || ["ক্লাস পাঠদান"]);

  // Academic Info Form State
  const [highestQualification, setHighestQualification] = useState(staff?.academic?.highest_qualification || "দাওরায়ে হাদিস (মাস্টার্স সমমান)");
  const [madrasaOrUni, setMadrasaOrUni] = useState(staff?.academic?.madrasa_or_university || "দারুল উলুম দেওবন্দ / বেফাকুল মাদারিস");
  const [degreeOrSanad, setDegreeOrSanad] = useState(staff?.academic?.degree_or_sanad || "মুমতাজ (প্রথম বিভাগ)");
  const [specialization, setSpecialization] = useState(staff?.academic?.specialization || "ফিকহ ও হাদিস");
  const [hifzCompleted, setHifzCompleted] = useState<boolean>(staff?.academic?.hifz_completed || false);
  const [qiraatDegree, setQiraatDegree] = useState(staff?.academic?.qiraat_degree || "");
  const [arabicQualification, setArabicQualification] = useState(staff?.academic?.arabic_qualification || "উচ্চতর আরবি সাহিত্য (আদব)");
  const [experienceYears, setExperienceYears] = useState<number>(staff?.academic?.teaching_experience_years || 3);
  const [previousInstitution, setPreviousInstitution] = useState(staff?.academic?.previous_institution || "");

  // Salary Form State
  const [basicSalary, setBasicSalary] = useState<number>(staff?.salary.basic_salary || 15000);
  const [allowanceHousing, setAllowanceHousing] = useState<number>(staff?.salary.allowances?.housing || 0);
  const [allowanceFood, setAllowanceFood] = useState<number>(staff?.salary.allowances?.food || 0);
  const [allowanceTransport, setAllowanceTransport] = useState<number>(staff?.salary.allowances?.transport || 0);
  const [allowanceMedical, setAllowanceMedical] = useState<number>(staff?.salary.allowances?.medical || 0);
  const [allowanceOther, setAllowanceOther] = useState<number>(staff?.salary.allowances?.other || 0);

  const [deductionAdvance, setDeductionAdvance] = useState<number>(staff?.salary.deductions?.advance || 0);
  const [deductionLoan, setDeductionLoan] = useState<number>(staff?.salary.deductions?.loan || 0);
  const [deductionAbsence, setDeductionAbsence] = useState<number>(staff?.salary.deductions?.absence || 0);
  const [deductionOther, setDeductionOther] = useState<number>(staff?.salary.deductions?.other || 0);

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "BKASH" | "NAGAD" | "OTHER">(staff?.salary.payment_method || "CASH");
  const [bankAccountNo, setBankAccountNo] = useState(staff?.salary.bank_account_no || "");
  const [bankName, setBankName] = useState(staff?.salary.bank_name || "");

  // Account creation for new staff
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRole, setAccountRole] = useState<"teacher" | "admin" | "staff">("teacher");

  // Filtered designations by selected category
  const filteredDesignations = designations.filter((d) => !d.category_id || d.category_id === categoryId);

  // Net salary calculation
  const totalAllowances = Number(allowanceHousing) + Number(allowanceFood) + Number(allowanceTransport) + Number(allowanceMedical) + Number(allowanceOther);
  const totalDeductions = Number(deductionAdvance) + Number(deductionLoan) + Number(deductionAbsence) + Number(deductionOther);
  const calculatedNetSalary = Number(basicSalary) + totalAllowances - totalDeductions;

  const toggleResponsibility = (item: string) => {
    if (responsibilities.includes(item)) {
      setResponsibilities(responsibilities.filter((r) => r !== item));
    } else {
      setResponsibilities([...responsibilities, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!firstName.trim()) {
      setErrorMessage("দয়া করে প্রথম নাম প্রদান করুন।");
      setActiveTab("personal");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && staff) {
        const updateRes = await updateStaffMember(staff.id, {
          personal: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name_bn: fullNameBn.trim() || `${firstName} ${lastName}`.trim(),
            full_name_en: fullNameEn.trim(),
            full_name_ar: fullNameAr.trim(),
            photo_url: photoUrl,
            father_name: fatherName.trim(),
            mother_name: motherName.trim(),
            spouse_name: spouseName.trim(),
            date_of_birth: dob,
            gender,
            blood_group: bloodGroup,
            nationality,
            nid_number: nidNumber.trim(),
            marital_status: maritalStatus,
          },
          contact: {
            phone: phone.trim(),
            alt_phone: altPhone.trim(),
            email: email.trim(),
            present_address: presentAddress.trim(),
            permanent_address: permanentAddress.trim(),
            emergency_contact_name: emergencyContactName.trim(),
            emergency_contact_relation: emergencyContactRelation.trim(),
            emergency_contact_phone: emergencyContactPhone.trim(),
          },
          employment: {
            ...staff.employment,
            category_id: categoryId,
            category_name: categories.find((c) => c.id === categoryId)?.name || "সাধারণ",
            department_id: departmentId,
            department_name: departments.find((d) => d.id === departmentId)?.name || "একাডেমিক",
            designation: designation.trim(),
            joining_date: joiningDate,
            employment_type: employmentType,
            status,
            reporting_to_name: reportingToName.trim(),
          },
          academic: {
            highest_qualification: highestQualification,
            madrasa_or_university: madrasaOrUni,
            degree_or_sanad: degreeOrSanad,
            specialization,
            hifz_completed: hifzCompleted,
            qiraat_degree: qiraatDegree,
            arabic_qualification: arabicQualification,
            teaching_experience_years: Number(experienceYears),
            previous_institution: previousInstitution,
          },
          responsibilities,
          salary: {
            basic_salary: Number(basicSalary),
            allowances: {
              housing: Number(allowanceHousing),
              food: Number(allowanceFood),
              transport: Number(allowanceTransport),
              medical: Number(allowanceMedical),
              other: Number(allowanceOther),
            },
            deductions: {
              advance: Number(deductionAdvance),
              loan: Number(deductionLoan),
              absence: Number(deductionAbsence),
              other: Number(deductionOther),
            },
            net_salary: calculatedNetSalary,
            payment_method: paymentMethod,
            bank_account_no: bankAccountNo,
            bank_name: bankName,
          },
        });

        if (updateRes.error) {
          setErrorMessage(updateRes.error);
        } else {
          onSuccess(staff.id);
        }
      } else {
        const createRes = await createStaffMember({
          personal: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name_bn: fullNameBn.trim() || `${firstName} ${lastName}`.trim(),
            full_name_en: fullNameEn.trim(),
            full_name_ar: fullNameAr.trim(),
            photo_url: photoUrl,
            father_name: fatherName.trim(),
            mother_name: motherName.trim(),
            spouse_name: spouseName.trim(),
            date_of_birth: dob,
            gender,
            blood_group: bloodGroup,
            nationality,
            nid_number: nidNumber.trim(),
            marital_status: maritalStatus,
          },
          contact: {
            phone: phone.trim(),
            alt_phone: altPhone.trim(),
            email: email.trim(),
            present_address: presentAddress.trim(),
            permanent_address: permanentAddress.trim(),
            emergency_contact_name: emergencyContactName.trim(),
            emergency_contact_relation: emergencyContactRelation.trim(),
            emergency_contact_phone: emergencyContactPhone.trim(),
          },
          employment: {
            category_id: categoryId,
            department_id: departmentId,
            designation: designation.trim(),
            joining_date: joiningDate,
            employment_type: employmentType,
            status,
            reporting_to_name: reportingToName.trim(),
          },
          academic: {
            highest_qualification: highestQualification,
            madrasa_or_university: madrasaOrUni,
            degree_or_sanad: degreeOrSanad,
            specialization,
            hifz_completed: hifzCompleted,
            qiraat_degree: qiraatDegree,
            arabic_qualification: arabicQualification,
            teaching_experience_years: Number(experienceYears),
            previous_institution: previousInstitution,
          },
          responsibilities,
          salary: {
            basic_salary: Number(basicSalary),
            allowances: {
              housing: Number(allowanceHousing),
              food: Number(allowanceFood),
              transport: Number(allowanceTransport),
              medical: Number(allowanceMedical),
              other: Number(allowanceOther),
            },
            deductions: {
              advance: Number(deductionAdvance),
              loan: Number(deductionLoan),
              absence: Number(deductionAbsence),
              other: Number(deductionOther),
            },
            net_salary: calculatedNetSalary,
            payment_method: paymentMethod,
            bank_account_no: bankAccountNo,
            bank_name: bankName,
          },
          account: createLoginAccount
            ? {
                create_login: true,
                email: accountEmail || email,
                password: accountPassword,
                role: accountRole,
              }
            : undefined,
        });

        if (createRes.error) {
          setErrorMessage(createRes.error);
        } else {
          onSuccess(createRes.staffId);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              {isEditing ? <Briefcase className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isEditing ? "স্টাফ তথ্য সম্পাদনা করুন" : "নতুন স্টাফ / শিক্ষক নিবন্ধন"}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? `${staff?.personal.first_name} ${staff?.personal.last_name || ""} (${staff?.staff_id_code})` : "মাদ্রাসার শিক্ষক বা কর্মচারীর পূর্ণাঙ্গ বিবরণ যুক্ত করুন"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-slate-50/40 overflow-x-auto text-xs font-semibold py-2">
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === "personal" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            ১. ব্যক্তিগত তথ্য
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contact")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === "contact" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            ২. যোগাযোগ ও ঠিকানা
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("employment")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === "employment" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            ৩. কর্মসংস্থান ও দায়িত্ব
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("academic")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === "academic" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            ৪. যোগ্যতা ও সনদ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("salary")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === "salary" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            ৫. বেতন কাঠামো
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                activeTab === "account" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              ৬. লগইন অ্যাকাউন্ট
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: PERSONAL INFO */}
          {activeTab === "personal" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="shrink-0">
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-500 overflow-hidden bg-white shadow-xs flex items-center justify-center text-slate-400 font-bold text-xl">
                    {photoUrl ? <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" /> : <span>ছবি</span>}
                  </div>
                </div>
                <div className="flex-1 w-full space-y-1">
                  <label className="text-xs font-semibold text-slate-700">প্রোফাইল ছবি (Photo URL / লিঙ্ক)</label>
                  <input
                    type="text"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://... অথবা ইমেজ লিঙ্ক দিন"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500">আইডি কার্ড ও প্রোফাইলে প্রদর্শনের জন্য পাসপোর্ট সাইজ ছবি ব্যবহার করুন।</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    প্রথম নাম (First Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="উদা: মাহমুদ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">শেষ নাম (Last Name)</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="উদা: হাসান"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">পূর্ণ নাম (বাংলায়)</label>
                  <input
                    type="text"
                    value={fullNameBn}
                    onChange={(e) => setFullNameBn(e.target.value)}
                    placeholder="উদা: মাওলানা মাহমুদ হাসান"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">পূর্ণ নাম (ইংরেজিতে)</label>
                  <input
                    type="text"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    placeholder="e.g. Mahmud Hasan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">নাম (আরবিতে - ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={fullNameAr}
                    onChange={(e) => setFullNameAr(e.target.value)}
                    placeholder="الشيخ محمود حسن"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-serif"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">পিতার নাম</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="পিতার নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">মাতার নাম</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="মাতার নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">স্ত্রী / স্বামীর নাম</label>
                  <input
                    type="text"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="স্ত্রী/স্বামীর নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">জন্ম তারিখ</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">লিঙ্গ (Gender)</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="MALE">পুরুষ (Male)</option>
                    <option value="FEMALE">মহিলা (Female)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">রক্তের গ্রুপ</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                  <label className="font-semibold text-slate-700 block mb-1">জাতীয় পরিচয়পত্র / পাসপোর্ট নং</label>
                  <input
                    type="text"
                    value={nidNumber}
                    onChange={(e) => setNidNumber(e.target.value)}
                    placeholder="NID নম্বর"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বৈবাহিক অবস্থা</label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="MARRIED">বিবাহিত (Married)</option>
                    <option value="UNMARRIED">অবিবাহিত (Unmarried)</option>
                    <option value="OTHER">অন্যান্য (Other)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT & ADDRESS */}
          {activeTab === "contact" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="০১৭xxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বিকল্প ফোন নম্বর</label>
                  <input
                    type="tel"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="০১৮xxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ইমেইল ঠিকানা</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বর্তমান ঠিকানা</label>
                  <textarea
                    rows={2}
                    value={presentAddress}
                    onChange={(e) => setPresentAddress(e.target.value)}
                    placeholder="বাসা নং, রোড, থানা, জেলা..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">স্থায়ী ঠিকানা</label>
                  <textarea
                    rows={2}
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="গ্রাম, ডাকঘর, থানা, জেলা..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200/80 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 text-rose-900">
                  <Phone className="w-3.5 h-3.5" />
                  <span>জরুরি যোগাযোগ (Emergency Contact)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">যোগাযোগকারীর নাম</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="নাম"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">সম্পর্ক</label>
                    <input
                      type="text"
                      value={emergencyContactRelation}
                      onChange={(e) => setEmergencyContactRelation(e.target.value)}
                      placeholder="উদা: ভাই / পিতা / চাচা"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">জরুরি ফোন নম্বর</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="ফোন নম্বর"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EMPLOYMENT & RESPONSIBILITIES */}
          {activeTab === "employment" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">স্টাফ ক্যাটাগরি</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বিভাগ (Department)</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    পদবী (Designation) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="উদা: সিনিয়র শিক্ষক / সহকারী মুদাররিস"
                    list="designations-list"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <datalist id="designations-list">
                    {filteredDesignations.map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">যোগদানের তারিখ</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">চাকরির ধরন</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বর্তমান স্ট্যাটাস</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StaffStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {Object.entries(STAFF_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="font-semibold text-slate-700 block mb-1">রিপোর্টিং ম্যানেজার / দায়িত্বশীল</label>
                  <input
                    type="text"
                    value={reportingToName}
                    onChange={(e) => setReportingToName(e.target.value)}
                    placeholder="উদা: মুহতামিম সাহেব / শিক্ষা পরিচালক"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Responsibilities Checklist */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>অতিরিক্ত দায়িত্ব ও দায়িত্বপ্রাপ্তি (Assigned Roles)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {DEFAULT_RESPONSIBILITIES.map((resp) => {
                    const isChecked = responsibilities.includes(resp);
                    return (
                      <label
                        key={resp}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition cursor-pointer text-[11px] ${
                          isChecked ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleResponsibility(resp)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{resp}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACADEMIC & QUALIFICATIONS */}
          {activeTab === "academic" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">সর্বোচ্চ শিক্ষাগত যোগ্যতা</label>
                  <input
                    type="text"
                    value={highestQualification}
                    onChange={(e) => setHighestQualification(e.target.value)}
                    placeholder="উদা: দাওরায়ে হাদিস / কামিল / অনার্স"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">মাদ্রাসা / বিশ্ববিদ্যালয় / বোর্ড</label>
                  <input
                    type="text"
                    value={madrasaOrUni}
                    onChange={(e) => setMadrasaOrUni(e.target.value)}
                    placeholder="উদা: বেফাকুল মাদারিস / আল-হাইআতুল উলয়া"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">সনদ / প্রাপ্ত বিভাগ (Result/Grade)</label>
                  <input
                    type="text"
                    value={degreeOrSanad}
                    onChange={(e) => setDegreeOrSanad(e.target.value)}
                    placeholder="উদা: মুমতাজ (প্রথম বিভাগ)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">বিশেষত্ব (Specialization)</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="উদা: হাদিস, ফিকহ, তাফসির, তাজবিদ, আরবি সাহিত্য"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">হিফজুল কুরআন সম্পন্ন?</label>
                  <select
                    value={hifzCompleted ? "yes" : "no"}
                    onChange={(e) => setHifzCompleted(e.target.value === "yes")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="no">না (সাধারণ)</option>
                    <option value="yes">হ্যাঁ (হাফেজে কুরআন)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ক্বিরাআত ও তাজবীদ সনদ</label>
                  <input
                    type="text"
                    value={qiraatDegree}
                    onChange={(e) => setQiraatDegree(e.target.value)}
                    placeholder="উদা: হাফস, সাব'আহ ক্বিরাআত"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">আরবি ভাষা ও সাহিত্যের দক্ষতা</label>
                  <input
                    type="text"
                    value={arabicQualification}
                    onChange={(e) => setArabicQualification(e.target.value)}
                    placeholder="উদা: আদব ডিপ্লোমা / মারকাযুদ্দাওয়াহ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">অভিজ্ঞতার বছর (Years of Exp)</label>
                  <input
                    type="number"
                    min={0}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">পূর্ববর্তী প্রতিষ্ঠান (Previous Inst)</label>
                  <input
                    type="text"
                    value={previousInstitution}
                    onChange={(e) => setPreviousInstitution(e.target.value)}
                    placeholder="পূর্বের মাদ্রাসার নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SALARY STRUCTURE */}
          {activeTab === "salary" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Allowances Section */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between text-emerald-900">
                    <span>মূল বেতন ও ভাতাদি (Basic & Allowances)</span>
                    <span className="text-[11px] font-mono">৳{(Number(basicSalary) + totalAllowances).toLocaleString("bn-BD")}</span>
                  </h4>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">মূল বেতন (Basic Salary ৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={basicSalary}
                      onChange={(e) => setBasicSalary(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 block mb-1">বাড়ি ভাড়া ভাতা (৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={allowanceHousing}
                        onChange={(e) => setAllowanceHousing(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">খাবার ভাতা (৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={allowanceFood}
                        onChange={(e) => setAllowanceFood(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">যাতায়াত ভাতা (৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={allowanceTransport}
                        onChange={(e) => setAllowanceTransport(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">চিকিৎসা ও অন্যান্য (৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={allowanceMedical}
                        onChange={(e) => setAllowanceMedical(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200/80 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between text-rose-900">
                    <span>কর্তনসমূহ (Deductions)</span>
                    <span className="text-[11px] font-mono">৳{totalDeductions.toLocaleString("bn-BD")}</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-slate-600 block mb-1">অগ্রিম গ্রহণ (Advance ৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={deductionAdvance}
                        onChange={(e) => setDeductionAdvance(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">ঋণ কিস্তি (Loan ৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={deductionLoan}
                        onChange={(e) => setDeductionLoan(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">অনুপস্থিতি কর্তন (Absence ৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={deductionAbsence}
                        onChange={(e) => setDeductionAbsence(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">অন্যান্য কর্তন (৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={deductionOther}
                        onChange={(e) => setDeductionOther(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Salary Highlight Card */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-300">সর্বমোট প্রদেয় নেট বেতন (Net Payable Salary):</span>
                  <h3 className="text-2xl font-bold text-emerald-400">
                    ৳{calculatedNetSalary.toLocaleString("bn-BD")}
                  </h3>
                </div>
                <div className="text-xs text-slate-300 text-right">
                  মূল বেতন (৳{basicSalary}) + মোট ভাতা (৳{totalAllowances}) - মোট কর্তন (৳{totalDeductions})
                </div>
              </div>

              {/* Payment Method & Bank Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">পরিশোধের মাধ্যম</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="CASH">নগদ (Cash)</option>
                    <option value="BANK">ব্যাংক ট্রান্সফার (Bank Transfer)</option>
                    <option value="BKASH">বিকাশ (bKash)</option>
                    <option value="NAGAD">নগদ (Nagad)</option>
                    <option value="OTHER">অন্যান্য</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ব্যাংক নাম / মোবাইল ব্যাংকিং নাম</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="উদা: ইসলামী ব্যাংক বাংলাদেশ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">অ্যাকাউন্ট নং / ওয়ালেট নম্বর</label>
                  <input
                    type="text"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    placeholder="হিসাব নম্বর"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LOGIN ACCOUNT (Only on create) */}
          {!isEditing && activeTab === "account" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createLoginCheckbox"
                    checked={createLoginAccount}
                    onChange={(e) => setCreateLoginAccount(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="createLoginCheckbox" className="font-bold text-slate-800 text-xs cursor-pointer">
                    এই কর্মীর জন্য সিস্টেম পোর্টাল লগইন অ্যাকাউন্ট তৈরি করুন
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 pl-6">
                  লগইন সক্রিয় করলে এই শিক্ষক/স্টাফ তাদের ইমেইল ও পাসওয়ার্ড দিয়ে হাজিরা, ক্লাস ও পোর্টাল ব্যবহার করতে পারবেন।
                </p>

                {createLoginAccount && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 pl-6">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">লগইন ইমেইল</label>
                      <input
                        type="email"
                        value={accountEmail || email}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        placeholder="staff@qawmi.edu"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">পাসওয়ার্ড</label>
                      <input
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder="কমপক্ষে ৬ অক্ষর"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">পোর্টাল রোল</label>
                      <select
                        value={accountRole}
                        onChange={(e) => setAccountRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="teacher">শিক্ষক (Teacher Portal)</option>
                        <option value="staff">স্টাফ (Staff Access)</option>
                        <option value="admin">সহকারী অ্যাডমিন (Admin Access)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {activeTab === "personal" && "ধাপ ১ / ৫"}
              {activeTab === "contact" && "ধাপ ২ / ৫"}
              {activeTab === "employment" && "ধাপ ৩ / ৫"}
              {activeTab === "academic" && "ধাপ ৪ / ৫"}
              {activeTab === "salary" && "ধাপ ৫ / ৫"}
              {activeTab === "account" && "ধাপ ৬ (ঐচ্ছিক)"}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{isEditing ? "হালনাগাদ সংরক্ষণ করুন" : "কর্মী নিবন্ধন সম্পূর্ণ করুন"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
