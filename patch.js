const fs = require('fs');
let code = fs.readFileSync('lib/getMadrasaInfo.ts', 'utf8');
code = code.replace(/phone/g, 'contact_phone');
code = code.replace(/madrasaInfo = { name: "Qawmi Madrasa", address: "Please update address", contact_phone: "" };/g, 'madrasaInfo = { name: "Qawmi Madrasa", address: "Please update address", phone: "" };');
code = code.replace(/madrasaInfo\.contact_phone/g, 'madrasaInfo.phone');
code = code.replace(/contact_phone: fullMadrasa.contact_phone/g, 'phone: fullMadrasa.contact_phone');
fs.writeFileSync('lib/getMadrasaInfo.ts', code);
