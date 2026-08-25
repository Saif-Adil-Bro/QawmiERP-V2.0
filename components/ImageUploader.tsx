"use client";

import { useState, useRef, DragEvent } from "react";
import { uploadImageAuto } from "@/lib/uploadHelper";
import { 
  Upload, Loader2, CheckCircle, Copy, Check, X, 
  FileImage, Globe, AlertCircle 
} from "lucide-react";

interface ImageUploaderProps {
  name: string;
  label?: string;
  subLabel?: string;
  defaultValue?: string;
  type?: "logo" | "signature" | "general";
  accept?: string;
  required?: boolean;
  aspectRatio?: "square" | "portrait" | "landscape" | "auto";
  placeholder?: string;
}

export default function ImageUploader({
  name,
  label = "ছবি আপলোড",
  subLabel = "PNG, JPG, JPEG বা WebP ফাইল নির্বাচন করুন",
  defaultValue = "",
  type = "general",
  accept = "image/png, image/jpeg, image/jpg, image/webp",
  required = false,
  aspectRatio = "portrait",
  placeholder = "https://iili.io/... অথবা https://files.catbox.moe/..."
}: ImageUploaderProps) {
  const [method, setMethod] = useState<"file" | "url">("file");
  const [url, setUrl] = useState<string>(defaultValue || "");
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [provider, setProvider] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("অনুগ্রহ করে শুধুমাত্র একটি ইমেজ ফাইল নির্বাচন করুন।");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("ফাইলের সাইজ ৫ মেগাবাইটের কম হতে হবে।");
      return;
    }

    setError("");
    
    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Automatic cloud upload to iili.io / Catbox
    setUploading(true);
    try {
      const res = await uploadImageAuto(file, type);
      if (res.success && res.url) {
        setUrl(res.url);
        setPreview(res.url);
        setProvider(res.provider || "iili.io");
      } else {
        setError(res.error || "ক্লাউডে আপলোড করতে সমস্যা হয়েছে।");
      }
    } catch (err: any) {
      setError(err?.message || "আপলোড এরর হয়েছে।");
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setUrl("");
    setPreview(null);
    setProvider("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyUrl = () => {
    if (url && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hidden input to pass the final URL in standard form submissions */}
      <input type="hidden" name={name} value={url} required={required && !url} />

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </label>

        {/* Tab switch between File and Direct URL */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setMethod("file")}
            className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
              method === "file"
                ? "bg-white text-slate-800 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>ফাইল আপলোড</span>
          </button>
          <button
            type="button"
            onClick={() => setMethod("url")}
            className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
              method === "url"
                ? "bg-white text-slate-800 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>সরাসরি লিংক</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {method === "file" ? (
        <div className="space-y-2">
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition relative group bg-white ${
              dragActive
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center">
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-2">
                  <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mb-2" />
                  <p className="text-xs font-bold text-emerald-700 animate-pulse">
                    স্বয়ংক্রিয়ভাবে iili.io / Catbox ক্লাউডে আপলোড হচ্ছে...
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    আপলোড সম্পন্ন হলে সরাসরি ক্লাউড লিংক যুক্ত ও সেভ হবে
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-2 bg-slate-100 rounded-full border border-slate-200 mb-1.5 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
                    <Upload className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    ডিভাইস থেকে ফাইল নির্বাচন করতে ক্লিক করুন অথবা ড্র্যাগ করুন
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {subLabel}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Direct URL Input */
        <div className="space-y-1">
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={url}
              onChange={(e) => {
                const val = e.target.value;
                setUrl(val);
                setPreview(val.trim() ? val.trim() : null);
              }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-xs transition"
              placeholder={placeholder}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Catbox, iili.io, ImgBB বা যেকোনো সরাসরি পাবলিক ইমেজ লিংক পেস্ট করুন
          </p>
        </div>
      )}

      {/* Preview & Live Status Bar */}
      {preview && (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3 overflow-hidden mr-2">
            <div className={`relative bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-xs flex items-center justify-center ${
              aspectRatio === "portrait" ? "w-12 h-14" : aspectRatio === "landscape" ? "w-20 h-12" : "w-12 h-12"
            }`}>
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback on broken image
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {provider ? `${provider} ক্লাউডে আপলোড সম্পন্ন` : "ছবি সফলভাবে যুক্ত হয়েছে"}
                </span>
              </div>
              {url && (
                <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px] sm:max-w-[320px]">
                  {url}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {url && (
              <button
                type="button"
                onClick={copyUrl}
                title="লিংক কপি করুন"
                className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition text-xs flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] text-emerald-600 font-medium hidden sm:inline">কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px] hidden sm:inline">কপি</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={clearImage}
              title="মুছে ফেলুন"
              className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
