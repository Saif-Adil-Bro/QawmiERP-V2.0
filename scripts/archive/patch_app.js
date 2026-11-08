const fs = require('fs');
let code = fs.readFileSync('app/layout.tsx', 'utf8');
if (!code.includes('export const dynamic')) {
  fs.writeFileSync('app/layout.tsx', 'export const dynamic = "force-dynamic";\n' + code);
}
console.log('Patched layout');
