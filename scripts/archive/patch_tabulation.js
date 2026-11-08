const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', 'utf8');

code = code.replace(
`  const selectedClassName = classes.find(c => c.id === classId)?.name || '';`,
`  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  // Extract all unique subjects
  const allSubjects = new Set<string>();
  results.forEach(student => {
    student.marks?.forEach((m: any) => {
      if (m.subject_name) allSubjects.add(m.subject_name);
    });
  });
  const subjectList = Array.from(allSubjects);`
);

code = code.replace(
`                <th className="px-4 py-3 print:border print:border-slate-300">নাম</th>
                {!classId && <th className="px-4 py-3 print:border print:border-slate-300">ক্লাস</th>}
                <th className="px-4 py-3 text-center print:border print:border-slate-300">মোট নম্বর</th>`,
`                <th className="px-4 py-3 print:border print:border-slate-300">নাম</th>
                {!classId && <th className="px-4 py-3 print:border print:border-slate-300">ক্লাস</th>}
                {subjectList.map(sub => (
                  <th key={sub} className="px-4 py-3 text-center print:border print:border-slate-300 whitespace-nowrap">{sub}</th>
                ))}
                <th className="px-4 py-3 text-center print:border print:border-slate-300">সর্বমোট</th>`
);

code = code.replace(
`                  <td className="px-4 py-3 font-medium text-slate-900 print:border print:border-slate-300">
                    {student.first_name} {student.last_name}
                  </td>
                  {!classId && <td className="px-4 py-3 print:border print:border-slate-300">{student.class_name}</td>}
                  <td className="px-4 py-3 text-center print:border print:border-slate-300">{student.totalMax}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 print:border print:border-slate-300">{student.totalObtained}</td>`,
`                  <td className="px-4 py-3 font-medium text-slate-900 print:border print:border-slate-300 whitespace-nowrap">
                    {student.first_name} {student.last_name}
                  </td>
                  {!classId && <td className="px-4 py-3 print:border print:border-slate-300">{student.class_name}</td>}
                  {subjectList.map(sub => {
                    const markObj = student.marks?.find((m: any) => m.subject_name === sub);
                    return (
                      <td key={sub} className="px-4 py-3 text-center print:border print:border-slate-300">
                        {markObj ? markObj.marks_obtained : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 print:border print:border-slate-300">{student.totalObtained} / {student.totalMax}</td>`
);

fs.writeFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', code);
console.log("patched!");
