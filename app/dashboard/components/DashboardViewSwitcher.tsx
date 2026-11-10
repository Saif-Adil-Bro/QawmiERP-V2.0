"use client";

import React from "react";
import { useAppMode } from "@/components/mode/ModeContext";
import { BasicMetroDashboard } from "@/components/mode/BasicMetroDashboard";

interface DashboardViewSwitcherProps {
  stats: {
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    todayPresent: number;
    todayAbsent: number;
    totalIncome: number;
    totalExpense: number;
    expensesSum: number;
    bazarSum: number;
  };
  children: React.ReactNode; // Advanced Dashboard Content
}

export default function DashboardViewSwitcher({
  stats,
  children,
}: DashboardViewSwitcherProps) {
  const { mode } = useAppMode();

  if (mode === "basic") {
    return <BasicMetroDashboard stats={stats} />;
  }

  // Advanced Mode (Default Full ERP View)
  return <>{children}</>;
}
