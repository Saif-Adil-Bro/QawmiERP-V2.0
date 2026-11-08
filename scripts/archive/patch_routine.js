const fs = require('fs');
let code = fs.readFileSync('app/dashboard/academic/routine/RoutineClient.tsx', 'utf8');

code = code.replace(/export default function RoutineClient\(\{[\s\S]*?className\s*\}: \{[\s\S]*?className\?: string\s*\}\) \{/, 
  'export default function RoutineClient({ routines, routineType, className, madrasaInfo }: { routines: any[], routineType: string, className?: string, madrasaInfo?: {name: string, address: string, phone: string} }) {');

const printHeader = `<div className="hidden print:block mb-6 border-b pb-4">
          <h1 className={\`text-3xl font-bold \${currentTheme.text} text-center uppercase tracking-wider\`}>{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
          <p className="text-center text-slate-500 mb-2">{madrasaInfo?.address || "Address"}</p>
          <h2 className={\`text-xl font-bold text-slate-800 text-center\`}>
            {routineType === 'Class' ? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'}
          </h2>`;

code = code.replace(/<div className="hidden print:block mb-6 border-b pb-4">[\s\S]*?<\/h2>/, printHeader);

fs.writeFileSync('app/dashboard/academic/routine/RoutineClient.tsx', code);
