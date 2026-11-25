import { describe, expect, it } from "vitest";
import {
  computeRosterAttendanceTruth,
  resolveStudentClassName,
  is100PercentPresent,
  normalizeAttendanceStatus,
  computeAbsenceStreakAndMonthly,
} from "@/lib/attendance-truth";
import { isValidUuid } from "@/lib/audit-log";
import {
  normalizePhoneKey,
  normalizeBengaliTeacherName,
  resolveTeacherIdentity,
} from "@/lib/teacher-identity";
import { DEFAULT_ONLINE_DONATION_SETTINGS } from "@/lib/fundraising-types";
import { isHifzStudent } from "@/lib/hifz/read";
import { SyllabusProgressEngine, type Syllabus } from "@/lib/syllabus";

describe("FOLLOWUP4 regressions", () => {
  describe("N6 & N2: Attendance truth & 100% present rule", () => {
    const classMap = new Map<string, string>([
      ["cls-1", "মিযান"],
      ["cls-2", "নাহবেমীর"],
      ["cls-3", "হেদায়াতুন্নাহু"],
    ]);

    const students = Array.from({ length: 11 }, (_, idx) => ({
      id: `std-${idx + 1}`,
      first_name: `শিক্ষার্থী`,
      last_name: `${idx + 1}`,
      roll_number: String(idx + 1),
      class_id: idx < 4 ? "cls-1" : idx < 8 ? "cls-2" : "cls-3",
      status: "Active",
    }));

    it("computes present + absent + late + leave + unmarked === totalStudents", () => {
      const todayRows = [
        { student_id: "std-1", status: "PRESENT" },
        { student_id: "std-2", status: "ABSENT" },
        { student_id: "std-3", status: "ABSENT" },
      ];

      const truth = computeRosterAttendanceTruth(students, todayRows);

      expect(truth.totalStudents).toBe(11);
      expect(truth.presentCount).toBe(1);
      expect(truth.absentCount).toBe(2);
      expect(truth.lateCount).toBe(0);
      expect(truth.leaveCount).toBe(0);
      expect(truth.markedCount).toBe(3);
      expect(truth.unmarkedCount).toBe(8);
      expect(
        truth.presentCount +
          truth.absentCount +
          truth.lateCount +
          truth.leaveCount +
          truth.unmarkedCount
      ).toBe(truth.totalStudents);
      expect(truth.presentPercentage).toBe(Math.round((1 / 11) * 100));
    });

    it("resolves student class name from classMap or relations without returning N/A", () => {
      expect(
        resolveStudentClassName({ class_id: "cls-2" }, classMap)
      ).toBe("নাহবেমীর");
      expect(
        resolveStudentClassName({ classes: { name: "শরহে জামী" } }, classMap)
      ).toBe("শরহে জামী");
      expect(
        resolveStudentClassName({ class_id: "unknown" }, classMap)
      ).toBe("সাধারণ জামাত");
    });

    it("normalizes attendance status across case variations", () => {
      expect(normalizeAttendanceStatus("present")).toBe("Present");
      expect(normalizeAttendanceStatus("Absent")).toBe("Absent");
      expect(normalizeAttendanceStatus("LATE")).toBe("Late");
      expect(normalizeAttendanceStatus("leave")).toBe("Leave");
      expect(normalizeAttendanceStatus("")).toBe("Unmarked");
    });

    it("computes consecutive absence streak and monthly absence counts accurately", () => {
      const stats = computeAbsenceStreakAndMonthly(
        [
          { date: "2026-04-19", status: "ABSENT" },
          { date: "2026-04-18", status: "ABSENT" },
          { date: "2026-04-17", status: "PRESENT" },
          { date: "2026-04-10", status: "ABSENT" },
        ],
        "2026-04-19"
      );
      expect(stats.consecutiveAbsent).toBe(2);
      expect(stats.monthlyAbsent).toBe(3);
    });

    it("N2: is100PercentPresent returns false when 0 attendance records exist or present < total", () => {
      expect(is100PercentPresent({ total: 0, present: 0, absent: 0 })).toBe(false);
      expect(is100PercentPresent({ total: 5, present: 4, absent: 1 })).toBe(false);
      expect(is100PercentPresent({ total: 5, present: 5, absent: 0 })).toBe(true);
    });
  });

  describe("N9: Audit log UUID sanitization", () => {
    it("accepts valid v4 UUIDs and rejects legacy or string identifiers", () => {
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUuid("stf_01")).toBe(false);
      expect(isValidUuid("admin")).toBe(false);
      expect(isValidUuid(null)).toBe(false);
    });
  });

  describe("PB-06: Teacher identity resolution across Bangla phone digits, honorifics & duplicate rows", () => {
    it("normalizes phone numbers across Bangla digits and +880 prefixes", () => {
      expect(normalizePhoneKey("+৮৮০ ১৭১১-২২৩৩৪৪")).toBe("1711223344");
      expect(normalizePhoneKey("01711223344")).toBe("1711223344");
    });

    it("normalizes Bengali teacher names across honorifics and য়/য় variations", () => {
      expect(
        normalizeBengaliTeacherName("হযরত মাওলানা ফয়জুল্লাহ সাহেব")
      ).toBe(normalizeBengaliTeacherName("ফয়জুল্লাহ"));
    });

    it("collects all sibling duplicate teacher UUIDs into keys", () => {
      const teachers = [
        {
          id: "11111111-1111-4111-8111-111111111111",
          first_name: "মাওলানা",
          last_name: "ফয়জুল্লাহ",
          phone: "01711223344",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          first_name: "ফয়জুল্লাহ",
          last_name: "",
          phone: "+৮৮০১৭১১২২৩৩৪৪",
        },
      ];
      const staff = [
        {
          id: "stf_01",
          personal: { full_name_bn: "মাওলানা ফয়জুল্লাহ সাহেব" },
          contact: { phone: "০১৭১১২২৩৩৪৪" },
        },
      ];

      const identity = resolveTeacherIdentity(teachers, staff, {
        linkedId: "stf_01",
      });
      expect(identity.teacher?.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(identity.staff?.id).toBe("stf_01");
      expect(identity.keys).toContain("11111111-1111-4111-8111-111111111111");
      expect(identity.keys).toContain("22222222-2222-4222-8222-222222222222");
      expect(identity.keys).toContain("stf_01");
    });
  });

  describe("N7: Online donation gateway default status", () => {
    it("defaults gateway_enabled to false when no payment gateway is configured", () => {
      expect(DEFAULT_ONLINE_DONATION_SETTINGS.gateway_enabled).toBe(false);
    });
  });

  describe("PB-08: Hifz student detection", () => {
    it("matches Hifz/Hafez/Tahfiz classes and rejects non-Hifz classes like Noorani or Mizan", () => {
      expect(isHifzStudent({ class_name: "হিফজুল কুরআন" })).toBe(true);
      expect(isHifzStudent({ classes: { name: "তাহফিজ বিভাগ" } })).toBe(true);
      expect(isHifzStudent({ class_name: "নূরানী ১ম" })).toBe(false);
      expect(isHifzStudent({ class_name: "মিযান" })).toBe(false);
    });
  });

  describe("Polish (b): Syllabus progress engine forecast with 0 completed progress", () => {
    const baseSyllabus: Syllabus = {
      id: "syl-1",
      madrasa_id: "mad-1",
      class_id: "cls-1",
      class_name: "নাহবেমীর",
      subject_id: "sub-1",
      subject_name: "নাহবেমীর",
      book_name: "নাহবেমীর",
      total_pages: 120,
      start_page: 1,
      end_page: 120,
      current_page: 1,
      teacher_id: "t-1",
      teacher_name: "মাওলানা ফয়জুল্লাহ",
      academic_year: "২০২৬",
      start_date: "2026-01-01",
      end_date: "2026-11-30",
      chapters: [],
      revision_interval_days: 7,
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    it("does not fabricate a 2027 delay date when 0 pages and 0 topics are completed", () => {
      const metrics = SyllabusProgressEngine.calculateMetrics(
        baseSyllabus,
        [],
        [],
        [],
        "2026-04-19"
      );
      expect(metrics.completed_pages).toBe(0);
      expect(metrics.completed_topics).toBe(0);
      expect(metrics.forecast_completion_date).toBe("2026-11-30");
      expect(metrics.forecast_variance_days).toBe(0);
      expect(metrics.status).not.toBe("ON_TRACK");
    });
  });
});
