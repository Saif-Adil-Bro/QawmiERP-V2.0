const fs = require('fs');
let code = fs.readFileSync('app/dashboard/academic/routine/RoutineClient.tsx', 'utf8');

const newHeader = `        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wider">{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
          <p className="text-sm text-slate-500 mb-2">{madrasaInfo?.address || ""}</p>
          <h2 className="text-lg font-bold text-slate-700">
            {routineType === 'Class' ? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'}
          </h2>`;

code = code.replace(/        <div>\s*<h2 className="text-2xl font-bold text-slate-800">\s*\{routineType === 'Class' \? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'\}\s*<\/h2>/, newHeader);

fs.writeFileSync('app/dashboard/academic/routine/RoutineClient.tsx', code);
