"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Archive,
  ArrowUpDown,
  Download,
  Eye,
  Wrench,
  PackageCheck,
  Building2,
  Layers,
  Sparkles,
  X,
  Share2,
  RefreshCw,
  FolderSync,
} from "lucide-react";
import { toBanglaNumber, formatCurrencyBangla } from "@/lib/numberToBangla";
import {
  AssetItem,
  AssetAllocation,
  MaintenanceRecord,
  ASSET_CATEGORIES,
  AssetCategory,
} from "@/lib/inventory";
import {
  createAssetItem,
  updateAssetItem,
  deleteAssetItem,
  archiveAssetItem,
  allocateAsset,
  returnAssetAllocation,
  recordMaintenance,
  deleteMaintenance,
} from "@/app/actions/inventory";

interface InventoryClientProps {
  initialItems: AssetItem[];
  initialAllocations: AssetAllocation[];
  initialMaintenance: MaintenanceRecord[];
}

export default function InventoryClient({
  initialItems,
  initialAllocations,
  initialMaintenance,
}: InventoryClientProps) {
  const [items, setItems] = useState<AssetItem[]>(initialItems);
  const [allocations, setAllocations] = useState<AssetAllocation[]>(initialAllocations);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(initialMaintenance);

  const [activeTab, setActiveTab] = useState<"stock" | "allocations" | "maintenance">("stock");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState<AssetItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    category: "BOARDING" as AssetCategory,
    category_name: "বোর্ডিং ও ছাত্রাবাস (খাট-তোশক)",
    total_qty: 1,
    condition: "GOOD" as any,
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_price_per_unit: 0,
    vendor_or_donor: "",
    voucher_no: "",
    room_location: "",
    description: "",
  });

  const [allocationFormData, setAllocationFormData] = useState({
    asset_id: "",
    location_or_room: "",
    assigned_to_person: "",
    quantity: 1,
    remarks: "",
  });

  const [maintenanceFormData, setMaintenanceFormData] = useState({
    asset_id: "",
    maintenance_date: new Date().toISOString().split("T")[0],
    issue_description: "",
    work_done: "",
    cost: 0,
    technician_or_shop: "",
    voucher_no: "",
    fund_name: "সাধারণ ফান্ড",
    auto_add_to_expense: true,
  });

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Metrics calculation
  const totalAssetsCount = items.reduce((sum, item) => sum + (item.total_qty || 0), 0);
  const totalAllocatedCount = items.reduce((sum, item) => sum + (item.allocated_qty || 0), 0);
  const totalInStockCount = items.reduce((sum, item) => sum + (item.in_stock_qty || 0), 0);
  const totalAssetValue = items.reduce((sum, item) => sum + (item.total_value || 0), 0);
  const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);

  // Filtered Items
  const filteredItems = items.filter((item) => {
    if (!showArchived && item.is_archived) return false;
    if (showArchived && !item.is_archived) return false;

    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (conditionFilter !== "all" && item.condition !== conditionFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        item.asset_code.toLowerCase().includes(q) ||
        (item.room_location && item.room_location.toLowerCase().includes(q)) ||
        (item.vendor_or_donor && item.vendor_or_donor.toLowerCase().includes(q)) ||
        (item.voucher_no && item.voucher_no.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Allocations
  const filteredAllocations = allocations.filter((a) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        a.asset_name.toLowerCase().includes(q) ||
        a.asset_code.toLowerCase().includes(q) ||
        a.location_or_room.toLowerCase().includes(q) ||
        (a.assigned_to_person && a.assigned_to_person.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Maintenance
  const filteredMaintenance = maintenance.filter((m) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        m.asset_name.toLowerCase().includes(q) ||
        m.asset_code.toLowerCase().includes(q) ||
        m.work_done.toLowerCase().includes(q) ||
        m.technician_or_shop.toLowerCase().includes(q) ||
        m.issue_description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // CRUD Handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsLoading(true);

    const catObj = ASSET_CATEGORIES.find((c) => c.id === formData.category);
    const res = await createAssetItem({
      ...formData,
      category_name: catObj?.name || formData.category,
    });
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.item) {
      setItems([res.item, ...items]);
      setShowCreateModal(false);
      showNotification("success", `নতুন সম্পদ সংরক্ষিত হয়েছে! কোড: ${res.item.asset_code}`);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsLoading(true);

    const catObj = ASSET_CATEGORIES.find((c) => c.id === formData.category);
    const res = await updateAssetItem(selectedItem.id, {
      ...formData,
      category_name: catObj?.name || formData.category,
    });
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.item) {
      setItems(items.map((i) => (i.id === selectedItem.id ? res.item! : i)));
      setShowEditModal(false);
      showNotification("success", "সম্পদের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।");
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${name}" স্থায়ীভাবে মুছে ফেলতে চান?`)) return;
    setIsLoading(true);
    const res = await deleteAssetItem(id);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      setItems(items.filter((i) => i.id !== id));
      setAllocations(allocations.filter((a) => a.asset_id !== id));
      showNotification("success", "সম্পদ সফলভাবে মুছে ফেলা হয়েছে।");
    }
  };

  const handleArchiveToggle = async (id: string) => {
    setIsLoading(true);
    const res = await archiveAssetItem(id);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      setItems(
        items.map((i) => (i.id === id ? { ...i, is_archived: res.is_archived } : i))
      );
      showNotification("success", res.is_archived ? "সম্পদ আর্কাইভে সরানো হয়েছে।" : "সম্পদ সক্রিয় তালিকায় পুনরুদ্ধার করা হয়েছে।");
    }
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationFormData.asset_id || !allocationFormData.location_or_room) return;
    setIsLoading(true);

    const res = await allocateAsset(allocationFormData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.allocation) {
      setAllocations([res.allocation, ...allocations]);
      // Update local item stocks
      setItems(
        items.map((i) =>
          i.id === allocationFormData.asset_id
            ? {
                ...i,
                in_stock_qty: Math.max(0, i.in_stock_qty - allocationFormData.quantity),
                allocated_qty: i.allocated_qty + allocationFormData.quantity,
              }
            : i
        )
      );
      setShowAllocateModal(false);
      showNotification(
        "success",
        `বরাদ্দ সম্পন্ন হয়েছে! ${res.allocation.location_or_room}-এ ${toBanglaNumber(res.allocation.quantity)}টি বরাদ্দ প্রদান করা হয়েছে।`
      );
    }
  };

  const handleReturnAllocation = async (allocationId: string, allocQty: number, assetId: string) => {
    if (!confirm(`আপনি কি এই বরাদ্দটি (${toBanglaNumber(allocQty)}টি) ফেরত নিতে চান?`)) return;
    setIsLoading(true);
    const res = await returnAssetAllocation(allocationId);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      setAllocations(
        allocations.map((a) => (a.id === allocationId ? { ...a, status: "RETURNED" } : a))
      );
      setItems(
        items.map((i) =>
          i.id === assetId
            ? {
                ...i,
                in_stock_qty: i.in_stock_qty + allocQty,
                allocated_qty: Math.max(0, i.allocated_qty - allocQty),
              }
            : i
        )
      );
      showNotification("success", "সম্পদ সফলভাবে স্টকে ফেরত নেওয়া হয়েছে।");
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceFormData.asset_id || !maintenanceFormData.work_done) return;
    setIsLoading(true);

    const res = await recordMaintenance(maintenanceFormData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.record) {
      setMaintenance([res.record, ...maintenance]);
      setShowMaintenanceModal(false);
      showNotification(
        "success",
        `রক্ষণাবেক্ষণ খরচ (${toBanglaNumber(res.record.cost)} ৳) সফলভাবে সংরক্ষিত হয়েছে${
          res.record.auto_add_to_expense ? " এবং মাদরাসার খরচ খাতে যুক্ত হয়েছে" : ""
        }!`
      );
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm("আপনি কি এই মেরামত রেকর্ডটি মুছে ফেলতে চান?")) return;
    setIsLoading(true);
    const res = await deleteMaintenance(id);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      setMaintenance(maintenance.filter((m) => m.id !== id));
      showNotification("success", "মেরামত রেকর্ড মুছে ফেলা হয়েছে।");
    }
  };

  const openEdit = (item: AssetItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      category_name: item.category_name,
      total_qty: item.total_qty,
      condition: item.condition,
      purchase_date: item.purchase_date,
      purchase_price_per_unit: item.purchase_price_per_unit,
      vendor_or_donor: item.vendor_or_donor || "",
      voucher_no: item.voucher_no || "",
      room_location: item.room_location || "",
      description: item.description || "",
    });
    setShowEditModal(true);
  };

  const openAllocateForItem = (item: AssetItem) => {
    setAllocationFormData({
      asset_id: item.id,
      location_or_room: "",
      assigned_to_person: "",
      quantity: 1,
      remarks: "",
    });
    setShowAllocateModal(true);
  };

  const openMaintenanceForItem = (item: AssetItem) => {
    setMaintenanceFormData({
      asset_id: item.id,
      maintenance_date: new Date().toISOString().split("T")[0],
      issue_description: "",
      work_done: "",
      cost: 0,
      technician_or_shop: "",
      voucher_no: "",
      fund_name: "সাধারণ ফান্ড",
      auto_add_to_expense: true,
    });
    setShowMaintenanceModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
            feedback.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-7 h-7 text-indigo-600" />
            <span>ইনভেন্টরি ও সম্পত্তি ব্যবস্থাপনা</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            বোর্ডিং আসবাবপত্র, ফ্যান-লাইট, খাট-তোশক, মাইক ও সরঞ্জামের স্টক, কক্ষ বরাদ্দ ও রক্ষণাবেক্ষণ খরচ ট্র্যাকিং
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>ইনভেন্টরি রেজিস্টার প্রিন্ট</span>
          </button>

          {/* New Allocation Button */}
          <button
            onClick={() => {
              if (items.length > 0) {
                setAllocationFormData({
                  asset_id: items[0].id,
                  location_or_room: "",
                  assigned_to_person: "",
                  quantity: 1,
                  remarks: "",
                });
                setShowAllocateModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
          >
            <PackageCheck className="w-4 h-4" />
            <span>+ নতুন কক্ষ বরাদ্দ</span>
          </button>

          {/* New Asset Button */}
          <button
            onClick={() => {
              setFormData({
                name: "",
                category: "BOARDING",
                category_name: "বোর্ডিং ও ছাত্রাবাস (খাট-তোশক)",
                total_qty: 1,
                condition: "GOOD",
                purchase_date: new Date().toISOString().split("T")[0],
                purchase_price_per_unit: 0,
                vendor_or_donor: "",
                voucher_no: "",
                room_location: "",
                description: "",
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন সম্পদ যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs font-semibold block">মোট সামগ্রী (আইটেম)</span>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {toBanglaNumber(totalAssetsCount)} <span className="text-xs text-slate-400 font-normal">টি</span>
          </p>
          <span className="text-[11px] text-slate-400">{toBanglaNumber(items.length)} টি ক্যাটাগরি আইটেম</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-emerald-700 text-xs font-semibold block">বর্তমানে স্টকে আছে</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
            {toBanglaNumber(totalInStockCount)} <span className="text-xs text-slate-400 font-normal">টি</span>
          </p>
          <span className="text-[11px] text-slate-400">অব্যবহৃত ও প্রস্তুত</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-indigo-700 text-xs font-semibold block">কক্ষে / দায়িত্বে বরাদ্দ</span>
          <p className="text-2xl font-bold text-indigo-700 mt-1 font-mono">
            {toBanglaNumber(totalAllocatedCount)} <span className="text-xs text-slate-400 font-normal">টি</span>
          </p>
          <span className="text-[11px] text-slate-400">সক্রিয়ভাবে ব্যবহৃত হচ্ছে</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-amber-700 text-xs font-semibold block">স্থায়ী সম্পদের মোট মূল্য</span>
          <p className="text-xl font-extrabold text-amber-800 mt-1">
            {formatCurrencyBangla(totalAssetValue)}
          </p>
          <span className="text-[11px] text-slate-400">ক্রয়মূল্যের ভিত্তিতে হিসাব</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-rose-700 text-xs font-semibold block">রক্ষণাবেক্ষণ ও মেরামত খরচ</span>
          <p className="text-xl font-extrabold text-rose-800 mt-1">
            {formatCurrencyBangla(totalMaintenanceCost)}
          </p>
          <span className="text-[11px] text-slate-400">{toBanglaNumber(maintenance.length)} টি মেরামত রেকর্ড</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-slate-200 px-4 pt-3 gap-2 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("stock")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "stock"
                ? "border-indigo-600 text-indigo-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>সম্পদ ও স্টক রেজিস্টার ({toBanglaNumber(items.length)})</span>
          </button>

          <button
            onClick={() => setActiveTab("allocations")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "allocations"
                ? "border-indigo-600 text-indigo-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>কক্ষ ও বোর্ডিং বরাদ্দ ট্র্যাকিং ({toBanglaNumber(allocations.length)})</span>
          </button>

          <button
            onClick={() => setActiveTab("maintenance")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "maintenance"
                ? "border-indigo-600 text-indigo-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>রক্ষণাবেক্ষণ ও মেরামত খরচের রেকর্ড ({toBanglaNumber(maintenance.length)})</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="সম্পদের নাম, কোড, কক্ষ বা ভাউচার খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {activeTab === "stock" && (
              <>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white text-slate-700"
                >
                  <option value="all">সকল ক্যাটাগরি</option>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white text-slate-700"
                >
                  <option value="all">সকল অবস্থা</option>
                  <option value="EXCELLENT">চমৎকার (নতুন)</option>
                  <option value="GOOD">ভালো (সচল)</option>
                  <option value="NEEDS_REPAIR">মেরামত প্রয়োজন</option>
                  <option value="DAMAGED">অচল / পরিত্যক্ত</option>
                </select>

                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    showArchived
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {showArchived ? "আর্কাইভকৃত সম্পদ দেখাচ্ছে" : "আর্কাইভ দেখুন"}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "maintenance" && (
              <button
                onClick={() => {
                  if (items.length > 0) {
                    setMaintenanceFormData({
                      asset_id: items[0].id,
                      maintenance_date: new Date().toISOString().split("T")[0],
                      issue_description: "",
                      work_done: "",
                      cost: 0,
                      technician_or_shop: "",
                      voucher_no: "",
                      fund_name: "সাধারণ ফান্ড",
                      auto_add_to_expense: true,
                    });
                    setShowMaintenanceModal(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ নতুন মেরামত খরচ যুক্ত করুন</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: Stock & Assets Table */}
        {activeTab === "stock" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">সম্পদের নাম ও কোড</th>
                  <th className="p-3.5">ক্যাটাগরি</th>
                  <th className="p-3.5 text-center">মোট পরিমাণ</th>
                  <th className="p-3.5 text-center">বরাদ্দ / স্টকে</th>
                  <th className="p-3.5 text-right">একক ও মোট মূল্য</th>
                  <th className="p-3.5">অবস্থা</th>
                  <th className="p-3.5 text-right">কার্যক্রম (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">কোনো সম্পদ পাওয়া যায়নি</p>
                      <p className="text-xs">নতুন সম্পদ যোগ করতে "+ নতুন সম্পদ যুক্ত করুন" বাটনে ক্লিক করুন</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md text-[11px] inline-block mb-1">
                          {item.asset_code}
                        </span>
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        {item.room_location && (
                          <div className="text-[11px] text-slate-400">লোকেশন: {item.room_location}</div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                          {item.category_name}
                        </span>
                        {item.vendor_or_donor && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            সূত্র: {item.vendor_or_donor}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="font-mono font-bold text-base text-slate-900">
                          {toBanglaNumber(item.total_qty)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">টি</span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="text-xs font-semibold">
                          <span className="text-indigo-700 font-bold">{toBanglaNumber(item.allocated_qty)}</span>
                          <span className="text-slate-400"> / </span>
                          <span className="text-emerald-700 font-bold">{toBanglaNumber(item.in_stock_qty)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">বরাদ্দ / স্টকে</span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="font-bold text-slate-900">
                          {formatCurrencyBangla(item.total_value)}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          একক: {formatCurrencyBangla(item.purchase_price_per_unit)}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {item.condition === "EXCELLENT" ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-md">
                            সচল ও চমৎকার
                          </span>
                        ) : item.condition === "GOOD" ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded-md">
                            ভালো
                          </span>
                        ) : item.condition === "NEEDS_REPAIR" ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[11px] rounded-md">
                            মেরামত প্রয়োজন
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[11px] rounded-md">
                            অচল / ত্রুটিযুক্ত
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Allocate Action */}
                          <button
                            onClick={() => openAllocateForItem(item)}
                            title="কক্ষে বরাদ্দ দিন"
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </button>

                          {/* Record Maintenance */}
                          <button
                            onClick={() => openMaintenanceForItem(item)}
                            title="মেরামত খরচ রেকর্ড করুন"
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={() => openEdit(item)}
                            title="সম্পাদনা করুন"
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Archive toggle */}
                          <button
                            onClick={() => handleArchiveToggle(item.id)}
                            title={item.is_archived ? "পুনরুদ্ধার করুন" : "আর্কাইভ করুন"}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Allocations Table */}
        {activeTab === "allocations" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">সম্পদ ও কোড</th>
                  <th className="p-3.5">বরাদ্দকৃত স্থান / কক্ষ</th>
                  <th className="p-3.5">দায়িত্বপ্রাপ্ত ব্যক্তি</th>
                  <th className="p-3.5 text-center">পরিমাণ</th>
                  <th className="p-3.5">বরাদ্দের তারিখ</th>
                  <th className="p-3.5">অবস্থা</th>
                  <th className="p-3.5 text-right">কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <PackageCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">কোনো সক্রিয় বরাদ্দ পাওয়া যায়নি</p>
                    </td>
                  </tr>
                ) : (
                  filteredAllocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5">
                        <span className="font-mono text-[10px] text-slate-500 font-bold block">
                          {alloc.asset_code}
                        </span>
                        <span className="font-bold text-slate-900">{alloc.asset_name}</span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{alloc.location_or_room}</span>
                        </div>
                        {alloc.remarks && <p className="text-[11px] text-slate-400">{alloc.remarks}</p>}
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium">{alloc.assigned_to_person || "সাধারণ ব্যবহার"}</span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="font-mono font-bold text-base text-indigo-700">
                          {toBanglaNumber(alloc.quantity)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">টি</span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-xs">{alloc.allocation_date}</span>
                        {alloc.return_date && (
                          <span className="block text-[10px] text-slate-400">
                            ফেরত: {alloc.return_date}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {alloc.status === "ACTIVE" ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-md">
                            সক্রিয় বরাদ্দ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-md">
                            ফেরত নেওয়া হয়েছে
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {alloc.status === "ACTIVE" && (
                          <button
                            onClick={() => handleReturnAllocation(alloc.id, alloc.quantity, alloc.asset_id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                          >
                            ফেরত নিন
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: Maintenance & Repairs Table */}
        {activeTab === "maintenance" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">সম্পদের নাম ও কোড</th>
                  <th className="p-3.5">তারিখ</th>
                  <th className="p-3.5">ত্রুটি ও মেরামতের বিবরণ</th>
                  <th className="p-3.5">মিস্ত্রি / দোকান</th>
                  <th className="p-3.5">ব্যয়িত ফান্ড</th>
                  <th className="p-3.5 text-right">মোট খরচ</th>
                  <th className="p-3.5 text-right">মুছুন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaintenance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">কোনো মেরামতের রেকর্ড নেই</p>
                    </td>
                  </tr>
                ) : (
                  filteredMaintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5">
                        <span className="font-mono text-[10px] text-indigo-700 font-bold block">
                          {m.asset_code}
                        </span>
                        <span className="font-bold text-slate-900">{m.asset_name}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-xs">{m.maintenance_date}</span>
                        {m.voucher_no && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            ভাউচার: {m.voucher_no}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900">{m.work_done}</div>
                        <span className="text-[11px] text-slate-500 line-clamp-1">
                          সমস্যা: {m.issue_description}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium">{m.technician_or_shop}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium text-[11px] rounded-md">
                          {m.fund_name}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <span className="font-bold text-rose-700 font-mono text-sm">
                          {formatCurrencyBangla(m.cost)}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteMaintenance(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create New Asset */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>+ নতুন স্থায়ী সম্পদ / ইনভেন্টরি যুক্ত করুন</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সম্পদের নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: দোতলা বাংক খাট / পাকপাখা ৫৬ ইঞ্চি সিলিং ফ্যান"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্যাটাগরি <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    অবস্থা (Condition)
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({ ...formData, condition: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="EXCELLENT">চমৎকার (নতুন)</option>
                    <option value="GOOD">ভালো (সচল)</option>
                    <option value="NEEDS_REPAIR">মেরামত প্রয়োজন</option>
                    <option value="DAMAGED">অচল / পরিত্যক্ত</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোট সংখ্যা (টি) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.total_qty}
                    onChange={(e) =>
                      setFormData({ ...formData, total_qty: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    প্রতিটির ক্রয়মূল্য (টাকা)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.purchase_price_per_unit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchase_price_per_unit: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্রয় / প্রাপ্তির তারিখ
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    দোকান বা দাতার নাম (Vendor/Donor)
                  </label>
                  <input
                    type="text"
                    placeholder="দোকান বা দাতার নাম"
                    value={formData.vendor_or_donor}
                    onChange={(e) =>
                      setFormData({ ...formData, vendor_or_donor: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    নির্দিষ্ট অবস্থান / রুম (Room Location)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: বোর্ডিং স্টোর রুম / দারুল ইক্বামাহ দোতলা"
                    value={formData.room_location}
                    onChange={(e) =>
                      setFormData({ ...formData, room_location: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "সংরক্ষণ হচ্ছে..." : "সম্পদ সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Asset */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-blue-600" />
                  <span>সম্পদ সম্পাদনা করুন</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">{selectedItem.asset_code}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সম্পদের নাম
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোট সংখ্যা (টি)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.total_qty}
                    onChange={(e) =>
                      setFormData({ ...formData, total_qty: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    অবস্থা (Condition)
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({ ...formData, condition: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="EXCELLENT">চমৎকার (নতুন)</option>
                    <option value="GOOD">ভালো (সচল)</option>
                    <option value="NEEDS_REPAIR">মেরামত প্রয়োজন</option>
                    <option value="DAMAGED">অচল / পরিত্যক্ত</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    একক ক্রয়মূল্য (টাকা)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.purchase_price_per_unit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchase_price_per_unit: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    লোকেশন / রুম
                  </label>
                  <input
                    type="text"
                    value={formData.room_location}
                    onChange={(e) =>
                      setFormData({ ...formData, room_location: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "হালনাগাদ হচ্ছে..." : "হালনাগাদ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Allocate to Room / Person */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-600" />
                <span>+ কক্ষ বা ছাত্রাবাসে সম্পদ বরাদ্দ</span>
              </h2>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সম্পদ নির্বাচন করুন <span className="text-rose-500">*</span>
                </label>
                <select
                  value={allocationFormData.asset_id}
                  onChange={(e) =>
                    setAllocationFormData({ ...allocationFormData, asset_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.asset_code}) — স্টকে আছে: {toBanglaNumber(i.in_stock_qty)}টি
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বরাদ্দকৃত স্থান বা রুম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: বোর্ডিং রুম ১০২ / হেফজখানা হলরুম"
                  value={allocationFormData.location_or_room}
                  onChange={(e) =>
                    setAllocationFormData({
                      ...allocationFormData,
                      location_or_room: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  দায়িত্বপ্রাপ্ত উস্তাদ বা ব্যক্তি
                </label>
                <input
                  type="text"
                  placeholder="যেমন: মাওলানা নুরুল হক (হোস্টেল সুপার)"
                  value={allocationFormData.assigned_to_person}
                  onChange={(e) =>
                    setAllocationFormData({
                      ...allocationFormData,
                      assigned_to_person: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বরাদ্দ সংখ্যা (টি) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={allocationFormData.quantity}
                  onChange={(e) =>
                    setAllocationFormData({
                      ...allocationFormData,
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মন্তব্য বা বিবরণ
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ৫ জন নতুন ছাত্রের ব্যবহারের জন্য"
                  value={allocationFormData.remarks}
                  onChange={(e) =>
                    setAllocationFormData({
                      ...allocationFormData,
                      remarks: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "বরাদ্দ হচ্ছে..." : "বরাদ্দ নিশ্চিত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Record Maintenance Cost */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-600" />
                <span>+ রক্ষণাবেক্ষণ ও মেরামত খরচ রেকর্ড</span>
              </h2>
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সম্পদ নির্বাচন <span className="text-rose-500">*</span>
                </label>
                <select
                  value={maintenanceFormData.asset_id}
                  onChange={(e) =>
                    setMaintenanceFormData({ ...maintenanceFormData, asset_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.asset_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মেরামতের কাজের বিবরণ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ফ্যানের কয়েল রিওয়াইন্ডিং ও নতুন বিয়ারিং"
                  value={maintenanceFormData.work_done}
                  onChange={(e) =>
                    setMaintenanceFormData({
                      ...maintenanceFormData,
                      work_done: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোট খরচ (টাকা) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={maintenanceFormData.cost}
                    onChange={(e) =>
                      setMaintenanceFormData({
                        ...maintenanceFormData,
                        cost: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm font-mono font-bold text-rose-700 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    তারিখ
                  </label>
                  <input
                    type="date"
                    value={maintenanceFormData.maintenance_date}
                    onChange={(e) =>
                      setMaintenanceFormData({
                        ...maintenanceFormData,
                        maintenance_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    দোকান বা টেকনিশিয়ান
                  </label>
                  <input
                    type="text"
                    placeholder="দোকানের নাম"
                    value={maintenanceFormData.technician_or_shop}
                    onChange={(e) =>
                      setMaintenanceFormData({
                        ...maintenanceFormData,
                        technician_or_shop: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ফান্ড নির্বাচন
                  </label>
                  <select
                    value={maintenanceFormData.fund_name}
                    onChange={(e) =>
                      setMaintenanceFormData({
                        ...maintenanceFormData,
                        fund_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    <option value="সাধারণ ফান্ড">সাধারণ ফান্ড</option>
                    <option value="উন্নয়ন ও মেরামত ফান্ড">উন্নয়ন ও মেরামত ফান্ড</option>
                    <option value="লিল্লাহ বোর্ডিং ফান্ড">লিল্লাহ বোর্ডিং ফান্ড</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceFormData.auto_add_to_expense}
                    onChange={(e) =>
                      setMaintenanceFormData({
                        ...maintenanceFormData,
                        auto_add_to_expense: e.target.checked,
                      })
                    }
                    className="rounded text-rose-600"
                  />
                  <span>স্বয়ংক্রিয়ভাবে মাদরাসার দৈনন্দিন হিসাব খাতার খরচে যোগ করুন</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "সংরক্ষণ হচ্ছে..." : "খরচ সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
