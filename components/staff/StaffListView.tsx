"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  STAFF_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/staff-management";
import {
  Search,
  Filter,
  UserPlus,
  QrCode,
  Edit,
  Eye,
  Phone,
  Mail,
  Briefcase,
  Building,
  Calendar,
  Grid,
  List as ListIcon,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
  MoreVertical,
  BookOpen,
} from "lucide-react";
import StaffIdCardModal from "./StaffIdCardModal";
import StaffCertificateGeneratorModal from "./StaffCertificateGeneratorModal";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffListViewProps {
  staffList: StaffMember[];
  categories: StaffCategory[];
  departments: StaffDepartment[];
  designations: StaffDesignation[];
  madrasaInfo?: any;
  madrasaName?: string;
  onSelectStaff: (staffId: string) => void;
  onAddStaff: () => void;
  onEditStaff: (staff: StaffMember) => void;
}

export default function StaffListView({
  staffList,
  categories,
  departments,
  designations,
  madrasaInfo,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
  onSelectStaff,
  onAddStaff,
  onEditStaff,
}: StaffListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Selected ID card modal
  const [idCardStaff, setIdCardStaff] = useState<StaffMember | null>(null);
  const [certStaff, setCertStaff] = useState<StaffMember | null>(null);

  // Counts for teachers vs general staff
  const teacherCount = useMemo(() => {
    return staffList.filter(
      (s) => s.employment.category_id === "cat_teaching" || !s.employment.category_id
    ).length;
  }, [staffList]);
  const nonTeacherCount = Math.max(0, staffList.length - teacherCount);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = `${staff.personal.first_name} ${staff.personal.last_name || ""} ${staff.personal.full_name_bn || ""}`.toLowerCase();
        const code = (staff.staff_id_code || "").toLowerCase();
        const phone = (staff.contact.phone || "").toLowerCase();
        const des = (staff.employment.designation || "").toLowerCase();
        const dept = (staff.employment.department_name || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !phone.includes(q) && !des.includes(q) && !dept.includes(q)) {
          return false;
        }
      }

      // Status
      if (selectedStatus !== "ALL" && staff.employment.status !== selectedStatus) {
        return false;
      }

      // Category
      if (selectedCategory !== "ALL") {
        const isTeaching = staff.employment.category_id === "cat_teaching" || !staff.employment.category_id;
        if (selectedCategory === "TEACHING_ONLY") {
          if (!isTeaching) return false;
        } else if (selectedCategory === "STAFF_ONLY") {
          if (isTeaching) return false;
        } else if (staff.employment.category_id !== selectedCategory) {
          return false;
        }
      }

      // Department
      if (selectedDepartment !== "ALL" && staff.employment.department_id !== selectedDepartment) {
        return false;
      }

      return true;
    });
  }, [staffList, searchQuery, selectedStatus, selectedCategory, selectedDepartment]);

  const handlePrintList = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম, পদবী, আইডি বা ফোন নম্বর দিয়ে খুঁজুন..."
              className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "grid" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="গ্রিড ভিউ"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "table" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="টেবিল ভিউ"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrintList}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200"
              title="তালিকা প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={onAddStaff}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ নতুন স্টাফ যুক্ত করুন</span>
            </button>
          </div>
        </div>

        {/* Quick Segmented Switcher: All vs Teachers vs Staff */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>সকল কর্মী ও শিক্ষক</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${selectedCategory === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {toBanglaNumber(staffList.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("TEACHING_ONLY")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === "TEACHING_ONLY"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>উস্তাদ ও শিক্ষকবৃন্দ</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${selectedCategory === "TEACHING_ONLY" ? "bg-white/20 text-white" : "bg-emerald-200 text-emerald-900"}`}>
              {toBanglaNumber(teacherCount)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("STAFF_ONLY")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === "STAFF_ONLY"
                ? "bg-blue-700 text-white shadow-xs"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>প্রশাসনিক ও সাধারণ স্টাফ</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${selectedCategory === "STAFF_ONLY" ? "bg-white/20 text-white" : "bg-blue-200 text-blue-900"}`}>
              {toBanglaNumber(nonTeacherCount)}
            </span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-500 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>ফিল্টার:</span>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">সকল স্ট্যাটাস ({staffList.length})</option>
            <option value="ACTIVE">সক্রিয়</option>
            <option value="ON_LEAVE">ছুটিতে আছেন</option>
            <option value="INACTIVE">নিষ্ক্রিয়</option>
            <option value="SUSPENDED">স্থগিত</option>
            <option value="RESIGNED">ইস্তফাপ্রাপ্ত</option>
            <option value="TERMINATED">অব্যাহতিপ্রাপ্ত</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">সকল ক্যাটাগরি</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">সকল বিভাগ</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {(selectedStatus !== "ALL" || selectedCategory !== "ALL" || selectedDepartment !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus("ALL");
                setSelectedCategory("ALL");
                setSelectedDepartment("ALL");
                setSearchQuery("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto cursor-pointer"
            >
              ফিল্টার রিসেট
            </button>
          )}
        </div>
      </div>

      {/* Staff Count Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          মোট স্টাফ: <strong className="text-slate-800">{toBanglaNumber(filteredStaff.length)}</strong> জন প্রদর্শিত
        </span>
      </div>

      {/* GRID VIEW */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-2xl text-center border border-slate-200/80 space-y-2">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">কোনো স্টাফ পাওয়া যায়নি</h4>
              <p className="text-xs text-slate-500">আপনার সার্চ বা ফিল্টার শর্ত অনুযায়ী কোনো তথ্য মেলেনি।</p>
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const statusCfg = STAFF_STATUS_LABELS[staff.employment.status] || STAFF_STATUS_LABELS.ACTIVE;

              return (
                <div
                  key={staff.id}
                  className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-emerald-300 transition space-y-4 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header: Photo + Name + Status */}
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl border-2 border-emerald-500 overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-lg shrink-0 shadow-xs">
                        {staff.personal.photo_url ? (
                          <img
                            src={staff.personal.photo_url}
                            alt={staff.personal.first_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{staff.personal.first_name.charAt(0)}</span>
                        )}
                      </div>

                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {staff.staff_id_code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                          >
                            {statusCfg.label.split("(")[0]}
                          </span>
                        </div>

                        <h4
                          onClick={() => onSelectStaff(staff.id)}
                          className="font-bold text-slate-900 text-sm hover:text-emerald-700 transition cursor-pointer line-clamp-1 mt-1"
                        >
                          {staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}
                        </h4>

                        <p className="text-xs font-semibold text-emerald-800 line-clamp-1">
                          {staff.employment.designation}
                        </p>
                      </div>
                    </div>

                    {/* Department & Contact Details */}
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">বিভাগ:</span>
                        <span className="font-medium text-slate-800 line-clamp-1">
                          {staff.employment.department_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">মোবাইল:</span>
                        <span className="font-semibold text-slate-800">{staff.contact.phone || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">বেতন:</span>
                        <span className="font-bold text-emerald-700">
                          ৳{toBanglaNumber(staff.salary.net_salary.toString())}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIdCardStaff(staff)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="ডিজিটাল আইডি কার্ড"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCertStaff(staff)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="সনদ ও নিয়োগপত্র"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditStaff(staff)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="সম্পাদনা"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {(staff.employment.category_id === "cat_teaching" || !staff.employment.category_id) && (
                        <Link
                          href={`/dashboard/teachers/${staff.id}/subjects`}
                          className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                          title="জামাত ও কিতাব/বিষয় বণ্টন"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Link>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectStaff(staff.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>প্রোফাইল</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold">স্টাফ তথ্য</th>
                  <th className="py-3.5 px-4 font-bold">স্টাফ আইডি</th>
                  <th className="py-3.5 px-4 font-bold">পদবী ও বিভাগ</th>
                  <th className="py-3.5 px-4 font-bold">মোবাইল নম্বর</th>
                  <th className="py-3.5 px-4 font-bold">যোগদানের তারিখ</th>
                  <th className="py-3.5 px-4 font-bold">মাসিক বেতন</th>
                  <th className="py-3.5 px-4 font-bold">স্ট্যাটাস</th>
                  <th className="py-3.5 px-4 font-bold text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      কোনো স্টাফ তথ্য পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const statusCfg = STAFF_STATUS_LABELS[staff.employment.status] || STAFF_STATUS_LABELS.ACTIVE;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl border border-emerald-400 overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold shrink-0">
                              {staff.personal.photo_url ? (
                                <img
                                  src={staff.personal.photo_url}
                                  alt={staff.personal.first_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{staff.personal.first_name.charAt(0)}</span>
                              )}
                            </div>
                            <div>
                              <span
                                onClick={() => onSelectStaff(staff.id)}
                                className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer block"
                              >
                                {staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}
                              </span>
                              <span className="text-[11px] text-slate-400 block">{staff.personal.full_name_en}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-600">
                          {staff.staff_id_code}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-emerald-900 block">{staff.employment.designation}</span>
                          <span className="text-[11px] text-slate-500 block">{staff.employment.department_name}</span>
                        </td>

                        <td className="py-3 px-4 font-medium">{staff.contact.phone || "—"}</td>

                        <td className="py-3 px-4">{toBanglaNumber(staff.employment.joining_date)}</td>

                        <td className="py-3 px-4 font-bold text-emerald-700">
                          ৳{toBanglaNumber(staff.salary.net_salary.toString())}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                          >
                            {statusCfg.label.split("(")[0]}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setIdCardStaff(staff)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="আইডি কার্ড"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onEditStaff(staff)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                              title="সম্পাদনা"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {(staff.employment.category_id === "cat_teaching" || !staff.employment.category_id) && (
                              <Link
                                href={`/dashboard/teachers/${staff.id}/subjects`}
                                className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition"
                                title="জামাত ও কিতাব/বিষয় বণ্টন"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </Link>
                            )}
                            <button
                              onClick={() => onSelectStaff(staff.id)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                            >
                              প্রোফাইল
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
      )}

      {/* MODALS */}
      {idCardStaff && (
        <StaffIdCardModal
          staff={idCardStaff}
          madrasaInfo={madrasaInfo}
          madrasaName={madrasaInfo?.name || madrasaName}
          madrasaPhone={madrasaInfo?.phone}
          madrasaAddress={madrasaInfo?.address}
          onClose={() => setIdCardStaff(null)}
        />
      )}

      {certStaff && (
        <StaffCertificateGeneratorModal
          staff={certStaff}
          madrasaInfo={madrasaInfo}
          madrasaName={madrasaInfo?.name || madrasaName}
          madrasaPhone={madrasaInfo?.phone}
          madrasaAddress={madrasaInfo?.address}
          onClose={() => setCertStaff(null)}
        />
      )}
    </div>
  );
}
