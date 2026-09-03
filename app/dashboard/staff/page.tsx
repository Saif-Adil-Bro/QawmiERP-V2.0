import React from "react";
import { getStaffMetadataFull } from "@/app/actions/staff";
import StaffManagementClient from "./StaffManagementClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const metadata = {
  title: "শিক্ষক ও স্টাফ (মানবসম্পদ) | QawmiManager",
  description: "কওমি মাদ্রাসার শিক্ষক, উস্তাদবৃন্দ, কর্মকর্তা ও কর্মচারীদের সমন্বিত পূর্ণাঙ্গ ব্যবস্থাপনা",
};

export default async function StaffPage() {
  const staffData = await getStaffMetadataFull();

  return (
    <PermissionGuard anyPermissions={["staff.view", "teacher.view"]}>
      <div className="min-h-screen bg-slate-50/50 pb-16">
        <StaffManagementClient initialData={staffData} />
      </div>
    </PermissionGuard>
  );
}
