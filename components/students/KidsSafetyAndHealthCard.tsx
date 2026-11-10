"use client";

import { useState, useTransition } from "react";
import {
  AuthorizedPickupPerson,
  KidsHealthProfile,
  StudentGatePassRecord,
  COMMON_FOOD_ALLERGIES,
  COMMON_CHILD_CONDITIONS,
} from "@/lib/child-safety-utils";
import {
  saveStudentHealthProfile,
  saveAuthorizedPickups,
  generateDailyGatePass,
} from "@/app/actions/child-safety";
import {
  ShieldCheck,
  AlertTriangle,
  Heart,
  PhoneCall,
  UserCheck,
  Plus,
  Trash2,
  QrCode,
  CheckCircle2,
  Edit2,
  X,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className: string;
  parentPhone?: string;
  bloodGroup?: string;
  initialPickups: AuthorizedPickupPerson[];
  initialHealth: KidsHealthProfile;
}

export default function KidsSafetyAndHealthCard({
  studentId,
  studentName,
  studentRoll,
  className,
  parentPhone,
  bloodGroup = "অজানা",
  initialPickups,
  initialHealth,
}: Props) {
  const [pickups, setPickups] = useState<AuthorizedPickupPerson[]>(initialPickups);
  const [health, setHealth] = useState<KidsHealthProfile>(initialHealth);
  const [activePass, setActivePass] = useState<StudentGatePassRecord | null>(null);

  // Modals
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [isGatePassModalOpen, setIsGatePassModalOpen] = useState(false);

  // Form states for Health modal
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(initialHealth.foodAllergies || []);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(initialHealth.chronicConditions || []);
  const [medications, setMedications] = useState(initialHealth.regularMedications || "");
  const [doctorPhone, setDoctorPhone] = useState(initialHealth.emergencyDoctorPhone || "");

  // Form state for Pickup modal
  const [pName, setPName] = useState("");
  const [pRelation, setPRelation] = useState("মাতা");
  const [pPhone, setPPhone] = useState("");
  const [pNid, setPNid] = useState("");

  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");

  // Primary Emergency Phone
  const primaryPhone =
    pickups.find((p) => p.isPrimaryEmergency)?.phone ||
    parentPhone ||
    pickups[0]?.phone ||
    "";

  const handleSaveHealth = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const updated: KidsHealthProfile = {
        ...health,
        bloodGroup,
        foodAllergies: selectedAllergies,
        chronicConditions: selectedConditions,
        regularMedications: medications,
        emergencyDoctorPhone: doctorPhone,
      };
      const res = await saveStudentHealthProfile(studentId, updated);
      if (res.success && res.data) {
        setHealth(res.data);
        setIsHealthModalOpen(false);
        showSuccess("স্বাস্থ্য ও অ্যালার্জি প্রোফাইল সংরক্ষিত হয়েছে!");
      }
    });
  };

  const handleAddPickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pPhone.trim()) return;

    const newPerson: AuthorizedPickupPerson = {
      id: `pup-${Date.now()}`,
      name: pName.trim(),
      relation: pRelation,
      phone: pPhone.trim(),
      nidOrId: pNid.trim() || undefined,
      isPrimaryEmergency: pickups.length === 0,
    };

    const updated = [...pickups, newPerson];
    startTransition(async () => {
      const res = await saveAuthorizedPickups(studentId, updated);
      if (res.success) {
        setPickups(updated);
        setIsPickupModalOpen(false);
        setPName("");
        setPPhone("");
        setPNid("");
        showSuccess("অনুমোদিত পিক-আপকারী যুক্ত করা হয়েছে!");
      }
    });
  };

  const handleRemovePickup = (id: string) => {
    if (!confirm("আপনি কি এই অনুমোদিত ব্যক্তিকে তালিকা থেকে বাদ দিতে চান?")) return;
    const updated = pickups.filter((p) => p.id !== id);
    startTransition(async () => {
      const res = await saveAuthorizedPickups(studentId, updated);
      if (res.success) {
        setPickups(updated);
        showSuccess("তালিকা আপডেট করা হয়েছে!");
      }
    });
  };

  const handleGenerateGatePass = (person: AuthorizedPickupPerson) => {
    startTransition(async () => {
      const res = await generateDailyGatePass({
        studentId,
        studentName,
        studentRoll,
        className,
        pickupPerson: {
          name: person.name,
          relation: person.relation,
          phone: person.phone,
        },
      });

      if (res.success && res.data) {
        setActivePass(res.data);
        setIsGatePassModalOpen(true);
      }
    });
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(false as any), 3000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Health & Allergy Safety Card */}
      <div className="bg-white rounded-2xl border border-rose-200 shadow-xs p-5 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">জরুরি স্বাস্থ্য ও অ্যালার্জি কার্ড</h3>
              <p className="text-[11px] text-slate-500">জরুরি অবস্থা ও শিশু সুরক্ষা তথ্য</p>
            </div>
          </div>
          <button
            onClick={() => setIsHealthModalOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="সম্পাদনা করুন"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Blood Group & Emergency Call */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">রক্তের গ্রুপ:</span>
            <span className="text-sm font-black text-rose-700 bg-white px-2.5 py-0.5 rounded-md border border-rose-200">
              {bloodGroup}
            </span>
          </div>

          {primaryPhone ? (
            <a
              href={`tel:${primaryPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>জরুরি কল: {primaryPhone}</span>
            </a>
          ) : (
            <span className="text-xs text-slate-400">জরুরি ফোন যুক্ত নেই</span>
          )}
        </div>

        {/* Food Allergies */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>খাবারের অ্যালার্জি:</span>
          </span>
          {health.foodAllergies && health.foodAllergies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {health.foodAllergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold"
                >
                  ⚠️ {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">কোনো ক্ষতিকর অ্যালার্জি রেকর্ড নেই (আলহামদুলিল্লাহ)</p>
          )}
        </div>

        {/* Chronic Conditions & Medications */}
        {(health.chronicConditions?.length > 0 || health.regularMedications) && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            {health.chronicConditions?.length > 0 && (
              <div className="text-xs">
                <span className="font-bold text-slate-600">বিশেষ সতর্কতা: </span>
                <span className="text-slate-800 font-semibold">{health.chronicConditions.join(", ")}</span>
              </div>
            )}
            {health.regularMedications && (
              <div className="text-xs">
                <span className="font-bold text-slate-600">নিয়মিত ওষুধ: </span>
                <span className="text-emerald-700 font-semibold">{health.regularMedications}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Authorized Pick-up & Gate Pass Card */}
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-5 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">অনুমোদিত পিক-আপ ও গেট পাস</h3>
              <p className="text-[11px] text-slate-500">ছুটির পর বাচ্চাকে নিরাপদে হস্তান্তরের তালিকা</p>
            </div>
          </div>
          <button
            onClick={() => setIsPickupModalOpen(true)}
            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন যোগ</span>
          </button>
        </div>

        {/* Authorized Persons List */}
        <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
          {pickups.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
              এখনো কোনো নির্দিষ্ট পিক-আপকারী যুক্ত করা হয়নি। 'নতুন যোগ' বাটনে ক্লিক করে যুক্ত করুন।
            </div>
          ) : (
            pickups.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 transition bg-slate-50/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 truncate">{person.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                      {person.relation}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{person.phone}</p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleGenerateGatePass(person)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="আজকের জন্য ডিজিটাল গেট পাস তৈরি করুন"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>গেট পাস</span>
                  </button>
                  <button
                    onClick={() => handleRemovePickup(person.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {successMsg && (
          <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold text-center animate-in fade-in">
            ✓ {successMsg}
          </div>
        )}
      </div>

      {/* MODAL 1: Edit Health & Allergy Profile */}
      {isHealthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">স্বাস্থ্য ও অ্যালার্জি প্রোফাইল সম্পাদনা</h3>
              <button onClick={() => setIsHealthModalOpen(false)}>
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveHealth} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">খাবারের অ্যালার্জি (টিক দিন):</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {COMMON_FOOD_ALLERGIES.map((allergy, i) => {
                    const isChecked = selectedAllergies.includes(allergy);
                    return (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAllergies([...selectedAllergies, allergy]);
                            else setSelectedAllergies(selectedAllergies.filter((a) => a !== allergy));
                          }}
                          className="rounded text-rose-600"
                        />
                        <span className="text-slate-800">{allergy}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">বিশেষ শারীরিক সমস্যা / সতর্কতা:</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {COMMON_CHILD_CONDITIONS.map((cond, i) => {
                    const isChecked = selectedConditions.includes(cond);
                    return (
                      <label key={i} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedConditions([...selectedConditions, cond]);
                            else setSelectedConditions(selectedConditions.filter((c) => c !== cond));
                          }}
                          className="rounded text-rose-600"
                        />
                        <span className="text-slate-800">{cond}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">নিয়মিত ওষুধ / ড্রপ / ইনহেলার:</label>
                <input
                  type="text"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder="যেমন: অ্যাজমা ইনহেলার সাথে থাকে..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsHealthModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
                >
                  {isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Authorized Pickup Person */}
      {isPickupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">অনুমোদিত পিক-আপকারী যুক্ত করুন</h3>
              <button onClick={() => setIsPickupModalOpen(false)}>
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleAddPickup} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">পূর্ণ নাম:</label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="যেমন: মোছাঃ সালমা খাতুন"
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">সম্পর্ক:</label>
                  <select
                    value={pRelation}
                    onChange={(e) => setPRelation(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs"
                  >
                    <option value="মাতা">মাতা</option>
                    <option value="পিতা">পিতা</option>
                    <option value="মামা">মামা</option>
                    <option value="চাচা">চাচা</option>
                    <option value="খালা">খালা</option>
                    <option value="ফুফু">ফুফু</option>
                    <option value="ড্রাইভার">ড্রাইভার</option>
                    <option value="গৃহকর্মী">গৃহকর্মী</option>
                    <option value="অন্যান্য">অন্যান্য অভিভাবক</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">মোবাইল নম্বর:</label>
                  <input
                    type="tel"
                    required
                    value={pPhone}
                    onChange={(e) => setPPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">জাতীয় পরিচয়পত্র বা আইডি নং (ঐচ্ছিক):</label>
                <input
                  type="text"
                  value={pNid}
                  onChange={(e) => setPNid(e.target.value)}
                  placeholder="NID নম্বর..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsPickupModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
                >
                  {isPending ? "যুক্ত হচ্ছে..." : "যুক্ত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Daily Digital Gate Pass Modal */}
      {isGatePassModalOpen && activePass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden text-center animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 space-y-1">
              <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-3 py-0.5 rounded-full inline-block">
                আজকের ডিজিটাল গেট পাস
              </span>
              <h2 className="text-xl font-black">{activePass.studentName}</h2>
              <p className="text-xs text-emerald-100">
                জামাত: {activePass.className} | রোল: {toBanglaNumber(activePass.studentRoll || "-")}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs text-slate-500 font-medium">নিরাপত্তা কোড (Security Code):</span>
                <div className="text-3xl font-black font-mono text-emerald-700 tracking-wider">
                  {activePass.passCode}
                </div>
                <p className="text-[11px] text-slate-400">ছুটির সময় মাদ্রাসার মূল ফটকে দায়িত্বরত শিক্ষককে এই কোডটি দেখান</p>
              </div>

              <div className="text-left text-xs space-y-1 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">অনুমোদিত ব্যক্তি:</span>
                  <span className="font-bold text-slate-800">{activePass.pickupPersonName} ({activePass.pickupPersonRelation})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ফোন নম্বর:</span>
                  <span className="font-bold text-slate-800 font-mono">{activePass.pickupPersonPhone}</span>
                </div>
              </div>

              <button
                onClick={() => setIsGatePassModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                পাস বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
