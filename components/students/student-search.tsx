"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function StudentSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get("q") || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      router.push(`/dashboard/students?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/dashboard/students`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-72">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="নাম বা রোল নম্বর দিয়ে খুঁজুন..."
        className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
      />
    </form>
  );
}
