"use client";

import { useState, useEffect } from "react";
import { getExamResults, saveExamMarks, getExamSubjects } from "@/app/actions/exams";
import { getClassSubjects } from "@/app/actions/class_subjects";

export default function MarksEntryClient({ examId, classes }: { examId: string, classes: { id: string, name: string }[] }) {
  const [classId, setClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [subjects, setSubjects] = useState<{ id: string, name: string }[]>([]);

  const [examSubjectsDetails, setExamSubjectsDetails] = useState<any[]>([]);

  useEffect(() => {
    if (classId) {
      // Fetch both standard class subjects and exam-specific setup
      Promise.all([
        getClassSubjects(classId),
        getExamSubjects(examId, classId)
      ]).then(([classSubjData, examSubjData]) => {
        let finalSubjects = [];
        if (examSubjData && examSubjData.length > 0) {
          finalSubjects = examSubjData.map((s: any) => ({ id: s.id, name: s.subject_name }));
          setExamSubjectsDetails(examSubjData);
        } else {
          finalSubjects = classSubjData.map((item: any) => ({ id: item.subjects?.id, name: item.subjects?.name }));
          setExamSubjectsDetails([]);
        }
        setSubjects(finalSubjects);
        setSubjectName("");
        setStudents([]);
      });
    } else {
      setSubjects([]);
      setExamSubjectsDetails([]);
      setSubjectName("");
      setStudents([]);
    }
  }, [classId, examId]);

  const loadStudents = async () => {
    if (!classId || !subjectName) {
      alert("ক্লাস এবং বিষয়ের নাম নির্বাচন করুন।");
      return;
    }
    setLoading(true);
    setMessage(null);
    const data = await getExamResults(examId, classId, subjectName);
    
    // Auto-fill total marks if set in exam setup
    const setupInfo = examSubjectsDetails.find(s => s.subject_name === subjectName);
    const configuredTotal = setupInfo ? setupInfo.total_marks : 100;
    
    const studentsWithMarks = data.map((student: any) => ({
      ...student,
      total_marks: student.total_marks || configuredTotal
    }));
    
    setStudents(studentsWithMarks);
    setLoading(false);
  };

  const handleMarksChange = (studentId: string, field: 'marks_obtained' | 'total_marks' | 'written_marks' | 'oral_marks' | 'tutorial_marks' | 'attendance_marks', value: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const updatedStudent = { ...s, [field]: value };
        if (field !== 'marks_obtained' && field !== 'total_marks') {
           const written = Number(updatedStudent.written_marks) || 0;
           const oral = Number(updatedStudent.oral_marks) || 0;
           const tutorial = Number(updatedStudent.tutorial_marks) || 0;
           const attendance = Number(updatedStudent.attendance_marks) || 0;
           updatedStudent.marks_obtained = (written + oral + tutorial + attendance).toString();
        }
        return updatedStudent;
      }
      return s;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    // validation
    const invalid = students.some(s => s.marks_obtained !== '' && Number(s.marks_obtained) > Number(s.total_marks));
    if (invalid) {
      setMessage({ type: 'error', text: 'প্রাপ্ত নম্বর মোট নম্বরের চেয়ে বেশি হতে পারে না।' });
      setSaving(false);
      return;
    }

    const marksData = students
      .filter(s => s.marks_obtained !== '')
      .map(s => ({
        student_id: s.id,
        marks_obtained: Number(s.marks_obtained),
        total_marks: Number(s.total_marks || 100),
        written_marks: Number(s.written_marks) || 0,
        oral_marks: Number(s.oral_marks) || 0,
        tutorial_marks: Number(s.tutorial_marks) || 0,
        attendance_marks: Number(s.attendance_marks) || 0
      }));

    if (marksData.length === 0) {
      setMessage({ type: 'error', text: 'অন্তত একজন শিক্ষার্থীর নম্বর এন্ট্রি করুন।' });
      setSaving(false);
      return;
    }

    const result = await saveExamMarks(examId, subjectName, marksData);
    
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'নম্বর সফলভাবে সেভ করা হয়েছে!' });
      setTimeout(() => setMessage(null), 3000);
    }
    setSaving(false);
  };

  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস</label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="">নির্বাচন করুন</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">বিষয়</label>
          <select 
            value={subjectName}
            onChange={(e) => { setSubjectName(e.target.value); setStudents([]); }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            disabled={!classId}
          >
            <option value="">নির্বাচন করুন</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-1/3">
          <button 
            onClick={loadStudents}
            disabled={!classId || !subjectName || loading}
            className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition disabled:opacity-50 font-medium shadow-sm"
          >
            {loading ? "খুঁজছি..." : "শিক্ষার্থী খুঁজুন"}
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">শিক্ষার্থীদের তালিকা ({selectedClassName} - {subjectName})</h3>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium"
            >
              {saving ? "সেভ হচ্ছে..." : "সব সেভ করুন"}
            </button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b">
                <tr>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3 min-w-[150px]">নাম</th>
                  <th className="px-4 py-3 w-28">মোট নম্বর</th>
                  <th className="px-4 py-3 w-28 text-orange-600" title="Written">লিখিত</th>
                  <th className="px-4 py-3 w-28 text-blue-600" title="Oral">মৌখিক</th>
                  <th className="px-4 py-3 w-28 text-purple-600" title="Tutorial">টিউটোরিয়াল</th>
                  <th className="px-4 py-3 w-28 text-green-600" title="Attendance">উপস্থিতি</th>
                  <th className="px-4 py-3 w-32 font-bold">প্রাপ্ত নম্বর</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600 bg-white">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">{student.roll_number || '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.total_marks}
                        onChange={(e) => handleMarksChange(student.id, 'total_marks', e.target.value)}
                        className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.written_marks}
                        onChange={(e) => handleMarksChange(student.id, 'written_marks', e.target.value)}
                        className="w-full px-2 py-1.5 border border-orange-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-orange-50/30"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.oral_marks}
                        onChange={(e) => handleMarksChange(student.id, 'oral_marks', e.target.value)}
                        className="w-full px-2 py-1.5 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50/30"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.tutorial_marks}
                        onChange={(e) => handleMarksChange(student.id, 'tutorial_marks', e.target.value)}
                        className="w-full px-2 py-1.5 border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-purple-50/30"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.attendance_marks}
                        onChange={(e) => handleMarksChange(student.id, 'attendance_marks', e.target.value)}
                        className="w-full px-2 py-1.5 border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500 bg-green-50/30"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={student.marks_obtained}
                        onChange={(e) => handleMarksChange(student.id, 'marks_obtained', e.target.value)}
                        className="w-full px-2 py-1.5 border-2 border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold bg-slate-50"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
