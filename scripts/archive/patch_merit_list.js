const fs = require('fs');

let pageCode = fs.readFileSync('app/dashboard/exams/[id]/merit-list/page.tsx', 'utf8');

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
  `<MeritListClient examId={examId} classes={classes} examTitle={exam.title} examYear={exam.year} />`,
  `<MeritListClient examId={examId} classes={classes} examTitle={exam.title} examYear={exam.year} madrasaInfo={madrasaInfo} />`
);

fs.writeFileSync('app/dashboard/exams/[id]/merit-list/page.tsx', pageCode);

let clientCode = fs.readFileSync('app/dashboard/exams/[id]/merit-list/MeritListClient.tsx', 'utf8');

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
  `      <div className="hidden print:block mb-8 text-center border-b-2 pb-4 border-indigo-900">
        <h2 className="text-2xl font-bold text-slate-900">{examTitle} - {examYear}</h2>`,
  `      <div className="hidden print:block mb-8 text-center border-b-2 pb-4 border-indigo-900">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
        {madrasaInfo?.address && <p className="text-sm text-slate-600 mb-1">{madrasaInfo.address}</p>}
        {madrasaInfo?.phone && <p className="text-sm text-slate-600 mb-4">মোবাইল: {madrasaInfo.phone}</p>}
        
        <h2 className="text-2xl font-bold text-slate-800">{examTitle} - {examYear}</h2>`
);

fs.writeFileSync('app/dashboard/exams/[id]/merit-list/MeritListClient.tsx', clientCode);
console.log('patched merit list');
