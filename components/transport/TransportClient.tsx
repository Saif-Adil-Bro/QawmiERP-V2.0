"use client";

import React, { useState, useTransition } from "react";
import {
  Bus,
  Car,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  UserPlus,
  UserMinus,
  MapPin,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Sparkles,
} from "lucide-react";
import {
  TransportVehicle,
  StudentTransportAssignment,
  DEFAULT_VEHICLE_TYPES,
} from "@/lib/transport-utils";
import {
  saveTransportVehicle,
  deleteTransportVehicle,
  assignStudentToVehicle,
  removeStudentFromVehicle,
} from "@/app/actions/transport";

interface Props {
  initialOverview: {
    vehicles: TransportVehicle[];
    assignments: StudentTransportAssignment[];
    allStudents: any[];
  };
}

export default function TransportClient({ initialOverview }: Props) {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>(initialOverview.vehicles);
  const [assignments, setAssignments] = useState<StudentTransportAssignment[]>(
    initialOverview.assignments
  );
  const [allStudents] = useState<any[]>(initialOverview.allStudents);
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState<TransportVehicle | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStop, setSelectedStop] = useState("");
  const [customFee, setCustomFee] = useState<number>(800);
  const [studentSearch, setStudentSearch] = useState("");

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTab, setSelectedTab] = useState<"vehicles" | "roster">("vehicles");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form data for vehicle
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState<"VAN" | "MICROBUS" | "BUS" | "AUTO">("VAN");
  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [assistantPhone, setAssistantPhone] = useState("");
  const [capacity, setCapacity] = useState<number>(14);
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState<number>(800);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [stopsText, setStopsText] = useState("");

  // Stats
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v: TransportVehicle) => v.isActive).length;
  const totalCapacity = vehicles.reduce((sum: number, v: TransportVehicle) => sum + (v.capacity || 0), 0);
  const totalAssignedStudents = assignments.length;
  const totalEstimatedRevenue = assignments.reduce(
    (sum: number, a: StudentTransportAssignment) => sum + (a.monthlyFee || 0),
    0
  );

  const handleOpenNewVehicle = () => {
    setEditingVehicle(null);
    setVehicleNo("");
    setVehicleType("VAN");
    setRouteName("");
    setDriverName("");
    setDriverPhone("");
    setAssistantName("");
    setAssistantPhone("");
    setCapacity(14);
    setDefaultMonthlyFee(800);
    setIsActive(true);
    setStopsText("");
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: TransportVehicle) => {
    setEditingVehicle(veh);
    setVehicleNo(veh.vehicleNo || "");
    setVehicleType(veh.vehicleType || "VAN");
    setRouteName(veh.routeName || "");
    setDriverName(veh.driverName || "");
    setDriverPhone(veh.driverPhone || "");
    setAssistantName(veh.assistantName || "");
    setAssistantPhone(veh.assistantPhone || "");
    setCapacity(veh.capacity || 14);
    setDefaultMonthlyFee(veh.defaultMonthlyFee || 800);
    setIsActive(veh.isActive ?? true);
    setStopsText(veh.stops?.join(", ") || "");
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim() || !driverName.trim() || !driverPhone.trim()) {
      setFeedback({ type: "error", message: "গাড়ির নম্বর, ড্রাইভারের নাম ও ফোন নম্বর পূরণ করুন।" });
      return;
    }

    const stops = stopsText
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await saveTransportVehicle({
        id: editingVehicle ? editingVehicle.id : undefined,
        vehicleNo,
        vehicleType,
        routeName: routeName || "সাধারণ রুট",
        stops,
        driverName,
        driverPhone,
        assistantName,
        assistantPhone,
        capacity: Number(capacity) || 14,
        defaultMonthlyFee: Number(defaultMonthlyFee) || 800,
        isActive,
      });

      if (res.success && res.data) {
        if (editingVehicle) {
          setVehicles((prev) =>
            prev.map((v) => (v.id === res.data!.id ? res.data! : v))
          );
        } else {
          setVehicles((prev) => [res.data!, ...prev]);
        }
        setIsVehicleModalOpen(false);
        setFeedback({
          type: "success",
          message: editingVehicle ? "গাড়ির তথ্য সফলভাবে আপডেট হয়েছে।" : "নতুন গাড়ি ও রুট সফলভাবে যোগ হয়েছে।",
        });
      } else {
        setFeedback({ type: "error", message: res.error || "সংরক্ষণ করা সম্ভব হয়নি।" });
      }
    });
  };

  const handleDeleteVehicle = (vehId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই যানটি ও এর রুট মুছে ফেলতে চান?")) return;

    startTransition(async () => {
      const res = await deleteTransportVehicle(vehId);
      if (res.success) {
        setVehicles((prev) => prev.filter((v) => v.id !== vehId));
        setAssignments((prev) => prev.filter((a) => a.vehicleId !== vehId));
        setFeedback({ type: "success", message: "যানবাহন সফলভাবে তালিকা থেকে মুছে ফেলা হয়েছে।" });
      } else {
        setFeedback({ type: "error", message: res.error || "মুছে ফেলা সম্ভব হয়নি।" });
      }
    });
  };

  const handleOpenAssignModal = (veh: TransportVehicle) => {
    setSelectedVehicleForAssign(veh);
    setSelectedStudentId("");
    setSelectedStop(veh.stops?.[0] || "");
    setCustomFee(veh.defaultMonthlyFee || 800);
    setStudentSearch("");
    setIsAssignModalOpen(true);
  };

  const handleAssignStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForAssign || !selectedStudentId) return;

    const student = allStudents.find((s: any) => s.id === selectedStudentId);
    if (!student) return;

    startTransition(async () => {
      const res = await assignStudentToVehicle({
        studentId: student.id,
        studentName: student.name || "শিক্ষার্থী",
        studentRoll: student.roll || "",
        className: student.class_name || student.classes?.name || "সাধারণ",
        vehicleId: selectedVehicleForAssign.id,
        pickupStop: selectedStop || "প্রধান মোড়",
        monthlyFee: customFee,
        parentPhone: student.mobile || student.guardian_phone || "",
      });

      if (res.success && res.data) {
        setAssignments((prev) => [
          res.data!,
          ...prev.filter((a) => a.studentId !== selectedStudentId),
        ]);
        setIsAssignModalOpen(false);
        setFeedback({
          type: "success",
          message: "শিক্ষার্থী সফলভাবে ভ্যানে বরাদ্দ হয়েছে এবং মাসিক ফি ডাটাবেজে যুক্ত হয়েছে।",
        });
      } else {
        setFeedback({ type: "error", message: res.error || "বরাদ্দ ব্যর্থ হয়েছে।" });
      }
    });
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই শিক্ষার্থীকে পরিবহন তালিকা থেকে অবমুক্ত করতে চান?")) return;

    startTransition(async () => {
      const res = await removeStudentFromVehicle(studentId);
      if (res.success) {
        setAssignments((prev) => prev.filter((a) => a.studentId !== studentId));
        setFeedback({ type: "success", message: "শিক্ষার্থীকে পরিবহন তালিকা থেকে অবমুক্ত করা হয়েছে।" });
      } else {
        setFeedback({ type: "error", message: res.error || "অবমুক্ত করা সম্ভব হয়নি।" });
      }
    });
  };

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v: TransportVehicle) => {
    const q = searchFilter.toLowerCase();
    return (
      (v.vehicleNo && v.vehicleNo.toLowerCase().includes(q)) ||
      (v.driverName && v.driverName.toLowerCase().includes(q)) ||
      (v.routeName && v.routeName.toLowerCase().includes(q)) ||
      v.stops?.some((s: string) => s.toLowerCase().includes(q))
    );
  });

  // Assigned student IDs
  const assignedStudentIds = new Set(assignments.map((a: StudentTransportAssignment) => a.studentId));

  // Filtered students for assign dropdown
  const filteredAvailableStudents = allStudents.filter((s: any) => {
    if (assignedStudentIds.has(s.id)) return false;
    const q = studentSearch.toLowerCase();
    const nameMatch = s.name?.toLowerCase().includes(q);
    const rollMatch = s.roll?.toString().toLowerCase().includes(q);
    const classMatch = (s.class_name || s.classes?.name)?.toLowerCase().includes(q);
    return nameMatch || rollMatch || classMatch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Bus className="w-64 h-64 text-white" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>শিশু ও আবাসিক পরিবহন ব্যবস্থাপনা</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            মাদরাসা ভ্যান ও ট্রান্সপোর্ট বহর
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1 max-w-xl">
            নূরানী ও হিফজ শিশুদের জন্য মাদরাসার নিরাপদ পরিবহন ব্যবস্থা, রুট স্টপেজ, ড্রাইভার যোগাযোগ এবং শিক্ষার্থী ফি ব্যবস্থাপনা।
          </p>
        </div>
        <button
          onClick={handleOpenNewVehicle}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-95 text-sm shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>নতুন গাড়ি ও রুট যোগ</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : "bg-red-500/10 text-red-300 border-red-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-75 hover:opacity-100 underline"
          >
            মুছে দিন
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card/70 border border-border/60 p-4 rounded-xl">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-2">
            <span>মোট সক্রিয় পরিবহন</span>
            <Bus className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {activeVehicles} <span className="text-xs font-normal text-muted-foreground">/ {totalVehicles} টি</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">ক্যাম্পাস ভ্যান ও বাস বহর</p>
        </div>

        <div className="bg-card/70 border border-border/60 p-4 rounded-xl">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-2">
            <span>মোট আসন ধারণক্ষমতা</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalCapacity} <span className="text-xs font-normal text-muted-foreground">আসন</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">সব গাড়ির সম্মিলিত সিট</p>
        </div>

        <div className="bg-card/70 border border-border/60 p-4 rounded-xl">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-2">
            <span>সেবাগ্রহণকারী শিক্ষার্থী</span>
            <UserPlus className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalAssignedStudents}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({totalCapacity > 0 ? Math.round((totalAssignedStudents / totalCapacity) * 100) : 0}% পূর্ণ)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">রুটভিত্তিক যাত্রী শিক্ষার্থী</p>
        </div>

        <div className="bg-card/70 border border-border/60 p-4 rounded-xl">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-2">
            <span>মাসিক পরিবহন রাজস্ব</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ৳ {totalEstimatedRevenue.toLocaleString("bn-BD")}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">শিক্ষার্থী ফি থেকে প্রত্যাশিত</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedTab("vehicles")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === "vehicles"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            গাড়ি ও রুট বিবরণ ({filteredVehicles.length})
          </button>
          <button
            onClick={() => setSelectedTab("roster")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === "roster"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            রুটভিত্তিক শিক্ষার্থী রোস্টার ({totalAssignedStudents})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="গাড়ি, ড্রাইভার বা রুট খুঁজুন..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border/70 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Tab 1: Vehicles Cards View */}
      {selectedTab === "vehicles" && (
        <>
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-2xl p-8">
              <Bus className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">কোনো পরিবহন বা রুট পাওয়া যায়নি</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                মাদরাসার ছাত্র-ছাত্রীদের পরিবহনের জন্য নতুন ভ্যান, বাস বা মাইক্রোবাস যোগ করতে উপরের বাটনে ক্লিক করুন।
              </p>
              <button
                onClick={handleOpenNewVehicle}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                <span>প্রথম গাড়ি যোগ করুন</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredVehicles.map((vehicle: TransportVehicle) => {
                const vehicleStudents = assignments.filter((a) => a.vehicleId === vehicle.id);
                const percentFull = vehicle.capacity
                  ? Math.min(100, Math.round((vehicleStudents.length / vehicle.capacity) * 100))
                  : 0;

                return (
                  <div
                    key={vehicle.id}
                    className="bg-card border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
                  >
                    {/* Card Top */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            {vehicle.vehicleType === "BUS" ? (
                              <Bus className="w-6 h-6" />
                            ) : vehicle.vehicleType === "MICROBUS" ? (
                              <Car className="w-6 h-6" />
                            ) : (
                              <Truck className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground text-base leading-tight">
                                {vehicle.vehicleNo}
                              </h3>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  vehicle.isActive
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                    : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                                }`}
                              >
                                {vehicle.isActive ? "সচল" : "নিষ্ক্রিয়"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {DEFAULT_VEHICLE_TYPES[vehicle.vehicleType] || "যানবাহন"} • রুট: {vehicle.routeName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditVehicle(vehicle)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="সম্পাদনা করুন"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Route & Driver Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl mb-4 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">ড্রাইভার ও যোগাযোগ:</span>
                          <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                            {vehicle.driverName}
                            <a
                              href={`tel:${vehicle.driverPhone}`}
                              className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 text-[11px]"
                            >
                              <Phone className="w-3 h-3 inline" /> {vehicle.driverPhone}
                            </a>
                          </span>
                          {vehicle.assistantName && (
                            <span className="text-muted-foreground text-[11px] block mt-1">
                              সহকারী: {vehicle.assistantName}{" "}
                              {vehicle.assistantPhone && `(${vehicle.assistantPhone})`}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-muted-foreground block text-[11px]">ডিফল্ট মাসিক ভাড়া:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            ৳ {vehicle.defaultMonthlyFee} / প্রতি শিক্ষার্থী
                          </span>
                          <span className="text-muted-foreground text-[11px] line-clamp-1 mt-1">
                            আসন ধারণক্ষমতা: {vehicle.capacity} জন
                          </span>
                        </div>
                      </div>

                      {/* Route Stops */}
                      {vehicle.stops && vehicle.stops.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                            নির্ধারিত স্টপেজ সমূহ:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {vehicle.stops.map((stop: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px] border border-border/60"
                              >
                                <MapPin className="w-3 h-3 text-emerald-500" />
                                {stop}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Capacity Progress Bar */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            আসন পূরণ: <strong className="text-foreground">{vehicleStudents.length}</strong> / {vehicle.capacity}
                          </span>
                          <span>{percentFull}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              percentFull >= 100
                                ? "bg-red-500"
                                : percentFull >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${percentFull}%` }}
                          />
                        </div>
                      </div>

                      {/* Enrolled Students Quick Chips */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">
                            যাত্রী শিক্ষার্থী ({vehicleStudents.length} জন):
                          </span>
                          <button
                            onClick={() => handleOpenAssignModal(vehicle)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>নতুন শিক্ষার্থী যোগ</span>
                          </button>
                        </div>

                        {vehicleStudents.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic bg-muted/20 p-2 rounded-lg text-center">
                            এখনো কোনো শিক্ষার্থী এই গাড়িতে বরাদ্দ করা হয়নি।
                          </p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {vehicleStudents.map((st: StudentTransportAssignment) => (
                              <div
                                key={st.studentId}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-xs hover:bg-muted/70 transition-colors"
                              >
                                <div>
                                  <span className="font-medium text-foreground">{st.studentName}</span>
                                  <span className="text-muted-foreground text-[11px] ml-2">
                                    (রোল: {st.studentRoll || "N/A"}, {st.className})
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] ml-2 font-medium">
                                    • স্টপ: {st.pickupStop} (৳ {st.monthlyFee})
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRemoveStudent(st.studentId)}
                                  disabled={isPending}
                                  className="text-muted-foreground hover:text-red-500 p-1 transition-colors"
                                  title="তালিকা থেকে বাদ দিন"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom CTA */}
                    <div className="p-3 bg-muted/30 border-t border-border/50 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        মাসিক রাজস্ব:{" "}
                        <strong>
                          ৳{" "}
                          {vehicleStudents
                            .reduce((sum, s) => sum + (s.monthlyFee || 0), 0)
                            .toLocaleString("bn-BD")}
                        </strong>
                      </span>
                      <button
                        onClick={() => handleOpenAssignModal(vehicle)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 font-medium transition-colors inline-flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>শিক্ষার্থী যুক্ত করুন</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Roster View */}
      {selectedTab === "roster" && (
        <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/60 bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">
              পরিবহন সেবা গ্রহণকারী শিক্ষার্থীদের তালিকা ও স্টপেজ
            </h3>
            <span className="text-xs text-muted-foreground">
              মোট: {totalAssignedStudents} জন শিক্ষার্থী
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border/60">
                  <th className="py-2.5 px-4 font-medium">শিক্ষার্থী ও রোল</th>
                  <th className="py-2.5 px-4 font-medium">জামাত / শ্রেণি</th>
                  <th className="py-2.5 px-4 font-medium">বরাদ্দকৃত গাড়ি</th>
                  <th className="py-2.5 px-4 font-medium">স্টপেজ</th>
                  <th className="py-2.5 px-4 font-medium">মাসিক ফি</th>
                  <th className="py-2.5 px-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      কোনো শিক্ষার্থী পরিবহনে বরাদ্দ করা হয়নি।
                    </td>
                  </tr>
                ) : (
                  assignments.map((st: StudentTransportAssignment) => (
                    <tr key={st.studentId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-foreground block">{st.studentName}</span>
                        <span className="text-[11px] text-muted-foreground">রোল: {st.studentRoll || "N/A"}</span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{st.className || "সাধারণ"}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-foreground">{st.vehicleNo}</span>
                        <span className="text-[10px] text-muted-foreground block">{st.routeName}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">
                          <MapPin className="w-3 h-3 text-emerald-500" />
                          {st.pickupStop}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        ৳ {st.monthlyFee}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleRemoveStudent(st.studentId)}
                          disabled={isPending}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                          title="পরিবহন থেকে অবমুক্ত করুন"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vehicle Add/Edit Modal */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl p-6 my-8">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {editingVehicle ? "যানবাহন ও রুট সম্পাদনা" : "নতুন যানবাহন ও রুট যুক্ত করুন"}
            </h2>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    যানবাহনের নাম / নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="যেমন: মাদরাসা ভ্যান-১ বা ঢাকা মেট্রো-১১-২২৩৩"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    গাড়ির ধরন *
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  >
                    <option value="VAN">ভ্যান (Van)</option>
                    <option value="MICROBUS">মাইক্রোবাস / হায়েস (Microbus)</option>
                    <option value="BUS">মিনিবাস (Bus)</option>
                    <option value="AUTO">ইজিবাইক / অটো (Auto)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  রুট নাম বা বিবরণ *
                </label>
                <input
                  type="text"
                  required
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="যেমন: উত্তরা - এয়ারপোর্ট - খিলক্ষেত রুট"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    ড্রাইভারের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="যেমন: আব্দুল কাদের"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    ড্রাইভারের মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    সহকারী / হেলপারের নাম (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    placeholder="যেমন: মো. হাসান"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    সহকারীর মোবাইল নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={assistantPhone}
                    onChange={(e) => setAssistantPhone(e.target.value)}
                    placeholder="018xxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    আসন সংখ্যা *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    ডিফল্ট মাসিক ফি (টাকা) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={defaultMonthlyFee}
                    onChange={(e) => setDefaultMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    value={isActive ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setIsActive(e.target.value === "ACTIVE")}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                  >
                    <option value="ACTIVE">সচল (Active)</option>
                    <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  স্টপেজ সমূহ (কমা দিয়ে আলাদা করুন)
                </label>
                <input
                  type="text"
                  value={stopsText}
                  onChange={(e) => setStopsText(e.target.value)}
                  placeholder="যেমন: রেল স্টেশন, ডাকবাংলো মোড়, বড় মসজিদ, ক্যাম্পাস গেট"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  প্রতিটি স্টপ লেখার পর কমা (,) দিন।
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50"
                >
                  {isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Student Modal */}
      {isAssignModalOpen && selectedVehicleForAssign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 my-8">
            <h2 className="text-lg font-bold text-foreground mb-1">
              শিক্ষার্থীকে পরিবহনে যুক্ত করুন
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              গাড়ি: <strong>{selectedVehicleForAssign.vehicleNo}</strong> ({selectedVehicleForAssign.capacity} আসনের মধ্যে{" "}
              {assignments.filter((a) => a.vehicleId === selectedVehicleForAssign.id).length} পূরণ)
            </p>

            <form onSubmit={handleAssignStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  শিক্ষার্থী নির্বাচন করুন *
                </label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                  className="w-full px-3 py-1.5 mb-2 rounded-lg border border-border bg-background text-foreground text-xs"
                />

                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs max-h-40"
                  size={5}
                >
                  {filteredAvailableStudents.length === 0 ? (
                    <option disabled value="">
                      কোনো শিক্ষার্থী পাওয়া যায়নি
                    </option>
                  ) : (
                    filteredAvailableStudents.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — রোল: {st.roll || "N/A"} ({st.class_name || st.classes?.name || "শ্রেণি নেই"})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  স্টপেজ নির্বাচন করুন *
                </label>
                {selectedVehicleForAssign.stops && selectedVehicleForAssign.stops.length > 0 ? (
                  <select
                    value={selectedStop}
                    onChange={(e) => setSelectedStop(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
                  >
                    {selectedVehicleForAssign.stops.map((stop: string, i: number) => (
                      <option key={i} value={stop}>
                        {stop}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={selectedStop}
                    onChange={(e) => setSelectedStop(e.target.value)}
                    placeholder="যেমন: স্টেশন মোড়"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
                  />
                )}
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  মাসিক পরিবহন ফি (টাকা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={customFee}
                  onChange={(e) => setCustomFee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  এটি শিক্ষার্থীর প্রোফাইলে <code>transport_fee</code> হিসেবে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedStudentId}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50"
                >
                  {isPending ? "যুক্ত হচ্ছে..." : "যুক্ত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
