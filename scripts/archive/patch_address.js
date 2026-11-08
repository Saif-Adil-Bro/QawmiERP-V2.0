const fs = require('fs');
let code = fs.readFileSync('app/dashboard/academic/id-cards/IdCardClient.tsx', 'utf8');

code = code.replace('<p className="text-[10px] opacity-80">মাদরাসা ম্যানেজমেন্ট</p>', '<p className="text-[10px] opacity-80">{madrasaInfo?.address || "মাদরাসা ম্যানেজমেন্ট"}</p>');
code = code.replace('<p className="text-[8px] text-slate-500 uppercase">Identity Card</p>', '<p className="text-[8px] text-slate-500 uppercase">{madrasaInfo?.address || "Identity Card"}</p>');
code = code.replace('<div className="w-full border-b-2 border-slate-100 my-2"></div>', '<p className="text-[8px] text-center text-slate-500">{madrasaInfo?.address}</p><div className="w-full border-b-2 border-slate-100 my-2"></div>');

fs.writeFileSync('app/dashboard/academic/id-cards/IdCardClient.tsx', code);
