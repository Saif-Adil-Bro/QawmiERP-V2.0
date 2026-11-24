"use client";

import { Plus } from "lucide-react";

export default function NewSubjectButton() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    window.location.assign("/dashboard/subjects/new");
  };

  return (
    <a
      href="/dashboard/subjects/new"
      onClick={handleClick}
      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      <span>নতুন বিষয় যোগ করুন</span>
    </a>
  );
}
