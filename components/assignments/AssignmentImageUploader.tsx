"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  CheckCircle2,
  X,
  FileImage,
  Plus,
  ExternalLink,
  Camera,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import { uploadImageAuto } from "@/lib/uploadHelper";

interface AssignmentImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function AssignmentImageUploader({
  images,
  onChange,
  maxImages = 5,
}: AssignmentImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (images.length >= maxImages) {
      setUploadError(`সর্বোচ্চ ${maxImages} টি ছবি যোগ করা যাবে।`);
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const res = await uploadImageAuto(file, "general");
      if (res && res.success && res.url) {
        onChange([...images, res.url]);
      } else {
        setUploadError(res.error || "ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন বা লিংক পেস্ট করুন।");
      }
    } catch (err: any) {
      setUploadError(err.message || "ছবি আপলোডে নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    if (images.length >= maxImages) {
      setUploadError(`সর্বোচ্চ ${maxImages} টি ছবি যোগ করা যাবে।`);
      return;
    }

    onChange([...images, urlInput.trim()]);
    setUrlInput("");
    setShowUrlInput(false);
    setUploadError("");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          বইয়ের পৃষ্ঠা বা লেখার ছবি সংযুক্তি (iili.io / imgbb ক্লাউড)
        </label>
        <span className="text-[11px] text-slate-400 font-medium">
          {images.length}/{maxImages} টি যুক্ত
        </span>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Upload action triggers */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading || images.length >= maxImages}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <Upload className="w-4 h-4 text-emerald-600" />
          )}
          <span>{uploading ? "iili.io তে আপলোড হচ্ছে..." : "গ্যালারি/ফাইল থেকে ছবি"}</span>
        </button>

        <button
          type="button"
          disabled={uploading || images.length >= maxImages}
          onClick={() => cameraInputRef.current?.click()}
          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Camera className="w-4 h-4 text-blue-600" />
          <span>ক্যামেরা দিয়ে তুলুন</span>
        </button>

        <button
          type="button"
          disabled={uploading || images.length >= maxImages}
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <LinkIcon className="w-4 h-4 text-slate-600" />
          <span>ইমেজ লিংক পেস্ট করুন</span>
        </button>
      </div>

      {/* Manual URL input drawer */}
      {showUrlInput && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 animate-in fade-in">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="উদা: https://iili.io/abc.jpg অথবা https://i.ibb.co/xyz.jpg"
            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
          >
            যোগ করুন
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(false)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{uploadError}</span>
        </p>
      )}

      {/* Thumbnails grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {images.map((imgUrl, index) => (
            <div
              key={index}
              className="relative group bg-slate-100 border border-slate-200 rounded-xl overflow-hidden aspect-4/3 shadow-2xs"
            >
              <img
                src={imgUrl}
                alt={`পড়ার ছবি ${index + 1}`}
                className="w-full h-full object-cover cursor-pointer transition group-hover:scale-105"
                onClick={() => setPreviewImage(imgUrl)}
              />

              {/* Action buttons overlay */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewImage(imgUrl)}
                  className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-md transition"
                  title="বড় করে দেখুন"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition"
                  title="মুছে ফেলুন"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                পৃষ্ঠা {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Large Image Lightbox / Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 text-white text-xs border-b border-slate-800">
              <span className="font-semibold">বইয়ের পৃষ্ঠা / অ্যাসাইনমেন্ট ছবি প্রিভিউ</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>আসল ছবি খুলুন</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[80vh] p-2 flex items-center justify-center">
              <img
                src={previewImage}
                alt="বড় প্রিভিউ"
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
