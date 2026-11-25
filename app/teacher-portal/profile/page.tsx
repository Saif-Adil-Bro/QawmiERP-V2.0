import { webTeacher, webIdentity, teacherScope, hasRole } from "@/lib/portal/identity";
import { rows } from "@/lib/portal/queries";
import TeacherProfileClient from "./TeacherProfileClient";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const t = await webTeacher();
  const i = t?.i || (await webIdentity());
  const scope =
    t?.scope ||
    (i && hasRole(i, ["super_admin", "admin", "muhtamim"])
      ? await teacherScope(i)
      : null);

  if (!i || !scope) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm font-bold text-slate-700">প্রোফাইল তথ্য লোড করা যায়নি।</p>
      </div>
    );
  }

  const meta = scope.meta || {};
  const teacherId = scope.teacher?.id || "";
  const staffId = scope.staff?.id || "";
  const keys = new Set(
    [
      teacherId,
      staffId,
      scope.staff?.legacy_id,
      i.user?.id,
      ...(Array.isArray(scope.keys) ? scope.keys : []),
    ].filter(Boolean)
  );
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidKeys = Array.from(keys).filter((k) => UUID_RE.test(String(k)));
  const teacherName = scope.display.name;

  // 1. Salary & Payslip records for this teacher
  const allSalaryPayments: any[] =
    meta.salary_payments || meta.staff_salary_records || meta.payroll_records || [];
  const salaryRecords = allSalaryPayments.filter((rec: any) => {
    if (rec.staff_id && keys.has(rec.staff_id)) return true;
    if (rec.teacher_id && keys.has(rec.teacher_id)) return true;
    if (
      rec.staff_name &&
      teacherName &&
      String(rec.staff_name).trim() === String(teacherName).trim()
    ) {
      return true;
    }
    return false;
  });

  const baseSalary = Number(
    scope.staff?.salary?.basic_salary ??
      scope.staff?.salary?.gross_salary ??
      scope.staff?.employment?.basic_salary ??
      scope.teacher?.salary ??
      0
  );
  const houseAllowance = Number(scope.staff?.salary?.house_rent ?? 0);
  const medicalAllowance = Number(scope.staff?.salary?.medical_allowance ?? 0);
  const transportAllowance = Number(scope.staff?.salary?.transport_allowance ?? 0);
  const foodAllowance = Number(scope.staff?.salary?.food_allowance ?? 0);
  const totalGrossSalary =
    Number(scope.staff?.salary?.gross_salary || 0) ||
    baseSalary + houseAllowance + medicalAllowance + transportAllowance + foodAllowance;

  // 2. Library records for this teacher
  const metaLoans: any[] =
    meta.library_loans || meta.book_issues || meta.library?.issues || [];
  const filteredMetaLoans = metaLoans.filter((loan: any) => {
    if (loan.borrower_id && keys.has(loan.borrower_id)) return true;
    if (loan.teacher_id && keys.has(loan.teacher_id)) return true;
    if (loan.staff_id && keys.has(loan.staff_id)) return true;
    if (
      (loan.borrower_name || loan.teacher_name) &&
      teacherName &&
      String(loan.borrower_name || loan.teacher_name).trim() === String(teacherName).trim()
    ) {
      return true;
    }
    return false;
  });

  let sqlLoans: any[] = [];
  if (uuidKeys.length > 0) {
    try {
      const { data: loanData, error: loanError } = await i.db
        .from("borrow_records")
        .select("id, book_id, issue_date, due_date, return_date, status, books(title, author)")
        .eq("madrasa_id", i.tenant)
        .in("teacher_id", uuidKeys);
      if (!loanError && Array.isArray(loanData)) {
        sqlLoans = loanData;
      }
    } catch {
      sqlLoans = [];
    }
  }

  const libraryRecords = [
    ...filteredMetaLoans.map((l: any, idx: number) => ({
      id: l.id || `meta_loan_${idx}`,
      book_title: l.book_title || l.title || l.book_name || "কিতাব",
      author: l.author || "",
      issue_date: l.issue_date || l.borrowed_at || l.created_at?.slice(0, 10) || "—",
      due_date: l.due_date || "—",
      return_date: l.return_date || null,
      status: l.status || (l.return_date ? "RETURNED" : "BORROWED"),
    })),
    ...sqlLoans.map((l: any) => ({
      id: l.id,
      book_title: l.books?.title || "কিতাব",
      author: l.books?.author || "",
      issue_date: l.issue_date || "—",
      due_date: l.due_date || "—",
      return_date: l.return_date || null,
      status: l.status || "BORROWED",
    })),
  ];

  const profileData = {
    name: scope.display.name,
    designation: scope.display.designation,
    email: i.user?.email || scope.teacher?.email || scope.staff?.contact?.email || "",
    phone: scope.teacher?.phone || scope.staff?.contact?.phone || i.userRow?.phone || "",
    staffCode:
      scope.staff?.staff_id_code ||
      scope.staff?.employment?.staff_id_code ||
      scope.teacher?.teacher_code ||
      "",
    joiningDate:
      scope.staff?.employment?.joining_date ||
      scope.teacher?.joining_date ||
      scope.teacher?.created_at?.slice(0, 10) ||
      "",
    department: scope.staff?.employment?.department || "তালীমাত (শিক্ষা বিভাগ)",
    bloodGroup: scope.staff?.personal?.blood_group || "",
    address:
      scope.staff?.contact?.present_address ||
      scope.staff?.contact?.permanent_address ||
      scope.teacher?.address ||
      "",
    inChargeClasses: scope.inCharge.map((c: any) => ({ id: c.id, name: c.name })),
    assignedSubjects: scope.assignments.map((a: any) => ({
      id: a.id,
      class_name: a.classes?.name || "জামাত",
      subject_name: a.subjects?.name || "কিতাব",
      subject_code: a.subjects?.code || "",
    })),
    salaryStructure: {
      baseSalary,
      houseAllowance,
      medicalAllowance,
      transportAllowance,
      foodAllowance,
      totalGrossSalary,
    },
    salaryRecords,
    libraryRecords,
  };

  return <TeacherProfileClient profile={profileData} />;
}
