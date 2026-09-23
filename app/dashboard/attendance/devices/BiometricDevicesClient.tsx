"use client";

import { useState, useEffect, useTransition } from "react";
import {
  BiometricDevice,
  BiometricUserMapping,
  BiometricPunchLog,
  BIOMETRIC_BRANDS_LIST,
  generateDeviceToken,
} from "@/lib/biometric";
import {
  getBiometricDevices,
  saveBiometricDevice,
  deleteBiometricDevice,
  testBiometricDeviceConnection,
  getBiometricUserMappings,
  saveBiometricUserMapping,
  deleteBiometricUserMapping,
  autoGenerateUserMappings,
  getBiometricPunchLogs,
  importBiometricLogsFromFile,
  getBiometricOverviewStats,
} from "@/app/actions/biometric";
import { getClasses, getStudents } from "@/app/actions/students";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  Fingerprint,
  Plus,
  RefreshCw,
  Server,
  Cpu,
  UploadCloud,
  FileSpreadsheet,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Trash2,
  Edit,
  Search,
  SlidersHorizontal,
  FileText,
  HelpCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Download,
  Info,
  Clock,
  ArrowLeft,
  Settings2,
  QrCode,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function BiometricDevicesClient() {
  const [activeTab, setActiveTab] = useState<
    "devices" | "mappings" | "importer" | "logs" | "guide"
  >("devices");

  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<BiometricUserMapping[]>([]);
  const [punchLogs, setPunchLogs] = useState<BiometricPunchLog[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Modals & UI States
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Partial<BiometricDevice> | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDevice, setConfigDevice] = useState<BiometricDevice | null>(null);

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Partial<BiometricUserMapping> | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [importDeviceId, setImportDeviceId] = useState<string>("");
  const [importUserType, setImportUserType] = useState<string>("all");
  const [importResult, setImportResult] = useState<any>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [mappingUserTypeFilter, setMappingUserTypeFilter] = useState("all");
  const [mappingClassFilter, setMappingClassFilter] = useState("all");

  const [logDateFilter, setLogDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logDeviceFilter, setLogDeviceFilter] = useState("all");

  // Notifications / Feedback
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [devs, maps, logs, st, cls, stds] = await Promise.all([
        getBiometricDevices(),
        getBiometricUserMappings(),
        getBiometricPunchLogs({ limit: 150 }),
        getBiometricOverviewStats(),
        getClasses(),
        getStudents(),
      ]);

      setDevices(devs || []);
      setMappings(maps || []);
      setPunchLogs(logs || []);
      setStats(st);
      setClassesList(cls || []);
      setStudentsList(stds || []);
      if (devs && devs.length > 0 && !importDeviceId) {
        setImportDeviceId(devs[0].id);
      }
    } catch (err) {
      console.error("Error loading biometric data:", err);
      showToast("error", "তথ্য লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (type: "success" | "error" | "info", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Device Actions
  const handleOpenNewDevice = () => {
    setEditingDevice({
      name: "",
      device_model: "ZKTeco_K40",
      serial_number: `ZK-${Date.now().toString().slice(-6)}`,
      ip_address: "192.168.1.201",
      port: 4370,
      protocol: "cloud_push",
      target_audience: "all",
      location: "প্রধান প্রবেশদ্বার",
      status: "active",
      secret_token: generateDeviceToken("bio"),
      notes: "",
    });
    setIsDeviceModalOpen(true);
  };

  const handleEditDevice = (dev: BiometricDevice) => {
    setEditingDevice({ ...dev });
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice?.name?.trim()) {
      showToast("error", "ডিভাইসের নাম দেওয়া আবশ্যক");
      return;
    }

    startTransition(async () => {
      const res = await saveBiometricDevice(editingDevice);
      if (res.success) {
        showToast("success", "ডিভাইস সফলভাবে সংরক্ষণ করা হয়েছে");
        setIsDeviceModalOpen(false);
        setEditingDevice(null);
        loadAllData();
      } else {
        showToast("error", res.error || "ডিভাইস সংরক্ষণ ব্যর্থ হয়েছে");
      }
    });
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${name}" ডিভাইসটি মুছে ফেলতে চান?`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteBiometricDevice(id);
      if (res.success) {
        showToast("success", "ডিভাইস সফলভাবে মুছে ফেলা হয়েছে");
        loadAllData();
      } else {
        showToast("error", res.error || "ডিলিট ব্যর্থ হয়েছে");
      }
    });
  };

  const handleTestConnection = async (dev: BiometricDevice) => {
    startTransition(async () => {
      const res = await testBiometricDeviceConnection(dev.id);
      if (res.success) {
        showToast("success", res.message);
        loadAllData();
      } else {
        showToast("error", "কানেকশন টেস্ট ব্যর্থ হয়েছে");
      }
    });
  };

  // Auto Mapping Action
  const handleAutoGenerateMappings = async () => {
    if (
      !confirm(
        "মাদরাসার সকল শিক্ষার্থী ও শিক্ষকের জন্য স্বয়ংক্রিয়ভাবে বায়োমেট্রিক আইডি ম্যাপিং করতে চান?"
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await autoGenerateUserMappings();
      if (res.success) {
        showToast("success", res.message);
        loadAllData();
      } else {
        showToast("error", res.message || "ম্যাপিং তৈরি ব্যর্থ হয়েছে");
      }
    });
  };

  // Save Mapping
  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapping?.device_user_id?.trim() || !editingMapping?.target_id) {
      showToast("error", "মেশিন আইডি ও শিক্ষার্থী/শিক্ষক নির্বাচন করুন");
      return;
    }

    startTransition(async () => {
      const res = await saveBiometricUserMapping(editingMapping);
      if (res.success) {
        showToast("success", "ম্যাপিং সফলভাবে সংরক্ষণ করা হয়েছে");
        setIsMappingModalOpen(false);
        setEditingMapping(null);
        loadAllData();
      } else {
        showToast("error", res.error || "ম্যাপিং সংরক্ষণ ব্যর্থ হয়েছে");
      }
    });
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm("আপনি কি এই ইউজার ম্যাপিংটি মুছে ফেলতে চান?")) return;
    startTransition(async () => {
      const res = await deleteBiometricUserMapping(id);
      if (res.success) {
        showToast("success", "ম্যাপিং মুছে ফেলা হয়েছে");
        loadAllData();
      }
    });
  };

  // File Upload Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFileContent(text || "");
      };
      reader.readAsText(file);
    }
  };

  const handleProcessUploadedFile = async () => {
    if (!fileContent || !selectedFile) {
      showToast("error", "অনুগ্রহ করে একটি লগ ফাইল আপলোড করুন");
      return;
    }

    startTransition(async () => {
      const res = await importBiometricLogsFromFile(
        fileContent,
        selectedFile.name,
        importDeviceId,
        importUserType
      );
      setImportResult(res);
      if (res.success) {
        showToast("success", res.message);
        loadAllData();
      } else {
        showToast("error", res.message || "ফাইল প্রসেসিং ব্যর্থ হয়েছে");
      }
    });
  };

  // Filtered Mappings
  const filteredMappings = mappings.filter((m) => {
    const matchSearch =
      !searchTerm ||
      m.target_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.device_user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.target_identifier && m.target_identifier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.class_name && m.class_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchType = mappingUserTypeFilter === "all" || m.user_type === mappingUserTypeFilter;
    const matchClass = mappingClassFilter === "all" || m.class_name === mappingClassFilter;

    return matchSearch && matchType && matchClass;
  });

  // Filtered Punch Logs
  const filteredLogs = punchLogs.filter((l) => {
    const matchDate = !logDateFilter || l.punch_date === logDateFilter;
    const matchDevice = logDeviceFilter === "all" || l.device_id === logDeviceFilter;
    const matchSearch =
      !searchTerm ||
      (l.target_name && l.target_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.device_user_id.includes(searchTerm) ||
      (l.class_name && l.class_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchDate && matchDevice && matchSearch;
  });

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-madrasa-domain.com";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all transform animate-in slide-in-from-bottom-5 ${
            toastMessage.type === "success"
              ? "bg-emerald-900 text-emerald-50 border-emerald-700"
              : toastMessage.type === "error"
              ? "bg-rose-900 text-rose-50 border-rose-700"
              : "bg-slate-900 text-slate-50 border-slate-700"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Sub-nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link
              href="/dashboard/attendance"
              className="hover:text-blue-600 flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>হাজিরা ও ছুটি ড্যাশবোর্ড</span>
            </Link>
            <span>/</span>
            <span className="text-blue-600 font-bold">বায়োমেট্রিক ও ফিঙ্গারপ্রিন্ট ডিভাইস</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white shadow-md shadow-blue-500/20">
              <Fingerprint className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span>বায়োমেট্রিক ও ফিঙ্গারপ্রিন্ট হাজিরা ডিভাইস</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            মাদরাসার ফিংগারপ্রিন্ট, ফেস রিকগনিশন ও পাঞ্চ মেশিন কনফিগারেশন, রিয়েলটাইম ক্লাউড পুশ ও ইউএসবি ফাইল আপলোড।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition flex items-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>রিফ্রেশ</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewDevice}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-600/20 active:scale-95 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন ডিভাইস যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">মোট সংযুক্ত ডিভাইস</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {toBanglaNumber(devices.length)}{" "}
              <span className="text-xs font-medium text-emerald-600">
                ({toBanglaNumber(devices.filter((d) => d.status === "active").length)} সক্রিয়)
              </span>
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">আজকের লাইভ পাঞ্চ</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {toBanglaNumber(stats?.totalPunchesToday || 0)}{" "}
              <span className="text-xs font-medium text-slate-500">উপস্থিতি</span>
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">ম্যাপ করা আইডি</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {toBanglaNumber(mappings.length)}{" "}
              <span className="text-xs font-medium text-slate-500">জন</span>
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">ক্লাউড পুশ গেটওয়ে</p>
            <h3 className="text-sm sm:text-base font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>অনলাইন ও প্রস্তুত</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition ${
            activeTab === "devices"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>ডিভাইস তালিকা ({toBanglaNumber(devices.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mappings")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition ${
            activeTab === "mappings"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>আইডি ও ইউজার ম্যাপিং ({toBanglaNumber(mappings.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("importer")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition ${
            activeTab === "importer"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>ইউএসবি / ফাইল ইমপোর্ট (অফলাইন)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition ${
            activeTab === "logs"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>রিয়েলটাইম পাঞ্চ লগ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition ${
            activeTab === "guide"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>সেটআপ নির্দেশিকা ও গাইড</span>
        </button>
      </div>

      {/* TAB 1: DEVICES LIST */}
      {activeTab === "devices" && (
        <div className="space-y-5">
          {devices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Fingerprint className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-800">কোনো ডিভাইস যুক্ত করা নেই</h3>
                <p className="text-xs text-slate-500">
                  আপনার মাদরাসার ফিঙ্গারপ্রিন্ট বা ফেস রিকগনিশন মেশিনটি সহজেই যুক্ত করে নিন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewDevice}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition"
              >
                + প্রথম ডিভাইস যুক্ত করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {devices.map((device) => {
                const brand = BIOMETRIC_BRANDS_LIST.find((b) => b.id === device.device_model);

                return (
                  <div
                    key={device.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Top status bar */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            device.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              device.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{device.status === "active" ? "সক্রিয় (Online)" : "নিষ্ক্রিয়"}</span>
                        </span>

                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                          {device.target_audience === "students"
                            ? "শুধু ছাত্র"
                            : device.target_audience === "teachers"
                            ? "শুধু স্টাফ"
                            : "উভয় (ছাত্র ও স্টাফ)"}
                        </span>
                      </div>

                      {/* Device Title & Model */}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                          {device.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          মডেল: <span className="text-slate-800 font-bold">{brand?.label || device.device_model}</span>
                        </p>
                      </div>

                      {/* Details Box */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-500">সিরিয়াল / ক্লাউড আইডি:</span>
                          <span className="font-mono font-bold text-slate-800">{device.serial_number}</span>
                        </div>
                        {device.ip_address && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500">লোকাল আইপি ও পোর্ট:</span>
                            <span className="font-mono text-slate-700">
                              {device.ip_address}:{device.port || 4370}
                            </span>
                          </div>
                        )}
                        {device.location && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500">অবস্থান:</span>
                            <span className="text-slate-800">{device.location}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                          <span className="font-semibold text-slate-500">মোট পাঞ্চ রেকর্ড:</span>
                          <span className="font-bold text-blue-600">
                            {toBanglaNumber(device.total_punches_count || 0)} বার
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setConfigDevice(device);
                          setIsConfigModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition flex items-center gap-1.5"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>কনফিগ গাইড</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTestConnection(device)}
                          title="কানেকশন টেস্ট"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-200/60 rounded-lg transition"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditDevice(device)}
                          title="সম্পাদনা"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          title="মুছে ফেলুন"
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER MAPPINGS */}
      {activeTab === "mappings" && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900">আইডি ও ইউজার ম্যাপিং</h3>
                <p className="text-xs text-slate-500">
                  মেশিনের User ID নম্বরের সাথে মাদরাসার শিক্ষার্থী ও শিক্ষকদের লিংক করুন।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoGenerateMappings}
                  disabled={isPending}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>এক ক্লিকে স্বয়ংক্রিয় ম্যাপিং (Auto-Map All)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingMapping({
                      device_user_id: "",
                      user_type: "student",
                      target_id: "",
                      fingerprint_registered: true,
                    });
                    setIsMappingModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ নতুন ম্যাপিং</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="নাম, রোল বা মেশিন আইডি দিয়ে খুঁজুন..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <select
                  value={mappingUserTypeFilter}
                  onChange={(e) => setMappingUserTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">সকল ধরন (ছাত্র ও শিক্ষক)</option>
                  <option value="student">শুধু শিক্ষার্থী</option>
                  <option value="teacher">শুধু শিক্ষক ও স্টাফ</option>
                </select>
              </div>

              <div>
                <select
                  value={mappingClassFilter}
                  onChange={(e) => setMappingClassFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">সকল জামাত</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mappings Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">মেশিন User ID</th>
                    <th className="py-2.5 px-3">নাম</th>
                    <th className="py-2.5 px-3">ধরন</th>
                    <th className="py-2.5 px-3">জামাত / পদবি</th>
                    <th className="py-2.5 px-3">রোল / কোড</th>
                    <th className="py-2.5 px-3">RFID কার্ড নং</th>
                    <th className="py-2.5 px-3 text-center">বায়োমেট্রিক স্ট্যাটাস</th>
                    <th className="py-2.5 px-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredMappings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        কোনো ইউজার ম্যাপিং পাওয়া যায়নি। &quot;এক ক্লিকে স্বয়ংক্রিয় ম্যাপিং&quot; বাটনে ক্লিক করে সব ছাত্র-শিক্ষকের আইডি লিংক করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map((map) => (
                      <tr key={map.id} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {map.device_user_id}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{map.target_name}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              map.user_type === "student"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {map.user_type === "student" ? "ছাত্র" : "শিক্ষক/স্টাফ"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {map.class_name || (map.user_type === "teacher" ? "শিক্ষক" : "—")}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {map.target_identifier || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {map.rfid_card_no ? (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-800 border border-slate-200">
                              💳 {map.rfid_card_no}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>রেজিস্টার্ড</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMapping({ ...map });
                                setIsMappingModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition"
                              title="সম্পাদনা করুন"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMapping(map.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="মুছুন"
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
          </div>
        </div>
      )}

      {/* TAB 3: OFFLINE USB FILE IMPORTER */}
      {activeTab === "importer" && (
        <div className="space-y-5">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <span>ইউএসবি পেনড্রাইভ / এক্সেল লগ ফাইল ইমপোর্ট (Offline Punch Sync)</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                মাদরাসায় ইন্টারনেট না থাকলে পাঞ্চ মেশিনে পেনড্রাইভ লাগিয়ে নামানো{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-bold">
                  attlog.dat
                </code>
                , <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-bold">.txt</code> বা{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-bold">.csv</code> ফাইল
                এখানে আপলোড করলেই সবার হাজিরা স্বয়ংক্রিয়ভাবে ডাটাবেজে যুক্ত হবে।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">ডিভাইস নির্বাচন করুন:</label>
                <select
                  value={importDeviceId}
                  onChange={(e) => setImportDeviceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium outline-none bg-white"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.serial_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">হাজিরা লক্ষ্যমাত্রা:</label>
                <select
                  value={importUserType}
                  onChange={(e) => setImportUserType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-medium outline-none bg-white"
                >
                  <option value="all">উভয় (ছাত্র ও শিক্ষক সবার হাজিরা)</option>
                  <option value="student">শুধু শিক্ষার্থীদের হাজিরা</option>
                  <option value="teacher">শুধু শিক্ষক ও কর্মচারীদের হাজিরা</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    const sample =
                      "101\t2026-09-23 08:15:30\t0\t1\n102\t2026-09-23 08:20:12\t0\t1\n480001\t2026-09-23 08:22:45\t0\t1";
                    const blob = new Blob([sample], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "sample_attlog.dat";
                    a.click();
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>নমুনা ফাইল ডাউনলোড (.dat)</span>
                </button>
              </div>
            </div>

            {/* File Dropzone */}
            <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 rounded-2xl p-6 sm:p-8 text-center transition">
              <input
                type="file"
                id="biometric-file"
                accept=".dat,.txt,.csv,.log"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="biometric-file" className="cursor-pointer block space-y-2">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold text-sm text-blue-700">ফাইল নির্বাচন করতে এখানে ক্লিক করুন</span>
                  <p className="text-xs text-slate-500">
                    সমর্থিত ফরম্যাট: ZKTeco attlog.dat, Standard CSV, Text Log File
                  </p>
                </div>
                {selectedFile && (
                  <div className="inline-block mt-2 px-3 py-1 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-blue-800">
                    📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </label>
            </div>

            {/* Process Button */}
            {selectedFile && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessUploadedFile}
                  disabled={isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>হাজিরা প্রসেস ও ডাটাবেজে সংরক্ষণ করুন</span>
                </button>
              </div>
            )}

            {/* Import Result Alert */}
            {importResult && (
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  importResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="font-bold text-sm flex items-center gap-2 mb-1">
                  {importResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{importResult.message}</span>
                </div>
                {importResult.uniqueDates && importResult.uniqueDates.length > 0 && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    তারিখসমূহ: {importResult.uniqueDates.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE PUNCH LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">পাঞ্চ ও হাজিরার লাইভ লগ</h3>
                <p className="text-xs text-slate-500">
                  ক্লাউড পুশ ও ইউএসবি ডিভাইস থেকে সংগৃহীত সর্বশেষ পাঞ্চ হিস্ট্রি
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={logDateFilter}
                  onChange={(e) => setLogDateFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">সময় ও তারিখ</th>
                    <th className="py-2.5 px-3">মেশিন User ID</th>
                    <th className="py-2.5 px-3">নাম</th>
                    <th className="py-2.5 px-3">জামাত / পদবি</th>
                    <th className="py-2.5 px-3">ডিভাইস</th>
                    <th className="py-2.5 px-3">পাঞ্চ মোড</th>
                    <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        নির্বাচিত তারিখে কোনো পাঞ্চ লগ পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {format(new Date(log.punch_time), "dd/MM/yyyy hh:mm:ss a")}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">
                          {log.device_user_id}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {log.target_name || "অজানা ইউজার"}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{log.class_name || "—"}</td>
                        <td className="py-2 px-3 text-slate-600">{log.device_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {log.sync_mode === "cloud_push" ? "ক্লাউড পুশ ⚡" : "USB ইমপোর্ট 💾"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === "processed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {log.status === "processed" ? "উপস্থিতি সফল" : "আনম্যাপড ID"}
                          </span>
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

      {/* TAB 5: HARDWARE SETUP GUIDE */}
      {activeTab === "guide" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-slate-800 text-xs sm:text-sm">
          <div className="space-y-1 border-b border-slate-200 pb-4">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-600" />
              <span>ZKTeco ও বায়োমেট্রিক মেশিন সেটআপ নির্দেশিকা</span>
            </h3>
            <p className="text-slate-500">
              কীভাবে মেশিনে আইপি ও ক্লাউড সার্ভার এড্রেস বসিয়ে সফটওয়্যারের সাথে কানেক্ট করবেন
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                ১
              </div>
              <h4 className="font-bold text-slate-900 text-sm">মেশিন মেন্যু ও নেটওয়ার্ক</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                মেশিনের <strong>M/OK</strong> বাটনে প্রেস করে <strong>Comm. (কমিউনিকেশন)</strong> সেটিংসে যান।
                ওয়াইফাই অথবা ল্যান ক্যাবল কানেক্ট করে <strong>Ethernet</strong> আইপি কনফিগার করুন।
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                ২
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Cloud Server / ADMS সেটিংস</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Comm. &gt; Cloud Server Settings</strong> অপশনে যান।{" "}
                <strong>Server Address</strong> হিসেবে আপনার ডোমেইন এবং <strong>Server Port</strong> হিসেবে{" "}
                <code className="bg-white px-1 py-0.5 rounded border text-blue-600 font-bold">443</code> অথবা{" "}
                <code className="bg-white px-1 py-0.5 rounded border text-blue-600 font-bold">80</code> সেট করুন।
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                ৩
              </div>
              <h4 className="font-bold text-slate-900 text-sm">ছাত্র ও আঙুলের ছাপ এন্ট্রি</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>User Mgt &gt; New User</strong> এ গিয়ে শিক্ষার্থীর রোল/আইডি নম্বর দিয়ে{" "}
                <strong>Fingerprint / Face</strong> রেজিস্টার করুন। সফটওয়্যারে &quot;এক ক্লিকে স্বয়ংক্রিয় ম্যাপিং&quot;
                করলেই হাজিরা সরাসরি বসে যাবে।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT DEVICE MODAL */}
      {isDeviceModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <Fingerprint className="w-5 h-5" />
                <span>{editingDevice.id ? "ডিভাইস সম্পাদনা" : "নতুন ডিভাইস যোগ করুন"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDeviceModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">ডিভাইসের নাম / অবস্থান *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মেইন গেট পাঞ্চ মেশিন"
                  value={editingDevice.name || ""}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">মডেল ও ব্র্যান্ড</label>
                  <select
                    value={editingDevice.device_model || "ZKTeco_K40"}
                    onChange={(e: any) =>
                      setEditingDevice({ ...editingDevice, device_model: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white"
                  >
                    {BIOMETRIC_BRANDS_LIST.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">সিরিয়াল নম্বর (SN)</label>
                  <input
                    type="text"
                    value={editingDevice.serial_number || ""}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, serial_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">কানেকশন প্রোটোকল</label>
                  <select
                    value={editingDevice.protocol || "cloud_push"}
                    onChange={(e: any) =>
                      setEditingDevice({ ...editingDevice, protocol: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white"
                  >
                    <option value="cloud_push">ক্লাউড পুশ (ADMS / Webhook)</option>
                    <option value="lan_tcp">লোকাল ল্যান / TCP IP</option>
                    <option value="offline_usb">অফলাইন ইউএসবি পেনড্রাইভ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">টার্গেট হাজিরা</label>
                  <select
                    value={editingDevice.target_audience || "all"}
                    onChange={(e: any) =>
                      setEditingDevice({ ...editingDevice, target_audience: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white"
                  >
                    <option value="all">উভয় (ছাত্র ও শিক্ষক)</option>
                    <option value="students">শুধু শিক্ষার্থী</option>
                    <option value="teachers">শুধু শিক্ষক ও স্টাফ</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 text-xs">ডিভাইস সিক্রেট টোকেন (Secret Token):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={editingDevice.secret_token || ""}
                    className="w-full px-3 py-1.5 font-mono text-xs bg-white border border-slate-300 rounded-lg select-all"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingDevice({ ...editingDevice, secret_token: generateDeviceToken("bio") })
                    }
                    className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 transition"
                    title="নতুন টোকেন জেনারেট করুন"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  {isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIG DETAILS MODAL */}
      {isConfigModalOpen && configDevice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-400" />
                <span>ডিভাইস ক্লাউড পুশ কনফিগারেশন</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <span className="font-bold text-slate-700">ডিভাইসের নাম:</span>
                <p className="text-slate-900 font-bold text-base">{configDevice.name}</p>
              </div>

              {/* Cloud Push Webhook Endpoint */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 text-xs">Cloud Push Server URL:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(`${appBaseUrl}/api/biometric/push`, "server_url")
                    }
                    className="text-blue-700 font-bold flex items-center gap-1 text-[11px] hover:underline"
                  >
                    {copiedKey === "server_url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "server_url" ? "কপি হয়েছে" : "কপি করুন"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  readOnly
                  value={`${appBaseUrl}/api/biometric/push`}
                  className="w-full px-3 py-1.5 font-mono text-xs bg-white border border-blue-200 rounded-lg text-slate-800 select-all"
                />
              </div>

              {/* Secret Token */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">Device Secret Token:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(configDevice.secret_token, "token")}
                    className="text-blue-700 font-bold flex items-center gap-1 text-[11px] hover:underline"
                  >
                    {copiedKey === "token" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "token" ? "কপি হয়েছে" : "কপি করুন"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  readOnly
                  value={configDevice.secret_token}
                  className="w-full px-3 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg text-slate-800 select-all"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
                💡 <strong>ZKTeco ADMS মেশিনের জন্য:</strong> মেশিনের{" "}
                <code>Comm. &gt; Cloud Server</code> মেন্যুতে গিয়ে Server IP/Domain ঘরে{" "}
                <code className="font-bold">{appBaseUrl.replace(/^https?:\/\//, "")}</code> এবং Port ঘরে{" "}
                <code className="font-bold">443</code> সেট করুন।
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl"
                >
                  ঠিক আছে
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MAPPING MODAL */}
      {isMappingModalOpen && editingMapping && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <h3 className="font-black text-base flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>বায়োমেট্রিক আইডি ম্যাপিং</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">ইউজার ধরন</label>
                <select
                  value={editingMapping.user_type || "student"}
                  onChange={(e: any) =>
                    setEditingMapping({
                      ...editingMapping,
                      user_type: e.target.value,
                      target_id: "",
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white"
                >
                  <option value="student">শিক্ষার্থী (Student)</option>
                  <option value="teacher">শিক্ষক / স্টাফ (Teacher/Staff)</option>
                </select>
              </div>

              {editingMapping.user_type === "student" ? (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">শিক্ষার্থী নির্বাচন করুন *</label>
                  <select
                    required
                    value={editingMapping.target_id || ""}
                    onChange={(e) => {
                      const sel = studentsList.find((s) => s.id === e.target.value);
                      setEditingMapping({
                        ...editingMapping,
                        target_id: e.target.value,
                        target_name: `${sel?.first_name || ""} ${sel?.last_name || ""}`.trim(),
                        target_identifier: sel?.student_id || `রোল: ${sel?.roll_number}`,
                        class_name: Array.isArray(sel?.classes) ? sel?.classes[0]?.name : sel?.classes?.name,
                        device_user_id:
                          editingMapping.device_user_id ||
                          String(sel?.roll_number || sel?.student_id?.replace(/\D/g, "") || ""),
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none bg-white"
                  >
                    <option value="">-- শিক্ষার্থী বেছে নিন --</option>
                    {studentsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} (রোল: {s.roll_number || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">উস্তাদ / স্টাফের নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="উস্তাদের নাম লিখুন"
                    value={editingMapping.target_name || ""}
                    onChange={(e) =>
                      setEditingMapping({
                        ...editingMapping,
                        target_name: e.target.value,
                        target_id: editingMapping.target_id || `tch_${Date.now()}`,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    মেশিনের User ID (Punch ID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: 101 বা 480001"
                    value={editingMapping.device_user_id || ""}
                    onChange={(e) =>
                      setEditingMapping({ ...editingMapping, device_user_id: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono font-bold text-blue-700 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    RFID স্মার্ট কার্ড নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: 1008291032"
                    value={editingMapping.rfid_card_no || ""}
                    onChange={(e) =>
                      setEditingMapping({ ...editingMapping, rfid_card_no: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
