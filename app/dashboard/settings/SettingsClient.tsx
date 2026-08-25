"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { updateMadrasaDetails } from "@/app/actions/tenant";
import { Building2, MapPin, Phone, Upload, Loader2, CheckCircle, AlertTriangle, Globe, FileImage } from "lucide-react";
import Image from "next/image";

interface Madrasa {
  id: string;
  name: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
}

export default function SettingsClient({
  madrasa,
  initialLogoUrl
}: {
  madrasa: Madrasa;
  initialLogoUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  // States for live preview and tracking
  const [name, setName] = useState(madrasa.name);
  const [address, setAddress] = useState(madrasa.address || "");
  const [phone, setPhone] = useState(madrasa.contact_phone || "");
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // New logo selection method states
  const [logoMethod, setLogoMethod] = useState<"file" | "url">("file");
  const [logoUrl, setLogoUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getGoogleDriveDirectLink = (url: string): string => {
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  };

  const handleLogoUrlChange = (val: string) => {
    setLogoUrl(val);
    if (val.trim()) {
      let previewUrl = val.trim();
      if (previewUrl.includes("drive.google.com")) {
        previewUrl = getGoogleDriveDirectLink(previewUrl);
      }
      setLogoPreview(previewUrl);
    } else {
      setLogoPreview(initialLogoUrl || null);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setError("অনুগ্রহ করে একটি ছবি ফাইল (.png, .jpg, .jpeg) নির্বাচন করুন।");
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("address", address);
      formData.append("phone", phone);
      
      if (logoMethod === "file" && selectedFile) {
        formData.append("logo", selectedFile);
      } else if (logoMethod === "url" && logoUrl.trim()) {
        formData.append("logoUrl", logoUrl.trim());
      }

      const response = await updateMadrasaDetails(formData);

      if (response.error) {
        setError(response.error);
      } else if (response.success) {
        setMessage(response.message || "মাদরাসার তথ্য সফলভাবে আপডেট করা হয়েছে।");
        // Clear inputs after success
        setSelectedFile(null);
        setLogoUrl("");
        // Trigger a force reload or cache-bust for logo preview in browser if needed
        if (logoPreview && logoPreview.startsWith("data:")) {
          // It was a dataURL, we let it stay as preview
        } else {
          setLogoPreview(`${initialLogoUrl}?t=${Date.now()}`);
        }
      }
    } catch (err: any) {
      setError(err?.message || "একটি আকস্মিক সমস্যা দেখা দিয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">মাদরাসা সেটিংস (Settings)</h1>
        <p className="text-slate-500 text-sm mt-1">মাদরাসার নাম, ঠিকানা, লোগো এবং অফিসিয়াল তথ্য পরিবর্তন ও আপডেট করুন</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Live Preview / Card info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">রিয়েল-টাইম প্রিভিউ</h3>
            
            <div className="relative w-28 h-28 bg-slate-50 rounded-full border border-slate-200/80 flex items-center justify-center overflow-hidden mb-4 group shadow-inner">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Madrasa Logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Building2 className="w-12 h-12 text-slate-300" />
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-800 line-clamp-2 px-2">
              {name || "মাদরাসার নাম"}
            </h2>
            
            <div className="w-full border-t border-slate-100 my-4"></div>

            <div className="w-full space-y-3 text-left text-sm text-slate-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{address || "ঠিকানা যুক্ত করা হয়নি"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{phone || "মোবাইল নম্বর যুক্ত করা হয়নি"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-400 font-mono">আইডি:</span>
                <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]">{madrasa.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-100 shadow-sm">
            {message && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}
            
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Madrasa Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  মাদরাসার নাম <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition"
                    placeholder="উদা: জামিয়া ইসলামিয়া দারুল উলুম"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">ঠিকানা</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 text-slate-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition resize-none"
                    placeholder="উদা: বাড়ি নং- ৪২, রোড নং- ০৫, ব্লক- সি, ঢাকা"
                  />
                </div>
              </div>

              {/* Mobile / Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">মোবাইল নম্বর</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition"
                    placeholder="উদা: 017XXXXXXXX"
                  />
                </div>
              </div>

              {/* Logo Selection Method and Input */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">মাদরাসার লোগো</label>
                
                {/* Method selector tabs */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg max-w-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setLogoMethod("file");
                      if (selectedFile) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setLogoPreview(reader.result as string);
                        };
                        reader.readAsDataURL(selectedFile);
                      } else {
                        setLogoPreview(initialLogoUrl || null);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
                      logoMethod === "file"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    ফাইল আপলোড
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoMethod("url");
                      handleLogoUrlChange(logoUrl);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
                      logoMethod === "url"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    CDN/ড্রাইভ লিংক
                  </button>
                </div>

                {logoMethod === "file" ? (
                  /* Logo Upload Box (Drag and Drop) */
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={handleUploadClick}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition relative group ${
                      dragActive
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-3 bg-slate-50 rounded-full border border-slate-100 mb-3 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        লোগো আপলোড করতে ক্লিক করুন অথবা ড্র্যাগ করুন
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PNG, JPG, JPEG, বা SVG ফাইল (সর্বোচ্চ ২ মেগাবাইট)
                      </p>
                    </div>

                    {selectedFile && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                        সিলেক্টেড: {selectedFile.name}
                      </div>
                    )}
                  </div>
                ) : (
                  /* URL Input Box */
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => handleLogoUrlChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition"
                        placeholder="উদা: https://example.com/logo.png অথবা গুগল ড্রাইভ লিংক"
                      />
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">
                      গুগল ড্রাইভ (Google Drive) বা যেকোনো সিডিএন (CDN) ইমেজ লিংক দিন। লিংকটি সরাসরি বা সবার জন্য উন্মুক্ত (Public sharing link) হতে হবে।
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      আপডেট হচ্ছে...
                    </>
                  ) : (
                    "সেটিংস সংরক্ষণ করুন"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
