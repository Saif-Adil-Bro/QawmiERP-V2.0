"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Layers,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  Truck,
  MapPin,
  Phone,
  User,
  Calendar,
  Edit2,
  Trash2,
  Clock,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Receipt,
  X
} from "lucide-react";
import {
  QurbaniLeatherBatch,
  CollectionBox,
  BoxCollectionLog
} from "@/lib/fundraising-types";
import {
  saveLeatherCollection,
  deleteLeatherCollection,
  saveCollectionBox,
  deleteCollectionBox,
  recordBoxOpening
} from "@/app/actions/fundraising";
import { numberToBanglaWords } from "@/lib/utils";

function toBanglaNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "০";
  const banglaDigits: { [key: string]: string } = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  return val.toString().replace(/[0-9]/g, (w) => banglaDigits[w] || w);
}

export default function CollectionsClient({
  initialLeathers,
  initialBoxes,
}: {
  initialLeathers: QurbaniLeatherBatch[];
  initialBoxes: CollectionBox[];
}) {
  const router = useRouter();
  const [leathers, setLeathers] = useState<QurbaniLeatherBatch[]>(initialLeathers);
  const [boxes, setBoxes] = useState<CollectionBox[]>(initialBoxes);
  const [activeTab, setActiveTab] = useState<"leather" | "boxes">("leather");

  // Search
  const [search, setSearch] = useState("");

  // Modals
  const [leatherModalOpen, setLeatherModalOpen] = useState(false);
  const [editingLeather, setEditingLeather] = useState<Partial<QurbaniLeatherBatch> | null>(null);

  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<Partial<CollectionBox> | null>(null);

  // Box Open / Log Modal
  const [openLogModal, setOpenLogModal] = useState(false);
  const [selectedBoxForOpen, setSelectedBoxForOpen] = useState<CollectionBox | null>(null);
  const [logFormData, setLogFormData] = useState({
    amount: 1500,
    date: new Date().toISOString().split("T")[0],
    witnesses: "মুহতামিম ও ক্যাশিয়ার",
    receipt_no: `BOX-${Date.now().toString().slice(-4)}`,
    notes: "",
  });

  // Print Modals
  const [printLeatherMemo, setPrintLeatherMemo] = useState<QurbaniLeatherBatch | null>(null);
  const [printBoxLogMemo, setPrintBoxLogMemo] = useState<{ box: CollectionBox; log: BoxCollectionLog } | null>(null);
  const [printReportOpen, setPrintReportOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  // Stats
  const totalLeatherPcs = leathers.reduce((acc, l) => acc + (l.quantity || 0), 0);
  const totalLeatherGross = leathers.reduce((acc, l) => acc + (l.total_sale_amount || 0), 0);
  const totalLeatherCost = leathers.reduce((acc, l) => acc + (l.transport_labor_cost || 0), 0);
  const totalLeatherNetIncome = leathers.reduce((acc, l) => acc + (l.net_profit || 0), 0);

  const totalBoxesCount = boxes.length;
  const activeBoxesCount = boxes.filter((b) => b.status === "ACTIVE").length;
  const totalBoxCollections = boxes.reduce(
    (acc, b) => acc + (b.total_collected_lifetime || b.total_collected || 0),
    0
  );

  // Filtered
  const filteredLeathers = leathers.filter(
    (l) =>
      (l.buyer_name && l.buyer_name.toLowerCase().includes(search.toLowerCase())) ||
      (l.type && l.type.toLowerCase().includes(search.toLowerCase())) ||
      (l.year && l.year.includes(search))
  );

  const filteredBoxes = boxes.filter(
    (b) =>
      (b.location_name && b.location_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.box_code && b.box_code.toLowerCase().includes(search.toLowerCase())) ||
      (b.area && b.area.toLowerCase().includes(search.toLowerCase())) ||
      (b.responsible_person && b.responsible_person.toLowerCase().includes(search.toLowerCase()))
  );

  // Actions for Leather
  const handleOpenCreateLeather = () => {
    setEditingLeather({
      year: "২০২৬",
      type: "গরু",
      quantity: 50,
      rate_per_piece: 850,
      total_sale_amount: 42500,
      transport_labor_cost: 3500,
      net_profit: 39000,
      buyer_name: "",
      buyer_phone: "",
      sale_date: new Date().toISOString().split("T")[0],
      due_amount: 0,
      notes: "",
    });
    setLeatherModalOpen(true);
  };

  const handleOpenEditLeather = (l: QurbaniLeatherBatch) => {
    setEditingLeather({ ...l });
    setLeatherModalOpen(true);
  };

  const handleSaveLeather = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeather?.quantity || !editingLeather?.rate_per_piece) {
      alert("পরিমাণ ও দর আবশ্যক");
      return;
    }
    setLoading(true);
    try {
      const res = await saveLeatherCollection(editingLeather);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setLeatherModalOpen(false);
      router.refresh();

      if (editingLeather.id) {
        setLeathers((prev) =>
          prev.map((l) => (l.id === editingLeather.id ? ({ ...l, ...editingLeather } as QurbaniLeatherBatch) : l))
        );
      } else if (res.id) {
        const newItem = {
          ...editingLeather,
          id: res.id,
          created_at: new Date().toISOString(),
        } as QurbaniLeatherBatch;
        setLeathers((prev) => [newItem, ...prev]);
        setPrintLeatherMemo(newItem); // Instant invoice print option
      }
    } catch (err) {
      alert("চামড়ার তথ্য সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeather = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই চামড়া চালানের রেকর্ড মুছে ফেলতে চান?")) return;
    try {
      await deleteLeatherCollection(id);
      setLeathers((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // Actions for Box
  const handleOpenCreateBox = () => {
    const nextCode = `BOX-${(boxes.length + 1).toString().padStart(3, "0")}`;
    setEditingBox({
      box_code: nextCode,
      location_name: "",
      area: "বাজার এলাকা",
      installation_date: new Date().toISOString().split("T")[0],
      responsible_person: "",
      responsible_phone: "",
      status: "ACTIVE",
      total_collected_lifetime: 0,
      collection_logs: [],
    });
    setBoxModalOpen(true);
  };

  const handleOpenEditBox = (b: CollectionBox) => {
    setEditingBox({ ...b });
    setBoxModalOpen(true);
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBox?.box_code || !editingBox?.location_name) {
      alert("বক্স কোড ও অবস্থান আবশ্যক");
      return;
    }
    setLoading(true);
    try {
      const res = await saveCollectionBox(editingBox);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setBoxModalOpen(false);
      router.refresh();

      if (editingBox.id) {
        setBoxes((prev) =>
          prev.map((b) => (b.id === editingBox.id ? ({ ...b, ...editingBox } as CollectionBox) : b))
        );
      } else if (res.id) {
        setBoxes((prev) => [
          {
            ...editingBox,
            id: res.id,
            total_collected_lifetime: 0,
            collection_logs: [],
            created_at: new Date().toISOString(),
          } as CollectionBox,
          ...prev,
        ]);
      }
    } catch (err) {
      alert("দানবাক্স সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBox = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই দানবাক্স রেকর্ড মুছে ফেলতে চান?")) return;
    try {
      await deleteCollectionBox(id);
      setBoxes((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch (err) {
      alert("মুছতে সমস্যা হয়েছে");
    }
  };

  // Open & Record Box Collection
  const handleOpenBoxModal = (b: CollectionBox) => {
    setSelectedBoxForOpen(b);
    setLogFormData({
      amount: 1500,
      date: new Date().toISOString().split("T")[0],
      witnesses: "মুহতামিম ও ক্যাশিয়ার",
      receipt_no: `BOX-${Date.now().toString().slice(-4)}`,
      notes: "",
    });
    setOpenLogModal(true);
  };

  const handleSaveBoxOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoxForOpen) return;
    setLoading(true);
    try {
      const res = await recordBoxOpening({
        box_id: selectedBoxForOpen.id,
        amount: Number(logFormData.amount),
        date: logFormData.date,
        witnesses: logFormData.witnesses,
        receipt_no: logFormData.receipt_no,
        notes: logFormData.notes,
      });

      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }

      setOpenLogModal(false);
      router.refresh();

      const newLog: BoxCollectionLog = {
        id: `log_${Date.now()}`,
        box_id: selectedBoxForOpen.id,
        amount: Number(logFormData.amount),
        date: logFormData.date,
        witnesses: logFormData.witnesses,
        receipt_no: logFormData.receipt_no,
        notes: logFormData.notes,
      };

      setBoxes((prev) =>
        prev.map((b) =>
          b.id === selectedBoxForOpen.id
            ? {
                ...b,
                last_opened_date: newLog.date,
                total_collected_lifetime: (b.total_collected_lifetime || 0) + newLog.amount,
                collection_logs: [newLog, ...(b.collection_logs || [])],
              }
            : b
        )
      );

      // Trigger box memo print
      setPrintBoxLogMemo({ box: selectedBoxForOpen, log: newLog });
    } catch (err) {
      alert("বক্স কালেকশন সংরক্ষণে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/60">
              <Boxes className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              কুরবানির চামড়া ও কালেকশন দানবাক্স হিসাব
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            বার্ষিক ঈদুল আযহার চামড়া বিক্রয় চালান ও দোকান/বাজারের কালেকশন বক্সের হিসাব রেজিস্টার।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintReportOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-xl border border-slate-200 transition-all text-sm shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>অডিট রিপোর্ট প্রিন্ট</span>
          </button>

          {activeTab === "leather" ? (
            <button
              onClick={handleOpenCreateLeather}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন চামড়া চালান এন্ট্রি</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateBox}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-all text-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন দানবাক্স স্থাপন</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">কুরবানির চামড়া সংগ্রহ</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(totalLeatherPcs)} পিস
          </span>
          <span className="text-[11px] text-slate-400">গরু, মহিষ ও ছাগল</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">চামড়া নিট লাভ</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalLeatherNetIncome)}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">খরচ বাদে তহবিলে জমা</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">সক্রিয় কালেকশন বক্স</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {toBanglaNumber(activeBoxesCount)} টি
          </span>
          <span className="text-[11px] text-slate-400">মোট {toBanglaNumber(totalBoxesCount)} টির মধ্যে</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">দানবাক্স থেকে মোট আদায়</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ৳ {toBanglaNumber(totalBoxCollections)}
          </span>
          <span className="text-[11px] text-slate-400">সার্বক্ষণিক কালেকশন</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 flex items-center gap-1 shadow-xs">
        <button
          onClick={() => setActiveTab("leather")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "leather"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>কুরবানির চামড়া বিক্রয় ড্রাইভ</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
            {toBanglaNumber(leathers.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("boxes")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "boxes"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>এলাকাভিত্তিক কালেকশন দানবাক্স</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
            {toBanglaNumber(boxes.length)}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === "leather" ? "চামড়ার ধরন বা ক্রেতা দিয়ে খুঁজুন..." : "বক্স কোড বা স্থান দিয়ে খুঁজুন..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LEATHER SALE BATCHES */}
      {/* ========================================================================= */}
      {activeTab === "leather" && (
        <div className="space-y-4">
          {filteredLeathers.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">কোনো চামড়া বিক্রয়ের রেকর্ড নেই</p>
              <p className="text-xs mt-1">কুরবানির মৌসুমে সংগৃহীত চামড়ার চালান এন্ট্রি করুন।</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">বছর / সাল</th>
                      <th className="py-3 px-4">চামড়ার ধরন</th>
                      <th className="py-3 px-4">পরিমাণ (পিস)</th>
                      <th className="py-3 px-4">দর (প্রতি পিস)</th>
                      <th className="py-3 px-4">মোট বিক্রয়</th>
                      <th className="py-3 px-4">পরিবহন/লেবার</th>
                      <th className="py-3 px-4">নিট লাভ (জমা)</th>
                      <th className="py-3 px-4">ক্রেতা ও বকেয়া</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeathers.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-700">{item.year}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">{item.type}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {toBanglaNumber(item.quantity)} টি
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          ৳ {toBanglaNumber(item.rate_per_piece)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          ৳ {toBanglaNumber(item.total_sale_amount)}
                        </td>
                        <td className="py-3 px-4 text-rose-600">
                          - ৳ {toBanglaNumber(item.transport_labor_cost || 0)}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                          ৳ {toBanglaNumber(item.net_profit)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{item.buyer_name || "স্থানীয় পার্টি"}</span>
                          {item.due_amount ? (
                            <span className="text-[10px] text-red-600 font-bold">বকেয়া: ৳ {toBanglaNumber(item.due_amount)}</span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold">সম্পূর্ণ পরিশোধিত</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPrintLeatherMemo(item)}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded"
                              title="চালান মেমো প্রিন্ট"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditLeather(item)}
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLeather(item.id)}
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
      {/* TAB 2: COLLECTION BOXES */}
      {/* ========================================================================= */}
      {activeTab === "boxes" && (
        <div className="space-y-4">
          {filteredBoxes.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              <Boxes className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm text-slate-600">কোনো দানবাক্স স্থাপন করা হয়নি</p>
              <p className="text-xs mt-1">দোকান, হোটেল বা বাজারের দানবাক্স রেজিস্ট্রি করুন।</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBoxes.map((box) => (
                <div
                  key={box.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                        {box.box_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        box.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {box.status === "ACTIVE" ? "সক্রিয়" : "নিষ্ক্রিয়"}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{box.location_name}</h3>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{box.area || "বাজার এলাকা"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>দায়িত্বশীল: {box.responsible_person || "দোকানদার"} ({box.responsible_phone || "-"})</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">সর্বমোট জমা:</span>
                      <span className="font-bold text-emerald-800 text-sm">৳ {toBanglaNumber(box.total_collected_lifetime || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>শেষ খোলার তারিখ:</span>
                      <span>{box.last_opened_date ? toBanglaNumber(box.last_opened_date) : "নতুন স্থাপিত"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditBox(box)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBox(box.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenBoxModal(box)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>টাকা সংগ্রহ ও গণনা</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT LEATHER */}
      {/* ========================================================================= */}
      {leatherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingLeather?.id ? "চামড়া চালান সম্পাদনা" : "নতুন চামড়া চালান এন্ট্রি"}</span>
              <button onClick={() => setLeatherModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveLeather} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বছর / সাল</label>
                  <input
                    type="text"
                    value={editingLeather?.year || "২০২৬"}
                    onChange={(e) => setEditingLeather(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">চামড়ার ধরন</label>
                  <select
                    value={editingLeather?.type || "গরু"}
                    onChange={(e) => setEditingLeather(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="গরু">গরু (Cow)</option>
                    <option value="মহিষ">মহিষ (Buffalo)</option>
                    <option value="ছাগল">ছাগল / খাসি (Goat)</option>
                    <option value="ভেড়া">ভেড়া / দুম্বা (Sheep)</option>
                    <option value="অন্যান্য">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সংগৃহীত পরিমাণ (পিস)</label>
                  <input
                    type="number"
                    required
                    value={editingLeather?.quantity || ""}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const rate = Number(editingLeather?.rate_per_piece || 0);
                      const gross = qty * rate;
                      const exp = Number(editingLeather?.transport_labor_cost || 0);
                      setEditingLeather(prev => ({
                        ...prev,
                        quantity: qty,
                        total_sale_amount: gross,
                        net_profit: gross - exp,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বিক্রয় দর (প্রতি পিস)</label>
                  <input
                    type="number"
                    required
                    value={editingLeather?.rate_per_piece || ""}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      const qty = Number(editingLeather?.quantity || 0);
                      const gross = qty * rate;
                      const exp = Number(editingLeather?.transport_labor_cost || 0);
                      setEditingLeather(prev => ({
                        ...prev,
                        rate_per_piece: rate,
                        total_sale_amount: gross,
                        net_profit: gross - exp,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">লেবার ও পরিবহন খরচ</label>
                  <input
                    type="number"
                    value={editingLeather?.transport_labor_cost || 0}
                    onChange={(e) => {
                      const exp = Number(e.target.value);
                      const gross = Number(editingLeather?.total_sale_amount || 0);
                      setEditingLeather(prev => ({
                        ...prev,
                        transport_labor_cost: exp,
                        net_profit: gross - exp,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">নিট লাভ (তহবিলে জমা)</label>
                  <input
                    type="number"
                    readOnly
                    value={editingLeather?.net_profit || 0}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ক্রেতা / আড়তদারের নাম</label>
                  <input
                    type="text"
                    placeholder="যেমন: আমিন লেদার"
                    value={editingLeather?.buyer_name || ""}
                    onChange={(e) => setEditingLeather(prev => ({ ...prev, buyer_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বকেয়া টাকা (যদি থাকে)</label>
                  <input
                    type="number"
                    value={editingLeather?.due_amount || 0}
                    onChange={(e) => setEditingLeather(prev => ({ ...prev, due_amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLeatherModalOpen(false)}
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
      {/* MODAL: ADD / EDIT BOX */}
      {/* ========================================================================= */}
      {boxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{editingBox?.id ? "দানবাক্স তথ্য সম্পাদনা" : "নতুন কালেকশন দানবাক্স স্থাপন"}</span>
              <button onClick={() => setBoxModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </h2>

            <form onSubmit={handleSaveBox} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বক্স কোড</label>
                  <input
                    type="text"
                    required
                    value={editingBox?.box_code || ""}
                    onChange={(e) => setEditingBox(prev => ({ ...prev, box_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">এলাকা / মহল্লা</label>
                  <input
                    type="text"
                    value={editingBox?.area || ""}
                    onChange={(e) => setEditingBox(prev => ({ ...prev, area: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">স্থাপনের স্থান / দোকানের নাম <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: হাজী বিরিয়ানি ও সুইটস, স্টেশন রোড"
                  value={editingBox?.location_name || ""}
                  onChange={(e) => setEditingBox(prev => ({ ...prev, location_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">দায়িত্বশীল ব্যক্তির নাম</label>
                  <input
                    type="text"
                    placeholder="দোকানদার / ম্যানেজার"
                    value={editingBox?.responsible_person || ""}
                    onChange={(e) => setEditingBox(prev => ({ ...prev, responsible_person: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={editingBox?.responsible_phone || ""}
                    onChange={(e) => setEditingBox(prev => ({ ...prev, responsible_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBoxModalOpen(false)}
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
      {/* MODAL: OPEN BOX & COLLECT MONEY */}
      {/* ========================================================================= */}
      {openLogModal && selectedBoxForOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h2 className="text-base font-bold text-slate-900 mb-1">দানবাক্স খোলা ও টাকা গণনা</h2>
            <p className="text-xs text-slate-500 mb-4 pb-2 border-b border-slate-100">
              বক্স: <span className="font-bold text-slate-800">{selectedBoxForOpen.box_code}</span> ({selectedBoxForOpen.location_name})
            </p>

            <form onSubmit={handleSaveBoxOpening} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">প্রাপ্ত টাকার পরিমাণ <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={logFormData.amount}
                    onChange={(e) => setLogFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">খোলার তারিখ</label>
                  <input
                    type="date"
                    required
                    value={logFormData.date}
                    onChange={(e) => setLogFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">উপস্থিত স্বাক্ষী / প্রতিনিধিবৃন্দ</label>
                <input
                  type="text"
                  placeholder="যেমন: মুহতামিম ও ক্যাশিয়ার"
                  value={logFormData.witnesses}
                  onChange={(e) => setLogFormData(prev => ({ ...prev, witnesses: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">জমা ভাউচার / রসিদ নং</label>
                <input
                  type="text"
                  value={logFormData.receipt_no}
                  onChange={(e) => setLogFormData(prev => ({ ...prev, receipt_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenLogModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  জমা সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT LEATHER SALE INVOICE / MEMO */}
      {/* ========================================================================= */}
      {printLeatherMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">কুরবানির চামড়া বিক্রয় চালান ও মেমো</h3>
              </div>
              <button onClick={() => setPrintLeatherMemo(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Memo */}
            <div className="space-y-4 text-slate-900 border-2 border-emerald-900/40 rounded-xl p-5 bg-white">
              <div className="text-center border-b border-emerald-800 pb-3">
                <div className="text-xs font-serif font-bold text-slate-600">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                <h2 className="text-lg font-black text-emerald-950">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h2>
                <h3 className="text-xs font-bold text-slate-700">কুরবানির চামড়া সংগ্রহ ও বিক্রয় মেমো - {printLeatherMemo.year}</h3>
                <p className="text-[10px] text-slate-500">চালান তারিখ: {toBanglaNumber(printLeatherMemo.sale_date || new Date().toISOString().split("T")[0])}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">ক্রেতা / আড়তদার: </span>
                  <span className="font-bold">{printLeatherMemo.buyer_name || "স্থানীয় চামড়া ব্যবসায়ী"}</span>
                </div>
                <div>
                  <span className="text-slate-500">চামড়ার ধরন: </span>
                  <span className="font-bold text-emerald-900">{printLeatherMemo.type}</span>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-800 font-bold">
                  <tr>
                    <th className="py-2 px-3 border text-left">বিবরণ</th>
                    <th className="py-2 px-3 border text-center">পরিমাণ</th>
                    <th className="py-2 px-3 border text-right">দর</th>
                    <th className="py-2 px-3 border text-right">মোট টাকা</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-3 border font-semibold">{printLeatherMemo.type} চামড়া বিক্রয়</td>
                    <td className="py-2 px-3 border text-center font-bold">{toBanglaNumber(printLeatherMemo.quantity)} পিস</td>
                    <td className="py-2 px-3 border text-right">৳ {toBanglaNumber(printLeatherMemo.rate_per_piece)}</td>
                    <td className="py-2 px-3 border text-right font-bold">৳ {toBanglaNumber(printLeatherMemo.total_sale_amount)}</td>
                  </tr>
                  {printLeatherMemo.transport_labor_cost ? (
                    <tr className="text-rose-700 bg-rose-50/40">
                      <td colSpan={3} className="py-1.5 px-3 border text-right font-semibold">বাদ: পরিবহন ও লেবার খরচ</td>
                      <td className="py-1.5 px-3 border text-right font-bold">- ৳ {toBanglaNumber(printLeatherMemo.transport_labor_cost)}</td>
                    </tr>
                  ) : null}
                  <tr className="bg-emerald-50/80 font-black text-emerald-950">
                    <td colSpan={3} className="py-2 px-3 border text-right">তহবিলে নিট জমা:</td>
                    <td className="py-2 px-3 border text-right font-black text-sm">৳ {toBanglaNumber(printLeatherMemo.net_profit)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="bg-slate-50 p-2.5 rounded-lg text-xs">
                <span className="text-[11px] text-slate-500 block">কথায়:</span>
                <span className="font-bold text-emerald-900">{numberToBanglaWords(printLeatherMemo.net_profit)}</span>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600">
                <div className="border-t border-slate-400 pt-1">ক্রেতার স্বাক্ষর</div>
                <div className="border-t border-slate-400 pt-1 font-bold">মুহতামিম / চামড়া কমিটি প্রধান</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPrintLeatherMemo(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs font-medium"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>মেমো প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT BOX COLLECTION OPENING MEMO */}
      {/* ========================================================================= */}
      {printBoxLogMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">দানবাক্স কালেকশন ভাউচার</h3>
              </div>
              <button onClick={() => setPrintBoxLogMemo(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Memo */}
            <div className="space-y-3 text-slate-900 border-2 border-slate-700 rounded-xl p-5 bg-white">
              <div className="text-center border-b border-slate-300 pb-2">
                <div className="text-xs font-serif font-bold text-slate-600">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                <h2 className="text-base font-black text-slate-950">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h2>
                <h3 className="text-xs font-bold text-emerald-800">দানবাক্স উন্মোচন ও টাকা গণনার জমা ভাউচার</h3>
                <p className="text-[10px] font-mono text-slate-500">ভাউচার নং: {printBoxLogMemo.log.receipt_no}</p>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">বক্স কোড ও অবস্থান:</span>
                  <span className="font-bold">{printBoxLogMemo.box.box_code} - {printBoxLogMemo.box.location_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">এলাকা:</span>
                  <span>{printBoxLogMemo.box.area || "বাজার"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">খোলার তারিখ:</span>
                  <span className="font-semibold">{toBanglaNumber(printBoxLogMemo.log.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">উপস্থিত স্বাক্ষীবৃন্দ:</span>
                  <span className="font-semibold">{printBoxLogMemo.log.witnesses || "মুহতামিম ও ক্যাশিয়ার"}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex justify-between items-center my-2">
                <div>
                  <span className="text-[10px] text-emerald-800 block">গণনাকৃত মোট টাকা:</span>
                  <span className="font-black text-emerald-950 text-base">
                    ৳ {toBanglaNumber(printBoxLogMemo.log.amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">কথায়:</span>
                  <span className="font-bold text-emerald-900 text-xs">
                    {numberToBanglaWords(printBoxLogMemo.log.amount)}
                  </span>
                </div>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600">
                <div className="border-t border-slate-400 pt-1">দায়িত্বশীল / স্বাক্ষী</div>
                <div className="border-t border-slate-400 pt-1 font-bold">মুহতামিম / কোষাধ্যক্ষ</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPrintBoxLogMemo(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs font-medium"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>ভাউচার প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ANNUAL COLLECTIONS AUDIT REPORT */}
      {/* ========================================================================= */}
      {printReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">চামড়া ও দানবাক্স বার্ষিক অডিট রিপোর্ট</h3>
              </div>
              <button onClick={() => setPrintReportOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Sheet */}
            <div className="space-y-6 text-slate-900">
              <div className="text-center border-b pb-3">
                <div className="text-xs font-serif font-bold text-slate-600">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
                <h2 className="text-xl font-black text-slate-900">মাদ্রাসাতুল হিকমাহ আল ইসলামিয়া</h2>
                <h3 className="text-sm font-bold text-emerald-800">কুরবানির চামড়া ও এলাকাভিত্তিক দানবাক্স বার্ষিক কালেকশন অডিট রিপোর্ট</h3>
                <p className="text-[11px] text-slate-500">প্রিন্ট তারিখ: {toBanglaNumber(new Date().toISOString().split("T")[0])}</p>
              </div>

              {/* Section 1: Leather Summary */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 mb-2 border-b pb-1">১. কুরবানির চামড়া বিক্রয় খতিয়ান</h4>
                <table className="w-full text-[11px] border border-slate-300 divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th className="py-1.5 px-2 border">সাল</th>
                      <th className="py-1.5 px-2 border">ধরন</th>
                      <th className="py-1.5 px-2 border">পরিমাণ</th>
                      <th className="py-1.5 px-2 border">মোট বিক্রয়</th>
                      <th className="py-1.5 px-2 border">খরচ</th>
                      <th className="py-1.5 px-2 border">নিট লাভ</th>
                      <th className="py-1.5 px-2 border">ক্রেতা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leathers.map((l) => (
                      <tr key={l.id} className="text-center">
                        <td className="py-1.5 px-2 border">{l.year}</td>
                        <td className="py-1.5 px-2 border font-bold">{l.type}</td>
                        <td className="py-1.5 px-2 border">{toBanglaNumber(l.quantity)} পিস</td>
                        <td className="py-1.5 px-2 border">৳ {toBanglaNumber(l.total_sale_amount)}</td>
                        <td className="py-1.5 px-2 border text-rose-600">৳ {toBanglaNumber(l.transport_labor_cost || 0)}</td>
                        <td className="py-1.5 px-2 border font-bold text-emerald-800">৳ {toBanglaNumber(l.net_profit)}</td>
                        <td className="py-1.5 px-2 border text-left">{l.buyer_name || "-"}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan={2} className="py-1.5 px-2 border text-right">সর্বমোট:</td>
                      <td className="py-1.5 px-2 border text-center">{toBanglaNumber(totalLeatherPcs)} পিস</td>
                      <td className="py-1.5 px-2 border">৳ {toBanglaNumber(totalLeatherGross)}</td>
                      <td className="py-1.5 px-2 border text-rose-600">৳ {toBanglaNumber(totalLeatherCost)}</td>
                      <td className="py-1.5 px-2 border font-black text-emerald-900">৳ {toBanglaNumber(totalLeatherNetIncome)}</td>
                      <td className="py-1.5 px-2 border"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Boxes Summary */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 mb-2 border-b pb-1">২. এলাকাভিত্তিক দানবাক্স আদায় খতিয়ান</h4>
                <table className="w-full text-[11px] border border-slate-300 divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th className="py-1.5 px-2 border">বক্স কোড</th>
                      <th className="py-1.5 px-2 border text-left">স্থাপনের স্থান ও এলাকা</th>
                      <th className="py-1.5 px-2 border">দায়িত্বশীল</th>
                      <th className="py-1.5 px-2 border">শেষ খোলার তারিখ</th>
                      <th className="py-1.5 px-2 border">মোট আদায়</th>
                      <th className="py-1.5 px-2 border">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {boxes.map((b) => (
                      <tr key={b.id} className="text-center">
                        <td className="py-1.5 px-2 border font-mono font-bold">{b.box_code}</td>
                        <td className="py-1.5 px-2 border text-left font-bold">{b.location_name} ({b.area || "বাজার"})</td>
                        <td className="py-1.5 px-2 border text-left">{b.responsible_person || "-"}</td>
                        <td className="py-1.5 px-2 border">{b.last_opened_date ? toBanglaNumber(b.last_opened_date) : "-"}</td>
                        <td className="py-1.5 px-2 border font-bold text-emerald-800">৳ {toBanglaNumber(b.total_collected_lifetime || 0)}</td>
                        <td className="py-1.5 px-2 border">{b.status === "ACTIVE" ? "সক্রিয়" : "নিষ্ক্রিয়"}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-bold">
                      <td colSpan={4} className="py-1.5 px-2 border text-right">দানবাক্স সর্বমোট আদায়:</td>
                      <td className="py-1.5 px-2 border font-black text-emerald-900">৳ {toBanglaNumber(totalBoxCollections)}</td>
                      <td className="py-1.5 px-2 border"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                <div className="border-t border-slate-400 pt-1 font-bold">অডিট ও হিসাব নিরীক্ষক</div>
                <div className="border-t border-slate-400 pt-1 font-bold">মুহতামিম / শুরা কমিটি</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t print:hidden">
              <button
                onClick={() => setPrintReportOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-600 text-xs font-medium"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>রিপোর্ট প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
