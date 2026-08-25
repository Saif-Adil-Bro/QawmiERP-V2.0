"use client";

import { useState } from "react";
import { CalendarDays, Clock, MapPin, User, BookOpen, Palette, LayoutTemplate } from "lucide-react";
import PrintButton from "@/app/components/PrintButton";

export default function RoutineClient({ routines, routineType, className, madrasaInfo }: { routines: any[], routineType: string, className?: string, madrasaInfo?: {name: string, address: string, phone: string} }) {
  const [template, setTemplate] = useState("grid");
  const [themeColor, setThemeColor] = useState("indigo");

  // Group by day_of_week
  const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  const groupedRoutines = days.reduce((acc, day) => {
    acc[day] = routines.filter(r => r.day_of_week === day);
    return acc;
  }, {} as Record<string, any[]>);

  const dayTranslations: Record<string, string> = {
    Saturday: "শনিবার",
    Sunday: "রবিবার",
    Monday: "সোমবার",
    Tuesday: "মঙ্গলবার",
    Wednesday: "বুধবার",
    Thursday: "বৃহস্পতিবার",
    Friday: "শুক্রবার",
  };

  const colors: Record<string, { bg: string, text: string, border: string, light: string, accent: string }> = {
    indigo: { bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-600", light: "bg-indigo-50", accent: "border-indigo-200" },
    emerald: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-600", light: "bg-emerald-50", accent: "border-emerald-200" },
    rose: { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-600", light: "bg-rose-50", accent: "border-rose-200" },
    slate: { bg: "bg-slate-800", text: "text-slate-800", border: "border-slate-800", light: "bg-slate-100", accent: "border-slate-300" },
    blue: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-600", light: "bg-blue-50", accent: "border-blue-200" },
  };

  const currentTheme = colors[themeColor] || colors.indigo;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 print:border-none print:shadow-none print:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4 print:hidden gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wider">{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
          <p className="text-sm text-slate-500 mb-2">{madrasaInfo?.address || ""}</p>
          <h2 className="text-lg font-bold text-slate-700">
            {routineType === 'Class' ? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'}
          </h2>
          {className && (
            <p className="text-slate-600 font-medium">
              জামাত: {className}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-lg border">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <select 
              value={template} 
              onChange={(e) => setTemplate(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded p-1"
            >
              <option value="grid">গ্রিড ডিজাইন</option>
              <option value="table">টেবিল ডিজাইন</option>
              <option value="compact">কম্প্যাক্ট ডিজাইন</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-slate-500" />
            <select 
              value={themeColor} 
              onChange={(e) => setThemeColor(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded p-1"
            >
              <option value="indigo">ইন্ডিগো (Indigo)</option>
              <option value="emerald">সবুজ (Emerald)</option>
              <option value="blue">নীল (Blue)</option>
              <option value="rose">লাল (Rose)</option>
              <option value="slate">কালো (Dark)</option>
            </select>
          </div>

          <PrintButton targetId="printable-routine-content" fileName="routine.pdf" />
        </div>
      </div>

      <div id="printable-routine-content" className="print:m-0 print:p-0">
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className={`text-3xl font-bold ${currentTheme.text} text-center uppercase tracking-wider`}>{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
          <p className="text-center text-slate-500 mb-2">{madrasaInfo?.address || "Address"}</p>
          <h2 className={`text-xl font-bold text-slate-800 text-center`}>
            {routineType === 'Class' ? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'}
          </h2>
          {className && (
            <p className="text-slate-600 font-medium text-center">
              জামাত: {className}
            </p>
          )}
        </div>

        {routines.length > 0 ? (
          <div className="space-y-8">
            {template === 'grid' && days.map(day => {
              if (groupedRoutines[day].length === 0) return null;
              
              return (
                <div key={day} className="mb-6">
                  <h3 className={`text-lg font-bold ${currentTheme.text} mb-3 ${currentTheme.light} p-2 rounded-md border-l-4 ${currentTheme.border}`}>
                    {dayTranslations[day]}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupedRoutines[day].map(routine => (
                      <div key={routine.id} className={`border ${currentTheme.accent} rounded-lg p-4 shadow-sm bg-white`}>
                        <div className={`flex items-center space-x-2 ${currentTheme.text} font-semibold mb-2`}>
                          <Clock className="w-4 h-4" />
                          <span>{routine.start_time.slice(0, 5)} - {routine.end_time.slice(0, 5)}</span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start space-x-2">
                            <BookOpen className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="font-medium text-slate-800">{routine.subjects?.name || 'Subject Not Set'}</span>
                          </div>
                          
                          <div className="flex items-start space-x-2">
                            <User className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="text-slate-600">{routine.teachers ? `${routine.teachers.first_name} ${routine.teachers.last_name}` : 'Teacher Not Assigned'}</span>
                          </div>
                          
                          {routine.room_number && (
                            <div className="flex items-start space-x-2">
                              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                              <span className="text-slate-600">রুম: {routine.room_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {template === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`${currentTheme.bg} text-white`}>
                      <th className="p-3 border text-sm font-semibold">দিন</th>
                      <th className="p-3 border text-sm font-semibold">সময়</th>
                      <th className="p-3 border text-sm font-semibold">বিষয়</th>
                      <th className="p-3 border text-sm font-semibold">শিক্ষক</th>
                      <th className="p-3 border text-sm font-semibold">রুম</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      if (groupedRoutines[day].length === 0) return null;
                      return groupedRoutines[day].map((routine, idx) => (
                        <tr key={routine.id} className="border-b border-slate-200">
                          {idx === 0 && (
                            <td 
                              rowSpan={groupedRoutines[day].length} 
                              className={`p-3 border font-bold ${currentTheme.text} ${currentTheme.light} align-middle`}
                            >
                              {dayTranslations[day]}
                            </td>
                          )}
                          <td className="p-3 border text-slate-800 font-medium">
                            {routine.start_time.slice(0, 5)} - {routine.end_time.slice(0, 5)}
                          </td>
                          <td className="p-3 border text-slate-800">
                            {routine.subjects?.name || '-'}
                          </td>
                          <td className="p-3 border text-slate-600">
                            {routine.teachers ? `${routine.teachers.first_name} ${routine.teachers.last_name}` : '-'}
                          </td>
                          <td className="p-3 border text-slate-600">
                            {routine.room_number || '-'}
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {template === 'compact' && days.map(day => {
              if (groupedRoutines[day].length === 0) return null;
              
              return (
                <div key={day} className="mb-4">
                  <div className={`flex items-center space-x-4 mb-2 border-b ${currentTheme.accent} pb-1`}>
                    <h3 className={`text-base font-bold ${currentTheme.text} w-24`}>
                      {dayTranslations[day]}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {groupedRoutines[day].map(routine => (
                      <div key={routine.id} className={`border ${currentTheme.accent} rounded p-2 bg-white flex flex-col justify-center min-w-[150px]`}>
                        <div className="text-xs font-bold text-slate-500 mb-1">
                          {routine.start_time.slice(0, 5)} - {routine.end_time.slice(0, 5)}
                        </div>
                        <div className={`text-sm font-bold ${currentTheme.text}`}>
                          {routine.subjects?.name || 'Subject Not Set'}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {routine.teachers ? `${routine.teachers.first_name} ${routine.teachers.last_name}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

          </div>
        ) : (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">এই জামাতের জন্য কোনো রুটিন পাওয়া যায়নি</p>
          </div>
        )}
      </div>
    </div>
  );
}
