const fs = require('fs');
let code = fs.readFileSync('app/dashboard/academic/certificates/CertificateClient.tsx', 'utf8');

code = code.replace(/export default function CertificateClient\(\{[\s\S]*?certificateType\s*\}: \{[\s\S]*?certificateType: string\s*\}\) \{/, 
  'export default function CertificateClient({ selectedStudent, certificateType, madrasaInfo }: { selectedStudent: any, certificateType: string, madrasaInfo?: {name: string, address: string, phone: string} }) {');

const quranHeader = `<h1 className={\`text-4xl font-black \${currentTheme.text} mb-2 tracking-widest\`}>{madrasaInfo?.name || "Qawmi Madrasa"}</h1>
            <p className="text-xl text-slate-600 mb-2">{madrasaInfo?.address || "Address"}</p>
            <h1 className={\`text-xl font-bold \${currentTheme.text} mb-2 tracking-widest\`}>বিসমিল্লাহির রাহমানির রাহিম</h1>`;

code = code.replace(/<h1 className=\{\`text-4xl font-black \$\{currentTheme.text\} mb-2 tracking-widest\`\}>বিসমিল্লাহির রাহমানির রাহিম<\/h1>/g, quranHeader);

fs.writeFileSync('app/dashboard/academic/certificates/CertificateClient.tsx', code);
