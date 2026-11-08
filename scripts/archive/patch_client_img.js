const fs = require('fs');

const path = 'app/dashboard/accounting/fees/[id]/receipt/ReceiptClient.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `<img src={madrasaInfo.logo_url} alt="Logo" className="w-20 h-20 object-contain mb-3" />`,
  `<img src={madrasaInfo.logo_url} alt="Logo" className="w-20 h-20 object-contain mb-3" onError={(e) => { e.currentTarget.style.display = 'none'; }} />`
);

fs.writeFileSync(path, code);
