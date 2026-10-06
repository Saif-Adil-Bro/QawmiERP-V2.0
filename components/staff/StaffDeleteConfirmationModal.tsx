"use client";

import React, { useState } from "react";
import { StaffMember, isTeachingStaff } from "@/lib/staff-management";
import { deleteStaffMember } from "@/app/actions/staff";
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert, UserX } from "lucide-react";

interface StaffDeleteConfirmationModalProps {
  staff: StaffMember | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function StaffDeleteConfirmationModal({
  staff,
  isOpen,
  onClose,
  onDeleted,
}: StaffDeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staff) return null;

  const staffName = staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name || ""}`.trim();
  const designation = staff.employment.designation || "স্টাফ";
  const isTeacher = isTeachingStaff(staff);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await deleteStaffMember(staff.id);
      if (res.error) {
        setError(res.error);
        setIsDeleting(false);
      } else {
        setIsDeleting(false);
        onDeleted();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "মুছে ফেলতে সমস্যা হয়েছে।");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-rose-100 overflow-hidden space-y-0">
        {/* Warning Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3.5">
          <div className="p-2.5 bg-rose-600 text-white rounded-2xl shrink-0 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-rose-950 flex items-center gap-1.5">
              <span>স্থায়ী অপসারণ নিশ্চিতকরণ</span>
            </h3>
            <p className="text-xs text-rose-700 mt-0.5 font-medium">
              সতর্কতা: এই পদক্ষেপটি অপরিবর্তনীয়
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-rose-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Staff Card Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center text-slate-700 font-bold shrink-0 border border-slate-300">
              {staff.personal.photo_url ? (
                <img
                  src={staff.personal.photo_url}
                  alt={staffName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserX className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">{staffName}</h4>
              <p className="text-xs text-emerald-800 font-semibold truncate">{designation}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                <span>আইডি: {staff.staff_id_code}</span>
                {staff.contact.phone && <span>• {staff.contact.phone}</span>}
              </div>
            </div>
          </div>

          {/* Warning Points */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5">
            <p className="font-bold text-amber-950 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>মুছে ফেলার পর যা ঘটবে:</span>
            </p>
            <ul className="space-y-1 list-disc list-inside text-amber-900 text-[11.5px]">
              <li>এই {isTeacher ? "শিক্ষকের" : "স্টাফের"} সার্ভিস বুক ও প্রোফাইল স্থায়ীভাবে মুছে যাবে।</li>
              {isTeacher && <li>সংশ্লিষ্ট জামাত ও কিতাব/বিষয় বণ্টন স্বয়ংক্রিয়ভাবে অবমুক্ত হবে।</li>}
              <li>তার যাবতীয় পূর্বের ছুটির আবেদন ও রেকর্ড ডিলিট হবে।</li>
            </ul>
          </div>

          <p className="text-xs text-slate-500 text-center">
            আপনি কি নিশ্চিতভাবে এই {isTeacher ? "শিক্ষককে" : "স্টাফ সদস্যকে"} সিস্টেম থেকে ডিলিট করতে চান?
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition cursor-pointer"
          >
            না, বাতিল করুন
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-950/20 transition cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>ডিলিট হচ্ছে...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>হ্যাঁ, নিশ্চিত ডিলিট করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
