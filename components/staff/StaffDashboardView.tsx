"use client";

import React from "react";
import {
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  StaffMember,
} from "@/lib/staff-management";
import {
  Users,
  UserCheck,
  Calendar,
  AlertCircle,
  TrendingUp,
  Plus,
  QrCode,
  DollarSign,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Briefcase,
  Layers,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffDashboardViewProps {
  stats: {
    total: number;
    active: number;
    onLeave: number;
    inactive: number;
    suspended: number;
    resigned: number;
    terminated: number;
  };
  distribution: {
    teaching: number;
    admin: number;
    support: number;
    management: number;
    custom: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    details?: string;
    user_email?: string;
    created_at: string;
  }>;
  pendingLeavesCount: number;
  expiringDocumentsCount: number;
  madrasaInfo?: any;
  onAddStaff: () => void;
  onNavigateTab: (tab: string) => void;
}

export default function StaffDashboardView({
  stats,
  distribution,
  recentActivity,
  pendingLeavesCount,
  expiringDocumentsCount,
  madrasaInfo,
  onAddStaff,
  onNavigateTab,
}: StaffDashboardViewProps) {
  const totalStaff = stats.total || 1; // avoid / 0

  return (
    <div className="space-y-6">
      {/* Dynamic Institutional Identity Header */}
      {madrasaInfo && (
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-700/50">
          <div className="flex items-center gap-3.5">
            {madrasaInfo.logo_url ? (
              <img
                src={madrasaInfo.logo_url}
                alt="Madrasa Logo"
                className="w-12 h-12 rounded-full object-contain bg-white/90 p-0.5 shadow-xs border border-emerald-300/40 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-emerald-700/60 border border-emerald-400/40 flex items-center justify-center text-emerald-100 font-bold shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">
                মানবসম্পদ ও স্টাফ ম্যানেজমেন্ট সিস্টেম
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {madrasaInfo.name || "দারুল উলুম কওমিয়া মাদ্রাসা"}
              </h2>
              <p className="text-xs text-emerald-100/80 font-medium">
                {madrasaInfo.address || "মাদ্রাসা ক্যাম্পাস"} {madrasaInfo.phone ? `• মোবাইল: ${toBanglaNumber(madrasaInfo.phone)}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab("reports")}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/10"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>রিপোর্ট ও সনদ</span>
            </button>
            <button
              onClick={onAddStaff}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950" />
              <span>নতুন স্টাফ</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff */}
        <div
          onClick={() => onNavigateTab("list")}
          className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-emerald-300 transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">সর্বমোট স্টাফ ও শিক্ষক</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {toBanglaNumber(stats.total)}
            </h3>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center">
              সকল কর্মী <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Active Staff */}
        <div
          onClick={() => onNavigateTab("list")}
          className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-emerald-300 transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">সক্রিয় কর্মী (Active)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-bold text-emerald-700">
              {toBanglaNumber(stats.active)}
            </h3>
            <span className="text-[11px] text-slate-400">
              {Math.round((stats.active / totalStaff) * 100)}% উপস্থিতি হার
            </span>
          </div>
        </div>

        {/* On Leave Staff */}
        <div
          onClick={() => onNavigateTab("leave")}
          className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-amber-300 transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">ছুটিতে আছেন (On Leave)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-bold text-amber-700">
              {toBanglaNumber(stats.onLeave)}
            </h3>
            <span className="text-[11px] text-amber-700 font-semibold flex items-center">
              {pendingLeavesCount > 0 ? `${toBanglaNumber(pendingLeavesCount)}টি আবেদন বাকি` : "ছুটি তালিকা"}
            </span>
          </div>
        </div>

        {/* Inactive / Resigned */}
        <div
          onClick={() => onNavigateTab("list")}
          className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-slate-300 transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">নিষ্ক্রিয় / ইস্তফাপ্রাপ্ত</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-700">
              {toBanglaNumber(stats.inactive + stats.resigned + stats.terminated + stats.suspended)}
            </h3>
            <span className="text-[11px] text-slate-400">আর্কাইভ রেকর্ড</span>
          </div>
        </div>
      </div>

      {/* Expiring Documents Alert Widget */}
      {expiringDocumentsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-950">
                ডকুমেন্ট মেয়াদের সতর্কতা: {toBanglaNumber(expiringDocumentsCount)}টি ডকুমেন্টের মেয়াদ আগামী ৩০ দিনে শেষ হবে!
              </h4>
              <p className="text-amber-800 text-[11px]">
                স্টাফ প্রোফাইলে গিয়ে চুক্তিপত্র, এনআইডি বা সনদপত্র নবায়ন নিশ্চিত করুন।
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("list")}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold shrink-0 cursor-pointer shadow-xs"
          >
            তালিকায় দেখুন
          </button>
        </div>
      )}

      {/* Quick Action Hub */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">স্টাফ ম্যানেজমেন্ট কুইক অ্যাকশন</h3>
            <p className="text-xs text-emerald-200 mt-0.5">
              এক ক্লিকে নতুন স্টাফ নিবন্ধন, দৈনিক হাজিরা, ছুটি অনুমোদন ও বেতন তৈরি করুন
            </p>
          </div>
          <button
            onClick={onAddStaff}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন স্টাফ যোগ করুন</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => onNavigateTab("list")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xs rounded-xl border border-white/15 text-left transition cursor-pointer space-y-1"
          >
            <Users className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold text-xs block">স্টাফ ডিরেক্টরি</span>
            <span className="text-[10px] text-emerald-200 block">সকল তালিকা ও কার্ড</span>
          </button>

          <button
            onClick={() => onNavigateTab("payroll")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xs rounded-xl border border-white/15 text-left transition cursor-pointer space-y-1"
          >
            <DollarSign className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold text-xs block">মাসিক পেরোল ও বেতন</span>
            <span className="text-[10px] text-emerald-200 block">বেতন শিট ও পরিশোধ</span>
          </button>

          <button
            onClick={() => onNavigateTab("leave")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xs rounded-xl border border-white/15 text-left transition cursor-pointer space-y-1"
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold text-xs block">ছুটির আবেদন</span>
            <span className="text-[10px] text-emerald-200 block">
              {pendingLeavesCount > 0 ? `${toBanglaNumber(pendingLeavesCount)}টি আবেদন বাকি` : "আবেদন ব্যবস্থাপনা"}
            </span>
          </button>

          <button
            onClick={() => onNavigateTab("reports")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xs rounded-xl border border-white/15 text-left transition cursor-pointer space-y-1"
          >
            <FileText className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold text-xs block">রিপোর্ট ও প্রিন্ট</span>
            <span className="text-[10px] text-emerald-200 block">স্টাফ তালিকা ও হাজিরা PDF</span>
          </button>
        </div>
      </div>

      {/* Bottom Grid: Category Distribution + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>ক্যাটাগরি অনুযায়ী বিন্যাস</span>
            </span>
            <span className="text-xs text-slate-400">সক্রিয় কর্মী</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* Teaching */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-700">শিক্ষক মণ্ডলী (Teaching Staff)</span>
                <span className="font-bold text-emerald-800">{toBanglaNumber(distribution.teaching)} জন</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalStaff > 0 ? Math.min(100, (distribution.teaching / totalStaff) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Admin */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-700">প্রশাসনিক কর্মকর্তা (Admin Staff)</span>
                <span className="font-bold text-blue-800">{toBanglaNumber(distribution.admin)} জন</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalStaff > 0 ? Math.min(100, (distribution.admin / totalStaff) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Support */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-700">সহায়ক ও সেবা কর্মী (Support)</span>
                <span className="font-bold text-amber-800">{toBanglaNumber(distribution.support)} জন</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalStaff > 0 ? Math.min(100, (distribution.support / totalStaff) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Management */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-700">ব্যবস্থাপনা ও পরিচালনা (Management)</span>
                <span className="font-bold text-purple-800">{toBanglaNumber(distribution.management)} জন</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${totalStaff > 0 ? Math.min(100, (distribution.management / totalStaff) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Custom/Other if any */}
            {distribution.custom > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-700">অন্যান্য ক্যাটাগরি (Other Staff)</span>
                  <span className="font-bold text-slate-800">{toBanglaNumber(distribution.custom)} জন</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-600 rounded-full transition-all duration-500"
                    style={{ width: `${totalStaff > 0 ? Math.min(100, (distribution.custom / totalStaff) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Log Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>সাম্প্রতিক কার্যক্রম ও অডিট হিস্টোরি (Activity Log)</span>
            </span>
          </h3>

          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">কোনো সাম্প্রতিক কার্যক্রম রেকর্ড নেই।</p>
            ) : (
              recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs flex items-center justify-between hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-800 block">{act.action}</span>
                      <span className="text-[11px] text-slate-500">{act.details}</span>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    <span className="block font-medium text-slate-600">{act.user_email || "অ্যাডমিন"}</span>
                    <span>{act.created_at.split("T")[0]}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
