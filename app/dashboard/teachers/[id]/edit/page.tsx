"use client";

import { useActionState, useEffect, useState } from "react";
import { getTeacher, updateTeacher, deleteTeacher } from "@/app/actions/teachers";
import Link from "next/link";
import { ArrowLeft, Trash2, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";

const initialState: { error?: string; success?: boolean } = {};

export default function EditTeacherPage() {
  const [state, formAction, isPending] = useActionState(updateTeacher, initialState);
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeacher() {
      if (id) {
        const data = await getTeacher(id);
        setTeacher(data);
        if (data?.photo_url) {
          setPhotoUrl(data.photo_url);
        }
        setLoading(false);
      }
    }
    fetchTeacher();
  }, [id]);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/staff");
    }
  }, [state, router]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteTeacher(id);
      if (res.error) {
        setDeleteError(res.error);
        setIsDeleting(false);
      } else {
        router.push("/dashboard/staff");
      }
    } catch (err: any) {
      setDeleteError(err.message || "মুছে ফেলতে সমস্যা হয়েছে।");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">শিক্ষক/স্টাফের তথ্য লোড হচ্ছে...</div>;
  }

  if (!teacher) {
    return <div className="p-8 text-center text-red-500">শিক্ষক/স্টাফ পাওয়া যায়নি।</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/staff"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">শিক্ষক/স্টাফ সম্পাদনা করুন</h1>
            <p className="text-slate-500">
              {teacher.first_name} {teacher.last_name} এর তথ্য আপডেট করুন
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-200"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>মুছে ফেলুন</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="id" value={teacher.id} />
          
          {state?.error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {state.error}
            </div>
          )}

          <div>
            <ImageUploader
              name="photo_url"
              label="প্রোফাইল ছবি"
              subLabel="গ্যালারি বা ফাইল থেকে ছবি সিলেক্ট করুন (সরাসরি iili.io / ImgBB তে ক্লাউড আপলোড হবে)"
              value={photoUrl}
              defaultValue={teacher.photo_url || ""}
              onChange={setPhotoUrl}
              aspectRatio="portrait"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-sm font-medium text-slate-700">প্রথম নাম <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                defaultValue={teacher.first_name}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="last_name" className="text-sm font-medium text-slate-700">শেষ নাম <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                defaultValue={teacher.last_name}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">ফোন নম্বর</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                defaultValue={teacher.phone || ""}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">ইমেইল</label>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={teacher.email || ""}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="designation" className="text-sm font-medium text-slate-700">পদবী / দায়িত্ব</label>
              <input
                type="text"
                id="designation"
                name="designation"
                defaultValue={teacher.designation || ""}
                placeholder="যেমন: মুহতামিম, ওস্তাদ, স্টাফ"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t gap-3">
            <Link
              href="/dashboard/staff"
              className="px-4 py-2 border rounded-md text-slate-700 hover:bg-slate-50 transition"
            >
              বাতিল
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isPending ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-rose-100 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3.5">
              <div className="p-2.5 bg-rose-600 text-white rounded-2xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-950">স্থায়ী অপসারণ নিশ্চিতকরণ</h3>
                <p className="text-xs text-rose-700 mt-0.5 font-medium">
                  সতর্কতা: এই পদক্ষেপটি অপরিবর্তনীয়
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-sm text-slate-700">
                আপনি কি নিশ্চিতভাবে <span className="font-bold text-slate-900">{teacher.first_name} {teacher.last_name}</span> কে সিস্টেম থেকে স্থায়ীভাবে মুছে ফেলতে চান?
              </p>

              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  মুছে ফেলার পর:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11.5px]">
                  <li>শিক্ষকের সকল সার্ভিস বুক ও প্রোফাইল ডাটাবেজ থেকে মুছে যাবে।</li>
                  <li>কিতাব বা ক্লাস বণ্টনের দায়িত্ব স্বয়ংক্রিয়ভাবে অবমুক্ত হবে।</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200"
              >
                না, বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
      )}
    </div>
  );
}
