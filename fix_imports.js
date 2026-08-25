const fs = require('fs');

function replaceInFile(path, target, replacement) {
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace(target, replacement);
  fs.writeFileSync(path, code);
}

replaceInFile(
  'app/dashboard/exams/[id]/paper/page.tsx',
  `import { getSubjects } from "@/app/actions/academic";`,
  `import { getSubjects } from "@/app/actions/subjects";`
);
replaceInFile(
  'app/dashboard/exams/[id]/paper/page.tsx',
  `import { getMadrasaInfo } from "@/app/actions/tenant";`,
  `import { getMadrasaDetails as getMadrasaInfo } from "@/app/actions/tenant";`
);

replaceInFile(
  'app/dashboard/exams/[id]/routine/page.tsx',
  `import { getSubjects } from "@/app/actions/academic";`,
  `import { getSubjects } from "@/app/actions/subjects";`
);
replaceInFile(
  'app/dashboard/exams/[id]/routine/page.tsx',
  `import { getMadrasaInfo } from "@/app/actions/tenant";`,
  `import { getMadrasaDetails as getMadrasaInfo } from "@/app/actions/tenant";`
);

replaceInFile(
  'app/dashboard/exams/question-bank/page.tsx',
  `import { getSubjects } from "@/app/actions/academic";`,
  `import { getSubjects } from "@/app/actions/subjects";`
);

console.log("Imports fixed!");
