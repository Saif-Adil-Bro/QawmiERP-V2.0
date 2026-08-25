const fs = require('fs');

let code = fs.readFileSync('app/dashboard/academic/certificates/page.tsx', 'utf8');

code = code.replace(/import \{ Award \} from "lucide-react";\nimport PrintButton from "@\/app\/components\/PrintButton";/, 'import { Award } from "lucide-react";\nimport PrintButton from "@/app/components/PrintButton";\nimport CertificateClient from "./CertificateClient";');

const startPattern = /<div className="bg-white rounded-xl border shadow-sm">/;
const parts = code.split(startPattern);
if (parts.length > 1) {
  code = parts[0] + `<CertificateClient selectedStudent={selectedStudent} certificateType={certificateType} />\n    </div>\n  );\n}\n`;
}

fs.writeFileSync('app/dashboard/academic/certificates/page.tsx', code);
