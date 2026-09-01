import React from "react";
import { getStaffMetadataFull } from "@/app/actions/staff";
import StaffManagementClient from "./StaffManagementClient";

export const metadata = {
  title: "স্টাফ ও মানবসম্পদ ব্যবস্থাপনা | QawmiManager",
  description: "কওমি মাদ্রাসার শিক্ষক, কর্মকর্তা ও কর্মচারীদের পূর্ণাঙ্গ ব্যবস্থাপনা",
};

export default async function StaffPage() {
  const staffData = await getStaffMetadataFull();

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <StaffManagementClient initialData={staffData} />
    </div>
  );
}
