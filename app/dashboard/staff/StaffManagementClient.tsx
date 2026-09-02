"use client";

import React, { useState, useEffect } from "react";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  StaffLeaveRequest,
  StaffSalaryPaymentRecord,
} from "@/lib/staff-management";
import { getStaffMetadataFull } from "@/app/actions/staff";
import StaffDashboardView from "@/components/staff/StaffDashboardView";
import StaffListView from "@/components/staff/StaffListView";
import StaffProfileView from "@/components/staff/StaffProfileView";
import StaffPayrollView from "@/components/staff/StaffPayrollView";
import StaffLeaveView from "@/components/staff/StaffLeaveView";
import StaffReportsView from "@/components/staff/StaffReportsView";
import StaffFormModal from "@/components/staff/StaffFormModal";
import StaffSettingsModal from "@/components/staff/StaffSettingsModal";
import {
  Users,
  LayoutDashboard,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  UserPlus,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

interface StaffManagementClientProps {
  initialData: {
    staff_members: StaffMember[];
    categories: StaffCategory[];
    departments: StaffDepartment[];
    designations: StaffDesignation[];
    leave_requests: StaffLeaveRequest[];
    salary_records: StaffSalaryPaymentRecord[];
    madrasa_info?: any;
  };
}

export default function StaffManagementClient({ initialData }: StaffManagementClientProps) {
  const [data, setData] = useState(initialData);
  const [currentTab, setCurrentTab] = useState<"dashboard" | "list" | "profile" | "payroll" | "leave" | "reports">(
    "dashboard"
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await getStaffMetadataFull();
      setData(refreshed);
    } catch (err) {
      console.error("Failed to refresh staff data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedStaff = data.staff_members.find((s) => s.id === selectedStaffId) || null;

  // Compute live dashboard stats
  const activeStaff = data.staff_members.filter((s) => s.employment.status === "ACTIVE").length;
  const onLeaveStaff = data.staff_members.filter((s) => s.employment.status === "ON_LEAVE").length;
  const inactiveStaff = data.staff_members.filter((s) => s.employment.status === "INACTIVE").length;
  const suspendedStaff = data.staff_members.filter((s) => s.employment.status === "SUSPENDED").length;
  const resignedStaff = data.staff_members.filter((s) => s.employment.status === "RESIGNED").length;
  const terminatedStaff = data.staff_members.filter((s) => s.employment.status === "TERMINATED").length;

  const teachingCount = data.staff_members.filter(
    (s) => s.employment.category_id === "cat_teaching" || !s.employment.category_id
  ).length;
  const adminCount = data.staff_members.filter((s) => s.employment.category_id === "cat_admin").length;
  const supportCount = data.staff_members.filter((s) => s.employment.category_id === "cat_support").length;
  const managementCount = data.staff_members.filter((s) => s.employment.category_id === "cat_management").length;
  const customCount = data.staff_members.filter(
    (s) => !["cat_teaching", "cat_admin", "cat_support", "cat_management"].includes(s.employment.category_id)
  ).length;

  const pendingLeaves = data.leave_requests.filter((r) => r.status === "PENDING").length;

  // Check expiring documents (within 30 days)
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let expiringDocsCount = 0;
  data.staff_members.forEach((s) => {
    (s.documents || []).forEach((doc) => {
      if (doc.expiry_date) {
        const exp = new Date(doc.expiry_date);
        if (exp >= now && exp <= thirtyDaysLater) {
          expiringDocsCount++;
        }
      }
    });
  });

  // Collect all audit logs chronologically
  const recentLogs: any[] = [];
  data.staff_members.forEach((s) => {
    (s.audit_logs || []).forEach((l) => {
      recentLogs.push(l);
    });
  });
  recentLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setCurrentTab("profile");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>ড্যাশবোর্ড</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-emerald-800">স্টাফ ও মানবসম্পদ</span>
            {currentTab === "profile" && selectedStaff && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-slate-800 font-bold">
                  {selectedStaff.personal.full_name_bn || selectedStaff.personal.first_name}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>স্টাফ ও মানবসম্পদ ব্যবস্থাপনা</span>
            {isRefreshing && <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />}
          </h1>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {currentTab === "profile" && (
            <button
              onClick={() => {
                setSelectedStaffId(null);
                setCurrentTab("list");
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>তালিকায় ফিরে যান</span>
            </button>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200 shadow-xs"
            title="বিভাগ ও পদবী সেটিংস"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ নতুন স্টাফ যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200/80 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => {
            setSelectedStaffId(null);
            setCurrentTab("dashboard");
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === "dashboard" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>ড্যাশবোর্ড</span>
        </button>

        <button
          onClick={() => {
            setSelectedStaffId(null);
            setCurrentTab("list");
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === "list" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>স্টাফ ডিরেক্টরি ({data.staff_members.length})</span>
        </button>

        <button
          onClick={() => {
            setSelectedStaffId(null);
            setCurrentTab("payroll");
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === "payroll" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>মাসিক বেতন ও পেরোল</span>
        </button>

        <button
          onClick={() => {
            setSelectedStaffId(null);
            setCurrentTab("leave");
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === "leave" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ছুটি ব্যবস্থাপনা {pendingLeaves > 0 && `(${pendingLeaves})`}</span>
        </button>

        <button
          onClick={() => {
            setSelectedStaffId(null);
            setCurrentTab("reports");
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === "reports" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>রিপোর্ট ও প্রিন্ট</span>
        </button>
      </div>

      {/* VIEW RENDERING */}
      {currentTab === "dashboard" && (
        <StaffDashboardView
          stats={{
            total: data.staff_members.length,
            active: activeStaff,
            onLeave: onLeaveStaff,
            inactive: inactiveStaff,
            suspended: suspendedStaff,
            resigned: resignedStaff,
            terminated: terminatedStaff,
          }}
          distribution={{
            teaching: teachingCount,
            admin: adminCount,
            support: supportCount,
            management: managementCount,
            custom: customCount,
          }}
          recentActivity={recentLogs.slice(0, 5)}
          pendingLeavesCount={pendingLeaves}
          expiringDocumentsCount={expiringDocsCount}
          madrasaInfo={data.madrasa_info}
          onAddStaff={() => setShowAddModal(true)}
          onNavigateTab={(tab) => setCurrentTab(tab as any)}
        />
      )}

      {currentTab === "list" && (
        <StaffListView
          staffList={data.staff_members}
          categories={data.categories}
          departments={data.departments}
          designations={data.designations}
          madrasaInfo={data.madrasa_info}
          onSelectStaff={handleSelectStaff}
          onAddStaff={() => setShowAddModal(true)}
          onEditStaff={(staff) => setEditingStaff(staff)}
        />
      )}

      {currentTab === "profile" && selectedStaff && (
        <StaffProfileView
          staff={selectedStaff}
          categories={data.categories}
          departments={data.departments}
          designations={data.designations}
          madrasaInfo={data.madrasa_info}
          onRefresh={refreshData}
        />
      )}

      {currentTab === "payroll" && (
        <StaffPayrollView
          salaryRecords={data.salary_records}
          staffList={data.staff_members}
          onRefresh={refreshData}
        />
      )}

      {currentTab === "leave" && (
        <StaffLeaveView
          leaveRequests={data.leave_requests}
          staffList={data.staff_members}
          onRefresh={refreshData}
        />
      )}

      {currentTab === "reports" && (
        <StaffReportsView
          staffList={data.staff_members}
          categories={data.categories}
          departments={data.departments}
          madrasaInfo={data.madrasa_info}
        />
      )}

      {/* Global Modals */}
      {showAddModal && (
        <StaffFormModal
          categories={data.categories}
          departments={data.departments}
          designations={data.designations}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refreshData();
          }}
        />
      )}

      {editingStaff && (
        <StaffFormModal
          staff={editingStaff}
          categories={data.categories}
          departments={data.departments}
          designations={data.designations}
          onClose={() => setEditingStaff(null)}
          onSuccess={() => {
            setEditingStaff(null);
            refreshData();
          }}
        />
      )}

      {showSettingsModal && (
        <StaffSettingsModal
          categories={data.categories}
          departments={data.departments}
          designations={data.designations}
          onClose={() => setShowSettingsModal(false)}
          onRefresh={refreshData}
        />
      )}
    </div>
  );
}
