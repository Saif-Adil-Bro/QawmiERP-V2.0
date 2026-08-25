const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/[id]/marks/MarksEntryClient.tsx', 'utf8');

code = code.replace(
  `import { getExamResults, saveExamMarks } from "@/app/actions/exams";\nimport { getClassSubjects } from "@/app/actions/class_subjects";`,
  `import { getExamResults, saveExamMarks, getExamSubjects } from "@/app/actions/exams";\nimport { getClassSubjects } from "@/app/actions/class_subjects";`
);

code = code.replace(
  `  useEffect(() => {
    if (classId) {
      getClassSubjects(classId).then((data) => {
        setSubjects(data.map((item: any) => ({ id: item.subjects?.id, name: item.subjects?.name })));
        setSubjectName("");
        setStudents([]);
      });
    } else {
      setSubjects([]);
      setSubjectName("");
      setStudents([]);
    }
  }, [classId]);`,
  `  const [examSubjectsDetails, setExamSubjectsDetails] = useState<any[]>([]);

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
  }, [classId, examId]);`
);

code = code.replace(
  `    const data = await getExamResults(examId, classId, subjectName);
    setStudents(data);`,
  `    const data = await getExamResults(examId, classId, subjectName);
    
    // Auto-fill total marks if set in exam setup
    const setupInfo = examSubjectsDetails.find(s => s.subject_name === subjectName);
    const configuredTotal = setupInfo ? setupInfo.total_marks : 100;
    
    const studentsWithMarks = data.map((student: any) => ({
      ...student,
      total_marks: student.total_marks || configuredTotal
    }));
    
    setStudents(studentsWithMarks);`
);

fs.writeFileSync('app/dashboard/exams/[id]/marks/MarksEntryClient.tsx', code);
console.log('patched marks client');
