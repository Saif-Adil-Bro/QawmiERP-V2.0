const fs = require('fs');

const filesToPatch = [
  'app/dashboard/academic/id-cards/page.tsx',
  'app/dashboard/academic/routine/page.tsx',
  'app/dashboard/academic/certificates/page.tsx'
];

filesToPatch.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  // Remove Promise wrap from searchParams to work across next versions with older react
  code = code.replace(/searchParams: Promise<\{ (.*?) \}>/g, 'searchParams: { $1 }');
  code = code.replace(/const params = await searchParams;/g, 'const params = searchParams;');
  fs.writeFileSync(file, code);
});
