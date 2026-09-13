"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  BookOpen,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Printer,
  CheckCircle,
  Clock,
  MapPin,
  TrendingUp,
  FileText,
  Phone,
  Tag,
  AlertCircle,
  CheckSquare,
  Send,
  ArrowDownToLine,
  Receipt,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Wallet,
  Scale,
  Building2,
  CheckCircle2,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import {
  Mahfil,
  MahfilSpeaker,
  MahfilReceiptBook,
  MahfilTransaction,
  MahfilSettlement
} from "@/lib/fundraising-types";
import {
  saveMahfilSpeaker,
  deleteMahfilSpeaker,
  saveMahfilReceiptBook,
  deleteMahfilReceiptBook,
  saveMahfilTransaction,
  deleteMahfilTransaction,
  saveMahfil,
  settleMahfilFund,
  deleteMahfilSettlement,
  getAvailableFundsForMahfil
} from "@/app/actions/fundraising";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

type TabType = "speakers" | "receipts" | "distribution" | "deposits" | "finance" | "audit";

type BookModalMode = "create_book" | "distribute" | "deposit" | "full_edit";

export default function MahfilDetailClient({ mahfil: initialMahfil }: { mahfil: Mahfil }) {
  const router = useRouter();
  const [mahfil, setMahfil] = useState<Mahfil>(initialMahfil);
  const [activeTab, setActiveTab] = useState<TabType>("receipts");

  // Search & Filter state for receipts
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptCategoryFilter, setReceiptCategoryFilter] = useState("ALL");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState("ALL");

  // Speaker Modal State
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Partial<MahfilSpeaker> | null>(null);

  // Receipt Book Modal State
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookModalMode, setBookModalMode] = useState<BookModalMode>("create_book");
  const [editingBook, setEditingBook] = useState<Partial<MahfilReceiptBook> | null>(null);

  // Transaction Modal State
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Partial<MahfilTransaction> | null>(null);

  // Settlement State (তহবিল সমন্বয় স্টেট)
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [settlementMode, setSettlementMode] = useState<"SURPLUS_DEPOSIT" | "DEFICIT_COVER">("SURPLUS_DEPOSIT");
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementFundId, setSettlementFundId] = useState<string>("fund-general");
  const [settlementFundName, setSettlementFundName] = useState<string>("সাধারণ ফান্ড (General Fund)");
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<"Cash" | "bKash" | "Nagad" | "Bank" | "Other">("Cash");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [availableFunds, setAvailableFunds] = useState<Array<{ id: string; name: string; category?: string; current_balance?: number }>>([]);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    async function loadFunds() {
      try {
        const funds = await getAvailableFundsForMahfil();
        if (funds && funds.length > 0) {
          setAvailableFunds(funds);
          if (!settlementFundId || settlementFundId === "fund-general") {
            setSettlementFundId(funds[0].id);
            setSettlementFundName(funds[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to load funds:", err);
      }
    }
    loadFunds();
  }, []);

  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------
  // Dynamic Calculations (পরিপূর্ণ ডায়নামিক ক্যালকুলেশন)
  // -------------------------------------------------------------
  const books = mahfil.receipt_books || [];

  // ১. রশিদ (Receipt Books) ক্যালকুলেশন
  const totalBooksCount = books.length;
  const totalReceiptPages = books.reduce((acc, b) => acc + (b.total_pages || 0), 0);
  const totalExpectedTarget = books.reduce((acc, b) => acc + (Number(b.expected_amount) || ((b.total_pages || 0) * (Number(b.rate_per_page) || 0))), 0);

  // ২. বিতরণ (Distribution) ক্যালকুলেশন
  const distributedBooks = books.filter(b => b.is_distributed || (b.issued_to_name && b.issued_to_name.trim().length > 0));
  const distributedBooksCount = distributedBooks.length;
  const distributedPagesTotal = distributedBooks.reduce((acc, b) => acc + (b.distributed_pages || b.total_pages || 0), 0);
  const inStockBooksCount = Math.max(0, totalBooksCount - distributedBooksCount);
  const inStockPagesCount = Math.max(0, totalReceiptPages - distributedPagesTotal);
  const distributionPercentage = totalBooksCount > 0 ? Math.round((distributedBooksCount / totalBooksCount) * 100) : 0;

  // ৩. জমা (Deposit / Collection) ক্যালকুলেশন
  const depositedBooks = books.filter(b => (b.total_collected || 0) > 0 || b.status === "RETURNED" || b.status === "PARTIALLY_RETURNED");
  const totalCollectedAmount = books.reduce((acc, b) => acc + (Number(b.total_collected) || 0), 0);
  const totalUsedPages = books.reduce((acc, b) => acc + (Number(b.used_pages) || 0), 0);
  const totalReturnedPages = books.reduce((acc, b) => acc + (Number(b.returned_pages) || 0), 0);
  const fullyReturnedBooksCount = books.filter(b => b.status === "RETURNED").length;
  const partiallyReturnedBooksCount = books.filter(b => b.status === "PARTIALLY_RETURNED").length;
  const pendingCollectionBooksCount = books.filter(b => b.status === "ISSUED" || b.status === "OVERDUE").length;
  const averageCollectionPerUsedSlip = totalUsedPages > 0 ? Math.round(totalCollectedAmount / totalUsedPages) : 0;

  // ৪. সার্বিক ফিনান্সিয়াল ক্যালকুলেশন
  const receiptIncome = totalCollectedAmount;
  const directIncome = (mahfil.transactions || []).filter(t => t.type === "INCOME").reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalIncome = receiptIncome + directIncome;
  const totalExpense = (mahfil.transactions || []).filter(t => t.type === "EXPENSE").reduce((acc, t) => acc + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // Categories list for filtering
  const allCategories = Array.from(new Set(books.map(b => b.category || "সাধারণ অনুদান")));

  // Filtered books for search & filters
  const filteredBooks = books.filter(b => {
    const matchesSearch =
      !receiptSearch ||
      (b.book_no && b.book_no.toLowerCase().includes(receiptSearch.toLowerCase())) ||
      (b.issued_to_name && b.issued_to_name.toLowerCase().includes(receiptSearch.toLowerCase())) ||
      (b.issued_to_phone && b.issued_to_phone.includes(receiptSearch)) ||
      (b.category && b.category.toLowerCase().includes(receiptSearch.toLowerCase())) ||
      (b.issued_to_area && b.issued_to_area.toLowerCase().includes(receiptSearch.toLowerCase()));

    const matchesCategory = receiptCategoryFilter === "ALL" || b.category === receiptCategoryFilter;
    const matchesStatus = receiptStatusFilter === "ALL" || b.status === receiptStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // -------------------------------------------------------------
  // Speaker Handlers
  // -------------------------------------------------------------
  const handleOpenSpeakerModal = (spk?: MahfilSpeaker) => {
    if (spk) {
      setEditingSpeaker({ ...spk });
    } else {
      setEditingSpeaker({
        name: "",
        title: "মাওলানা",
        designation: "",
        topic: "তাফসীরুল কুরআন ও ইসলামী জীবন",
        date: mahfil.start_date,
        time_slot: "বাদ মাগরিব",
        phone: "",
        agreed_hadia: 10000,
        paid_hadia: 0,
        status: "CONFIRMED",
        notes: "",
      });
    }
    setSpeakerModalOpen(true);
  };

  const handleSaveSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpeaker?.name?.trim()) return;
    setLoading(true);
    try {
      let res = await saveMahfilSpeaker(mahfil.id, editingSpeaker);
      if (res && "error" in res && res.error) {
        const apiRes = await fetch("/api/fundraising/mahfil/speakers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, speaker: editingSpeaker }),
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || apiData.error) {
          alert(apiData.error || res.error || "বক্তা সংরক্ষণে সমস্যা হয়েছে");
          return;
        }
      }
      setSpeakerModalOpen(false);
      router.refresh();
      const updatedSpeakers = editingSpeaker.id
        ? (mahfil.speakers || []).map(s => s.id === editingSpeaker.id ? { ...s, ...editingSpeaker } as MahfilSpeaker : s)
        : [...(mahfil.speakers || []), { ...editingSpeaker, id: `spk_${Date.now()}` } as MahfilSpeaker];
      setMahfil(prev => ({ ...prev, speakers: updatedSpeakers }));
    } catch (err: any) {
      try {
        const apiRes = await fetch("/api/fundraising/mahfil/speakers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, speaker: editingSpeaker }),
        });
        const apiData = await apiRes.json();
        if (apiRes.ok && !apiData.error) {
          setSpeakerModalOpen(false);
          router.refresh();
          const updatedSpeakers = editingSpeaker.id
            ? (mahfil.speakers || []).map(s => s.id === editingSpeaker.id ? { ...s, ...editingSpeaker } as MahfilSpeaker : s)
            : [...(mahfil.speakers || []), { ...editingSpeaker, id: `spk_${Date.now()}` } as MahfilSpeaker];
          setMahfil(prev => ({ ...prev, speakers: updatedSpeakers }));
          return;
        }
      } catch {}
      alert("বক্তা সংরক্ষণে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpeaker = async (speakerId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই বক্তার তথ্য মুছে ফেলতে চান?")) return;
    try {
      let res = await deleteMahfilSpeaker(mahfil.id, speakerId);
      if (res && "error" in res && res.error) {
        await fetch(`/api/fundraising/mahfil/speakers?mahfilId=${mahfil.id}&speakerId=${speakerId}`, {
          method: "DELETE",
        });
      }
      setMahfil(prev => ({ ...prev, speakers: (prev.speakers || []).filter(s => s.id !== speakerId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // -------------------------------------------------------------
  // Receipt Book Handlers (রশিদ, বিতরণ, জমা - পৃথক ও ডায়নামিক)
  // -------------------------------------------------------------
  const handleOpenBookModal = (mode: BookModalMode, bk?: MahfilReceiptBook) => {
    setBookModalMode(mode);
    if (bk) {
      setEditingBook({
        ...bk,
        total_pages: bk.total_pages || (Math.max(1, (bk.page_to || 50) - (bk.page_from || 1) + 1)),
        distributed_pages: bk.distributed_pages || bk.total_pages || 50,
        rate_per_page: bk.rate_per_page || 0,
        expected_amount: bk.expected_amount || 0,
        used_pages: bk.used_pages || 0,
        returned_pages: bk.returned_pages || 0,
        total_collected: bk.total_collected || 0,
      });
    } else {
      const nextNum = books.length + 1;
      setEditingBook({
        book_no: `বই #${nextNum}`,
        page_from: 1,
        page_to: 50,
        total_pages: 50,
        category: "সাধারণ অনুদান",
        receipt_type: "সাধারণ রসিদ বই",
        rate_per_page: 100,
        expected_amount: 5000,
        is_distributed: mode === "distribute",
        issued_to_name: "",
        issued_to_type: "উস্তাদ",
        issued_to_phone: "",
        issued_to_jamath: "",
        issued_to_area: "",
        issued_date: new Date().toISOString().split("T")[0],
        distributed_pages: 50,
        issued_by: "",
        is_deposited: mode === "deposit",
        return_date: mode === "deposit" ? new Date().toISOString().split("T")[0] : "",
        used_pages: 0,
        returned_pages: 50,
        total_collected: 0,
        payment_method: "Cash",
        deposit_voucher_no: "",
        received_by: "",
        due_amount: 0,
        status: mode === "deposit" ? "RETURNED" : (mode === "distribute" ? "ISSUED" : "ISSUED"),
        notes: "",
      });
    }
    setBookModalOpen(true);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook?.book_no?.trim()) {
      alert("রসিদ বই নম্বর প্রদান করুন");
      return;
    }
    if (bookModalMode === "distribute" && !editingBook?.issued_to_name?.trim()) {
      alert("বিতরণ করার জন্য দায়িত্বপ্রাপ্ত ব্যক্তির নাম প্রদান করুন");
      return;
    }

    setLoading(true);

    // Dynamic calculations before saving
    const pageFrom = Number(editingBook.page_from || 1);
    const pageTo = Number(editingBook.page_to || 50);
    const totalPages = Math.max(1, pageTo - pageFrom + 1);
    const ratePerPage = Number(editingBook.rate_per_page || 0);
    const expectedAmount = Number(editingBook.expected_amount || (ratePerPage > 0 ? totalPages * ratePerPage : 0));
    const distributedPages = Number(editingBook.distributed_pages || totalPages);
    const usedPages = Number(editingBook.used_pages || 0);
    const returnedPages = Math.max(0, distributedPages - usedPages);
    const totalCollected = Number(editingBook.total_collected || 0);

    const hasDistributedInfo = Boolean(editingBook.issued_to_name && editingBook.issued_to_name.trim().length > 0);
    const isDistributed = editingBook.is_distributed ?? hasDistributedInfo;
    const isDeposited = editingBook.is_deposited ?? (totalCollected > 0 || editingBook.status === "RETURNED" || editingBook.status === "PARTIALLY_RETURNED");

    let status = editingBook.status || "ISSUED";
    if (totalCollected > 0 && usedPages >= distributedPages && returnedPages === 0) {
      status = "RETURNED";
    } else if (totalCollected > 0 || usedPages > 0) {
      status = "PARTIALLY_RETURNED";
    } else if (isDistributed) {
      status = "ISSUED";
    }

    const payload: Partial<MahfilReceiptBook> = {
      ...editingBook,
      book_no: (editingBook.book_no || `বই #${books.length + 1}`).trim(),
      category: editingBook.category || "সাধারণ অনুদান",
      page_from: pageFrom,
      page_to: pageTo,
      total_pages: totalPages,
      rate_per_page: ratePerPage,
      expected_amount: expectedAmount,
      receipt_type: editingBook.receipt_type || "সাধারণ রসিদ বই",
      is_distributed: isDistributed,
      issued_to_name: (editingBook.issued_to_name || "").trim(),
      issued_to_type: editingBook.issued_to_type || "উস্তাদ",
      issued_to_phone: editingBook.issued_to_phone || "",
      issued_to_jamath: editingBook.issued_to_jamath || "",
      issued_to_area: editingBook.issued_to_area || "",
      issued_date: editingBook.issued_date || new Date().toISOString().split("T")[0],
      distributed_pages: distributedPages,
      issued_by: editingBook.issued_by || "",
      is_deposited: isDeposited,
      return_date: editingBook.return_date || (isDeposited ? new Date().toISOString().split("T")[0] : ""),
      used_pages: usedPages,
      returned_pages: returnedPages,
      total_collected: totalCollected,
      payment_method: editingBook.payment_method || "Cash",
      deposit_voucher_no: editingBook.deposit_voucher_no || "",
      received_by: editingBook.received_by || "",
      due_amount: Number(editingBook.due_amount || 0),
      status: status as any,
      notes: editingBook.notes || "",
    };

    try {
      // 1. Try Server Action
      let res = await saveMahfilReceiptBook(mahfil.id, payload);

      // 2. If Server Action returned error, fallback to API route
      if (res && "error" in res && res.error) {
        console.warn("Server action issue, trying API route fallback:", res.error);
        const apiRes = await fetch("/api/fundraising/mahfil/receipt-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, book: payload }),
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || apiData.error) {
          alert(apiData.error || res.error || "রসিদ বই সংরক্ষণে সমস্যা হয়েছে");
          return;
        }
      }

      setBookModalOpen(false);
      router.refresh();

      // Optimistic UI state update
      const fullBook: MahfilReceiptBook = {
        ...payload,
        id: editingBook.id || `bk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      } as MahfilReceiptBook;

      const updatedBooks = editingBook.id
        ? books.map(b => b.id === editingBook.id ? fullBook : b)
        : [...books, fullBook];

      setMahfil(prev => ({ ...prev, receipt_books: updatedBooks }));
    } catch (err: any) {
      // Direct API fallback if network or Next.js server action failed
      try {
        const apiRes = await fetch("/api/fundraising/mahfil/receipt-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, book: payload }),
        });
        const apiData = await apiRes.json();
        if (apiRes.ok && !apiData.error) {
          setBookModalOpen(false);
          router.refresh();
          const fullBook: MahfilReceiptBook = {
            ...payload,
            id: editingBook.id || `bk_${Date.now()}`,
          } as MahfilReceiptBook;
          setMahfil(prev => ({
            ...prev,
            receipt_books: editingBook.id ? books.map(b => b.id === editingBook.id ? fullBook : b) : [...books, fullBook]
          }));
          return;
        }
      } catch {}
      alert("রসিদ বই সংরক্ষণে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই রসিদ বইয়ের এন্ট্রি মুছতে চান?")) return;
    try {
      let res = await deleteMahfilReceiptBook(mahfil.id, bookId);
      if (res && "error" in res && res.error) {
        // API fallback
        await fetch(`/api/fundraising/mahfil/receipt-book?mahfilId=${mahfil.id}&bookId=${bookId}`, {
          method: "DELETE",
        });
      }
      setMahfil(prev => ({ ...prev, receipt_books: (prev.receipt_books || []).filter(b => b.id !== bookId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // -------------------------------------------------------------
  // Transaction Handlers
  // -------------------------------------------------------------
  const handleOpenTxnModal = (type: "INCOME" | "EXPENSE", txn?: MahfilTransaction) => {
    if (txn) {
      setEditingTxn({ ...txn });
    } else {
      setEditingTxn({
        type,
        category: type === "INCOME" ? "মঞ্চের প্রকাশ্য দান" : "বক্তা হাদিয়া",
        amount: 5000,
        description: "",
        date: new Date().toISOString().split("T")[0],
        receipt_no: `MHF-${Date.now().toString().slice(-4)}`,
        paid_to_or_received_from: "",
        payment_method: "Cash",
        voucher_no: "",
      });
    }
    setTxnModalOpen(true);
  };

  const handleSaveTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn?.amount || editingTxn.amount <= 0) {
      alert("সঠিক পরিমাণ উল্লেখ করুন");
      return;
    }
    setLoading(true);
    try {
      let res = await saveMahfilTransaction(mahfil.id, editingTxn);
      if (res && "error" in res && res.error) {
        const apiRes = await fetch("/api/fundraising/mahfil/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, transaction: editingTxn }),
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || apiData.error) {
          alert(apiData.error || res.error || "লেনদেন সংরক্ষণে সমস্যা হয়েছে");
          return;
        }
      }
      setTxnModalOpen(false);
      router.refresh();
      const updatedTxns = editingTxn.id
        ? (mahfil.transactions || []).map(t => t.id === editingTxn.id ? { ...t, ...editingTxn } as MahfilTransaction : t)
        : [{ ...editingTxn, id: `txn_${Date.now()}` } as MahfilTransaction, ...(mahfil.transactions || [])];
      setMahfil(prev => ({ ...prev, transactions: updatedTxns }));
    } catch (err: any) {
      try {
        const apiRes = await fetch("/api/fundraising/mahfil/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfilId: mahfil.id, transaction: editingTxn }),
        });
        const apiData = await apiRes.json();
        if (apiRes.ok && !apiData.error) {
          setTxnModalOpen(false);
          router.refresh();
          const updatedTxns = editingTxn.id
            ? (mahfil.transactions || []).map(t => t.id === editingTxn.id ? { ...t, ...editingTxn } as MahfilTransaction : t)
            : [{ ...editingTxn, id: `txn_${Date.now()}` } as MahfilTransaction, ...(mahfil.transactions || [])];
          setMahfil(prev => ({ ...prev, transactions: updatedTxns }));
          return;
        }
      } catch {}
      alert("লেনদেন সংরক্ষণে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTxn = async (txnId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ভাউচারটি মুছতে চান?")) return;
    try {
      let res = await deleteMahfilTransaction(mahfil.id, txnId);
      if (res && "error" in res && res.error) {
        await fetch(`/api/fundraising/mahfil/transactions?mahfilId=${mahfil.id}&txnId=${txnId}`, {
          method: "DELETE",
        });
      }
      setMahfil(prev => ({ ...prev, transactions: (prev.transactions || []).filter(t => t.id !== txnId) }));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // -------------------------------------------------------------
  // Mahfil Settlement Handlers (তহবিল সমন্বয় ও ভাউচার হ্যান্ডলার)
  // -------------------------------------------------------------
  const handleOpenSettlementModal = (modeOverride?: "SURPLUS_DEPOSIT" | "DEFICIT_COVER") => {
    const determinedMode = modeOverride || (netBalance >= 0 ? "SURPLUS_DEPOSIT" : "DEFICIT_COVER");
    const defaultAmt = Math.abs(netBalance);

    setSettlementMode(determinedMode);
    setSettlementAmount(defaultAmt);
    setSettlementDate(new Date().toISOString().split("T")[0]);
    setSettlementPaymentMethod("Cash");
    setSettlementNotes("");

    if (availableFunds.length > 0) {
      setSettlementFundId(availableFunds[0].id);
      setSettlementFundName(availableFunds[0].name);
    } else {
      setSettlementFundId("fund-general");
      setSettlementFundName("সাধারণ ফান্ড (General Fund)");
    }
    setSettlementModalOpen(true);
  };

  const handleFundSelectChange = (fundId: string) => {
    setSettlementFundId(fundId);
    const found = availableFunds.find(f => f.id === fundId);
    if (found) {
      setSettlementFundName(found.name);
    }
  };

  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementAmount || settlementAmount <= 0) {
      alert("অনুগ্রহ করে সঠিক টাকার পরিমাণ উল্লেখ করুন।");
      return;
    }
    if (!settlementFundId || !settlementFundName) {
      alert("অনুগ্রহ করে একটি ফান্ড নির্বাচন করুন।");
      return;
    }

    setSettling(true);
    const payload = {
      settlement_type: settlementMode,
      amount: Number(settlementAmount),
      fund_id: settlementFundId,
      fund_name: settlementFundName,
      settlement_date: settlementDate,
      payment_method: settlementPaymentMethod,
      notes: settlementNotes,
    };

    try {
      let res = await settleMahfilFund(mahfil.id, payload);
      if (res && "error" in res && res.error) {
        // Try fallback via API route
        const apiRes = await fetch("/api/fundraising/mahfil/settlement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mahfil_id: mahfil.id, ...payload }),
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || apiData.error) {
          alert(apiData.error || res.error || "তহবিল সমন্বয়ে সমস্যা হয়েছে");
          return;
        }
        res = apiData;
      }

      setSettlementModalOpen(false);
      router.refresh();

      if (res.settlement) {
        const newSettlement = res.settlement;
        setMahfil(prev => ({
          ...prev,
          settlement: newSettlement,
          settlements: [...(prev.settlements || []), newSettlement],
          transactions: payload.settlement_type === "SURPLUS_DEPOSIT"
            ? [
                ...(prev.transactions || []),
                {
                  id: newSettlement.mahfil_txn_id || `txn_settle_${Date.now()}`,
                  mahfil_id: mahfil.id,
                  type: "EXPENSE",
                  category: "উদ্বৃত্ত ফান্ডে স্থানান্তর",
                  amount: Number(payload.amount),
                  description: `মাহফিলের উদ্বৃত্ত অর্থ ${payload.fund_name}-এ স্থানান্তর ও জমা (${newSettlement.accounting_voucher_no})`,
                  date: payload.settlement_date,
                  payment_method: payload.payment_method,
                  receipt_no: newSettlement.accounting_voucher_no,
                }
              ]
            : [
                ...(prev.transactions || []),
                {
                  id: newSettlement.mahfil_txn_id || `txn_settle_${Date.now()}`,
                  mahfil_id: mahfil.id,
                  type: "INCOME",
                  category: "ফান্ড থেকে ঘাটতি পূরণ",
                  amount: Number(payload.amount),
                  description: `${payload.fund_name} থেকে ঘাটতি সমন্বয় বাবদ প্রাপ্তি (${newSettlement.accounting_voucher_no})`,
                  date: payload.settlement_date,
                  payment_method: payload.payment_method,
                  receipt_no: newSettlement.accounting_voucher_no,
                }
              ]
        }));
      }

      alert(res.message || "তহবিল সমন্বয় সফলভাবে সম্পন্ন হয়েছে এবং ভাউচার তৈরি হয়েছে।");
    } catch (err: any) {
      alert("তহবিল সমন্বয়ে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setSettling(false);
    }
  };

  const handleDeleteSettlementItem = async (settlementId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই তহবিল সমন্বয়টি বাতিল করতে চান? এতে মাদরাসা হিসাবের স্বয়ংক্রিয় ভাউচারটিও মুছে যাবে।")) return;
    setLoading(true);
    try {
      let res = await deleteMahfilSettlement(mahfil.id, settlementId);
      if (res && "error" in res && res.error) {
        const apiRes = await fetch(`/api/fundraising/mahfil/settlement?mahfil_id=${mahfil.id}&settlement_id=${settlementId}`, {
          method: "DELETE",
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || apiData.error) {
          alert(apiData.error || res.error || "সমন্বয় বাতিল করতে সমস্যা হয়েছে");
          return;
        }
      }

      setMahfil(prev => {
        const remainingSettlements = (prev.settlements || []).filter(s => s.id !== settlementId);
        const targetSettlement = (prev.settlements || []).find(s => s.id === settlementId) || prev.settlement;
        const filteredTxns = targetSettlement?.mahfil_txn_id
          ? (prev.transactions || []).filter(t => t.id !== targetSettlement.mahfil_txn_id)
          : (prev.transactions || []);

        return {
          ...prev,
          settlements: remainingSettlements,
          settlement: remainingSettlements.length > 0 ? remainingSettlements[remainingSettlements.length - 1] : undefined,
          transactions: filteredTxns,
        };
      });

      router.refresh();
      alert("তহবিল সমন্বয় ও ভাউচার সফলভাবে বাতিল করা হয়েছে।");
    } catch (err) {
      alert("বাতিল করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/fundraising/mahfil"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="তালিকায় ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{mahfil.title}</h1>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                {mahfil.year} {mahfil.hijri_year ? `(${mahfil.hijri_year})` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {toBanglaNumber(mahfil.start_date)} {mahfil.end_date !== mahfil.start_date ? `থেকে ${toBanglaNumber(mahfil.end_date)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {mahfil.venue || "মাদ্রাসা প্রাঙ্গণ"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("audit")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>অডিট ও ব্যালেন্স শীট</span>
          </button>
        </div>
      </div>

      {/* Dynamic Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">রশিদ বই (মোট)</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(totalBooksCount)} টি
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
            মোট পাতা: {toBanglaNumber(totalReceiptPages)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">বিতরণকৃত বই</span>
            <Send className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-xl font-bold text-blue-700 mt-1 block">
            {toBanglaNumber(distributedBooksCount)} টি
          </span>
          <span className="text-[11px] text-blue-600/80 font-medium block mt-0.5">
            স্টকে: {toBanglaNumber(inStockBooksCount)} টি ({toBanglaNumber(distributionPercentage)}%)
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">মোট জমা (আদায়)</span>
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalCollectedAmount)}
          </span>
          <span className="text-[11px] text-emerald-600/80 font-medium block mt-0.5">
            ব্যবহৃত পাতা: {toBanglaNumber(totalUsedPages)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">মঞ্চ ও সরাসরি দান</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-xl font-bold text-indigo-700 mt-1 block">
            ৳ {toBanglaNumber(directIncome)}
          </span>
          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
            ভাউচার সংখ্যা: {toBanglaNumber((mahfil.transactions || []).filter(t => t.type === "INCOME").length)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">সর্বমোট ব্যয়</span>
            <TrendingUp className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-xl font-bold text-rose-700 mt-1 block">
            ৳ {toBanglaNumber(totalExpense)}
          </span>
          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
            বক্তা হাদিয়া ও ডেকোরেশন
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">নিট স্থিতি / উদ্বৃত্ত</span>
            <CheckCircle className={`w-4 h-4 ${netBalance >= 0 ? "text-emerald-600" : "text-red-600"}`} />
          </div>
          <span className={`text-xl font-bold mt-1 block ${netBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            ৳ {toBanglaNumber(netBalance)}
          </span>
          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
            মোট আয়: ৳ {toBanglaNumber(totalIncome)}
          </span>
        </div>
      </div>

      {/* Mahfil Fund Coordination Banner (তহবিল সমন্বয় ও অটোমেটিক ভাউচার বার) */}
      <div className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        mahfil.settlement || (mahfil.settlements && mahfil.settlements.length > 0)
          ? "bg-emerald-50/80 border-emerald-200"
          : netBalance > 0
          ? "bg-blue-50/70 border-blue-200"
          : netBalance < 0
          ? "bg-rose-50/70 border-rose-200"
          : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            mahfil.settlement || (mahfil.settlements && mahfil.settlements.length > 0)
              ? "bg-emerald-600 text-white"
              : netBalance > 0
              ? "bg-blue-600 text-white"
              : netBalance < 0
              ? "bg-rose-600 text-white"
              : "bg-slate-700 text-white"
          }`}>
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900">
                মাহফিলের আয়-ব্যয় তহবিল সমন্বয় ও হিসাব ভাউচার
              </h4>
              {mahfil.settlement ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  সমন্বিত ({mahfil.settlement.settlement_type === "SURPLUS_DEPOSIT" ? "উদ্বৃত্ত জমা" : "ঘাটতি পূরণ"})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  অপেক্ষমাণ (Pending)
                </span>
              )}
            </div>

            {mahfil.settlement ? (
              <p className="text-xs text-slate-600 mt-0.5">
                {mahfil.settlement.settlement_type === "SURPLUS_DEPOSIT" ? "উদ্বৃত্ত অর্থ" : "ঘাটতি পূরণ বাবদ"} <strong className="text-slate-900">৳ {toBanglaNumber(mahfil.settlement.amount)}</strong> &rarr; <span className="font-semibold text-emerald-800">{mahfil.settlement.fund_name}</span>-এ সমন্বিত। স্বয়ংক্রিয় ভাউচার নং: <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">{mahfil.settlement.accounting_voucher_no}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-600 mt-0.5">
                {netBalance > 0
                  ? `মাহফিলে উদ্বৃত্ত জমা রয়েছে ৳ ${toBanglaNumber(netBalance)}। এই অর্থ সাধারণ ফান্ড বা নির্দিষ্ট ফান্ডে জমা করে স্বয়ংক্রিয় ভাউচার তৈরি করুন।`
                  : netBalance < 0
                  ? `মাহফিলে ঘাটতি রয়েছে ৳ ${toBanglaNumber(Math.abs(netBalance))}। অন্য কোনো ফান্ড থেকে এই ঘাটতি পূরণ করে স্বয়ংক্রিয় খরচ ভাউচার তৈরি করুন।`
                  : "মাহফিলের আয় এবং ব্যয় সমপরিমাণ রয়েছে। কোনো তহবিল সমন্বয় প্রয়োজন নেই।"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {mahfil.settlement ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenSettlementModal(netBalance >= 0 ? "SURPLUS_DEPOSIT" : "DEFICIT_COVER")}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন সমন্বয়</span>
              </button>
              <button
                onClick={() => mahfil.settlement && handleDeleteSettlementItem(mahfil.settlement.id)}
                disabled={loading}
                className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
                title="সমন্বয় ও ভাউচার বাতিল করুন"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>বাতিল</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleOpenSettlementModal(netBalance >= 0 ? "SURPLUS_DEPOSIT" : "DEFICIT_COVER")}
              className={`px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs text-white ${
                netBalance > 0
                  ? "bg-blue-600 hover:bg-blue-700"
                  : netBalance < 0
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>
                {netBalance > 0
                  ? `উদ্বৃত্ত ৳ ${toBanglaNumber(netBalance)} ফান্ডে জমা করুন`
                  : netBalance < 0
                  ? `ঘাটতি ৳ ${toBanglaNumber(Math.abs(netBalance))} ফান্ড থেকে পূরণ করুন`
                  : "তহবিল সমন্বয় করুন"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation (রশিদ, বিতরণ এবং জমা সম্পূর্ণ আলাদা ফিল্ড ও মেনু) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 flex items-center gap-1 shadow-xs overflow-x-auto">
        {[
          { id: "receipts", label: "১. রশিদ (রসিদ বই)", icon: Receipt, count: totalBooksCount },
          { id: "distribution", label: "২. বিতরণ (বিতরণ রেজিস্টার)", icon: Send, count: distributedBooksCount },
          { id: "deposits", label: "৩. জমা (আদায় ও জমা)", icon: ArrowDownToLine, count: depositedBooks.length },
          { id: "speakers", label: "বক্তা ও অতিথি সূচি", icon: Users, count: mahfil.speakers?.length || 0 },
          { id: "finance", label: "আয় ও ব্যয় খতিয়ান", icon: DollarSign, count: mahfil.transactions?.length || 0 },
          { id: "audit", label: "অডিট রিপোর্ট ও প্রিন্ট", icon: FileText, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                  {toBanglaNumber(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: রসিদ বই (RECEIPT BOOKS MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <span>রশিদ বই ব্যবস্থাপনা</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                রশিদ বই ক্রম, পাতা রেঞ্জ, খাতের তালিকা, প্রতি পাতার দর ও লক্ষ্যমাত্রা ব্যবস্থাপনা
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenBookModal("create_book")}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন রশিদ বই তৈরি</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="বই নং, খাত বা নাম দিয়ে খুঁজুন..."
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                className="w-full bg-transparent border-none focus:outline-hidden text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">খাত:</span>
              <select
                value={receiptCategoryFilter}
                onChange={(e) => setReceiptCategoryFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">সকল খাত</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50 text-emerald-600" />
              <p className="font-bold text-sm text-slate-700">কোনো রশিদ বই পাওয়া যায়নি</p>
              <p className="text-xs mt-1 text-slate-500">উপরে 'নতুন রশিদ বই তৈরি' বাটনে ক্লিক করে রশিদ বই যোগ করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">বই নম্বর</th>
                      <th className="py-3 px-4">পাতা রেঞ্জ</th>
                      <th className="py-3 px-4">মোট পাতা</th>
                      <th className="py-3 px-4">খাত / ফান্ড</th>
                      <th className="py-3 px-4">পাতার দর / লক্ষ্যমাত্রা</th>
                      <th className="py-3 px-4">বিতরণ অবস্থা</th>
                      <th className="py-3 px-4">আদায়কৃত জমা</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBooks.map((bk) => (
                      <tr key={bk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{bk.book_no}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {toBanglaNumber(bk.page_from)} হতে {toBanglaNumber(bk.page_to)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {toBanglaNumber(bk.total_pages)} পাতা
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-[11px]">
                            {bk.category || "সাধারণ অনুদান"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {bk.rate_per_page ? (
                            <span>প্রতি পাতা ৳ {toBanglaNumber(bk.rate_per_page)} (মোট ৳ {toBanglaNumber(bk.expected_amount || ((bk.total_pages || 50) * bk.rate_per_page))})</span>
                          ) : (
                            <span className="text-slate-400">উন্মুক্ত দান</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {bk.issued_to_name ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                              বিতরণকৃত: {bk.issued_to_name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded text-[10px]">
                              স্টকে সংরক্ষিত (অবিতরণকৃত)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                          ৳ {toBanglaNumber(bk.total_collected || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!bk.issued_to_name && (
                              <button
                                onClick={() => handleOpenBookModal("distribute", bk)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-[10px] flex items-center gap-1"
                                title="বিতরণ করুন"
                              >
                                <Send className="w-3 h-3" />
                                <span>বিতরণ</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenBookModal("full_edit", bk)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                              title="সম্পাদনা করুন"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBook(bk.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: বিতরণ রেজিস্টার (DISTRIBUTION MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === "distribution" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                <span>রশিদ বই বিতরণ রেজিস্টার</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                উস্তাদ, ছাত্র, কমিটি সদস্য বা প্রতিনিধিদের নামে রশিদ বই বিতরণ ও দায়িত্বপ্রাপ্ত এলাকা রেকর্ড করুন
              </p>
            </div>
            <button
              onClick={() => handleOpenBookModal("distribute")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন রশিদ বই বিতরণ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">মোট বিতরণকৃত বই</span>
              <span className="text-lg font-bold text-blue-700 block mt-0.5">{toBanglaNumber(distributedBooksCount)} টি</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">বিতরণকৃত পাতা</span>
              <span className="text-lg font-bold text-slate-800 block mt-0.5">{toBanglaNumber(distributedPagesTotal)} পাতা</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">স্টকে থাকা বই</span>
              <span className="text-lg font-bold text-amber-700 block mt-0.5">{toBanglaNumber(inStockBooksCount)} টি</span>
            </div>
          </div>

          {distributedBooks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Send className="w-10 h-10 mx-auto mb-2 opacity-50 text-blue-500" />
              <p className="font-bold text-sm text-slate-700">এখনো কোনো রশিদ বিতরণ রেকর্ড করা হয়নি</p>
              <p className="text-xs mt-1 text-slate-500">উস্তাদ, ছাত্র বা স্বেচ্ছাসেবকদের নামে রশিদ বই বিতরণ শুরু করতে ওপরের বাটনে ক্লিক করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">বই নম্বর</th>
                      <th className="py-3 px-4">কার নামে বিতরণ</th>
                      <th className="py-3 px-4">পদবি / জামাত</th>
                      <th className="py-3 px-4">মোবাইল</th>
                      <th className="py-3 px-4">দায়িত্বপ্রাপ্ত এলাকা</th>
                      <th className="py-3 px-4">বিতরণ তারিখ</th>
                      <th className="py-3 px-4">বিতরণকৃত পাতা</th>
                      <th className="py-3 px-4">বর্তমান অবস্থা</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {distributedBooks.map((bk) => (
                      <tr key={bk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{bk.book_no}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{bk.issued_to_name}</span>
                          <span className="text-[10px] text-slate-400">{bk.category}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[11px]">
                            {bk.issued_to_type} {bk.issued_to_jamath ? `(${bk.issued_to_jamath})` : ""}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{bk.issued_to_phone || "-"}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{bk.issued_to_area || "সাধারণ"}</td>
                        <td className="py-3 px-4 text-slate-600">{toBanglaNumber(bk.issued_date)}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{toBanglaNumber(bk.distributed_pages || bk.total_pages)} পাতা</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            bk.status === "RETURNED" ? "bg-emerald-100 text-emerald-800" :
                            bk.status === "PARTIALLY_RETURNED" ? "bg-amber-100 text-amber-800" :
                            bk.status === "OVERDUE" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {bk.status === "RETURNED" ? "জমা সম্পন্ন" :
                             bk.status === "PARTIALLY_RETURNED" ? "আংশিক জমা" :
                             bk.status === "OVERDUE" ? "বকেয়া" : "বিতরণকৃত"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenBookModal("deposit", bk)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[10px] flex items-center gap-1"
                              title="আদায় ও জমা এন্ট্রি"
                            >
                              <ArrowDownToLine className="w-3 h-3" />
                              <span>জমা</span>
                            </button>
                            <button
                              onClick={() => handleOpenBookModal("distribute", bk)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded"
                              title="বিতরণ তথ্য সম্পাদনা"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBook(bk.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: জমা ও আদায় বিবরণী (DEPOSIT & COLLECTION MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
                <span>রশিদ আদায় ও জমা রেজিস্টার</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ব্যবহৃত পাতা, ফেরত পাতা, জমাকৃত অর্থ (৳), জমার মেমো ও ক্যাশিয়ার জমা খতিয়ান
              </p>
            </div>
            <button
              onClick={() => handleOpenBookModal("deposit")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন আদায় ও জমা এন্ট্রি</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">সর্বমোট জমা</span>
              <span className="text-xl font-bold text-emerald-700 block mt-0.5">৳ {toBanglaNumber(totalCollectedAmount)}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">ব্যবহৃত রসিদ</span>
              <span className="text-xl font-bold text-slate-800 block mt-0.5">{toBanglaNumber(totalUsedPages)} পাতা</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">ফেরত রসিদ</span>
              <span className="text-xl font-bold text-blue-700 block mt-0.5">{toBanglaNumber(totalReturnedPages)} পাতা</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">পূর্ণাঙ্গ জমা বই</span>
              <span className="text-xl font-bold text-emerald-800 block mt-0.5">{toBanglaNumber(fullyReturnedBooksCount)} টি</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">বই নম্বর</th>
                    <th className="py-3 px-4">গ্রহীতা / জমা প্রদানকারী</th>
                    <th className="py-3 px-4">জমার তারিখ</th>
                    <th className="py-3 px-4">ব্যবহৃত পাতা</th>
                    <th className="py-3 px-4">ফেরত পাতা</th>
                    <th className="py-3 px-4">জমাকৃত টাকা (৳)</th>
                    <th className="py-3 px-4">মাধ্যম / মেমো নং</th>
                    <th className="py-3 px-4">ক্যাশিয়ার</th>
                    <th className="py-3 px-4">স্ট্যাটাস</th>
                    <th className="py-3 px-4 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {books.filter(b => (b.total_collected || 0) > 0 || b.status === "RETURNED" || b.status === "PARTIALLY_RETURNED" || b.used_pages).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        এখনো কোনো জমার তথ্য যুক্ত করা হয়নি। 'নতুন আদায় ও জমা এন্ট্রি' বাটনে ক্লিক করে জমা এন্ট্রি দিন।
                      </td>
                    </tr>
                  ) : (
                    books
                      .filter(b => (b.total_collected || 0) > 0 || b.status === "RETURNED" || b.status === "PARTIALLY_RETURNED" || b.used_pages)
                      .map((bk) => (
                        <tr key={bk.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{bk.book_no}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{bk.issued_to_name || "নামবিহীন"}</span>
                            <span className="text-[10px] text-slate-400">{bk.category}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{bk.return_date ? toBanglaNumber(bk.return_date) : toBanglaNumber(bk.issued_date)}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{toBanglaNumber(bk.used_pages || 0)}</td>
                          <td className="py-3 px-4 text-slate-600">{toBanglaNumber(bk.returned_pages || 0)}</td>
                          <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                            ৳ {toBanglaNumber(bk.total_collected || 0)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span>{bk.payment_method || "Cash"}</span>
                            {bk.deposit_voucher_no && <span className="block font-mono text-[10px] text-slate-400">#{bk.deposit_voucher_no}</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{bk.received_by || "ক্যাশিয়ার"}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              bk.status === "RETURNED" ? "bg-emerald-100 text-emerald-800" :
                              bk.status === "PARTIALLY_RETURNED" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {bk.status === "RETURNED" ? "পূর্ণাঙ্গ জমা" :
                               bk.status === "PARTIALLY_RETURNED" ? "আংশিক জমা" : "চলমান"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenBookModal("deposit", bk)}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                                title="সম্পাদনা করুন"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBook(bk.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SPEAKERS */}
      {/* ========================================================================= */}
      {activeTab === "speakers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">সম্মানিত বক্তা ও অতিথি সময়সূচি</h3>
            <button
              onClick={() => handleOpenSpeakerModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বক্তা যোগ করুন</span>
            </button>
          </div>

          {(mahfil.speakers || []).length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">এখনো কোনো বক্তার তথ্য যুক্ত করা হয়নি</p>
              <p className="text-xs mt-1">ওপরের বাটন চেপে সম্মানিত মেহমানদের তালিকা ও বয়ানের সময়সূচি এন্ট্রি করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ক্রমিক</th>
                      <th className="py-3 px-4">বক্তার নাম ও উপাধি</th>
                      <th className="py-3 px-4">প্রতিষ্ঠান / পরিচয়</th>
                      <th className="py-3 px-4">বয়ানের বিষয়</th>
                      <th className="py-3 px-4">নির্ধারিত সময়</th>
                      <th className="py-3 px-4">মোবাইল</th>
                      <th className="py-3 px-4">হাদিয়া (ধার্য / প্রদত্ত)</th>
                      <th className="py-3 px-4">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mahfil.speakers.map((spk, idx) => (
                      <tr key={spk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-500">{toBanglaNumber(idx + 1)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {spk.title ? `${spk.title} ` : ""}{spk.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{spk.designation || "-"}</td>
                        <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">{spk.topic || "-"}</td>
                        <td className="py-3 px-4 font-semibold text-emerald-800 bg-emerald-50/50">{spk.time_slot || "-"}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{spk.phone || "-"}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          ৳ {toBanglaNumber(spk.agreed_hadia || 0)} / <span className="text-emerald-600">৳ {toBanglaNumber(spk.paid_hadia || 0)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            spk.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                            spk.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                            spk.status === "DECLINED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {spk.status === "CONFIRMED" ? "নিশ্চিত" :
                             spk.status === "COMPLETED" ? "উপস্থিত" :
                             spk.status === "DECLINED" ? "অপারগ" : "আমন্ত্রিত"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenSpeakerModal(spk)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpeaker(spk.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FINANCE & VOUCHERS */}
      {/* ========================================================================= */}
      {activeTab === "finance" && (
        <div className="space-y-4">
          {/* Fund Settlement & Accounting Integration Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/60">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>মাহফিল সমাপনী তহবিল সমন্বয় (Fund Settlement)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      অটোমেটিক ভাউচার
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    মাহফিলের উদ্বৃত্ত অর্থ নির্দিষ্ট ফান্ডে জমা বা ঘাটতি অন্য ফান্ড থেকে পূরণ করার স্বয়ংক্রিয় অ্যাকাউন্টিং সমন্বয়
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenSettlementModal(netBalance >= 0 ? "SURPLUS_DEPOSIT" : "DEFICIT_COVER")}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>তহবিল সমন্বয় / ভাউচার তৈরি</span>
              </button>
            </div>

            {/* Settlements List / Records */}
            {(mahfil.settlements || (mahfil.settlement ? [mahfil.settlement] : [])).length === 0 ? (
              <div className="bg-slate-50/60 p-4 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    এখনো কোনো তহবিল সমন্বয় করা হয়নি। বর্তমান নিট স্থিতি: <strong className={netBalance >= 0 ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>৳ {toBanglaNumber(netBalance)}</strong>
                  </span>
                </div>
                <button
                  onClick={() => handleOpenSettlementModal(netBalance >= 0 ? "SURPLUS_DEPOSIT" : "DEFICIT_COVER")}
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  এখনই সমন্বয় করুন &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-700">সমন্বয় ও ট্রান্সফার রেকর্ডসমূহ:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(mahfil.settlements || (mahfil.settlement ? [mahfil.settlement] : [])).map((st) => (
                    <div key={st.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.settlement_type === "SURPLUS_DEPOSIT" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {st.settlement_type === "SURPLUS_DEPOSIT" ? "উদ্বৃত্ত জমা" : "ঘাটতি পূরণ"}
                          </span>
                          <span className="font-bold text-slate-900">{st.fund_name}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-1 flex items-center gap-2 flex-wrap">
                          <span>তারিখ: {toBanglaNumber(st.settlement_date)}</span>
                          <span>•</span>
                          <span>মেথড: {st.payment_method}</span>
                          <span>•</span>
                          <span className="font-mono font-semibold text-slate-700">ভাউচার: {st.accounting_voucher_no}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          ৳ {toBanglaNumber(st.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteSettlementItem(st.id)}
                          disabled={loading}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="সমন্বয় ও ভাউচার বাতিল করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <h3 className="text-base font-bold text-slate-900">মাহফিলের আয় ও ব্যয় ভাউচার খতিয়ান</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenTxnModal("INCOME")}
                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>আয় / অনুদান ভাউচার</span>
              </button>
              <button
                onClick={() => handleOpenTxnModal("EXPENSE")}
                className="flex items-center gap-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ব্যয় ভাউচার এন্ট্রি</span>
              </button>
            </div>
          </div>

          {(mahfil.transactions || []).length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">এখনো কোনো ভাউচার এন্ট্রি করা হয়নি</p>
              <p className="text-xs mt-1">মঞ্চের দান, স্পন্সর, বক্তা হাদিয়া বা প্যান্ডেল খরচের ভাউচার যুক্ত করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ধরন</th>
                      <th className="py-3 px-4">তারিখ</th>
                      <th className="py-3 px-4">খাত / বিবরণ</th>
                      <th className="py-3 px-4">গ্রহীতা / দাতা</th>
                      <th className="py-3 px-4">পেমেন্ট মেথড</th>
                      <th className="py-3 px-4">রসিদ / ভাউচার নং</th>
                      <th className="py-3 px-4 text-right">টাকার পরিমাণ</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mahfil.transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                            txn.type === "INCOME" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {txn.type === "INCOME" ? "আয়" : "ব্যয়"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{toBanglaNumber(txn.date)}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{txn.category}</span>
                          {txn.description && <span className="text-[11px] text-slate-500">{txn.description}</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{txn.paid_to_or_received_from || "-"}</td>
                        <td className="py-3 px-4 text-slate-600">{txn.payment_method}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{txn.receipt_no || txn.voucher_no || "-"}</td>
                        <td className={`py-3 px-4 text-right font-bold text-sm ${txn.type === "INCOME" ? "text-emerald-700" : "text-rose-600"}`}>
                          {txn.type === "INCOME" ? "+" : "-"} ৳ {toBanglaNumber(txn.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenTxnModal(txn.type, txn)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTxn(txn.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: অডিট রিপোর্ট ও ব্যালেন্স শীট (AUDIT REPORT WITH COMPLETE RASHID DATA) */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h3 className="text-base font-bold text-slate-900">মাহফিলের পূর্ণাঙ্গ অডিট ও আয়-ব্যয় বিবরণী</h3>
              <p className="text-xs text-slate-500">শুরা কমিটি ও সাধারণ শুভাকাঙ্ক্ষীদের জন্য অফিসিয়াল প্রতিবেদন (রশিদ, বিতরণ ও জমার তথ্য সহ)</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / পিডিএফ ডাউনলোড</span>
            </button>
          </div>

          {/* Printable Container */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs print:p-0 print:border-none print:shadow-none space-y-6 text-slate-900">
            {/* Header */}
            <div className="text-center border-b-2 border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-900">{mahfil.title}</h2>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                শিক্ষাবর্ষ: {mahfil.year} {mahfil.hijri_year ? `(${mahfil.hijri_year})` : ""} | স্থান: {mahfil.venue}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                তারিখ: {toBanglaNumber(mahfil.start_date)} {mahfil.end_date !== mahfil.start_date ? `থেকে ${toBanglaNumber(mahfil.end_date)}` : ""}
              </p>
            </div>

            {/* Financial Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Income Column */}
              <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30">
                <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 mb-3 text-sm flex items-center justify-between">
                  <span>আয়ের বিবরণী (Income)</span>
                  <span>টাকা</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-emerald-100">
                    <span className="text-slate-700 font-bold">রসিদ বই কালেকশন (মোট {toBanglaNumber(totalBooksCount)} টি বই)</span>
                    <span className="font-bold text-emerald-800">৳ {toBanglaNumber(totalCollectedAmount)}</span>
                  </div>
                  {(mahfil.transactions || []).filter(t => t.type === "INCOME").map((t, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-emerald-100">
                      <span className="text-slate-700">{t.category} ({t.paid_to_or_received_from || "সাধারণ"})</span>
                      <span className="font-bold text-slate-900">৳ {toBanglaNumber(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-bold text-emerald-900 border-t-2 border-emerald-300">
                    <span>সর্বমোট আয়:</span>
                    <span>৳ {toBanglaNumber(totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expense Column */}
              <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/30">
                <h4 className="font-bold text-rose-900 border-b border-rose-200 pb-2 mb-3 text-sm flex items-center justify-between">
                  <span>ব্যয়ের বিবরণী (Expenditure)</span>
                  <span>টাকা</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {(mahfil.transactions || []).filter(t => t.type === "EXPENSE").map((t, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-rose-100">
                      <span className="text-slate-700">{t.category} ({t.paid_to_or_received_from || t.description || "-"})</span>
                      <span className="font-bold text-slate-900">৳ {toBanglaNumber(t.amount)}</span>
                    </div>
                  ))}
                  {(mahfil.transactions || []).filter(t => t.type === "EXPENSE").length === 0 && (
                    <p className="text-slate-400 py-2">কোনো ব্যয়ের এন্ট্রি নেই</p>
                  )}
                  <div className="flex justify-between pt-2 text-sm font-bold text-rose-900 border-t-2 border-rose-300">
                    <span>সর্বমোট ব্যয়:</span>
                    <span>৳ {toBanglaNumber(totalExpense)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Summary Box */}
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">চূড়ান্ত ফলাফল:</span>
                <span className="text-sm text-slate-600">মোট আয় - মোট ব্যয়</span>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${netBalance >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {netBalance >= 0 ? "উদ্বৃত্ত: " : "ঘাটতি: "} ৳ {toBanglaNumber(Math.abs(netBalance))}
                </span>
              </div>
            </div>

            {/* তহবিল সমন্বয় ও স্থিতি স্থানান্তর বিবরণী (Fund Settlement & Transfer Statement) */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-700" />
                  <span>তহবিল সমন্বয় ও স্থানান্তর বিবরণী (Fund Coordination Statement)</span>
                </h4>
                <span className="text-xs text-slate-500 font-medium">অ্যাকাউন্টিং ভাউচার ট্র্যাকিং</span>
              </div>

              {(mahfil.settlements || (mahfil.settlement ? [mahfil.settlement] : [])).length === 0 ? (
                <p className="text-xs text-slate-500 py-1">
                  এখনো কোনো তহবিল সমন্বয় করা হয়নি (উদ্বৃত্ত/ঘাটতি অনিষ্পন্ন অবস্থায় রয়েছে)।
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-200/70 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="py-2 px-3">সমন্বয়ের ধরন</th>
                        <th className="py-2 px-3">ফান্ডের নাম</th>
                        <th className="py-2 px-3">তারিখ</th>
                        <th className="py-2 px-3">পেমেন্ট মাধ্যম</th>
                        <th className="py-2 px-3">অ্যাকাউন্টিং ভাউচার নং</th>
                        <th className="py-2 px-3 text-right">টাকার পরিমাণ (৳)</th>
                        <th className="py-2 px-3">মন্তব্য / বিবরণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(mahfil.settlements || (mahfil.settlement ? [mahfil.settlement] : [])).map((st) => (
                        <tr key={st.id} className="hover:bg-white/60">
                          <td className="py-2 px-3 font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                              st.settlement_type === "SURPLUS_DEPOSIT" ? "bg-emerald-100 text-emerald-900" : "bg-blue-100 text-blue-900"
                            }`}>
                              {st.settlement_type === "SURPLUS_DEPOSIT" ? "উদ্বৃত্ত জমা" : "ঘাটতি পূরণ"}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">{st.fund_name}</td>
                          <td className="py-2 px-3">{toBanglaNumber(st.settlement_date)}</td>
                          <td className="py-2 px-3">{st.payment_method}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{st.accounting_voucher_no}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">৳ {toBanglaNumber(st.amount)}</td>
                          <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">{st.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* রসিদ, বিতরণ ও জমার পূর্ণাঙ্গ রিপোর্ট বিবরণী */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">রশিদ বই, বিতরণ ও আদায়ের বিস্তারিত খতিয়ান</h4>
                <span className="text-xs text-slate-500">
                  মোট বই: {toBanglaNumber(totalBooksCount)} টি | বিতরণ: {toBanglaNumber(distributedBooksCount)} টি | মোট আদায়: ৳ {toBanglaNumber(totalCollectedAmount)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">বই নং</th>
                      <th className="py-2 px-3">খাত</th>
                      <th className="py-2 px-3">পাতা রেঞ্জ</th>
                      <th className="py-2 px-3">কার নামে বিতরণ</th>
                      <th className="py-2 px-3">পদবি/এলাকা</th>
                      <th className="py-2 px-3">মোবাইল</th>
                      <th className="py-2 px-3">ব্যবহৃত পাতা</th>
                      <th className="py-2 px-3">ফেরত পাতা</th>
                      <th className="py-2 px-3 text-right">আদায়কৃত টাকা (৳)</th>
                      <th className="py-2 px-3">অবস্থা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {books.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-4 text-center text-slate-400">কোনো রসিদ বইয়ের ডাটা নেই</td>
                      </tr>
                    ) : (
                      books.map((bk) => (
                        <tr key={bk.id}>
                          <td className="py-2 px-3 font-bold">{bk.book_no}</td>
                          <td className="py-2 px-3">{bk.category || "সাধারণ"}</td>
                          <td className="py-2 px-3 font-mono">{toBanglaNumber(bk.page_from)}-{toBanglaNumber(bk.page_to)}</td>
                          <td className="py-2 px-3 font-medium">{bk.issued_to_name || "অবিতরণকৃত"}</td>
                          <td className="py-2 px-3">{bk.issued_to_type || "-"} {bk.issued_to_area ? `/ ${bk.issued_to_area}` : ""}</td>
                          <td className="py-2 px-3 font-mono">{bk.issued_to_phone || "-"}</td>
                          <td className="py-2 px-3">{toBanglaNumber(bk.used_pages || 0)}</td>
                          <td className="py-2 px-3">{toBanglaNumber(bk.returned_pages || 0)}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-800">৳ {toBanglaNumber(bk.total_collected || 0)}</td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-bold">
                              {bk.status === "RETURNED" ? "জমা সম্পন্ন" :
                               bk.status === "PARTIALLY_RETURNED" ? "আংশিক জমা" :
                               bk.issued_to_name ? "বিতরণকৃত" : "স্টকে"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={6} className="py-2 px-3 text-right">সর্বমোট রশিদ কালেকশন:</td>
                      <td className="py-2 px-3">{toBanglaNumber(totalUsedPages)}</td>
                      <td className="py-2 px-3">{toBanglaNumber(totalReturnedPages)}</td>
                      <td className="py-2 px-3 text-right text-emerald-800">৳ {toBanglaNumber(totalCollectedAmount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-16 grid grid-cols-3 gap-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম ক্যাশিয়ার
              </div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মাহফিল পরিচালক / সম্পাদক
              </div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                মুহতারাম মুহতামিম / সভাপতি
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SPEAKER */}
      {/* ========================================================================= */}
      {speakerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingSpeaker?.id ? "বক্তা তথ্য সম্পাদনা" : "নতুন বক্তা যোগ করুন"}</span>
              <button onClick={() => setSpeakerModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveSpeaker} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">উপাধি</label>
                  <input
                    type="text"
                    value={editingSpeaker?.title || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="মাওলানা / মুফতী"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">বক্তার নাম <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingSpeaker?.name || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="বক্তার পুরো নাম"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">প্রতিষ্ঠান / পরিচয়</label>
                <input
                  type="text"
                  value={editingSpeaker?.designation || ""}
                  onChange={(e) => setEditingSpeaker(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="মুহাদ্দিস, জামিয়া... / ঢাকা"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বয়ানের বিষয়</label>
                <input
                  type="text"
                  value={editingSpeaker?.topic || ""}
                  onChange={(e) => setEditingSpeaker(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="যেমন: কুরআন ও সুন্নাহর আলোকে আদর্শ জীবন"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={editingSpeaker?.date || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সময় / অধিবেশন</label>
                  <input
                    type="text"
                    value={editingSpeaker?.time_slot || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, time_slot: e.target.value }))}
                    placeholder="বাদ আসর / বাদ এশা / রাত ৯:০০"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    value={editingSpeaker?.phone || ""}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editingSpeaker?.status || "CONFIRMED"}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="CONFIRMED">নিশ্চিত (Confirmed)</option>
                    <option value="INVITED">আমন্ত্রিত (Invited)</option>
                    <option value="COMPLETED">উপস্থিত (Completed)</option>
                    <option value="DECLINED">অপারগ (Declined)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ধার্যকৃত হাদিয়া (টাকা)</label>
                  <input
                    type="number"
                    value={editingSpeaker?.agreed_hadia || 0}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, agreed_hadia: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">প্রদত্ত হাদিয়া (পরিশোধ)</label>
                  <input
                    type="number"
                    value={editingSpeaker?.paid_hadia || 0}
                    onChange={(e) => setEditingSpeaker(prev => ({ ...prev, paid_hadia: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSpeakerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DYNAMIC RASHID, BITORON & JOMA MODAL (আলাদা ফিল্ড ও মোড) */}
      {/* ========================================================================= */}
      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Modal Title & Sub-tabs */}
            <div className="mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <span>
                    {bookModalMode === "create_book" ? "রশিদ বই তৈরি / তথ্য" :
                     bookModalMode === "distribute" ? "রশিদ বিতরণ ফরম" :
                     bookModalMode === "deposit" ? "রশিদ আদায় ও জমা ফরম" : "রশিদ, বিতরণ ও জমা সম্পূর্ণ তথ্য"}
                  </span>
                </h2>
                <button onClick={() => setBookModalOpen(false)} className="text-slate-400 font-bold p-1 hover:text-slate-700">✕</button>
              </div>

              {/* Fast mode switcher within modal */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setBookModalMode("create_book")}
                  className={`flex-1 py-1.5 px-2 rounded-md font-bold text-center transition-all ${
                    bookModalMode === "create_book" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ১. রশিদ তথ্য
                </button>
                <button
                  type="button"
                  onClick={() => setBookModalMode("distribute")}
                  className={`flex-1 py-1.5 px-2 rounded-md font-bold text-center transition-all ${
                    bookModalMode === "distribute" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ২. বিতরণ তথ্য
                </button>
                <button
                  type="button"
                  onClick={() => setBookModalMode("deposit")}
                  className={`flex-1 py-1.5 px-2 rounded-md font-bold text-center transition-all ${
                    bookModalMode === "deposit" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ৩. জমা ও আদায়
                </button>
                <button
                  type="button"
                  onClick={() => setBookModalMode("full_edit")}
                  className={`flex-1 py-1.5 px-2 rounded-md font-bold text-center transition-all ${
                    bookModalMode === "full_edit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  সকল ফিল্ড
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-4 text-xs">
              {/* ------------------------------------------------------------- */}
              {/* SECTION 1: রশিদ সংক্রান্ত ফিল্ড (Receipt Book Info) */}
              {/* ------------------------------------------------------------- */}
              {(bookModalMode === "create_book" || bookModalMode === "full_edit") && (
                <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>রশিদ সংক্রান্ত মূল ফিল্ড (Receipt Details)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      মোট পাতা: {toBanglaNumber(Math.max(1, Number(editingBook?.page_to || 50) - Number(editingBook?.page_from || 1) + 1))}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">বই নম্বর <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="যেমন: বই #০১"
                        value={editingBook?.book_no || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, book_no: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">পাতা শুরু (হতে)</label>
                      <input
                        type="number"
                        min={1}
                        value={editingBook?.page_from || 1}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingBook(prev => {
                            const pTo = Number(prev?.page_to || 50);
                            const tPages = Math.max(1, pTo - val + 1);
                            const rate = Number(prev?.rate_per_page || 0);
                            return {
                              ...prev,
                              page_from: val,
                              total_pages: tPages,
                              expected_amount: rate > 0 ? tPages * rate : prev?.expected_amount,
                              distributed_pages: prev?.distributed_pages || tPages
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">পাতা শেষ (পর্যন্ত)</label>
                      <input
                        type="number"
                        min={1}
                        value={editingBook?.page_to || 50}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingBook(prev => {
                            const pFrom = Number(prev?.page_from || 1);
                            const tPages = Math.max(1, val - pFrom + 1);
                            const rate = Number(prev?.rate_per_page || 0);
                            return {
                              ...prev,
                              page_to: val,
                              total_pages: tPages,
                              expected_amount: rate > 0 ? tPages * rate : prev?.expected_amount,
                              distributed_pages: prev?.distributed_pages || tPages
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">খাত / অনুদানের ধরন</label>
                      <select
                        value={editingBook?.category || "সাধারণ অনুদান"}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="সাধারণ অনুদান">সাধারণ অনুদান</option>
                        <option value="মাদ্রাসার উন্নয়ন">মাদ্রাসার উন্নয়ন</option>
                        <option value="এতিমখানা ও লিল্লাহ ফান্ড">এতিমখানা ও লিল্লাহ ফান্ড</option>
                        <option value="কিতাব ও লাইব্রেরি ফান্ড">কিতাব ও লাইব্রেরি ফান্ড</option>
                        <option value="মঞ্চের কালেকশন">মঞ্চের কালেকশন</option>
                        <option value="অন্যান্য তহবিল">অন্যান্য তহবিল</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">প্রতি পাতার নির্ধারিত দর (৳)</label>
                      <input
                        type="number"
                        placeholder="যেমন: ১০০ / ৫০০"
                        value={editingBook?.rate_per_page || ""}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          setEditingBook(prev => {
                            const pages = Number(prev?.total_pages || 50);
                            return {
                              ...prev,
                              rate_per_page: rate,
                              expected_amount: rate > 0 ? pages * rate : 0
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">সম্ভাব্য লক্ষ্যমাত্রা (৳)</label>
                      <input
                        type="number"
                        placeholder="স্বয়ংক্রিয় গণনা"
                        value={editingBook?.expected_amount || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, expected_amount: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2: বিতরণ সংক্রান্ত ফিল্ড (Distribution Info) */}
              {/* ------------------------------------------------------------- */}
              {(bookModalMode === "distribute" || bookModalMode === "full_edit") && (
                <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-blue-600" />
                      <span>বিতরণ সংক্রান্ত ফিল্ড (Distribution Details)</span>
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium">রশিদ বই দায়িত্ব প্রদান</span>
                  </div>

                  {bookModalMode === "distribute" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">রশিদ বই নম্বর <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={editingBook?.book_no || ""}
                          onChange={(e) => setEditingBook(prev => ({ ...prev, book_no: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">মোট পাতা</label>
                        <input
                          type="number"
                          value={editingBook?.total_pages || 50}
                          onChange={(e) => setEditingBook(prev => ({ ...prev, total_pages: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        কার নামে বিতরণ (গ্রহীতা) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="উস্তাদ / ছাত্র / সদস্যের পুরো নাম"
                        value={editingBook?.issued_to_name || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">গ্রহীতার পদবি / ধরন</label>
                      <select
                        value={editingBook?.issued_to_type || "উস্তাদ"}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_type: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="উস্তাদ">উস্তাদ</option>
                        <option value="ছাত্র">ছাত্র</option>
                        <option value="কমিটি সদস্য">কমিটি সদস্য</option>
                        <option value="মুহিব্বিন/স্বেচ্ছাসেবক">মুহিব্বিন/স্বেচ্ছাসেবক</option>
                        <option value="প্রতিনিধি">প্রতিনিধি</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জামাত / শ্রেণি বা শাখা</label>
                      <input
                        type="text"
                        placeholder="যেমন: মিশকাত / হেফজ"
                        value={editingBook?.issued_to_jamath || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_jamath: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                      <input
                        type="text"
                        placeholder="017XXXXXXXX"
                        value={editingBook?.issued_to_phone || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">দায়িত্বপ্রাপ্ত এলাকা / মহল্লা</label>
                      <input
                        type="text"
                        placeholder="যেমন: বাজার এলাকা / ঢাকা"
                        value={editingBook?.issued_to_area || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_area: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">বিতরণের তারিখ</label>
                      <input
                        type="date"
                        value={editingBook?.issued_date || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">বিতরণকৃত পাতা সংখ্যা</label>
                      <input
                        type="number"
                        value={editingBook?.distributed_pages || editingBook?.total_pages || 50}
                        onChange={(e) => {
                          const dist = Number(e.target.value);
                          setEditingBook(prev => {
                            const u = Number(prev?.used_pages || 0);
                            return {
                              ...prev,
                              distributed_pages: dist,
                              returned_pages: Math.max(0, dist - u)
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">বিতরণকারী / ইস্যুকারী</label>
                      <input
                        type="text"
                        placeholder="যেমন: নাজেমে তালীমাত"
                        value={editingBook?.issued_by || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, issued_by: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3: জমা সংক্রান্ত ফিল্ড (Deposit & Collection Info) */}
              {/* ------------------------------------------------------------- */}
              {(bookModalMode === "deposit" || bookModalMode === "full_edit") && (
                <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                      <ArrowDownToLine className="w-4 h-4 text-indigo-600" />
                      <span>জমা ও আদায় সংক্রান্ত ফিল্ড (Deposit Details)</span>
                    </span>
                    <span className="text-[11px] text-indigo-700 font-medium">আদায় ও হিসাব মিলানো</span>
                  </div>

                  {bookModalMode === "deposit" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">বই নম্বর</label>
                        <input
                          type="text"
                          value={editingBook?.book_no || ""}
                          onChange={(e) => setEditingBook(prev => ({ ...prev, book_no: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">জমা প্রদানকারী (গ্রহীতা)</label>
                        <input
                          type="text"
                          value={editingBook?.issued_to_name || ""}
                          onChange={(e) => setEditingBook(prev => ({ ...prev, issued_to_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">ব্যবহৃত / আদায়কৃত পাতা</label>
                      <input
                        type="number"
                        min={0}
                        value={editingBook?.used_pages || 0}
                        onChange={(e) => {
                          const used = Number(e.target.value);
                          setEditingBook(prev => {
                            const dist = Number(prev?.distributed_pages || prev?.total_pages || 50);
                            const rem = Math.max(0, dist - used);
                            return {
                              ...prev,
                              used_pages: used,
                              returned_pages: rem
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">ফেরত / অবিক্রিত পাতা</label>
                      <input
                        type="number"
                        min={0}
                        value={editingBook?.returned_pages !== undefined ? editingBook.returned_pages : Math.max(0, Number(editingBook?.distributed_pages || 50) - Number(editingBook?.used_pages || 0))}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, returned_pages: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-emerald-800 mb-1">
                        জমাকৃত মোট টাকা (৳) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={editingBook?.total_collected || 0}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, total_collected: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জমার তারিখ</label>
                      <input
                        type="date"
                        value={editingBook?.return_date || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, return_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জমার মাধ্যম (Payment Method)</label>
                      <select
                        value={editingBook?.payment_method || "Cash"}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, payment_method: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="Cash">নগদ ক্যাশ (Cash)</option>
                        <option value="bKash">বিকাশ (bKash)</option>
                        <option value="Nagad">নগদ (Nagad)</option>
                        <option value="Bank">ব্যাংক অ্যাকাউন্ট</option>
                        <option value="Other">অন্যান্য</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জমার মেমো / ভাউচার নং</label>
                      <input
                        type="text"
                        placeholder="যেমন: DP-001"
                        value={editingBook?.deposit_voucher_no || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, deposit_voucher_no: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জমা গ্রহণকারী ক্যাশিয়ার</label>
                      <input
                        type="text"
                        placeholder="ক্যাশিয়ার / উস্তাদের নাম"
                        value={editingBook?.received_by || ""}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, received_by: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">জমার স্ট্যাটাস</label>
                      <select
                        value={editingBook?.status || "ISSUED"}
                        onChange={(e) => setEditingBook(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold"
                      >
                        <option value="ISSUED">বিতরণকৃত (এখনো জমা বাকি)</option>
                        <option value="PARTIALLY_RETURNED">আংশিক জমা (কিছু পাতা বাকি)</option>
                        <option value="RETURNED">পূর্ণাঙ্গ জমা সম্পন্ন</option>
                        <option value="OVERDUE">বকেয়া / বিলম্বিত</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">মন্তব্য / বিশেষ নোট</label>
                <textarea
                  rows={2}
                  placeholder="কোনো বিশেষ মন্তব্য বা হিসাবের বিবরণ..."
                  value={editingBook?.notes || ""}
                  onChange={(e) => setEditingBook(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  {loading ? <span>সংরক্ষণ হচ্ছে...</span> : <span>সংরক্ষণ করুন</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TRANSACTION */}
      {/* ========================================================================= */}
      {txnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingTxn?.type === "INCOME" ? "আয় / দান ভাউচার" : "ব্যয় ভাউচার এন্ট্রি"}</span>
              <button onClick={() => setTxnModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveTxn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ক্যাটাগরি / খাত</label>
                  <select
                    value={editingTxn?.category || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {editingTxn?.type === "INCOME" ? (
                      <>
                        <option value="মঞ্চের প্রকাশ্য দান">মঞ্চের প্রকাশ্য দান</option>
                        <option value="রসিদ বই কালেকশন">রসিদ বই কালেকশন</option>
                        <option value="দানবাক্স থেকে প্রাপ্ত">দানবাক্স থেকে প্রাপ্ত</option>
                        <option value="বিশেষ স্পন্সর / অনুদান">বিশেষ স্পন্সর / অনুদান</option>
                        <option value="অন্যান্য আয়">অন্যান্য আয়</option>
                      </>
                    ) : (
                      <>
                        <option value="বক্তা হাদিয়া">বক্তা হাদিয়া</option>
                        <option value="প্যান্ডেল ও ডেকোরেশন">প্যান্ডেল ও ডেকোরেশন</option>
                        <option value="মাইক ও সাউন্ড সিস্টেম">মাইক ও সাউন্ড সিস্টেম</option>
                        <option value="মেহমানদারি ও তাবাররুক">মেহমানদারি ও তাবাররুক</option>
                        <option value="প্রচার, মাইকিং ও পোস্টার">প্রচার, মাইকিং ও পোস্টার</option>
                        <option value="আলোকসজ্জা ও বিদ্যুৎ">আলোকসজ্জা ও বিদ্যুৎ</option>
                        <option value="অন্যান্য ব্যয়">অন্যান্য ব্যয়</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">টাকার পরিমাণ <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={editingTxn?.amount || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={editingTxn?.date || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">পেমেন্ট মেথড</label>
                  <select
                    value={editingTxn?.payment_method || "Cash"}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, payment_method: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Cash">নগদ (Cash)</option>
                    <option value="bKash">বিকাশ (bKash)</option>
                    <option value="Nagad">নগদ (Nagad)</option>
                    <option value="Bank">ব্যাংক অ্যাকাউন্ট</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editingTxn?.type === "INCOME" ? "দাতার নাম" : "গ্রহীতা / প্রতিষ্ঠানের নাম"}
                  </label>
                  <input
                    type="text"
                    placeholder="নাম..."
                    value={editingTxn?.paid_to_or_received_from || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, paid_to_or_received_from: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">রসিদ / ভাউচার নং</label>
                  <input
                    type="text"
                    value={editingTxn?.receipt_no || ""}
                    onChange={(e) => setEditingTxn(prev => ({ ...prev, receipt_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বিবরণ / নোট</label>
                <textarea
                  rows={2}
                  value={editingTxn?.description || ""}
                  onChange={(e) => setEditingTxn(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxnModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  ভাউচার সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAHFIL FUND SETTLEMENT & VOUCHER GENERATOR MODAL */}
      {/* ========================================================================= */}
      {settlementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {settlementMode === "SURPLUS_DEPOSIT"
                      ? "মাহফিল উদ্বৃত্ত তহবিল স্থানান্তর ও জমা"
                      : "মাহফিল ব্যয় ঘাটতি পূরণ ও সমন্বয়"}
                  </h3>
                  <p className="text-xs text-slate-500">মাদরাসা অ্যাকাউন্টিংয়ে স্বয়ংক্রিয় ভাউচার ও খতিয়ান পোস্টিং</p>
                </div>
              </div>
              <button
                onClick={() => setSettlementModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-base"
              >
                ✕
              </button>
            </div>

            {/* Financial Overview in Modal */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">মোট আয় ও আদায়</span>
                <span className="font-bold text-slate-900 text-sm">৳ {toBanglaNumber(totalIncome)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">মোট মাহফিল ব্যয়</span>
                <span className="font-bold text-rose-600 text-sm">৳ {toBanglaNumber(totalExpense)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">বর্তমান স্থিতি</span>
                <span className={`font-bold text-sm ${netBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {netBalance >= 0 ? "উদ্বৃত্ত: " : "ঘাটতি: "} ৳ {toBanglaNumber(Math.abs(netBalance))}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteSettlement} className="space-y-3.5 text-xs">
              {/* Type selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">সমন্বয়ের ধরন নির্বাচন করুন</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementMode("SURPLUS_DEPOSIT");
                      if (netBalance > 0) setSettlementAmount(netBalance);
                    }}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      settlementMode === "SURPLUS_DEPOSIT"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>💰 উদ্বৃত্ত ফান্ডে জমা</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementMode("DEFICIT_COVER");
                      if (netBalance < 0) setSettlementAmount(Math.abs(netBalance));
                    }}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      settlementMode === "DEFICIT_COVER"
                        ? "bg-blue-50 border-blue-500 text-blue-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🔄 ঘাটতি ফান্ড থেকে পূরণ</span>
                  </button>
                </div>
              </div>

              {/* Fund Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {settlementMode === "SURPLUS_DEPOSIT" ? "যে ফান্ডে উদ্বৃত্ত জমা হবে *" : "যে ফান্ড থেকে ঘাটতি পূরণ হবে *"}
                </label>
                <select
                  value={settlementFundId}
                  onChange={(e) => handleFundSelectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-900"
                  required
                >
                  {availableFunds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.category ? `(${f.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">টাকার পরিমাণ (৳) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={settlementAmount || ""}
                    onChange={(e) => setSettlementAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                    placeholder="টাকার পরিমাণ..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সমন্বয়ের তারিখ</label>
                  <input
                    type="date"
                    required
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">স্থানান্তর / পেমেন্ট মাধ্যম</label>
                <select
                  value={settlementPaymentMethod}
                  onChange={(e) => setSettlementPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Cash">নগদ ক্যাশ (Cash)</option>
                  <option value="Bank">ব্যাংক ট্রান্সফার / অ্যাকাউন্ট</option>
                  <option value="bKash">বিকাশ (bKash)</option>
                  <option value="Nagad">নগদ (Nagad)</option>
                  <option value="Other">অন্যান্য</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">বিবরণ / অনুমোদনের নোট</label>
                <textarea
                  rows={2}
                  placeholder="যেমন: শুরা কমিটির সিদ্ধান্ত অনুযায়ী উদ্বৃত্ত অর্থ সাধারণ ফান্ডে স্থানান্তর..."
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              {/* Automatic Voucher Explanatory Note */}
              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                settlementMode === "SURPLUS_DEPOSIT"
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-blue-50/70 border-blue-200 text-blue-900"
              }`}>
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  {settlementMode === "SURPLUS_DEPOSIT" ? (
                    <>
                      <strong>অটোমেটিক ভাউচার সুবিধা:</strong> এই সমন্বয়টি নিশ্চিত করলে মূল মাদরাসার সাধারণ হিসাব বহিতে স্বয়ংক্রিয়ভাবে একটি <strong>[জমা ভাউচার]</strong> তৈরি হবে এবং নির্বাচিত ফান্ডে <strong>৳ {toBanglaNumber(settlementAmount)}</strong> জমা হিসেবে নথিভুক্ত হবে।
                    </>
                  ) : (
                    <>
                      <strong>অটোমেটিক ভাউচার সুবিধা:</strong> এই সমন্বয়টি নিশ্চিত করলে মূল মাদরাসার সাধারণ হিসাব বহিতে স্বয়ংক্রিয়ভাবে একটি <strong>[ব্যয়/স্থানান্তর ভাউচার]</strong> তৈরি হবে এবং মাহফিলের ঘাটতি সমন্বয় করা হবে।
                    </>
                  )}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlementModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className={`px-5 py-2 font-bold rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-colors ${
                    settlementMode === "SURPLUS_DEPOSIT"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {settling ? (
                    <span>প্রক্রিয়াধীন হচ্ছে...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>সমন্বয় নিশ্চিত করুন এবং ভাউচার তৈরি করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
