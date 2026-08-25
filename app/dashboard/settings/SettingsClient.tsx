"use client";

import { useState, useRef, DragEvent } from "react";
import { updateMadrasaDetails } from "@/app/actions/tenant";
import { uploadImageAuto } from "@/lib/uploadHelper";
import { 
  Building2, MapPin, Phone, Mail, Upload, Loader2, CheckCircle, 
  AlertTriangle, Globe, FileImage, PenTool, Hash, Calendar, 
  Sparkles, HelpCircle, ExternalLink, X, ShieldCheck,
  Copy, Check, Info
} from "lucide-react";

interface Madrasa {
  id: string;
  name: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  registration_no?: string;
  reg_no?: string;
  established_year?: string;
  principal_name?: string;
  principal_signature_url?: string;
  signature_url?: string;
  eiin_code?: string;
  slogan?: string;
  website?: string;
  logo_url?: string;
}

export default function SettingsClient({
  madrasa,
  initialLogoUrl,
  initialSignatureUrl,
}: {
  madrasa: Madrasa;
  initialLogoUrl: string;
  initialSignatureUrl?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showApiGuide, setShowApiGuide] = useState(false);

  // Form Fields
  const [name, setName] = useState(madrasa.name || "");
  const [establishedYear, setEstablishedYear] = useState(madrasa.established_year || "");
  const [principalName, setPrincipalName] = useState(madrasa.principal_name || "");
  const [registrationNo, setRegistrationNo] = useState(madrasa.registration_no || madrasa.reg_no || "");
  const [eiinCode, setEiinCode] = useState(madrasa.eiin_code || "");
  const [slogan, setSlogan] = useState(madrasa.slogan || "");
  const [address, setAddress] = useState(madrasa.address || "");
  const [phone, setPhone] = useState(madrasa.contact_phone || "");
  const [email, setEmail] = useState(madrasa.contact_email || "");
  const [website, setWebsite] = useState(madrasa.website || "");

  // Logo States
  const [logoMethod, setLogoMethod] = useState<"file" | "url">("file");
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl || null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl && initialLogoUrl.startsWith("http") ? initialLogoUrl : "");
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoProvider, setLogoProvider] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Signature States
  const [sigMethod, setSigMethod] = useState<"file" | "url">("file");
  const [signaturePreview, setSignaturePreview] = useState<string | null>(initialSignatureUrl || null);
  const [selectedSigFile, setSelectedSigFile] = useState<File | null>(null);
  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl && initialSignatureUrl.startsWith("http") ? initialSignatureUrl : "");
  const [sigDragActive, setSigDragActive] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [sigProvider, setSigProvider] = useState<string>("");
  const sigInputRef = useRef<HTMLInputElement>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Helper for Google Drive and direct links
  const normalizeImageUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    
    // Google Drive direct link converter
    if (trimmed.includes("drive.google.com")) {
      const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }
    return trimmed;
  };

  // Logo handlers
  const handleLogoUrlChange = (val: string) => {
    setLogoUrl(val);
    if (val.trim()) {
      setLogoPreview(normalizeImageUrl(val));
    } else {
      setLogoPreview(initialLogoUrl || null);
    }
  };

  const handleLogoDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setLogoDragActive(true);
    } else if (e.type === "dragleave") {
      setLogoDragActive(false);
    }
  };

  const processLogoFile = async (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Automatic cloud upload to iili.io / Catbox / Storage
      setUploadingLogo(true);
      setError("");
      try {
        const res = await uploadImageAuto(file, "logo");
        if (res.success && res.url) {
          setLogoUrl(res.url);
          setLogoPreview(res.url);
          setLogoProvider(res.provider || "iili.io");
          setMessage(`লোগোটি সফলভাবে ক্লাউডে (${res.provider === "catbox.moe" ? "Catbox" : res.provider === "iili.io" ? "iili.io" : "ক্লাউড সিডিএন"}) আপলোড হয়েছে এবং লিংক যোগ হয়েছে!`);
        } else {
          // If auto upload had an issue, fallback to normal form upload
          setLogoProvider("");
        }
      } catch (err: any) {
        console.warn("Auto logo upload err:", err);
      } finally {
        setUploadingLogo(false);
      }
    } else {
      setError("অনুগ্রহ করে একটি ছবি ফাইল (.png, .jpg, .jpeg, .svg) নির্বাচন করুন।");
    }
  };

  const handleLogoDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setLogoDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLogoFile(e.dataTransfer.files[0]);
    }
  };

  // Signature handlers
  const handleSignatureUrlChange = (val: string) => {
    setSignatureUrl(val);
    if (val.trim()) {
      setSignaturePreview(normalizeImageUrl(val));
    } else {
      setSignaturePreview(initialSignatureUrl || null);
    }
  };

  const handleSigDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setSigDragActive(true);
    } else if (e.type === "dragleave") {
      setSigDragActive(false);
    }
  };

  const processSigFile = async (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedSigFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Automatic cloud upload to iili.io / Catbox / Storage
      setUploadingSig(true);
      setError("");
      try {
        const res = await uploadImageAuto(file, "signature");
        if (res.success && res.url) {
          setSignatureUrl(res.url);
          setSignaturePreview(res.url);
          setSigProvider(res.provider || "iili.io");
          setMessage(`স্বাক্ষরটি সফলভাবে ক্লাউডে (${res.provider === "catbox.moe" ? "Catbox" : res.provider === "iili.io" ? "iili.io" : "ক্লাউড সিডিএন"}) আপলোড হয়েছে এবং লিংক যোগ হয়েছে!`);
        } else {
          setSigProvider("");
        }
      } catch (err: any) {
        console.warn("Auto sig upload err:", err);
      } finally {
        setUploadingSig(false);
      }
    } else {
      setError("স্বাক্ষরের জন্য অনুগ্রহ করে একটি PNG অথবা ইমেজ ফাইল নির্বাচন করুন।");
    }
  };

  const handleSigDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSigDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSigFile(e.dataTransfer.files[0]);
    }
  };

  const clearSignature = () => {
    setSelectedSigFile(null);
    setSignatureUrl("");
    setSignaturePreview(null);
    setSigProvider("");
  };

  const clearLogo = () => {
    setSelectedLogoFile(null);
    setLogoUrl("");
    setLogoPreview(null);
    setLogoProvider("");
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      // 1. Ensure logo image is uploaded to cloud CDN first if a file was selected
      let currentLogoUrl = logoUrl.trim();
      if (selectedLogoFile && !currentLogoUrl) {
        setUploadingLogo(true);
        try {
          const res = await uploadImageAuto(selectedLogoFile, "logo");
          if (res.success && res.url) {
            currentLogoUrl = res.url;
            setLogoUrl(res.url);
          }
        } catch {
          // ignore error and proceed
        } finally {
          setUploadingLogo(false);
        }
      }

      // 2. Ensure signature image is uploaded to cloud CDN first if a file was selected
      let currentSigUrl = signatureUrl.trim();
      if (selectedSigFile && !currentSigUrl) {
        setUploadingSig(true);
        try {
          const res = await uploadImageAuto(selectedSigFile, "signature");
          if (res.success && res.url) {
            currentSigUrl = res.url;
            setSignatureUrl(res.url);
          }
        } catch {
          // ignore error and proceed
        } finally {
          setUploadingSig(false);
        }
      }

      const formData = new FormData();
      formData.append("name", name);
      formData.append("establishedYear", establishedYear);
      formData.append("principalName", principalName);
      formData.append("registrationNo", registrationNo);
      formData.append("eiinCode", eiinCode);
      formData.append("slogan", slogan);
      formData.append("address", address);
      formData.append("phone", phone);
      formData.append("email", email);
      formData.append("website", website);

      // Logo handling: prefer lightweight URL to avoid server action body overflow
      if (currentLogoUrl) {
        formData.append("logoUrl", normalizeImageUrl(currentLogoUrl));
      } else if (logoMethod === "file" && selectedLogoFile) {
        formData.append("logo", selectedLogoFile);
      } else if (logoUrl.trim()) {
        formData.append("logoUrl", normalizeImageUrl(logoUrl));
      }

      // Signature handling: prefer lightweight URL
      if (currentSigUrl) {
        formData.append("signatureUrl", normalizeImageUrl(currentSigUrl));
      } else if (sigMethod === "file" && selectedSigFile) {
        formData.append("signature", selectedSigFile);
      } else if (signatureUrl.trim()) {
        formData.append("signatureUrl", normalizeImageUrl(signatureUrl));
      }

      const response = await updateMadrasaDetails(formData);

      if (response?.error) {
        setError(response.error);
      } else if (response?.success) {
        setMessage(response.message || "মাদরাসার তথ্য ও স্বাক্ষর সফলভাবে আপডেট করা হয়েছে।");
        setSelectedLogoFile(null);
        setSelectedSigFile(null);
      }
    } catch (err: any) {
      console.error("Settings save error:", err);
      const errTxt = err?.message || "";
      if (errTxt.includes("fetch") || errTxt.includes("Failed to fetch")) {
        setError("নেটওয়ার্ক ড্রপ বা ব্রাউজার বিচ্ছিন্নতার কারণে ডাটা পাঠানো যায়নি। অনুগ্রহ করে সংযোগ চেক করে আবার চেষ্টা করুন। (প্রয়োজনে ছবি তুলে বা Catbox/iili.io লিংক দিয়ে চেষ্টা করুন)");
      } else {
        setError(errTxt || "একটি আকস্মিক সমস্যা দেখা দিয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">মাদরাসা সেটিংস ও প্রাতিষ্ঠানিক তথ্য</h1>
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-200">
              অফিসিয়াল প্রোফাইল
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            মাদরাসার নাম, স্থাপিত সাল, মুহতামিম, স্বাক্ষর, রেজিস্ট্রেশন নম্বর এবং প্রাতিষ্ঠানিক বিবরণ পরিবর্তন ও আপডেট করুন
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowApiGuide(!showApiGuide)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200/70 transition shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
          {showApiGuide ? "গাইড বন্ধ করুন" : "ইমেজ হোস্ট (Catbox/iili.io) গাইড"}
        </button>
      </div>

      {/* External Image Host / API Helper Banner */}
      {showApiGuide && (
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-800 relative animate-fadeIn">
          <button
            onClick={() => setShowApiGuide(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300 shrink-0 mt-0.5">
              <Globe className="w-6 h-6" />
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-bold text-indigo-100 flex items-center gap-2">
                ছবি ও স্বাক্ষরের জন্য Catbox.moe / iili.io / ImgBB ব্যবহারের নিয়ম
              </h3>
              <p className="text-sm text-indigo-200 leading-relaxed max-w-3xl">
                আপনি সরাসরি আপনার ডিভাইস থেকে ছবি/স্বাক্ষর আপলোড করতে পারেন (যা স্বয়ংক্রিয়ভাবে সুপারবেজ ক্লাউডে নিরাপদ থাকবে)। অথবা আপনি চাইলে যেকোনো ফ্রি ইমেজ হোস্টিং সার্ভিস যেমন <strong>Catbox.moe</strong>, <strong>iili.io</strong> বা <strong>ImgBB</strong> থেকে পাওয়া ডিরেক্ট পার্মানেন্ট লিংক কপি করে নিচে <em>&quot;CDN/ড্রাইভ লিংক&quot;</em> অপশনে পেস্ট করতে পারেন:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <a
                  href="https://catbox.moe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-xs text-white"
                >
                  <span className="font-semibold">Catbox.moe</span>
                  <span className="text-slate-300 flex items-center gap-1">ভিজিট করুন <ExternalLink className="w-3 h-3" /></span>
                </a>
                <a
                  href="https://iili.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-xs text-white"
                >
                  <span className="font-semibold">iili.io (Freeimage)</span>
                  <span className="text-slate-300 flex items-center gap-1">ভিজিট করুন <ExternalLink className="w-3 h-3" /></span>
                </a>
                <a
                  href="https://imgbb.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition text-xs text-white"
                >
                  <span className="font-semibold">ImgBB.com</span>
                  <span className="text-slate-300 flex items-center gap-1">ভিজিট করুন <ExternalLink className="w-3 h-3" /></span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (5 Cols) - Live Official Card & Stamp Preview */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
          
          {/* Institutional Identity Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600"></div>
            
            <div className="text-center pt-2">
              <div className="relative w-24 h-24 mx-auto bg-slate-50 rounded-2xl border-2 border-slate-200/80 flex items-center justify-center overflow-hidden mb-3 shadow-inner group">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Madrasa Logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-slate-300" />
                )}
              </div>

              <h2 className="text-lg font-bold text-slate-800 line-clamp-2 px-1">
                {name || "মাদরাসার নাম"}
              </h2>

              {slogan && (
                <p className="text-xs text-emerald-700 font-medium italic mt-1 bg-emerald-50/70 px-3 py-1 rounded-full inline-block border border-emerald-100/60">
                  &ldquo;{slogan}&rdquo;
                </p>
              )}

              {/* Badges: Est & Reg */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs">
                {establishedYear && (
                  <span className="bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200/60 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    স্থাপিতঃ {establishedYear}
                  </span>
                )}
                {registrationNo && (
                  <span className="bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-500" />
                    রেজিস্ট্রেশনঃ {registrationNo}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full border-t border-slate-100 my-4"></div>

            {/* Principal & Signature Stamp Preview Box */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                  মুহতামিম ও স্বাক্ষর প্রিভিউ
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Official</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center relative flex flex-col items-center justify-center min-h-[90px] shadow-sm">
                {signaturePreview ? (
                  <div className="relative w-full h-16 flex items-center justify-center">
                    <img
                      src={signaturePreview}
                      alt="Principal Signature"
                      className="max-h-full max-w-[200px] object-contain drop-shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="py-2 text-slate-300 flex flex-col items-center justify-center text-xs">
                    <PenTool className="w-5 h-5 mb-1 opacity-40" />
                    <span>স্বাক্ষর যুক্ত করা হয়নি</span>
                  </div>
                )}
                
                <div className="w-36 border-t border-dashed border-slate-400 mt-1 pt-1">
                  <p className="text-xs font-bold text-slate-800">
                    {principalName || "মুহতামিম / প্রিন্সিপাল"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">মুহতামিম / প্রধান শিক্ষক</p>
                </div>
              </div>
            </div>

            {/* Details list */}
            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              {eiinCode && (
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>EIIN / মাদরাসা কোড: <strong>{eiinCode}</strong></span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{address || "ঠিকানা যুক্ত করা হয়নি"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{phone || "ফোন যুক্ত করা হয়নি"}</span>
              </div>
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate text-indigo-600">{website}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Notice card */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600" />
              স্বয়ংক্রিয় সংযুক্তি:
            </p>
            <p className="text-amber-800/90 leading-relaxed">
              এখানে দেওয়া মুহতামিমের নাম, স্বাক্ষর, রেজিস্ট্রেশন নম্বর ও স্থাপিত সাল স্বয়ংক্রিয়ভাবে প্রশংসা পত্র (Certificate), প্রবেশপত্র (Admit Card), পরীক্ষার রেজাল্ট কার্ড এবং রসিদে প্রিন্ট হবে।
            </p>
          </div>

        </div>

        {/* Right Column (8 Cols) - Main Form */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            
            {message && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 animate-fadeIn">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}
            
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 animate-fadeIn">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-7">
              
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    ১. মাদরাসার প্রাথমিক বিবরণ
                  </h2>
                </div>

                {/* Madrasa Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    মাদরাসার পূর্ণ নাম <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                      placeholder="উদা: জামিয়া ইসলামিয়া দারুল উলুম"
                    />
                  </div>
                </div>

                {/* Grid: Established Year & Registration No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      স্থাপিতঃ (Est. Year)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={establishedYear}
                        onChange={(e) => setEstablishedYear(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: ১৯৯৫ অথবা 1995"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">মাদরাসা প্রতিষ্ঠার সাল</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      রেজিস্ট্রেশন নম্বর (Reg No.)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: BEFAQ-2024-889 বা সরকারি কোড"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">বেফাক / হাইআতুল উলয়া / বোর্ড নিবন্ধন নং</p>
                  </div>
                </div>

                {/* Slogan and EIIN Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      মাদরাসা কোড / EIIN
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Hash className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={eiinCode}
                        onChange={(e) => setEiinCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: 139042 বা কোড"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      স্লোগান / মূলবাণী (Tagline)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={slogan}
                        onChange={(e) => setSlogan(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: কুরআন ও সুন্নাহর আলোকে আলোকিত জীবন"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Principal & Signature Details */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      ২. মুহতামিম (Principal) ও অফিসিয়াল স্বাক্ষর
                    </h2>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2.5 py-0.5 rounded-full">
                    স্বাক্ষর ও অনুমোদন
                  </span>
                </div>

                {/* Principal Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    মুহতামিমের নাম (Principal / Head Name)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <PenTool className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition"
                      placeholder="উদা: মাওলানা মুফতি আবদুল্লাহ"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">সার্টিফিকেট ও অফিসিয়াল নথিতে মুহতামিম হিসেবে প্রদর্শিত হবে</p>
                </div>

                {/* Principal Signature Upload Box */}
                <div className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        মুহতামিমের স্বাক্ষর (Principal Signature PNG)
                      </label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        অনুমোদিত সাইজ রেশিও: <strong>3:1 বা 4:1</strong> (উদা: 300x100px বা 400x120px, স্বচ্ছ Transparent PNG / সাদা ব্যাকগ্রাউন্ড)
                      </p>
                    </div>

                    {/* Signature Method selector tabs */}
                    <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSigMethod("file");
                          if (selectedSigFile) {
                            const reader = new FileReader();
                            reader.onload = () => setSignaturePreview(reader.result as string);
                            reader.readAsDataURL(selectedSigFile);
                          } else {
                            setSignaturePreview(initialSignatureUrl || null);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                          sigMethod === "file"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <FileImage className="w-3.5 h-3.5" />
                        ফাইল আপলোড
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSigMethod("url");
                          handleSignatureUrlChange(signatureUrl);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                          sigMethod === "url"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        CDN/লিংক
                      </button>
                    </div>
                  </div>

                  {sigMethod === "file" ? (
                    /* Signature Drag & Drop File Upload Box */
                    <div className="space-y-2">
                      <div
                        onDragEnter={handleSigDrag}
                        onDragOver={handleSigDrag}
                        onDragLeave={handleSigDrag}
                        onDrop={handleSigDrop}
                        onClick={() => !uploadingSig && sigInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition relative group bg-white ${
                          sigDragActive
                            ? "border-indigo-500 bg-indigo-50/50"
                            : "border-slate-300 hover:border-indigo-500 hover:bg-slate-50/80"
                        }`}
                      >
                        <input
                          ref={sigInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          disabled={uploadingSig}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              processSigFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        
                        <div className="flex flex-col items-center justify-center">
                          {uploadingSig ? (
                            <div className="flex flex-col items-center justify-center py-2">
                              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                              <p className="text-xs font-bold text-indigo-700 animate-pulse">
                                স্বয়ংক্রিয়ভাবে iili.io / Catbox ক্লাউডে আপলোড হচ্ছে...
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                আপলোড সম্পন্ন হলে সরাসরি ইমেজ লিংক যুক্ত ও সংরক্ষিত হবে
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="p-2.5 bg-slate-100 rounded-full border border-slate-200 mb-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                                <PenTool className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                              </div>
                              <p className="text-xs font-semibold text-slate-700">
                                স্বাক্ষরের PNG ফাইল আপলোড করতে এখানে ক্লিক করুন অথবা ড্র্যাগ করুন
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                ফাইল নির্বাচন করলে স্বয়ংক্রিয়ভাবে ক্লাউড সার্ভারে (iili.io / Catbox) আপলোড হবে
                              </p>
                            </>
                          )}
                        </div>

                        {selectedSigFile && !uploadingSig && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium border border-indigo-200">
                            <span>সিলেক্টেড: {selectedSigFile.name}</span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                clearSignature();
                              }}
                              className="hover:text-red-500 ml-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Cloud Uploaded URL Live Notice for Signature */}
                      {signatureUrl && (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold text-emerald-900">
                                {sigProvider ? `${sigProvider} ক্লাউড লিংক:` : "সংরক্ষিত স্বাক্ষর লিংক:"}
                              </span>{" "}
                              <span className="text-emerald-700 text-[11px] font-mono select-all">
                                {signatureUrl}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(signatureUrl, "sig")}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-100 shrink-0 transition text-[11px] font-medium"
                          >
                            {copiedKey === "sig" ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> কপি হয়েছে
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-600" /> লিংক কপি
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Signature URL input */
                    <div className="space-y-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Globe className="w-4 h-4" />
                        </div>
                        <input
                          type="url"
                          value={signatureUrl}
                          onChange={(e) => handleSignatureUrlChange(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm transition bg-white"
                          placeholder="উদা: https://files.catbox.moe/abc123.png অথবা https://iili.io/xyz.png"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Catbox.moe, iili.io (Freeimage), ImgBB বা যেকোনো সরাসরি পাবলিক ইমেজ লিংক পেস্ট করুন
                      </p>
                    </div>
                  )}

                  {/* Signature Preview Mini Box */}
                  {signaturePreview && (
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={signaturePreview}
                            alt="Signature Preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <span>মুহতামিমের স্বাক্ষর দৃশ্যমান</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-mono">লাইভ প্রিভিউ</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">সার্টিফিকেট, প্রত্যয়নপত্র ও রসিদে এই স্বাক্ষরটি স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="স্বাক্ষর মুছুন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Logo & Identity */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      ৩. মাদরাসার লোগো (Logo)
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">অনুপাত ১:১ (বর্গাকার / বৃত্তাকার)</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">
                      লোগো ফাইল বা লিংক
                    </label>

                    {/* Logo Method Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setLogoMethod("file");
                          if (selectedLogoFile) {
                            const reader = new FileReader();
                            reader.onload = () => setLogoPreview(reader.result as string);
                            reader.readAsDataURL(selectedLogoFile);
                          } else {
                            setLogoPreview(initialLogoUrl || null);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                          logoMethod === "file"
                            ? "bg-white text-emerald-700 shadow-sm"
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
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                          logoMethod === "url"
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        CDN/লিংক
                      </button>
                    </div>
                  </div>

                  {logoMethod === "file" ? (
                    <div className="space-y-2">
                      <div
                        onDragEnter={handleLogoDrag}
                        onDragOver={handleLogoDrag}
                        onDragLeave={handleLogoDrag}
                        onDrop={handleLogoDrop}
                        onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition relative group bg-white ${
                          logoDragActive
                            ? "border-emerald-500 bg-emerald-50/50"
                            : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80"
                        }`}
                      >
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                          disabled={uploadingLogo}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              processLogoFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        
                        <div className="flex flex-col items-center justify-center">
                          {uploadingLogo ? (
                            <div className="flex flex-col items-center justify-center py-2">
                              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                              <p className="text-xs font-bold text-emerald-700 animate-pulse">
                                স্বয়ংক্রিয়ভাবে iili.io / Catbox ক্লাউডে আপলোড হচ্ছে...
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                আপলোড সম্পন্ন হলে সরাসরি ইমেজ লিংক যুক্ত ও সংরক্ষিত হবে
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="p-2.5 bg-slate-100 rounded-full border border-slate-200 mb-2 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
                                <Upload className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                              </div>
                              <p className="text-xs font-semibold text-slate-700">
                                লোগো আপলোড করতে এখানে ক্লিক করুন অথবা ড্র্যাগ করুন
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                ফাইল নির্বাচন করলে স্বয়ংক্রিয়ভাবে ক্লাউড সার্ভারে (iili.io / Catbox) আপলোড হবে
                              </p>
                            </>
                          )}
                        </div>

                        {selectedLogoFile && !uploadingLogo && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium border border-emerald-200">
                            <span>সিলেক্টেড: {selectedLogoFile.name}</span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                clearLogo();
                              }}
                              className="hover:text-red-500 ml-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Cloud Uploaded URL Live Notice for Logo */}
                      {logoUrl && (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold text-emerald-900">
                                {logoProvider ? `${logoProvider} ক্লাউড লিংক:` : "সংরক্ষিত লোগো লিংক:"}
                              </span>{" "}
                              <span className="text-emerald-700 text-[11px] font-mono select-all">
                                {logoUrl}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(logoUrl, "logo")}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-100 shrink-0 transition text-[11px] font-medium"
                          >
                            {copiedKey === "logo" ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> কপি হয়েছে
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-600" /> লিংক কপি
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Globe className="w-4 h-4" />
                        </div>
                        <input
                          type="url"
                          value={logoUrl}
                          onChange={(e) => handleLogoUrlChange(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                          placeholder="উদা: https://files.catbox.moe/abc123.png অথবা https://iili.io/xyz.png"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Catbox.moe, iili.io (Freeimage), ImgBB বা যেকোনো সরাসরি পাবলিক ইমেজ লিংক পেস্ট করুন
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Address & Contact */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    ৪. যোগাযোগ ও ঠিকানা
                  </h2>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ঠিকানা</label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition resize-none"
                      placeholder="উদা: কাতিয়ারচর, কিশোরগঞ্জ সদর, কিশোরগঞ্জ"
                    />
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">মোবাইল নম্বর</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: 017XXXXXXXX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">ইমেইল ঠিকানা</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                        placeholder="উদা: madrasa@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">ওয়েবসাইট / ফেসবুক পেইজ লিংক</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                      placeholder="উদা: https://facebook.com/madrasapage"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-200">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-400" />
                  সকল তথ্য এনক্রিপ্ট হয়ে নিরাপদে সংরক্ষিত হবে।
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      সেটিংস সংরক্ষণ করুন
                    </>
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
