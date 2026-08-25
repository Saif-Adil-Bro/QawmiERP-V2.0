const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/page.tsx', 'utf8');

const target = `<Link
          href="/dashboard/exams/new"`;
const replacement = `<Link
          href="/dashboard/exams/question-bank"
          className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-100 transition flex items-center space-x-2"
        >
          <FileText className="w-4 h-4" />
          <span>প্রশ্নব্যাংক (Question Bank)</span>
        </Link>
        <Link
          href="/dashboard/exams/new"`;

code = code.replace(target, replacement);

fs.writeFileSync('app/dashboard/exams/page.tsx', code);
