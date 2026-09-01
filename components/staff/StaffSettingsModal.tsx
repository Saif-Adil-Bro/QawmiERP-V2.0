"use client";

import React, { useState } from "react";
import {
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
} from "@/lib/staff-management";
import {
  addStaffCategory,
  addStaffDepartment,
  addStaffDesignation,
  deleteStaffDepartment,
  deleteStaffDesignation,
} from "@/app/actions/staff";
import {
  Settings,
  Plus,
  Trash2,
  X,
  Layers,
  Building,
  Briefcase,
  CheckCircle,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffSettingsModalProps {
  categories: StaffCategory[];
  departments: StaffDepartment[];
  designations: StaffDesignation[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function StaffSettingsModal({
  categories,
  departments,
  designations,
  onClose,
  onRefresh,
}: StaffSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"departments" | "designations" | "categories">("departments");

  // Add Department State
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptNameEn, setNewDeptNameEn] = useState("");
  const [isAddingDept, setIsAddingDept] = useState(false);

  // Add Designation State
  const [newDesTitle, setNewDesTitle] = useState("");
  const [newDesTitleEn, setNewDesTitleEn] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState(departments[0]?.id || "");
  const [isAddingDes, setIsAddingDes] = useState(false);

  // Add Category State
  const [newCatName, setNewCatName] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatType, setNewCatType] = useState<any>("CUSTOM");
  const [isAddingCat, setIsAddingCat] = useState(false);

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setIsAddingDept(true);
    const res = await addStaffDepartment(newDeptName, newDeptNameEn);
    setIsAddingDept(false);
    if (res.success) {
      setNewDeptName("");
      setNewDeptNameEn("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddDes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesTitle.trim()) return;
    setIsAddingDes(true);
    const res = await addStaffDesignation(newDesTitle, selectedDeptId, newDesTitleEn);
    setIsAddingDes(false);
    if (res.success) {
      setNewDesTitle("");
      setNewDesTitleEn("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    const res = await addStaffCategory(newCatName, newCatType, newCatNameEn);
    setIsAddingCat(false);
    if (res.success) {
      setNewCatName("");
      setNewCatNameEn("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteDept = async (deptId: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই বিভাগটি মুছে ফেলতে চান?")) return;
    const res = await deleteStaffDepartment(deptId);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteDes = async (desId: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই পদবীটি মুছে ফেলতে চান?")) return;
    const res = await deleteStaffDesignation(desId);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-800">স্টাফ কনফিগারেশন ও বিভাগ সেটিংস</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("departments")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "departments" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            বিভাগসমূহ ({departments.length})
          </button>
          <button
            onClick={() => setActiveTab("designations")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "designations" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            পদবীসমূহ ({designations.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "categories" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            ক্যাটাগরিসমূহ ({categories.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 1. DEPARTMENTS */}
          {activeTab === "departments" && (
            <div className="space-y-4">
              {/* Add form */}
              <form onSubmit={handleAddDept} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="নতুন বিভাগের নাম (বাংলা)..."
                  className="flex-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <input
                  type="text"
                  value={newDeptNameEn}
                  onChange={(e) => setNewDeptNameEn(e.target.value)}
                  placeholder="Department Name (English)..."
                  className="w-1/3 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="submit"
                  disabled={isAddingDept}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shrink-0"
                >
                  {isAddingDept ? "যোগ হচ্ছে..." : "+ যোগ করুন"}
                </button>
              </form>

              {/* List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {departments.map((d) => (
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">{d.name}</span>
                      {d.name_en && <span className="text-[10px] text-slate-400">{d.name_en}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteDept(d.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. DESIGNATIONS */}
          {activeTab === "designations" && (
            <div className="space-y-4">
              <form onSubmit={handleAddDes} className="flex flex-col sm:flex-row gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={newDesTitle}
                  onChange={(e) => setNewDesTitle(e.target.value)}
                  placeholder="পদবীর নাম (বাংলা)..."
                  className="flex-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="px-3 py-2 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isAddingDes}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shrink-0"
                >
                  {isAddingDes ? "যোগ হচ্ছে..." : "+ যোগ করুন"}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {designations.map((d) => (
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">{d.name}</span>
                      {d.description && <span className="text-[10px] text-slate-400">{d.description}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteDes(d.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. CATEGORIES */}
          {activeTab === "categories" && (
            <div className="space-y-4">
              <form onSubmit={handleAddCat} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="ক্যাটাগরির নাম (উদা: হোস্টেল কর্মী)..."
                  className="flex-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="submit"
                  disabled={isAddingCat}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shrink-0 cursor-pointer"
                >
                  {isAddingCat ? "যোগ হচ্ছে..." : "+ যোগ করুন"}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {categories.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                    </div>
                    {c.code === "custom" && !c.is_system && (
                      <button className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
