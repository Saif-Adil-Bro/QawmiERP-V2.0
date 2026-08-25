const fs = require('fs');

let pageCode = fs.readFileSync('app/dashboard/exams/[id]/results/page.tsx', 'utf8');

if (!pageCode.includes('getMadrasaInfo')) {
  pageCode = pageCode.replace(
    'import { getClasses } from "@/app/actions/students";',
    'import { getClasses } from "@/app/actions/students";\nimport { getMadrasaInfo } from "@/lib/getMadrasaInfo";'
  );

  pageCode = pageCode.replace(
    `  const [exam, classes] = await Promise.all([
    getExamById(examId),
    getClasses()
  ]);`,
    `  const [exam, classes, madrasaInfo] = await Promise.all([
    getExamById(examId),
    getClasses(),
    getMadrasaInfo()
  ]);`
  );

  pageCode = pageCode.replace(
    `<ExamResultsClient examId={examId} classes={classes} examTitle={exam.title} examYear={exam.year} />`,
    `<ExamResultsClient examId={examId} classes={classes} examTitle={exam.title} examYear={exam.year} madrasaInfo={madrasaInfo} />`
  );

  fs.writeFileSync('app/dashboard/exams/[id]/results/page.tsx', pageCode);
}

let clientCode = fs.readFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', 'utf8');

if (!clientCode.includes('madrasaInfo')) {
  clientCode = clientCode.replace(
    `  examTitle, 
  examYear 
}: { 
  examId: string, 
  classes: { id: string, name: string }[],
  examTitle: string,
  examYear: string
}) {`,
    `  examTitle, 
  examYear,
  madrasaInfo
}: { 
  examId: string, 
  classes: { id: string, name: string }[],
  examTitle: string,
  examYear: string,
  madrasaInfo?: any
}) {`
  );

  clientCode = clientCode.replace(
    `                    <div className="text-center mb-6 border-b pb-4">
                      <h2 className="text-xl font-bold text-slate-800">{examTitle} - {examYear}</h2>`,
    `                    <div className="text-center mb-6 border-b pb-4">
                      <h1 className="text-2xl font-bold text-slate-900 mb-1">{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
                      {(madrasaInfo?.address || madrasaInfo?.phone) && (
                        <p className="text-xs text-slate-500 mb-3">
                          {madrasaInfo?.address} {madrasaInfo?.phone ? \`| মোবাইল: \${madrasaInfo.phone}\` : ''}
                        </p>
                      )}
                      <h2 className="text-lg font-bold text-slate-700">{examTitle} - {examYear}</h2>`
  );

  fs.writeFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', clientCode);
}
console.log('patched exam results');
