"use client";

import { useState, useEffect } from "react";
import { 
  Award, Palette, LayoutTemplate, Printer, FileText, 
  BookOpen, Search, GraduationCap, ChevronRight, UserCheck, Type
} from "lucide-react";
import { getStudentReportCard } from "@/app/actions/exams";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function CertificateClient({ 
  selectedStudent, 
  certificateType, 
  madrasaInfo,
  students = [],
  classes = [],
  exams = [],
  initialStudentId
}: { 
  selectedStudent: any, 
  certificateType: string, 
  madrasaInfo?: any,
  students: any[],
  classes: any[],
  exams: any[],
  initialStudentId?: string
}) {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"certificate" | "marksheet" | "results">("certificate");

  // General Shared Data
  const [profileAndLogo, setProfileAndLogo] = useState<any>(null);

  // Certificate Settings
  const [template, setTemplate] = useState("ornate");
  const [themeColor, setThemeColor] = useState("slate");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [arabicFont, setArabicFont] = useState("font-amiri");

  // Marksheet Settings
  const [msExamId, setMsExamId] = useState("");
  const [msClassId, setMsClassId] = useState("");
  const [msStudentId, setMsStudentId] = useState("");
  const [msResults, setMsResults] = useState<any[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [msLoaded, setMsLoaded] = useState(false);

  // Results Tabulation Settings
  const [resExamId, setResExamId] = useState("");
  const [resClassId, setResClassId] = useState("");
  const [resResults, setResResults] = useState<any[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [resLoaded, setResLoaded] = useState(false);

  // Fetch tenant info (Logo and Profile)
  useEffect(() => {
    async function load() {
      const res = await getMadrasaProfileWithLogo();
      if (res) {
        setProfileAndLogo(res);
      }
    }
    load();
  }, []);

  // Pre-set default active tab based on query params to make sure if a student was generated, they land on certificate tab
  useEffect(() => {
    if (initialStudentId) {
      setActiveTab("certificate");
    }
  }, [initialStudentId]);

  // Handle Certificate Form Submission (URL parameters redirect)
  const handleCertificateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentId = formData.get("student_id") as string;
    const type = formData.get("type") as string;
    
    const url = new URL(window.location.href);
    url.searchParams.set("student_id", studentId);
    url.searchParams.set("type", type);
    window.location.href = url.toString();
  };

  // Generate Marksheets Client-Side using Server Actions
  const handleGenerateMarksheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msExamId) return;
    setMsLoading(true);
    setMsLoaded(false);

    try {
      // Get all student results for this exam & class
      const data = await getStudentReportCard(msExamId, msClassId || undefined);
      
      // Filter by student if selected
      let finalData = data;
      if (msStudentId) {
        finalData = data.filter(s => s.id === msStudentId);
      }

      // Sort by percentage descending
      const sortedData = finalData.sort((a, b) => Number(b.percentage) - Number(a.percentage));
      setMsResults(sortedData);
      setMsLoaded(true);
    } catch (err) {
      console.error("Error generating marksheets:", err);
    } finally {
      setMsLoading(false);
    }
  };

  // Generate Tabulation Sheet Client-Side
  const handleGenerateResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resExamId) return;
    setResLoading(true);
    setResLoaded(false);

    try {
      const data = await getStudentReportCard(resExamId, resClassId || undefined);
      // Sort by percentage descending for tabulation ranking
      const sortedData = data.sort((a, b) => Number(b.percentage) - Number(a.percentage));
      setResResults(sortedData);
      setResLoaded(true);
    } catch (err) {
      console.error("Error loading results:", err);
    } finally {
      setResLoading(false);
    }
  };

  // Handle Dynamic Print Triggers
  const triggerPrint = () => {
    window.print();
  };

  // Filter students based on chosen class in Marksheet form
  const filteredStudentsForMs = students.filter(s => !msClassId || s.class_id === msClassId);

  // Certificate Theme Colors
  const colors: Record<string, { main: string, text: string, accent: string, border: string }> = {
    slate: { main: "border-slate-800", text: "text-slate-800", accent: "text-slate-600", border: "border-slate-500" },
    indigo: { main: "border-indigo-800", text: "text-indigo-800", accent: "text-indigo-600", border: "border-indigo-500" },
    emerald: { main: "border-emerald-800", text: "text-emerald-800", accent: "text-emerald-600", border: "border-emerald-500" },
    rose: { main: "border-rose-800", text: "text-rose-800", accent: "text-rose-600", border: "border-rose-500" },
    amber: { main: "border-amber-700", text: "text-amber-800", accent: "text-amber-600", border: "border-amber-500" },
  };
  const currentTheme = colors[themeColor] || colors.slate;

  // Selected details names
  const selectedMsExamTitle = exams.find(e => e.id === msExamId)?.title || "পরীক্ষা";
  const selectedMsExamYear = exams.find(e => e.id === msExamId)?.year || "";
  const selectedResExamTitle = exams.find(e => e.id === resExamId)?.title || "পরীক্ষা";
  const selectedResExamYear = exams.find(e => e.id === resExamId)?.year || "";
  const selectedResClassName = classes.find(c => c.id === resClassId)?.name || "";

  // Dynamic calculation for Tabulation list subjects
  const resSubjectList = (() => {
    const allSubjects = new Set<string>();
    resResults.forEach(student => {
      student.marks?.forEach((m: any) => {
        if (m.subject_name) allSubjects.add(m.subject_name);
      });
    });
    return Array.from(allSubjects);
  })();

  return (
    <div className="space-y-6">
      {/* Dynamic Printing CSS for Orientation and Styles */}
      {activeTab === 'certificate' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: landscape; margin: 1cm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .print-area-certificate { display: block !important; width: 100% !important; }
            .print-hidden-element { display: none !important; }
          }
        `}} />
      )}
      {activeTab === 'marksheet' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: portrait; margin: 1cm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .print-area-marksheet { display: block !important; width: 100% !important; }
            .print-hidden-element { display: none !important; }
          }
        `}} />
      )}
      {activeTab === 'results' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: landscape; margin: 1cm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .print-area-results { display: block !important; width: 100% !important; }
            .print-hidden-element { display: none !important; }
          }
        `}} />
      )}

      {/* Screen Tabs Selector */}
      <div className="flex justify-center print:hidden">
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200/80 inline-flex shadow-inner">
          <button
            onClick={() => setActiveTab("certificate")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === "certificate"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <Award className="w-4 h-4 mr-1 text-indigo-600" />
            <span>প্রশংসাপত্র ও সনদ</span>
          </button>
          
          <button
            onClick={() => setActiveTab("marksheet")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === "marksheet"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <FileText className="w-4 h-4 mr-1 text-emerald-600" />
            <span>প্রোগ্রেস রিপোর্ট ও মার্কশীট</span>
          </button>
          
          <button
            onClick={() => setActiveTab("results")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === "results"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50"
            }`}
          >
            <BookOpen className="w-4 h-4 mr-1 text-amber-600" />
            <span>পরীক্ষার ফলাফল তালিকা</span>
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: CERTIFICATE GENERATOR ==================== */}
      {activeTab === "certificate" && (
        <div className="space-y-6 print-hidden-element">
          {/* Controls Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              সনদ জেনারেট করুন
            </h3>
            <form onSubmit={handleCertificateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">শিক্ষার্থী নির্বাচন করুন</label>
                <select name="student_id" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm" required defaultValue={initialStudentId || ""}>
                  <option value="">-- শিক্ষার্থী নির্বাচন --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} (রোল: {student.roll_number || 'নেই'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">সনদের ধরন</label>
                <select name="type" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm" defaultValue={certificateType}>
                  <option value="Hifz">হিফজ সমাপ্তি সনদ</option>
                  <option value="Dawra">দাওরায়ে হাদিস সনদ</option>
                  <option value="Testimonial">প্রশংসাপত্র</option>
                </select>
              </div>
              <div>
                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm py-2.5 rounded-lg transition shadow-sm">
                  জেনারেট করুন
                </button>
              </div>
            </form>
          </div>

          {/* Certificate Design Customizer & Preview */}
          {selectedStudent ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Customizer Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b bg-slate-50 print:hidden gap-4">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-sm font-semibold text-slate-700">ডিজাইন ও কালার কাস্টমাইজ করুন</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-slate-500" />
                    <select 
                      value={template} 
                      onChange={(e) => setTemplate(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium"
                    >
                      <option value="ornate">ক্লাসিক (Ornate)</option>
                      <option value="standard">স্ট্যান্ডার্ড (Standard)</option>
                      <option value="minimal">মিনিমাল (Minimal)</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-500" />
                    <select 
                      value={themeColor} 
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium"
                    >
                      <option value="slate">কালো (Dark)</option>
                      <option value="indigo">ইন্ডিগো (Indigo)</option>
                      <option value="emerald">সবুজ (Emerald)</option>
                      <option value="rose">লাল (Rose)</option>
                      <option value="amber">সোনালী (Amber)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-slate-500" />
                    <select 
                      value={banglaFont} 
                      onChange={(e) => setBanglaFont(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium"
                    >
                      <option value="font-solaiman">বাংলা: সোলাইমান লিপি (ডিফল্ট)</option>
                      <option value="font-shorif">বাংলা: শরীফ শিশির</option>
                      <option value="font-hindsiliguri">বাংলা: হিন্দ শিলিগুড়ি</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-slate-500" />
                    <select 
                      value={arabicFont} 
                      onChange={(e) => setArabicFont(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium"
                    >
                      <option value="font-amiri">আরবি: আমীরী (Amiri)</option>
                      <option value="font-shahrazad">আরবি: শাহরাজাদ (Shahrazad)</option>
                    </select>
                  </div>

                  <button 
                    onClick={triggerPrint}
                    className="flex items-center space-x-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span>প্রিন্ট করুন</span>
                  </button>
                </div>
              </div>

              {/* On-Screen Certificate Canvas Wrapper */}
              <div className="p-4 sm:p-8 flex justify-center bg-slate-100 overflow-x-auto print:bg-white print:p-0">
                <div className="bg-white p-6 shadow-md rounded-lg border print:border-none print:shadow-none print:p-0">
                  <div id="printable-certificate-container" className={`w-[10.5in] h-[7.5in] flex items-center justify-center bg-white ${banglaFont}`}>
                    {/* Ornate Template */}
                    {template === 'ornate' && (
                      <div className={`border-[12px] border-double ${currentTheme.main} p-12 text-center relative w-full h-full bg-white flex flex-col justify-between`}>
                        <div className={`absolute top-10 left-10 opacity-10 ${currentTheme.text}`}>
                           <Award className="w-24 h-24" />
                        </div>
                        <div className={`absolute top-10 right-10 opacity-10 ${currentTheme.text}`}>
                           <Award className="w-24 h-24" />
                        </div>
                        
                        <div>
                          <h1 className={`text-4xl font-black ${currentTheme.text} mb-1 tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                          <p className="text-sm text-slate-600 mb-1">{profileAndLogo?.madrasa?.address || madrasaInfo?.address || "মাদরাসা ঠিকানা"}</p>
                          <h1 className={`text-sm font-bold ${currentTheme.text} mb-1 tracking-widest`}>বিসমিল্লাহির রাহমানির রাহিম</h1>
                          <div className="w-36 h-0.5 bg-slate-300 mx-auto my-2"></div>
                        </div>

                        <h2 className={`text-3xl font-bold ${currentTheme.text} my-4`}>
                          {certificateType === "Hifz" ? "হিফজুল কুরআন সমাপ্তি সনদ" :
                            certificateType === "Dawra" ? "দাওরায়ে হাদিস সমাপ্তি সনদ" : "প্রশংসাপত্র"}
                        </h2>
                        
                        <div className="flex-1 flex flex-col justify-center">
                          <p className="text-lg text-slate-700 leading-relaxed max-w-3xl mx-auto">
                            এই মর্মে প্রত্যয়ন করা যাচ্ছে যে,
                            <br/>
                            <span className={`text-3xl font-black ${currentTheme.text} border-b-2 ${currentTheme.border} inline-block px-8 py-1.5 mt-2 mb-4`}>
                              {selectedStudent.first_name} {selectedStudent.last_name}
                            </span>
                            <br/>
                            পিতা: <span className="font-bold text-slate-950">{selectedStudent.father_name || "__________________"}</span>
                            <br/>
                            তিনি আমাদের মাদ্রাসায় অত্যন্ত সুনামের সহিত অধ্যয়ন করেছেন এবং 
                            <span className={`font-bold ${currentTheme.accent}`}> {certificateType === 'Hifz' ? 'পবিত্র কোরআন হিফজ' : 'নির্ধারিত পাঠ্যক্রম'} </span> 
                            সফলভাবে সম্পন্ন করেছেন। আমরা তার উজ্জ্বল ভবিষ্যৎ ও নেক হায়াত কামনা করি।
                          </p>
                        </div>

                        <div className="flex justify-between mt-8 px-12 items-end">
                           <div className="text-center">
                              <div className={`border-t-2 ${currentTheme.border} pt-1.5 w-40 mx-auto`}></div>
                              <p className={`text-xs font-bold ${currentTheme.text} mt-1`}>শ্রেণী শিক্ষক</p>
                           </div>
                           <div className="text-center">
                              {profileAndLogo?.signatureUrl && (
                                <div className="h-10 flex items-center justify-center mb-1">
                                  <img 
                                    src={profileAndLogo.signatureUrl} 
                                    alt="Principal Signature" 
                                    className="max-h-full max-w-[130px] object-contain"
                                  />
                                </div>
                              )}
                              <div className={`border-t-2 ${currentTheme.border} pt-1 w-40 mx-auto`}></div>
                              <p className={`text-xs font-bold ${currentTheme.text} mt-0.5`}>
                                {profileAndLogo?.principalName || "মুহতামিম / প্রিন্সিপাল"}
                              </p>
                              {profileAndLogo?.principalName && (
                                <p className="text-[10px] text-slate-500">মুহতামিম</p>
                              )}
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Standard Template */}
                    {template === 'standard' && (
                      <div className={`border-8 solid ${currentTheme.main} p-12 text-center relative w-full h-full bg-slate-50/50 flex flex-col justify-between`}>
                        <div>
                          <h1 className={`text-3xl font-black ${currentTheme.text} mb-1 tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                          <p className="text-sm text-slate-600 mb-2">{profileAndLogo?.madrasa?.address || madrasaInfo?.address || "মাদরাসা ঠিকানা"}</p>
                          <div className={`w-28 h-1 ${currentTheme.main} bg-current mx-auto my-2`}></div>
                        </div>

                        <h2 className={`text-3xl font-black ${currentTheme.text} my-4 tracking-wide`}>
                          {certificateType === "Hifz" ? "হিফজুল কুরআন সমাপ্তি সনদ" :
                            certificateType === "Dawra" ? "দাওরায়ে হাদিস সমাপ্তি সনদ" : "প্রশংসাপত্র"}
                        </h2>
                        
                        <div className="flex-1 flex flex-col justify-center">
                          <p className="text-base text-slate-700 leading-relaxed max-w-3xl mx-auto">
                            প্রত্যয়ন করা যাচ্ছে যে,<br/>
                            <span className={`text-2xl font-bold ${currentTheme.text} italic inline-block my-2`}>
                              {selectedStudent.first_name} {selectedStudent.last_name}
                            </span><br/>
                            পিতা: <span className="font-bold text-slate-900">{selectedStudent.father_name || "__________________"}</span><br/>
                            তিনি আমাদের মাদ্রাসায় অধ্যয়ন করে অত্যন্ত দক্ষতার সাথে 
                            <span className={`font-bold ${currentTheme.accent}`}> {certificateType === 'Hifz' ? 'পবিত্র কোরআন হিফজ' : 'নির্ধারিত পাঠ্যক্রম'} </span> 
                            সফলভাবে সম্পন্ন করেছেন। আমরা তার কল্যাণময় ভবিষ্যৎ কামনা করি।
                          </p>
                        </div>

                        <div className="flex justify-between mt-8 px-12 items-end">
                           <div className="text-center">
                              <div className="border-t border-slate-700 pt-1.5 w-40 mx-auto"></div>
                              <p className="text-xs font-bold text-slate-800 mt-1">পরীক্ষক</p>
                           </div>
                           <div className="text-center">
                              {profileAndLogo?.signatureUrl && (
                                <div className="h-10 flex items-center justify-center mb-1">
                                  <img 
                                    src={profileAndLogo.signatureUrl} 
                                    alt="Principal Signature" 
                                    className="max-h-full max-w-[130px] object-contain"
                                  />
                                </div>
                              )}
                              <div className="border-t border-slate-700 pt-1 w-40 mx-auto"></div>
                              <p className="text-xs font-bold text-slate-800 mt-0.5">
                                {profileAndLogo?.principalName || "মুহতামিম"}
                              </p>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Minimal Template */}
                    {template === 'minimal' && (
                      <div className="p-16 text-center relative w-full h-full bg-white flex flex-col justify-between border-2 border-slate-100">
                        <div className="flex items-center justify-between border-b pb-4">
                          <h1 className={`text-xl font-bold ${currentTheme.text} tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                          <p className="text-xs text-slate-400">সনদ নং: {selectedStudent.id.substring(0,6).toUpperCase()}</p>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center my-6">
                          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">সনদপত্র ও প্রশংসাপত্র</p>
                          <h2 className={`text-4xl font-extralight ${currentTheme.text} mb-3`}>
                            {selectedStudent.first_name} {selectedStudent.last_name}
                          </h2>
                          <p className="text-sm text-slate-500 mb-6">পিতা: {selectedStudent.father_name || "__________________"}</p>
                          
                          <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
                            সফলভাবে ও নিষ্ঠার সাথে আমাদের শিক্ষা প্রতিষ্ঠানে অধ্যয়ন সমাপ্ত করেছেন এবং 
                            <span className={`font-medium ${currentTheme.text}`}> {certificateType === 'Hifz' ? 'হিফজুল কুরআন' : 'শ্রেণীভিত্তিক পাঠ্যক্রম'} </span> 
                            সুন্দরভাবে সম্পন্ন করার স্বীকৃতিস্বরূপ এই প্রশংসাপত্র প্রদান করা হলো।
                          </p>
                        </div>

                        <div className="flex justify-between items-end border-t pt-6 w-full">
                           <div className="text-left">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">তারিখ</p>
                              <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('bn-BD')}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">কর্তৃপক্ষ</p>
                              <div className={`border-b ${currentTheme.border} w-32 pb-4`}></div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 shadow-sm">
              <Award className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-bounce" />
              <h4 className="text-base font-bold text-slate-700">কোনো প্রশংসাপত্র সিলেক্ট করা হয়নি</h4>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">উপরের ফর্ম থেকে একজন শিক্ষার্থী এবং সনদের ধরন নির্বাচন করে "জেনারেট করুন" বাটনে চাপ দিন।</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: MARKSHEETS GENERATOR ==================== */}
      {activeTab === "marksheet" && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              মার্কশীট ও প্রোগ্রেস রিপোর্ট
            </h3>
            <form onSubmit={handleGenerateMarksheets} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">পরীক্ষা নির্বাচন করুন</label>
                <select 
                  value={msExamId} 
                  onChange={(e) => setMsExamId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 text-sm" 
                  required
                >
                  <option value="">-- পরীক্ষা নির্বাচন --</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ক্লাস নির্বাচন করুন</label>
                <select 
                  value={msClassId} 
                  onChange={(e) => {
                    setMsClassId(e.target.value);
                    setMsStudentId(""); // Reset student
                  }}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 text-sm"
                >
                  <option value="">সকল ক্লাস</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">শিক্ষার্থী (ঐচ্ছিক)</label>
                <select 
                  value={msStudentId} 
                  onChange={(e) => setMsStudentId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 text-sm animate-fade-in"
                >
                  <option value="">সকল শিক্ষার্থী</option>
                  {filteredStudentsForMs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (রোল: {s.roll_number || 'নেই'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button 
                  type="submit" 
                  disabled={msLoading || !msExamId}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm py-2.5 rounded-lg transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                  {msLoading ? "লোডিং..." : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>মার্কশীট জেনারেট করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Screen Preview & Actions */}
          {msLoaded && msResults.length > 0 && (
            <div className="space-y-6 print-hidden-element">
              <div className="flex flex-col sm:flex-row justify-between items-center bg-emerald-50 border border-emerald-100 p-4 rounded-xl gap-4">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
                    <UserCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">সফলভাবে মার্কশীট তৈরি হয়েছে</h4>
                    <p className="text-xs text-slate-500 mt-0.5">মোট {msResults.length} জন শিক্ষার্থীর মার্কশীট প্রিন্ট করার জন্য রেডি।</p>
                  </div>
                </div>
                
                <button
                  onClick={triggerPrint}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-lg text-sm shadow-sm transition"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  <span>সকল মার্কশীট প্রিন্ট করুন</span>
                </button>
              </div>

              {/* Grid Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {msResults.map((student, index) => (
                  <div key={student.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                    <div className="flex justify-between items-start border-b pb-3 mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{student.first_name} {student.last_name}</h4>
                        <p className="text-xs text-indigo-600 font-semibold mt-1 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">ক্লাস: {student.class_name || "নেই"}</p>
                      </div>
                      <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-lg font-bold">
                        রোল: {student.roll_number || '-'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span>মেধাস্থান:</span>
                        <span className="font-bold text-slate-900">{index + 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>বিভাগ:</span>
                        <span className="font-bold text-slate-900">{student.grade}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>মোট প্রাপ্ত:</span>
                        <span className="font-bold text-slate-900">{student.totalObtained} / {student.totalMax}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>শতকরা হার:</span>
                        <span className="font-bold text-slate-900">{student.percentage}%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">বিষয়ভিত্তিক নম্বর:</p>
                      {student.marks?.length > 0 ? (
                        student.marks.map((m: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-slate-700">
                            <span className="truncate max-w-[120px]">{m.subject_name}</span>
                            <span className="font-semibold">{m.marks_obtained} / {m.total_marks}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">কোনো মার্কস পাওয়া যায়নি</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {msLoaded && msResults.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 shadow-sm print-hidden-element">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700">কোনো মার্কশীট ডাটা পাওয়া যায়নি</h4>
              <p className="text-sm text-slate-400 mt-1">নির্বাচিত ফিল্টারের জন্য কোনো শিক্ষার্থীর পরীক্ষার ফলাফল খুঁজে পাওয়া যায়নি।</p>
            </div>
          )}

          {!msLoaded && !msLoading && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 shadow-sm print-hidden-element">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
              <h4 className="text-base font-bold text-slate-700">মার্কশীট জেনারেট করুন</h4>
              <p className="text-sm text-slate-400 mt-1">পরীক্ষা ও ক্লাস সিলেক্ট করে জেনারেট বাটনে চাপুন।</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: EXAMS TABULATION RESULTS ==================== */}
      {activeTab === "results" && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              পরীক্ষার ফলাফল ও লেজার তালিকা
            </h3>
            <form onSubmit={handleGenerateResults} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">পরীক্ষা নির্বাচন করুন</label>
                <select 
                  value={resExamId} 
                  onChange={(e) => setResExamId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-slate-800 text-sm" 
                  required
                >
                  <option value="">-- পরীক্ষা নির্বাচন --</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ক্লাস নির্বাচন করুন</label>
                <select 
                  value={resClassId} 
                  onChange={(e) => setResClassId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-slate-800 text-sm"
                  required
                >
                  <option value="">-- ক্লাস নির্বাচন --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button 
                  type="submit" 
                  disabled={resLoading || !resExamId || !resClassId}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm py-2.5 rounded-lg transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                  {resLoading ? "খুঁজছি..." : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>ফলাফল দেখুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Screen Tabulation Summary & Actions */}
          {resLoaded && resResults.length > 0 && (
            <div className="space-y-6 print-hidden-element">
              <div className="flex flex-col sm:flex-row justify-between items-center bg-amber-50 border border-amber-100 p-4 rounded-xl gap-4">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 bg-amber-100 rounded-lg text-amber-800">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">ফলাফল মেধা তালিকা তৈরি হয়েছে</h4>
                    <p className="text-xs text-slate-500 mt-0.5">শ্রেণী: {selectedResClassName} | মোট পরীক্ষার্থী: {resResults.length} জন</p>
                  </div>
                </div>
                
                <button
                  onClick={triggerPrint}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-lg text-sm shadow-sm transition"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  <span>ফলাফল শীট প্রিন্ট করুন</span>
                </button>
              </div>

              {/* Grid Tabulation Ledger Preview */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 w-16">মেধাস্থান</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 w-16">রোল</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-700">নাম</th>
                        {resSubjectList.map(sub => (
                          <th key={sub} className="px-3 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap">{sub}</th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700">মোট প্রাপ্ত</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700">শতকরা</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700">বিভাগ</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700">জিপিএ (GPA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {resResults.map((student, index) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition duration-150">
                          <td className="px-4 py-3 text-center font-black text-slate-900 bg-slate-50/50">{index + 1}</td>
                          <td className="px-4 py-3 text-center font-semibold">{student.roll_number || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {student.first_name} {student.last_name}
                          </td>
                          {resSubjectList.map(sub => {
                            const markObj = student.marks?.find((m: any) => m.subject_name === sub);
                            return (
                              <td key={sub} className="px-3 py-3 text-center font-medium">
                                {markObj ? markObj.marks_obtained : '-'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center font-bold text-indigo-700">{student.totalObtained} / {student.totalMax}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">{student.percentage}%</td>
                          <td className="px-4 py-3 text-center font-semibold">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                              student.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              student.percentage >= 60 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              student.percentage >= 45 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              student.percentage >= 33 ? 'bg-slate-100 text-slate-700' :
                              'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {student.grade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black text-slate-900">
                            {
                              student.percentage >= 80 ? '৫.০০' :
                              student.percentage >= 70 ? '৪.০০' :
                              student.percentage >= 60 ? '৩.৫০' :
                              student.percentage >= 50 ? '৩.০০' :
                              student.percentage >= 40 ? '২.০০' :
                              student.percentage >= 33 ? '১.০০' : '০.০০'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {resLoaded && resResults.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 shadow-sm print-hidden-element">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700">কোনো ফলাফল পাওয়া যায়নি</h4>
              <p className="text-sm text-slate-400 mt-1 font-medium">নির্বাচিত পরীক্ষা ও ক্লাসের জন্য কোনো ফলাফল বা মার্কসের এন্ট্রি ডাটাবেজে পাওয়া যায়নি।</p>
            </div>
          )}

          {!resLoaded && !resLoading && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 shadow-sm print-hidden-element">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
              <h4 className="text-base font-bold text-slate-700">ফলাফল ও মেধা তালিকা দেখুন</h4>
              <p className="text-sm text-slate-400 mt-1">পরীক্ষা এবং ক্লাস নির্বাচন করে ফলাফল দেখুন বাটনে ক্লিক করুন।</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== PRINT VIEWS (ONLY SHOWN WHEN PRINTED) ==================== */}
      
      {/* 1. Certificate Printing Container */}
      {activeTab === 'certificate' && selectedStudent && (
        <div className="hidden print:block print-area-certificate w-full mx-auto">
          <div className="w-[10.5in] h-[7.2in] mx-auto flex items-center justify-center bg-white">
            {template === 'ornate' && (
              <div className={`border-[14px] border-double ${currentTheme.main} p-12 text-center relative w-full h-full bg-white flex flex-col justify-between`}>
                <div className={`absolute top-10 left-10 opacity-10 ${currentTheme.text}`}>
                   <Award className="w-24 h-24" />
                </div>
                <div className={`absolute top-10 right-10 opacity-10 ${currentTheme.text}`}>
                   <Award className="w-24 h-24" />
                </div>
                
                <div>
                  <h1 className={`text-4xl font-black ${currentTheme.text} mb-1 tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                  <p className="text-sm text-slate-600 mb-1">{profileAndLogo?.madrasa?.address || madrasaInfo?.address || "মাদরাসা ঠিকানা"}</p>
                  <h1 className={`text-sm font-bold ${currentTheme.text} mb-1 tracking-widest`}>বিসমিল্লাহির রাহমানির রাহিম</h1>
                  <div className="w-36 h-0.5 bg-slate-300 mx-auto my-2"></div>
                </div>

                <h2 className={`text-3.5xl font-bold ${currentTheme.text} my-4`}>
                  {certificateType === "Hifz" ? "হিফজুল কুরআন সমাপ্তি সনদ" :
                    certificateType === "Dawra" ? "দাওরায়ে হাদিস সমাপ্তি সনদ" : "প্রশংসাপত্র"}
                </h2>
                
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-xl text-slate-700 leading-loose max-w-3xl mx-auto">
                    এই মর্মে প্রত্যয়ন করা যাচ্ছে যে,
                    <br/>
                    <span className={`text-3.5xl font-black ${currentTheme.text} border-b-2 ${currentTheme.border} inline-block px-8 py-1.5 mt-2 mb-4`}>
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </span>
                    <br/>
                    পিতা: <span className="font-bold text-slate-950">{selectedStudent.father_name || "__________________"}</span>
                    <br/>
                    তিনি আমাদের মাদ্রাসায় অত্যন্ত সুনামের সহিত অধ্যয়ন করেছেন এবং 
                    <span className={`font-bold ${currentTheme.accent}`}> {certificateType === 'Hifz' ? 'পবিত্র কোরআন হিফজ' : 'নির্ধারিত পাঠ্যক্রম'} </span> 
                    সফলভাবে সম্পন্ন করেছেন। আমরা তার উজ্জ্বল ভবিষ্যৎ ও নেক হায়াত কামনা করি।
                  </p>
                </div>

                <div className="flex justify-between mt-8 px-12">
                   <div className="text-center">
                      <div className={`border-t-2 ${currentTheme.border} pt-1.5 w-40 mx-auto`}></div>
                      <p className={`text-xs font-bold ${currentTheme.text} mt-1`}>শ্রেণী শিক্ষক</p>
                   </div>
                   <div className="text-center">
                      <div className={`border-t-2 ${currentTheme.border} pt-1.5 w-40 mx-auto`}></div>
                      <p className={`text-xs font-bold ${currentTheme.text} mt-1`}>মুহতামিম / প্রিন্সিপাল</p>
                   </div>
                </div>
              </div>
            )}

            {template === 'standard' && (
              <div className={`border-8 solid ${currentTheme.main} p-12 text-center relative w-full h-full bg-white flex flex-col justify-between`}>
                <div>
                  <h1 className={`text-3xl font-black ${currentTheme.text} mb-1 tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                  <p className="text-sm text-slate-600 mb-2">{profileAndLogo?.madrasa?.address || madrasaInfo?.address || "মাদরাসা ঠিকানা"}</p>
                  <div className={`w-28 h-1 ${currentTheme.main} bg-current mx-auto my-2`}></div>
                </div>

                <h2 className={`text-3xl font-black ${currentTheme.text} my-4 tracking-wide`}>
                  {certificateType === "Hifz" ? "হিফজুল কুরআন সমাপ্তি সনদ" :
                    certificateType === "Dawra" ? "দাওরায়ে হাদিস সমাপ্তি সনদ" : "প্রশংসাপত্র"}
                </h2>
                
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-lg text-slate-700 leading-relaxed max-w-3xl mx-auto">
                    প্রত্যয়ন করা যাচ্ছে যে,<br/>
                    <span className={`text-2xl font-bold ${currentTheme.text} italic inline-block my-2`}>
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </span><br/>
                    পিতা: <span className="font-bold text-slate-900">{selectedStudent.father_name || "__________________"}</span><br/>
                    তিনি আমাদের মাদ্রাসায় অধ্যয়ন করে অত্যন্ত দক্ষতার সাথে 
                    <span className={`font-bold ${currentTheme.accent}`}> {certificateType === 'Hifz' ? 'পবিত্র কোরআন হিফজ' : 'নির্ধারিত পাঠ্যক্রম'} </span> 
                    সফলভাবে সম্পন্ন করেছেন। আমরা তার কল্যাণময় ভবিষ্যৎ কামনা করি।
                  </p>
                </div>

                <div className="flex justify-between mt-8 px-12">
                   <div className="text-center">
                      <div className="border-t border-slate-700 pt-1.5 w-40 mx-auto"></div>
                      <p className="text-xs font-bold text-slate-800 mt-1">পরীক্ষক</p>
                   </div>
                   <div className="text-center">
                      <div className="border-t border-slate-700 pt-1.5 w-40 mx-auto"></div>
                      <p className="text-xs font-bold text-slate-800 mt-1">মুহতামিম</p>
                   </div>
                </div>
              </div>
            )}

            {template === 'minimal' && (
              <div className="p-16 text-center relative w-full h-full bg-white flex flex-col justify-between border">
                <div className="flex items-center justify-between border-b pb-4">
                  <h1 className={`text-xl font-bold ${currentTheme.text} tracking-wider`}>{profileAndLogo?.madrasa?.name || madrasaInfo?.name || "মাদরাসা নাম"}</h1>
                  <p className="text-xs text-slate-400">সনদ নং: {selectedStudent.id.substring(0,6).toUpperCase()}</p>
                </div>
                
                <div className="flex-1 flex flex-col justify-center items-center my-6">
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">সনদপত্র ও প্রশংসাপত্র</p>
                  <h2 className={`text-4xl font-extralight ${currentTheme.text} mb-3`}>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">পিতা: {selectedStudent.father_name || "__________________"}</p>
                  
                  <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                    সফলভাবে ও নিষ্ঠার সাথে আমাদের শিক্ষা প্রতিষ্ঠানে অধ্যয়ন সমাপ্ত করেছেন এবং 
                    <span className={`font-medium ${currentTheme.text}`}> {certificateType === 'Hifz' ? 'হিফজুল কুরআন' : 'শ্রেণীভিত্তিক পাঠ্যক্রম'} </span> 
                    সুন্দরভাবে সম্পন্ন করার স্বীকৃতিস্বরূপ এই প্রশংসাপত্র প্রদান করা হলো।
                  </p>
                </div>

                <div className="flex justify-between items-end border-t pt-6 w-full">
                   <div className="text-left">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">তারিখ</p>
                      <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('bn-BD')}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">কর্তৃপক্ষ</p>
                      <div className={`border-b ${currentTheme.border} w-32 pb-4`}></div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Marksheets Printing Container (One sheet per page) */}
      {activeTab === 'marksheet' && msResults.length > 0 && (
        <div className="hidden print:block print-area-marksheet w-full space-y-12">
          {msResults.map((student, index) => (
            <div key={student.id} className="print:break-after-page print:w-full print:min-h-[100vh] print:py-6">
              <PrintLetterpad madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} logoUrl={profileAndLogo?.logoUrl}>
                <div className="border-4 border-double border-slate-800 p-8 m-4 rounded-xl relative bg-white">
                  {/* Header */}
                  <div className="text-center border-b-2 border-slate-800 pb-4 mb-6 relative">
                    <div className="mt-2 inline-block bg-slate-800 text-white px-6 py-1.5 rounded-full font-bold text-lg uppercase tracking-wider">
                      প্রোগ্রেস রিপোর্ট / মার্কশিট
                    </div>
                    <p className="text-slate-800 font-bold text-md mt-3">{selectedMsExamTitle} - {selectedMsExamYear}</p>
                  </div>

                  {/* Student Info */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6 text-base">
                    <div className="flex border-b border-dashed border-slate-350 pb-0.5">
                      <span className="font-bold text-slate-700 w-28">ছাত্রের নাম:</span>
                      <span className="font-black text-slate-900 flex-1">{student.first_name} {student.last_name}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-350 pb-0.5">
                      <span className="font-bold text-slate-700 w-28">ক্লাস:</span>
                      <span className="font-black text-slate-900 flex-1">{student.class_name || 'N/A'}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-350 pb-0.5">
                      <span className="font-bold text-slate-700 w-28">রোল নম্বর:</span>
                      <span className="font-black text-slate-900 flex-1">{student.roll_number || 'N/A'}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-350 pb-0.5">
                      <span className="font-bold text-slate-700 w-28">মেধাস্থান:</span>
                      <span className="font-black text-slate-900 flex-1">{index + 1}</span>
                    </div>
                  </div>

                  {/* Marks Table */}
                  <table className="w-full text-left border-collapse mb-6">
                    <thead>
                      <tr>
                        <th className="border-2 border-slate-800 px-4 py-2.5 bg-slate-100 font-bold text-slate-950 text-center w-16">ক্র.নং</th>
                        <th className="border-2 border-slate-800 px-4 py-2.5 bg-slate-100 font-bold text-slate-950">विषয়ের নাম</th>
                        <th className="border-2 border-slate-800 px-4 py-2.5 bg-slate-100 font-bold text-slate-950 text-center w-32">পূর্ণ নম্বর</th>
                        <th className="border-2 border-slate-800 px-4 py-2.5 bg-slate-100 font-bold text-slate-950 text-center w-32">প্রাপ্ত নম্বর</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.marks?.map((markRow: any, i: number) => (
                        <tr key={i}>
                          <td className="border-2 border-slate-800 px-4 py-2 text-center text-slate-800 font-bold">{i + 1}</td>
                          <td className="border-2 border-slate-800 px-4 py-2 font-black text-slate-950">{markRow.subject_name}</td>
                          <td className="border-2 border-slate-800 px-4 py-2 text-center text-slate-800 font-bold">{markRow.total_marks}</td>
                          <td className="border-2 border-slate-800 px-4 py-2 text-center font-black text-slate-950">{markRow.marks_obtained}</td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="border-2 border-slate-800 px-4 py-2.5 text-right font-black text-slate-950 uppercase">সর্বমোট:</td>
                        <td className="border-2 border-slate-800 px-4 py-2.5 text-center font-black text-slate-950">{student.totalMax}</td>
                        <td className="border-2 border-slate-800 px-4 py-2.5 text-center font-black text-slate-950 text-lg">{student.totalObtained}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Final Grade / Result */}
                  <div className="flex justify-between items-center bg-slate-50 border-2 border-slate-800 p-3.5 rounded-lg mb-12">
                    <div className="text-md">
                      <span className="font-bold text-slate-800">প্রাপ্ত বিভাগ (Grade): </span>
                      <span className="font-black text-slate-950 text-xl">{student.grade}</span>
                    </div>
                    <div className="text-md">
                      <span className="font-bold text-slate-800">শতকরা (Percentage): </span>
                      <span className="font-black text-slate-950 text-xl">{student.percentage}%</span>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="flex justify-between items-end mt-10 pt-6">
                    <div className="text-center w-40 border-t-2 border-slate-800 pt-1">
                      <p className="font-bold text-slate-900 text-xs">শ্রেণী শিক্ষকের স্বাক্ষর</p>
                    </div>
                    <div className="text-center w-40 border-t-2 border-slate-800 pt-1">
                      <p className="font-bold text-slate-900 text-xs">পরীক্ষা নিয়ন্ত্রক</p>
                    </div>
                    <div className="text-center w-40">
                      {profileAndLogo?.signatureUrl && (
                        <div className="h-9 flex items-center justify-center mb-1">
                          <img 
                            src={profileAndLogo.signatureUrl} 
                            alt="Principal Signature" 
                            className="max-h-full max-w-[120px] object-contain"
                          />
                        </div>
                      )}
                      <div className="border-t-2 border-slate-800 pt-1">
                        <p className="font-bold text-slate-900 text-xs">
                          {profileAndLogo?.principalName || "মুহতামিম / প্রিন্সিপাল"}
                        </p>
                        {profileAndLogo?.principalName && (
                          <p className="text-[10px] text-slate-600">মুহতামিম</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </PrintLetterpad>
            </div>
          ))}
        </div>
      )}

      {/* 3. Tabulation Sheet Printing Container (Landscape format) */}
      {activeTab === 'results' && resResults.length > 0 && (
        <div className="hidden print:block print-area-results w-full">
          <PrintLetterpad madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} logoUrl={profileAndLogo?.logoUrl}>
            <div className="mb-6 text-center border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-800">{selectedResExamTitle} - {selectedResExamYear}</h2>
              <h3 className="text-md font-extrabold text-indigo-700 mt-1">
                পরীক্ষার ফলাফল ও মেধা তালিকা (লেজার)
              </h3>
              {selectedResClassName && <p className="text-slate-600 font-bold text-xs mt-1 bg-slate-100 inline-block px-3 py-1 rounded-full border border-slate-200">শ্রেণী: {selectedResClassName}</p>}
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-950 font-bold border-b border-black">
                <tr>
                  <th className="px-2 py-2 border border-slate-400 text-center w-12">মেধাস্থান</th>
                  <th className="px-2 py-2 border border-slate-400 text-center w-12">রোল</th>
                  <th className="px-3 py-2 border border-slate-400">ছাত্রের নাম</th>
                  {resSubjectList.map(sub => (
                    <th key={sub} className="px-2 py-2 border border-slate-400 text-center whitespace-nowrap">{sub}</th>
                  ))}
                  <th className="px-2 py-2 border border-slate-400 text-center">প্রাপ্ত নম্বর</th>
                  <th className="px-2 py-2 border border-slate-400 text-center">শতকরা</th>
                  <th className="px-2 py-2 border border-slate-400 text-center">বিভাগ</th>
                  <th className="px-2 py-2 border border-slate-400 text-center">জিপিএ (GPA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-slate-800">
                {resResults.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 border border-slate-300 text-center font-bold">{index + 1}</td>
                    <td className="px-2 py-2 border border-slate-300 text-center">{student.roll_number || '-'}</td>
                    <td className="px-3 py-2 border border-slate-300 font-bold text-slate-900 whitespace-nowrap">
                      {student.first_name} {student.last_name}
                    </td>
                    {resSubjectList.map(sub => {
                      const markObj = student.marks?.find((m: any) => m.subject_name === sub);
                      return (
                        <td key={sub} className="px-2 py-2 border border-slate-300 text-center">
                          {markObj ? markObj.marks_obtained : '-'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 border border-slate-300 text-center font-bold">{student.totalObtained} / {student.totalMax}</td>
                    <td className="px-2 py-2 border border-slate-300 text-center">{student.percentage}%</td>
                    <td className="px-2 py-2 border border-slate-300 text-center font-bold">{student.grade}</td>
                    <td className="px-2 py-2 border border-slate-300 text-center font-black text-indigo-800">
                      {
                        student.percentage >= 80 ? '৫.০০' :
                        student.percentage >= 70 ? '৪.০০' :
                        student.percentage >= 60 ? '৩.৫০' :
                        student.percentage >= 50 ? '৩.০০' :
                        student.percentage >= 40 ? '২.০০' :
                        student.percentage >= 33 ? '১.০০' : '০.০০'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="flex justify-between items-end mt-12 pt-6">
              <div className="text-center w-48 border-t border-slate-500 pt-1.5">
                <p className="font-bold text-slate-900 text-xs">শ্রেণী শিক্ষকের স্বাক্ষর</p>
              </div>
              <div className="text-center w-48 border-t border-slate-500 pt-1.5">
                <p className="font-bold text-slate-900 text-xs">পরীক্ষা নিয়ন্ত্রক</p>
              </div>
              <div className="text-center w-48">
                {profileAndLogo?.signatureUrl && (
                  <div className="h-9 flex items-center justify-center mb-1">
                    <img 
                      src={profileAndLogo.signatureUrl} 
                      alt="Principal Signature" 
                      className="max-h-full max-w-[130px] object-contain"
                    />
                  </div>
                )}
                <div className="border-t border-slate-500 pt-1.5">
                  <p className="font-bold text-slate-900 text-xs">
                    {profileAndLogo?.principalName || "মুহতামিম / প্রিন্সিপাল"}
                  </p>
                </div>
              </div>
            </div>
          </PrintLetterpad>
        </div>
      )}
    </div>
  );
}
