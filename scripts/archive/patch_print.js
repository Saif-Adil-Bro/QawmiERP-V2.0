const fs = require('fs');
let code = fs.readFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', 'utf8');

code = code.replace(
  `  return (
    <div className="space-y-6">`,
  `  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: \`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      \`}} />`
);

fs.writeFileSync('app/dashboard/exams/[id]/results/ExamResultsClient.tsx', code);
console.log('landscape print added');
