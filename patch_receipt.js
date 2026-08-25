const fs = require('fs');

const pagePath = 'app/dashboard/accounting/fees/[id]/receipt/page.tsx';
let pageCode = fs.readFileSync(pagePath, 'utf8');

pageCode = pageCode.replace(
  `import { getFeeWithReceiptNo } from "@/app/actions/accounting";`,
  `import { getFeeWithReceiptNo } from "@/app/actions/accounting";\nimport { getMadrasaInfo } from "@/lib/getMadrasaInfo";`
);

pageCode = pageCode.replace(
  `  if (!fee) {
    return notFound();
  }

  return <ReceiptClient fee={fee} />;`,
  `  if (!fee) {
    return notFound();
  }

  const madrasaInfo = await getMadrasaInfo();

  return <ReceiptClient fee={fee} madrasaInfo={madrasaInfo} />;`
);

fs.writeFileSync(pagePath, pageCode);

const clientPath = 'app/dashboard/accounting/fees/[id]/receipt/ReceiptClient.tsx';
let clientCode = fs.readFileSync(clientPath, 'utf8');

clientCode = clientCode.replace(
  `export default function ReceiptClient({ fee }: { fee: any }) {`,
  `export default function ReceiptClient({ fee, madrasaInfo }: { fee: any, madrasaInfo?: any }) {`
);

clientCode = clientCode.replace(
  `        <div className="text-center mb-8 pb-8 border-b border-slate-200">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">মানি রিসিট</h2>
          <p className="text-slate-500">রিসিট নং: <span className="font-mono text-slate-700 font-medium">{fee.receipt_no}</span></p>
        </div>`,
  `        <div className="text-center mb-8 pb-8 border-b border-slate-200 flex flex-col items-center">
          {madrasaInfo?.logo_url && (
            <img src={madrasaInfo.logo_url} alt="Logo" className="w-20 h-20 object-contain mb-3" />
          )}
          {madrasaInfo?.name && <h1 className="text-2xl font-bold text-slate-800">{madrasaInfo.name}</h1>}
          {madrasaInfo?.address && <p className="text-slate-600 mb-4">{madrasaInfo.address}</p>}
          <h2 className="text-xl font-bold text-slate-800 mt-2 bg-slate-100 inline-block px-4 py-1.5 rounded-full border border-slate-200">মানি রিসিট</h2>
          <p className="text-slate-500 mt-3">রিসিট নং: <span className="font-mono text-slate-700 font-medium">{fee.receipt_no}</span></p>
        </div>`
);

fs.writeFileSync(clientPath, clientCode);

