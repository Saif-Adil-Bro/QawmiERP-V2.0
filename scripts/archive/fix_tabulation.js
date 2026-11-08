const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', 'utf8');

code = code.replace(
`                <th className="px-4 py-3 text-center print:border print:border-slate-300">সর্বমোট</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">প্রাপ্ত নম্বর</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">শতকরা</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">বিভাগ (Grade)</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {results.map((student, index) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition print:hover:bg-white">
                  <td className="px-4 py-3 text-center font-bold text-slate-900 print:border print:border-slate-300">{index + 1}</td>
                  <td className="px-4 py-3 print:border print:border-slate-300">{student.roll_number || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 print:border print:border-slate-300 whitespace-nowrap">
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
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 print:border print:border-slate-300">{student.totalObtained} / {student.totalMax}</td>
                  <td className="px-4 py-3 text-center print:border print:border-slate-300">{student.percentage}%</td>
                  <td className="px-4 py-3 text-center font-medium print:border print:border-slate-300">`,
`                <th className="px-4 py-3 text-center print:border print:border-slate-300">মোট প্রাপ্ত</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">শতকরা</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">বিভাগ</th>
                <th className="px-4 py-3 text-center print:border print:border-slate-300">জিপিএ (GPA)</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {results.map((student, index) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition print:hover:bg-white">
                  <td className="px-4 py-3 text-center font-bold text-slate-900 print:border print:border-slate-300">{index + 1}</td>
                  <td className="px-4 py-3 print:border print:border-slate-300">{student.roll_number || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 print:border print:border-slate-300 whitespace-nowrap">
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
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 print:border print:border-slate-300">{student.totalObtained} / {student.totalMax}</td>
                  <td className="px-4 py-3 text-center print:border print:border-slate-300">{student.percentage}%</td>
                  <td className="px-4 py-3 text-center font-medium print:border print:border-slate-300">`
);

// We need to add GPA logic
// To add GPA we can just map the percentage to GPA in the UI or add it to backend. Let's do it in the UI here.

code = code.replace(
  `{student.grade}
                    </span>
                  </td>
                </tr>`,
  `{student.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-indigo-700 print:border print:border-slate-300">
                    {
                      student.percentage >= 80 ? '5.00' :
                      student.percentage >= 70 ? '4.00' :
                      student.percentage >= 60 ? '3.50' :
                      student.percentage >= 50 ? '3.00' :
                      student.percentage >= 40 ? '2.00' :
                      student.percentage >= 33 ? '1.00' : '0.00'
                    }
                  </td>
                </tr>`
);

fs.writeFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', code);
console.log("fixed!");
