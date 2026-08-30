"use client";

import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import DashboardNav from "./DashboardNav";
import { logout } from "@/app/actions/auth";
import { SessionProvider } from "@/components/sessions/SessionContext";
import SessionSelector from "@/components/sessions/SessionSelector";
import ArchivedSessionBanner from "@/components/sessions/ArchivedSessionBanner";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="flex h-screen bg-slate-50 print:bg-white print:h-auto overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 print:hidden ${
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          <div className="p-5 border-b border-slate-800 shrink-0 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">QawmiERP</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">মাদরাসা ম্যানেজমেন্ট</p>
            </div>
            {/* Close button for mobile */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dynamic Nav Menu */}
          <div className="flex-1 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
            <DashboardNav />
          </div>

          {/* Logout Button */}
          <div className="p-4 border-t border-slate-800 shrink-0">
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition text-sm font-medium cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                <span>লগআউট</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-8 print:hidden shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">এডমিন পোর্টাল</h1>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              {/* Global Academic Session Selector */}
              <SessionSelector />

              <div className="w-9 h-9 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center justify-center font-bold text-sm shadow-2xs">
                A
              </div>
            </div>
          </header>

          {/* Archived Session Notice Banner */}
          <ArchivedSessionBanner />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:overflow-visible">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
