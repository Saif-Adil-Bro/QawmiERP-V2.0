"use client";

import { useState } from "react";
import { BookDown, Search, CheckCircle, Calendar, AlertTriangle, User } from "lucide-react";
import { returnBook } from "@/app/actions/library";
import { convertToBanglaNumber } from "@/lib/student-utils";

interface BookIssue {
  id: string;
  issue_date: string;
  due_date: string | null;
  return_date: string | null;
  status: string;
  books: {
    title: string;
    author: string | null;
  } | null;
  students: {
    first_name: string;
    last_name: string;
    roll_number: string | null;
    classes: {
      name: string;
    } | null;
  } | null;
}

interface ReturnClientProps {
  initialIssues: BookIssue[];
}

export default function ReturnClient({ initialIssues }: ReturnClientProps) {
  const [issues, setIssues] = useState<BookIssue[]>(initialIssues);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleReturn = async (issueId: string) => {
    if (!confirm("আপনি কি কিতাবটি ফেরত নিতে চান?")) return;

    setLoadingId(issueId);
    try {
      const res = await returnBook(issueId);
      if (res.error) {
        alert(res.error);
      } else {
        // Update local state: mark as Returned and update return_date
        setIssues(prev =>
          prev.map(item =>
            item.id === issueId
              ? {
                  ...item,
                  status: "Returned",
                  return_date: new Date().toISOString().split("T")[0],
                }
              : item
          )
        );
      }
    } catch (err) {
      alert("একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoadingId(null);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Currently issued books (Pending return)
  const pendingIssues = issues.filter(issue => issue.status === "Issued");
  // Returned books
  const returnedIssues = issues.filter(issue => issue.status === "Returned");

  // Filtering pending issues
  const filteredPending = pendingIssues.filter(issue => {
    const studentName = `${issue.students?.first_name || ""} ${issue.students?.last_name || ""}`.toLowerCase();
    const roll = (issue.students?.roll_number || "").toLowerCase();
    const bookTitle = (issue.books?.title || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    return studentName.includes(search) || roll.includes(search) || bookTitle.includes(search);
  });

  return (
    <div className="space-y-8">
      {/* Search Input */}
      <div className="relative max-w-md bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <Search className="absolute left-5 top-4.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="শিক্ষার্থী, রোল বা কিতাব দিয়ে খুঁজুন..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Pending Returns (ইস্যু করা কিতাবসমূহ) */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <BookDown className="w-5 h-5 mr-2 text-emerald-600" />
          ইস্যু করা আছে (ফেরত নেওয়ার অপেক্ষমাণ)
        </h2>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-3.5">শিক্ষার্থী</th>
                  <th className="px-6 py-3.5">কিতাব</th>
                  <th className="px-6 py-3.5 text-center">ইস্যুর তারিখ</th>
                  <th className="px-6 py-3.5 text-center">ফেরতের ডেডলাইন</th>
                  <th className="px-6 py-3.5 text-center">অবস্থা (Overdue?)</th>
                  <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {filteredPending.length > 0 ? (
                  filteredPending.map((issue) => {
                    // Check if overdue
                    const isOverdue = issue.due_date && issue.due_date < todayStr;
                    return (
                      <tr key={issue.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            {issue.students?.first_name} {issue.students?.last_name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            রোল: {issue.students?.roll_number ? convertToBanglaNumber(issue.students.roll_number) : "-"} | ক্লাস: {issue.students?.classes?.name || "অনির্ধারিত"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-indigo-700">{issue.books?.title}</div>
                          {issue.books?.author && (
                            <div className="text-xs text-slate-500">{issue.books.author}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-xs">
                          {convertToBanglaNumber(issue.issue_date)}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-xs">
                          {issue.due_date ? convertToBanglaNumber(issue.due_date) : "-"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isOverdue ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                              সময় পার হয়েছে!
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              নির্ধারিত সময়ের মধ্যে
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleReturn(issue.id)}
                            disabled={loadingId === issue.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition hover:shadow shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            {loadingId === issue.id ? "ফেরত নেওয়া হচ্ছে..." : "ফেরত নিন"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      ফেরত নেওয়ার মতো কোনো কিতাব এই মুহূর্তে খালি নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recently Returned List (সম্প্রতি ফেরত নেওয়া হয়েছে) */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" />
          সম্প্রতি ফেরত এসেছে (ইতিহাস)
        </h2>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-3.5">শিক্ষার্থী</th>
                  <th className="px-6 py-3.5">কিতাব</th>
                  <th className="px-6 py-3.5 text-center">ইস্যুর তারিখ</th>
                  <th className="px-6 py-3.5 text-center">ফেরতের তারিখ</th>
                  <th className="px-6 py-3.5 text-center">অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {returnedIssues.length > 0 ? (
                  returnedIssues.slice(0, 10).map((issue) => (
                    <tr key={issue.id} className="bg-slate-50/20 hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {issue.students?.first_name} {issue.students?.last_name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          রোল: {issue.students?.roll_number ? convertToBanglaNumber(issue.students.roll_number) : "-"} | ক্লাস: {issue.students?.classes?.name || "অনির্ধারিত"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{issue.books?.title}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">
                        {convertToBanglaNumber(issue.issue_date)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs font-bold text-emerald-600">
                        {issue.return_date ? convertToBanglaNumber(issue.return_date) : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          ফেরত এসেছে
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      কোনো ফেরতের রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
