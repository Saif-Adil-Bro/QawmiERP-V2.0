const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/page.tsx', 'utf8');

code = code.replace(
  `import { Plus, ArrowLeft, PenTool, FileText, Printer, IdCard } from "lucide-react";`,
  `import { Plus, ArrowLeft, PenTool, FileText, Printer, IdCard, Trophy } from "lucide-react";`
);

code = code.replace(
  `                      <Link
                        href={\`/dashboard/exams/\${exam.id}/admit-cards\`}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200"
                        title="প্রবেশপত্র (Admit Cards)"
                      >
                        <IdCard className="w-4 h-4" />
                      </Link>
                    </td>`,
  `                      <Link
                        href={\`/dashboard/exams/\${exam.id}/admit-cards\`}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200"
                        title="প্রবেশপত্র (Admit Cards)"
                      >
                        <IdCard className="w-4 h-4" />
                      </Link>
                      <Link
                        href={\`/dashboard/exams/\${exam.id}/merit-list\`}
                        className="inline-flex items-center justify-center p-2 text-amber-600 hover:bg-amber-50 rounded-md transition border border-transparent hover:border-amber-200"
                        title="মেধাতালিকা (Merit List)"
                      >
                        <Trophy className="w-4 h-4" />
                      </Link>
                    </td>`
);

fs.writeFileSync('app/dashboard/exams/page.tsx', code);
console.log('patched page.tsx');
