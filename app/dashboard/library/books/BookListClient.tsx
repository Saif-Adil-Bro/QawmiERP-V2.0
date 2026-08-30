"use client";

import { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Book, Filter, BookOpen } from "lucide-react";
import { createBook, updateBook, deleteBook } from "@/app/actions/library";
import { convertToBanglaNumber } from "@/lib/student-utils";

interface Book {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  total_copies: number;
  available_copies: number;
}

interface BookListClientProps {
  initialBooks: Book[];
}

const CATEGORIES = [
  "তাফসীর",
  "হাদীস",
  "ফিকহ",
  "আকাইদ",
  "নাহু-সরফ",
  "আদব / সাহিত্য",
  "ইতিহাস ও জীবনী",
  "অন্যান্য"
];

export default function BookListClient({ initialBooks }: BookListClientProps) {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("হাদীস");
  const [totalCopies, setTotalCopies] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingBook(null);
    setTitle("");
    setAuthor("");
    setCategory("হাদীস");
    setTotalCopies("1");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author || "");
    setCategory(book.category || "হাদীস");
    setTotalCopies(String(book.total_copies));
    setError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("category", category);
    formData.append("total_copies", totalCopies);

    try {
      if (editingBook) {
        const res = await updateBook(editingBook.id, null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          // Update state locally
          setBooks(prev => prev.map(b => b.id === editingBook.id ? {
            ...b,
            title,
            author: author || null,
            category: category || null,
            total_copies: parseInt(totalCopies, 10),
            available_copies: b.available_copies + (parseInt(totalCopies, 10) - b.total_copies)
          } : b));
          setIsModalOpen(false);
        }
      } else {
        const res = await createBook(null, formData);
        if (res?.error) {
          setError(res.error);
        } else {
          // Re-fetch or add directly
          window.location.reload();
        }
      }
    } catch (err: any) {
      console.error("Book save failed:", err);
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে আপনি "${name}" কিতাবটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await deleteBook(id);
      if (res?.error) {
        alert(`মুছে ফেলতে ত্রুটি: ${res.error}`);
      } else {
        setBooks(prev => prev.filter(b => b.id !== id));
      }
    } catch (err) {
      console.error("deleteBook failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    }
  };

  // Filtering
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (book.author && book.author.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || book.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="কিতাবের নাম বা লেখক দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <select
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">সকল বিষয়</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Book Button */}
        <button
          onClick={openAddModal}
          className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm hover:shadow active:scale-95"
        >
          <Plus className="w-4 h-4 mr-1" />
          <span>নতুন কিতাব যোগ করুন</span>
        </button>
      </div>

      {/* Book Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-6 py-3.5">কিতাবের নাম</th>
                <th className="px-6 py-3.5">লেখক</th>
                <th className="px-6 py-3.5">বিষয়/শ্রেণী</th>
                <th className="px-6 py-3.5 text-center">মোট কপি</th>
                <th className="px-6 py-3.5 text-center">অবশিষ্ট কপি</th>
                <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => {
                  const outOfStock = book.available_copies <= 0;
                  return (
                    <tr key={book.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <Book className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 text-base">{book.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{book.author || "-"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {book.category || "অন্যান্য"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800 font-mono">
                        {convertToBanglaNumber(book.total_copies)}টি
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            outOfStock
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {convertToBanglaNumber(book.available_copies)}টি
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(book)}
                            className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                            title="সম্পাদনা"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(book.id, book.title)}
                            className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    কোনো কিতাব পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                {editingBook ? "কিতাব সংশোধন" : "নতুন কিতাব যোগ করুন"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  কিতাবের নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="যেমন: বুখারী শরীফ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  লেখক
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="যেমন: ইমাম বুখারী (রহ.)"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    শ্রেণী/বিষয়
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    মোট কপি <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  disabled={loading}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  disabled={loading}
                >
                  {loading ? "সংরক্ষণ করা হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
