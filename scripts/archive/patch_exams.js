const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/page.tsx', 'utf8');

const target = `                      <Link
                        href={\`/dashboard/exams/\${exam.id}/routine\`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                        title="পরীক্ষার রুটিন (Exam Routine)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        href={\`/dashboard/exams/\${exam.id}/routine\`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                        title="পরীক্ষার রুটিন (Exam Routine)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        href={\`/dashboard/exams/\${exam.id}/routine\`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                        title="পরীক্ষার রুটিন (Exam Routine)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
`;

const replacement = `                      <Link
                        href={\`/dashboard/exams/\${exam.id}/routine\`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                        title="পরীক্ষার রুটিন (Exam Routine)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('app/dashboard/exams/page.tsx', code);
    console.log("Patched successfully");
} else {
    console.log("Target not found");
}
