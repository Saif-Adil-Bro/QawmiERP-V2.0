"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Users,
  Edit,
  Trash2,
  CheckCircle2,
  ExternalLink,
  FileImage,
  MoreVertical,
  Maximize2,
  X,
} from "lucide-react";
import {
  AssignmentItem,
  ASSIGNMENT_TYPE_MAP,
} from "@/lib/assignmentTypes";
import {
  deleteAssignment,
  updateAssignmentStatus,
} from "@/app/actions/assignments";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface AssignmentCardProps {
  assignment: AssignmentItem;
  onEdit?: (item: AssignmentItem) => void;
  onRefresh?: () => void;
  canManage?: boolean; // If admin or teacher
}

export default function AssignmentCard({
  assignment,
  onEdit,
  onRefresh,
  canManage = true,
}: AssignmentCardProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${assignment.title}" মুছে ফেলতে চান?`)) return;

    try {
      setDeleting(true);
      const res = await deleteAssignment(assignment.id);
      if (res && res.success) {
        onRefresh?.();
      } else {
        alert(res?.error || "ডিলিট ব্যর্থ হয়েছে।");
      }
    } catch {
      alert("ডিলিট করতে সমস্যা হয়েছে।");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = assignment.status === "ACTIVE" ? "COMPLETED" : "ACTIVE";
    try {
      await updateAssignmentStatus(assignment.id, nextStatus);
      onRefresh?.();
    } catch {
      // ignore
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "TODAY_LESSON":
        return "bg-emerald-100 text-emerald-900 border-emerald-200";
      case "TOMORROW_LESSON":
        return "bg-blue-100 text-blue-900 border-blue-200";
      case "HOMEWORK":
        return "bg-amber-100 text-amber-900 border-amber-200";
      case "MEMORIZATION":
        return "bg-purple-100 text-purple-900 border-purple-200";
      case "EXAM_REVISION":
        return "bg-rose-100 text-rose-900 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between gap-3 ${
        assignment.status === "COMPLETED"
          ? "border-emerald-200/80 bg-emerald-50/20"
          : "border-slate-200"
      }`}
    >
      <div className="space-y-3">
        {/* Top Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getTypeStyle(
                assignment.type
              )}`}
            >
              {assignment.type_bangla || ASSIGNMENT_TYPE_MAP[assignment.type]}
            </span>

            {assignment.subject_name && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {assignment.subject_name}
              </span>
            )}

            {assignment.status === "COMPLETED" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                সম্পন্ন
              </span>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-1 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => onEdit?.(assignment)}
                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                title="সম্পাদনা করুন"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                title="মুছে ফেলুন"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 leading-snug">
          {assignment.title}
        </h3>

        {/* Target Jamat / Student */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>জামাত: {assignment.class_name}</span>
          </div>

          {assignment.target_type === "STUDENT" ? (
            <div className="flex items-center gap-1 font-semibold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">
              <User className="w-3.5 h-3.5 text-amber-700" />
              <span>
                নির্দিষ্ট ছাত্র: {assignment.student_name}{" "}
                {assignment.student_roll ? `(রোল: ${toBanglaNumber(assignment.student_roll)})` : ""}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">(সকল ছাত্রের জন্য)</span>
          )}
        </div>

        {/* Description Body */}
        <div className="p-3 bg-slate-50/80 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line border border-slate-100">
          {assignment.description}
        </div>

        {/* Image Attachments Gallery (iili.io / imgbb) */}
        {assignment.image_urls && assignment.image_urls.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <FileImage className="w-3.5 h-3.5 text-emerald-600" />
              <span>বইয়ের পৃষ্ঠার ছবি ({toBanglaNumber(assignment.image_urls.length)} টি):</span>
            </span>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {assignment.image_urls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxImage(url)}
                  className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition"
                >
                  <img
                    src={url}
                    alt={`পৃষ্ঠা ${idx + 1}`}
                    className="w-full h-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 py-0.2 rounded">
                    পৃষ্ঠা {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info & Status Toggle */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>দেওয়া হয়েছে: <strong className="text-slate-700">{assignment.assigned_date}</strong></span>
          </div>

          {assignment.due_date && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>পড়া ধরা হবে: <strong className="text-amber-800">{assignment.due_date}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            শিক্ষক: <strong className="text-slate-700">{assignment.teacher_name}</strong>
          </span>

          {canManage && (
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 print:hidden cursor-pointer ${
                assignment.status === "COMPLETED"
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{assignment.status === "COMPLETED" ? "পুনরায় সক্রিয়" : "পড়া সম্পন্ন"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Full Size Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 text-white text-xs border-b border-slate-800">
              <span className="font-semibold">{assignment.title} - বইয়ের পৃষ্ঠা</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>আসল ছবি খুলুন</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[80vh] p-2 flex items-center justify-center">
              <img
                src={lightboxImage}
                alt="বড় পৃষ্ঠা প্রিভিউ"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
