const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/[id]/marks/MarksEntryClient.tsx', 'utf8');

code = code.replace(
  `  const handleMarksChange = (studentId: string, field: 'marks_obtained' | 'total_marks', value: string) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, [field]: value } : s
    ));
  };`,
  `  const handleMarksChange = (studentId: string, field: 'marks_obtained' | 'total_marks' | 'written_marks' | 'oral_marks' | 'tutorial_marks' | 'attendance_marks', value: string) => {
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
  };`
);

code = code.replace(
  `    const marksData = students
      .filter(s => s.marks_obtained !== '')
      .map(s => ({
        student_id: s.id,
        marks_obtained: Number(s.marks_obtained),
        total_marks: Number(s.total_marks || 100)
      }));`,
  `    const marksData = students
      .filter(s => s.marks_obtained !== '')
      .map(s => ({
        student_id: s.id,
        marks_obtained: Number(s.marks_obtained),
        total_marks: Number(s.total_marks || 100),
        written_marks: Number(s.written_marks) || 0,
        oral_marks: Number(s.oral_marks) || 0,
        tutorial_marks: Number(s.tutorial_marks) || 0,
        attendance_marks: Number(s.attendance_marks) || 0
      }));`
);

code = code.replace(
  `                <tr>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3">নাম</th>
                  <th className="px-4 py-3 w-32">মোট নম্বর</th>
                  <th className="px-4 py-3 w-32">প্রাপ্ত নম্বর</th>
                </tr>`,
  `                <tr>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3 min-w-[150px]">নাম</th>
                  <th className="px-4 py-3 w-28">মোট নম্বর</th>
                  <th className="px-4 py-3 w-28 text-orange-600" title="Written">লিখিত</th>
                  <th className="px-4 py-3 w-28 text-blue-600" title="Oral">মৌখিক</th>
                  <th className="px-4 py-3 w-28 text-purple-600" title="Tutorial">টিউটোরিয়াল</th>
                  <th className="px-4 py-3 w-28 text-green-600" title="Attendance">উপস্থিতি</th>
                  <th className="px-4 py-3 w-32 font-bold">প্রাপ্ত নম্বর</th>
                </tr>`
);

code = code.replace(
  `                    <td className="px-4 py-3">
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
                        value={student.marks_obtained}
                        onChange={(e) => handleMarksChange(student.id, 'marks_obtained', e.target.value)}
                        className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                        min="0"
                        placeholder="0"
                      />
                    </td>`,
  `                    <td className="px-4 py-3">
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
                    </td>`
);

fs.writeFileSync('app/dashboard/exams/[id]/marks/MarksEntryClient.tsx', code);
console.log('client patched');
