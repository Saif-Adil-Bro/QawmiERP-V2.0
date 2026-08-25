const fs = require('fs');
let code = fs.readFileSync('app/dashboard/academic/certificates/CertificateClient.tsx', 'utf8');

const standardHeader = `<h1 className={\`text-4xl font-black \${currentTheme.text} mb-2 tracking-widest uppercase\`}>{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
            <p className="text-xl text-slate-600 mb-4">{madrasaInfo?.address || "Address"}</p>
            <h1 className={\`text-2xl font-bold text-slate-800 mb-2\`}>বিসমিল্লাহির রাহমানির রাহিম</h1>`;

code = code.replace(/<h1 className=\{\`text-3xl font-bold text-slate-800 mb-2\`\}>বিসমিল্লাহির রাহমানির রাহিম<\/h1>/, standardHeader);

// Let's check if there's a minimal template too
const minimalHeader = `<h1 className="text-3xl font-black text-slate-800 mb-1 uppercase tracking-widest">{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
            <p className="text-lg text-slate-500 mb-6">{madrasaInfo?.address || "Address"}</p>
            <h1 className="text-xl font-bold text-slate-700 mb-2">বিসমিল্লাহির রাহমানির রাহিম</h1>`;
code = code.replace(/<h1 className="text-xl font-bold text-slate-700 mb-2">বিসমিল্লাহির রাহমানির রাহিম<\/h1>/, minimalHeader);

fs.writeFileSync('app/dashboard/academic/certificates/CertificateClient.tsx', code);
