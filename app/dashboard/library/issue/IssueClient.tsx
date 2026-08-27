"use client";

import { useState } from "react";
import { BookUp, BookOpen, User, Calendar, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { issueBook } from "@/app/actions/library";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";
import { convertToBanglaNumber } from "@/lib/student-utils";

interface Book {
  id: string;
  title: string;
  available_copies: number;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string | null;
  classes?: {
    name: string;
  };
}

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

interface IssueClientProps {
  books: Book[];
  students: Student[];
  initialIssues: BookIssue[];
}

export default function IssueClient({ books, students, initialIssues }: IssueClientProps) {
  const [issues, setIssues] = useState<BookIssue[]>(initialIssues);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableBooks = books.filter(b => b.available_copies > 0);

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("book_id", selectedBookId);
    formData.append("student_id", selectedStudentId);
    formData.append("issue_date", issueDate);
    formData.append("due_date", dueDate);

    try {
      const res = await issueBook(null, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setSelectedBookId("");
        setSelectedStudentId("");
        setDueDate("");
        // Reload page to refresh all lists dynamically
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      setError("একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const studentName = `${issue.students?.first_name || ""} ${issue.students?.last_name || ""}`.toLowerCase();
    const roll = (issue.students?.roll_number || "").toLowerCase();
    const bookTitle = (issue.books?.title || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = studentName.includes(search) || roll.includes(search) || bookTitle.includes(search);
    const matchesFilter = statusFilter === "All" || issue.status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Issue Form - Left Panel (1 column) */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
          <div className="px-6 py-4 border-b bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <BookUp className="w-5 h-5 mr-2 text-amber-600" />
              নতুন কিতাব ইস্যু করুন
            </h2>
          </div>

          <form onSubmit={handleIssueSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                সফলভাবে কিতাব ইস্যু করা হয়েছে! পৃষ্ঠা রিলোড হচ্ছে...
              </div>
            )}

            {/* Book Select */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1" />
                কিতাব নির্বাচন করুন <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
              >
                <option value="">কিতাব বেছে নিন...</option>
                {availableBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} (অবশিষ্ট: {convertToBanglaNumber(b.available_copies)}টি)
                  </option>
                ))}
              </select>
              {availableBooks.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1">সব কিতাব ইতিমধ্যে ইস্যু করা রয়েছে!</p>
              )}
            </div>

            {/* Student Search & Select */}
            <StudentSearchSelector
              students={students}
              value={selectedStudentId}
              onChange={(id) => setSelectedStudentId(id)}
              name="student_id"
              label="শিক্ষার্থী নির্বাচন করুন"
              placeholder="শিক্ষার্থী বেছে নিন (নাম বা রোল লিখে খুঁজুন)..."
              required
            />

            {/* Issue Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                ইস্যু করার তারিখ
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                ফেরত দেওয়ার শেষ তারিখ (ঐচ্ছিক)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || availableBooks.length === 0}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition active:scale-95 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "ইস্যু করা হচ্ছে..." : "কিতাব ইস্যু নিশ্চিত করুন"}
            </button>
          </form>
        </div>
      </div>

      {/* Issues Log List - Right Panel (2 columns) */}
      <div className="lg:col-span-2 space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="শিক্ষার্থী, রোল বা কিতাব দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("All")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                statusFilter === "All"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              সকল রেকর্ড
            </button>
            <button
              onClick={() => setStatusFilter("Issued")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                statusFilter === "Issued"
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              ইস্যু করা আছে
            </button>
            <button
              onClick={() => setStatusFilter("Returned")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                statusFilter === "Returned"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              ফেরত এসেছে
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-3">শিক্ষার্থী</th>
                  <th className="px-6 py-3">কিতাব</th>
                  <th className="px-6 py-3 text-center">ইস্যুর তারিখ</th>
                  <th className="px-6 py-3 text-center">ফেরতের ডেডলাইন</th>
                  <th className="px-6 py-3 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue) => {
                    const isReturned = issue.status === "Returned";
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
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              isReturned
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}
                          >
                            {isReturned ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                ফেরত এসেছে
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                ইস্যু করা আছে
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      কোনো ইস্যু রেকর্ড পাওয়া যায়নি।
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
