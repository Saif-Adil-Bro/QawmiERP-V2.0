import { describe, it, expect, vi } from "vitest";
import {
  attendanceStats,
  holidayApplies,
  studentHomework,
  validDate,
  isLeaveFeedback,
  published,
} from "@/lib/portal/rules";
import {
  computeStudentExamSummary,
  rankSummaries,
  DEFAULT_GRADING_CONFIG,
} from "@/lib/exam-grading";
import { examReport, portalExams, studentExam } from "@/lib/portal/exams";
import { teacherScope, teacherStudents } from "@/lib/portal/identity";
import { portalSnapshot } from "@/lib/portal/snapshot";
import {
  getRoutineLiveStatus,
  getNextActiveAcademicDay,
} from "@/lib/routine-helper";
import { matchesVerifiedPayment } from "@/lib/payment-gateway-engine";
import { reconcilePayments, studentLedger } from "@/lib/portal/ledger";
import { rows } from "@/lib/portal/queries";
import { schedulePlacement, activatePlacements } from "@/lib/portal/promotion";
import { hydrateStudentWithMetadata } from "@/lib/sessions";

const { meta } = vi.hoisted(() => ({
  meta: {
    sessions: [
      {
        id: "old",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        is_current: false,
      },
      {
        id: "now",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        is_current: true,
      },
    ],
    enrollments: [
      { session_id: "old", student_id: "a", class_id: "c0", roll_number: "3" },
      { session_id: "old", student_id: "b", class_id: "c0", roll_number: "9" },
    ],
    published_exams: {
      oldEx: { is_published: true },
      exam: { is_published: true },
    },
    student_profiles: {
      a: {
        class_id: "c0",
        class_name: "old",
        section: "Old",
        fee_discount: 20,
      },
    },
    assignments: [],
    academic_holidays: [],
  },
}));
vi.mock("@/lib/sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sessions")>()),
  getMadrasaMetadata: async () => meta,
}));
vi.mock("@/lib/structured-config", () => ({
  getStructuredMadrasaSetting: async () => ({found: true, value: {exam: {is_locked: true}}}),
  getExamSettingsBundle: async () => ({
    gradingConfig: DEFAULT_GRADING_CONFIG,
    evaluationRules: { fail_policy: "compulsory_subject_fail" },
    compulsorySubjects: {},
  }),
}));
// Minimal PostgREST fixture: filters/pagination actually execute. No live database or keys.
function fixture() {
  const table: Record<string, any[]> = {
    students: [
      {
        id: "a",
        class_id: "c1",
        roll_number: "1",
        classes: { id: "c1", name: "New" },
      },
      {
        id: "b",
        class_id: "c0",
        roll_number: "2",
        classes: { id: "c0", name: "Old" },
      },
      { id: "other", class_id: "c1", madrasa_id: "B" },
    ],
    classes: [
      { id: "c0", name: "Old" },
      { id: "c1", name: "New" },
    ],
    teachers: [{ id: "teacher", email: "teacher@example.test" }],
    exams: [
      { id: "exam", start_date: "2026-05-01" },
      { id: "oldEx", start_date: "2025-05-01", status: "Published" },
    ],
    exam_settings: [
      {
        id: "p",
        scope_key: "oldEx",
        setting_key: "publish_info",
        setting_value: { is_published: false },
      },
    ],
    teacher_subjects: [
      {
        id: "ta",
        class_id: "c1",
        teacher_id: "teacher",
        subject_id: "s",
        subjects: { id: "s", name: "A" },
      },
    ],
    routines: [
      {
        id: "mine",
        teacher_id: "teacher",
        class_id: "c1",
        subject_id: "s",
        subjects: { name: "A" },
      },
      {
        id: "r1",
        teacher_id: null,
        class_id: "c1",
        subject_id: "s",
        day_of_week: "Monday",
        start_time: "08:00",
        subjects: { name: "A" },
      },
      {
        id: "r2",
        teacher_id: "otherTeacher",
        class_id: "c1",
        subject_id: "s",
        subjects: { name: "A" },
      },
    ],
    exam_subjects: [
      {
        id: "sub",
        exam_id: "exam",
        class_id: "c1",
        subject_name: "A",
        total_marks: 50,
        pass_marks: 15,
      },
      {
        id: "sub2",
        exam_id: "exam",
        class_id: "c1",
        subject_name: "B",
        total_marks: 100,
      },
    ],
    exam_results: [
      {
        id: "m1",
        exam_id: "exam",
        student_id: "a",
        subject_name: "A",
        total_marks: 50,
        marks_obtained: 0,
      },
      {
        id: "m2",
        exam_id: "exam",
        student_id: "a",
        subject_name: "B",
        marks_obtained: 79,
        total_marks: 100,
      },
      {
        id: "oa",
        exam_id: "oldEx",
        student_id: "a",
        subject_name: "Old",
        marks_obtained: 80,
        total_marks: 100,
      },
      {
        id: "ob",
        exam_id: "oldEx",
        student_id: "b",
        subject_name: "Old",
        marks_obtained: 80,
        total_marks: 100,
      },
    ],
    attendance: [
      { id: "ma", student_id: "a", date: "2026-06-01", status: "Present" },
      { id: "mb", student_id: "b", date: "2026-06-01", status: "Absent" },
    ],
    notices: [
      { id: "pub", is_active: true, target_audience: "All" },
      {
        id: "other-class",
        class_id: "c0",
        is_active: true,
        target_audience: "Students",
      },
      { id: "t", is_active: true, target_audience: "Teachers" },
      { id: "revoked", is_active: false, target_audience: "All" },
    ],
    student_fees: [
      { id: "bill", student_id: "a", due_amount: 50, payable_amount: 70 },
    ],
    fee_discount_waivers: [{ id: "discount", student_id: "a", value: 20 }],
    fee_payments: [
      {
        id: "paid",
        receipt_no: "MR-1",
        student_id: "a",
        total_amount_received: 20,
        status: "COMPLETED",
        fee_payment_allocations: [
          { student_fee_id: "bill", allocated_amount: 20 },
        ],
      },
      {
        id: "void",
        receipt_no: "MR-2",
        student_id: "a",
        status: "VOID",
        total_amount_received: 20,
      },
    ],
    fees: [
      { id: "l1", student_id: "a", receipt_no: "MR-1", amount: 20 },
      { id: "l2", student_id: "a", notes: "[রিসিট: MR-2]", amount: 20 },
      { id: "l3", student_id: "a", amount: 20 },
      { id: "l4", student_id: "a", amount: 20 },
    ],
  };
  const db = {
    from: (name: string) => {
      let data = (table[name] || []).map((r) => ({ madrasa_id: "A", ...r }));
      const q: any = {
        select: () => q,
        order: () => q,
        eq: (k: string, v: any) => {
          data = data.filter((r) => r[k] === v);
          return q;
        },
        in: (k: string, vs: any[]) => {
          data = data.filter((r) => vs.includes(r[k]));
          return q;
        },
        is: (k: string) => {
          data = data.filter((r) => r[k] == null);
          return q;
        },
        or: (filter: string) => {
          const ids = filter.split("class_id.in.(")[1].slice(0, -1).split(",");
          data = data.filter(
            (r) => r.class_id == null || ids.includes(r.class_id),
          );
          return q;
        },
        range: (a: number, b: number) =>
          Promise.resolve({ data: data.slice(a, b + 1), error: null }),
        limit: (n: number) =>
          Promise.resolve({ data: data.slice(0, n), error: null }),
      };
      return q;
    },
  };
  const i = (role: string, profile: any = {}) =>
    ({
      db,
      tenant: "A",
      user: { id: "user", email: "nobody@example.test" },
      userRow: {
        role,
        teacher_id: role === "teacher" ? "teacher" : undefined,
        student_id: "a",
      },
      perms: { roles: [role], profile, summary: { effectivePermissions: [] } },
    }) as any;
  return { db, i, table };
}
describe("Cross-portal parity", () => {
  it("uses stored current class, including null after leaving; never revives stale section/roll", () => {
    expect(
      hydrateStudentWithMetadata(
        { id: "a", class_id: null, roll_number: null },
        meta,
      ),
    ).toMatchObject({ class_id: "", roll_number: "", section: "" });
  });
  it("separates unposted, leave, late, and absent and rejects invalid calendar dates", () => {
    expect(attendanceStats([]).percentage).toBeNull();
    expect(
      attendanceStats(
        ["Present", "Late", "Absent", "Leave", "Draft"].map((status) => ({
          status,
        })),
      ),
    ).toMatchObject({ total: 4, percentage: 25 });
    expect(validDate("2026-02-30")).toBe(false);
  });
  it("does not invent records or display another class or student’s homework/holidays", () => {
    expect(
      holidayApplies(
        { applicable_to: "specific_classes", applicable_classes: ["x"] },
        [{ id: "c1" }],
      ),
    ).toBe(false);
    const base = { class_id: "c1", target_type: "CLASS", status: "ACTIVE" };
    expect(
      studentHomework(
        [
          { ...base, id: "asg-seed-1" },
          { ...base, id: "ok" },
          { ...base, id: "other", target_type: "STUDENT", student_id: "b" },
          { ...base, id: "archive", status: "ARCHIVED" },
        ] as any,
        { id: "a", class_id: "c1" },
      ).map((x) => x.id),
    ).toEqual(["ok"]);
  });
  it("uses real exam-time enrollment for a promoted pupil; identical Admin and Guardian merit", async () => {
    const { db, table } = fixture(),
      exam = { ...table.exams[1], is_published: true };
    const report = await examReport(db, "A", exam, meta),
      student = await studentExam(db, "A", exam, "a", meta);
    expect(report.find((s) => s.id === "a")).toMatchObject({
      class_id: "c0",
      roll_number: "3",
      totalObtained: 80,
    });
    expect(student.merit).toMatchObject({
      meritPosition: 1,
      totalCandidates: 2,
    });
    expect(student.summary).toEqual(report[0].summary);
    const flags = await portalExams(db, "A", meta);
    expect(flags.find((e) => e.id === "oldEx").is_published).toBe(false);
  });
  it("distinguishes zero from missing; ranks passing candidates 1,1,3 with failed entrants in denominator", () => {
    const defs = [
      { subject_name: "A", total_marks: 50, pass_marks: 15 },
      { subject_name: "B", total_marks: 100 },
    ];
    const summary = (n: number) =>
      computeStudentExamSummary(
        [
          { subject_name: "A", marks_obtained: n, total_marks: 50 },
          { subject_name: "B", marks_obtained: 70 },
        ],
        undefined,
        { examSubjects: defs },
      );
    const missing = computeStudentExamSummary(
      [{ subject_name: "A", marks_obtained: 0 }],
      undefined,
      { examSubjects: defs },
    );
    expect(missing.subjects.map((s) => [s.hasEntered, s.isFailed])).toEqual([
      [true, true],
      [false, false],
    ]);
    const rank = rankSummaries(
      [50, 50, 30, 0].map((n, i) => ({ id: String(i), summary: summary(n) })),
    );
    expect([...rank.ranks.values()]).toEqual([1, 1, 3]);
    expect(rank.totalCandidates).toBe(4);
  });
  it("rejects malformed Boolean publication, ordinary feedback and unverifiable gateway amounts", () => {
    const exam = { id: "exam", status: "Published" };
    expect(published({}, exam)).toBe(true);
    expect(published({ exam: { is_published: "false" } }, exam)).toBe(false);
    expect(isLeaveFeedback({ action_type: "GENERAL" })).toBe(false);
    expect(isLeaveFeedback({ category: "ছুটির আবেদন" })).toBe(true);
    const v = {
      is_valid: true,
      status: "VALID" as const,
      tran_id: "ref",
      val_id: "validation",
      currency: "BDT",
      amount: 75.5,
    };
    expect(matchesVerifiedPayment(v, "ref", 75.5, "validation")).toBe(true);
    for (const invalid of [
      { ...v, tran_id: "other" },
      { ...v, amount: 75.51 },
      { ...v, amount: 0 },
      { ...v, amount: NaN },
      { ...v, currency: "USD" },
    ])
      expect(matchesVerifiedPayment(invalid, "ref", 75.5, "validation")).toBe(
        false,
      );
    expect(
      reconcilePayments(
        [{ id: "p", receipt_no: "MR-1", status: "VOID" }],
        [
          {
            id: "legacy",
            amount: 60,
            notes: "[অনলাইন পেমেন্ট: MR-1 | Trx: old]",
          },
        ],
      ),
    ).toEqual([]);
  });
  it("holds a future promotion until activation; an amended exit removes the active class and section", () => {
    const m: any = {
      student_profiles: {
        a: { class_id: "old", section: "B", phone: "unchanged" },
      },
    };
    const plan = {
      id: "a",
      previous_class: "old",
      previous_roll: "3",
      class_id: "new",
      class_name: "New",
      roll_number: "2",
      student_status: "ACTIVE" as const,
    };
    schedulePlacement(m, "2027", plan);
    expect(m.student_profiles.a.class_id).toBe("old");
    schedulePlacement(m, "2027", {
      ...plan,
      class_id: null,
      class_name: null,
      roll_number: null,
      student_status: "GRADUATED",
    });
    expect(activatePlacements(m, "2027")).toEqual([
      {
        id: "a",
        previous_class: "old",
        previous_roll: "3",
        class_id: null,
        roll_number: null,
      },
    ]);
    expect(m.student_profiles.a).toMatchObject({
      student_status: "GRADUATED",
      section: "",
      phone: "unchanged",
    });
    expect(activatePlacements(m, "2027")).toEqual([]);
  });
  it("keeps a second class running during the first class’s holiday; adjacent periods do not overlap", () => {
    const monday = new Date("2026-11-16T02:30:00Z"); // Dhaka 08:30
    const rs = [
      {
        id: "a",
        class_id: "c1",
        day_of_week: "Monday",
        start_time: "08:00",
        end_time: "09:00",
      },
      {
        id: "b",
        class_id: "c2",
        day_of_week: "Monday",
        start_time: "08:00",
        end_time: "08:30",
      },
      {
        id: "c",
        class_id: "c2",
        day_of_week: "Monday",
        start_time: "08:30",
        end_time: "09:00",
      },
    ];
    const h = [{ start_date: "2026-11-16", portalClassIds: ["c1"] }];
    const status = getRoutineLiveStatus(rs, monday, h);
    expect(status.isHoliday).toBe(false);
    expect(status.currentClass?.id).toBe("c");
    expect(status.isCurrent(rs[0])).toBe(false);
    expect(status.isCurrent(rs[1])).toBe(false);
    expect(
      getNextActiveAcademicDay(rs, new Date("2026-11-15T02:30:00Z"), h)
        ?.totalClasses,
    ).toBe(2);
  });
  it("selects only linked siblings in tenant; invalid explicit selection never chooses a fallback", async () => {
    const { i } = fixture();
    const identity = i("guardian", { linkedStudentIds: ["b", "other"] });
    const data = await portalSnapshot(identity, "student", "b");
    expect(data?.students.map((x) => x.id)).toEqual(["a", "b"]);
    expect(data?.attendance.map((a) => a.student_id)).toEqual(["b"]);
    expect(data?.notices.map((n) => n.id)).toEqual(["pub", "other-class"]);
    expect(
      (await portalSnapshot(identity, "student", "other"))?.active_student,
    ).toBeNull();
    expect(await portalSnapshot(identity, "teacher")).toBeNull();
  });
  it("reconciles bills, waivers and allocations without merging independent equal-amount receipts or reviving a void", async () => {
    const { db } = fixture();
    const ledger = await studentLedger(db, "A", "a", meta);
    expect(ledger).toMatchObject({ total_paid: 60, total_due: 50 });
    expect(ledger.discounts[0].id).toBe("discount");
    expect(
      ledger.payments.find((p) => p.id === "paid").allocations[0]
        .allocated_amount,
    ).toBe(20);
  });
  it("scopes Teacher snapshot to the online entry roster, subject and directly assigned periods, not fees or classmates", async () => {
    const { i } = fixture();
    const identity = i("teacher");
    identity.perms.profile.assignedClassIds = ["c1"];
    const data = await portalSnapshot(identity, "teacher");
    expect(data?.routines.map((r) => r.id)).toEqual(["mine"]);
    expect(data?.exam_results.map((m) => m.id)).toEqual(["m1"]);
    expect(data?.exams.map(e => [e.id, e.is_locked])).toEqual([["exam", true], ["oldEx", false]]);
    expect(data?.fee_invoices).toEqual([]);
    expect(data?.students[0]).not.toHaveProperty("fee_discount");
    identity.perms.profile.assignedClassIds = [];
    identity.userRow.teacher_id = "unlinked";
    const scope = await teacherScope(identity);
    expect(await teacherStudents(identity, scope)).toEqual([]);
  });
  it("pages past server limits and treats errors other than an absent optional table as failures", async () => {
    const all = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const query = (err: any) => () => ({
      order: () => ({
        range: (s: number, e: number) => ({
          data: all.slice(s, e + 1),
          error: err,
        }),
      }),
    });
    expect(await rows(query(null))).toHaveLength(1001);
    await expect(
      rows(query({ code: "42501", message: "denied" }), true),
    ).rejects.toThrow();
    expect(await rows(query({ code: "42P01" }), true)).toEqual([]);
  });
});
