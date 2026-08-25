const fs = require('fs');

const path = 'lib/getMadrasaInfo.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `let madrasaInfo = { name: "Qawmi Madrasa", address: "Please update address", phone: "" };`,
  `let madrasaInfo = { name: "Qawmi Madrasa", address: "Please update address", phone: "", logo_url: "" };`
);

code = code.replace(
  `             name: fullMadrasa.name || madrasaInfo.name,
             address: fullMadrasa.address || madrasaInfo.address,
             phone: fullMadrasa.contact_phone || madrasaInfo.phone
           };`,
  `             name: fullMadrasa.name || madrasaInfo.name,
             address: fullMadrasa.address || madrasaInfo.address,
             phone: fullMadrasa.contact_phone || madrasaInfo.phone,
             logo_url: supabase.storage.from('logos').getPublicUrl(\`madrasa_logo_\${userDetails.madrasa_id}.png\`).data.publicUrl
           };`
);

code = code.replace(
  `             madrasaInfo.name = nameOnly.name || madrasaInfo.name;
           }`,
  `             madrasaInfo.name = nameOnly.name || madrasaInfo.name;
           }
           madrasaInfo.logo_url = supabase.storage.from('logos').getPublicUrl(\`madrasa_logo_\${userDetails.madrasa_id}.png\`).data.publicUrl;`
);

fs.writeFileSync(path, code);
