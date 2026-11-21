import { afterEach, describe, expect, it, vi } from "vitest";
import {
  statusLabel,
  severityLabel,
  guardianMessage,
  urgent,
  healthStats,
  recentRecovery,
  displayTime,
  dialable,
  filterCases,
  searchStudent,
  type HealthCase,
  type StaffCase,
} from "@/lib/student-health/model";
import { sealCase, openCase } from "@/lib/student-health/sealed";
import { hasSmsReceipt } from "@/lib/sms-gateway";
import {
  normalizeWidgetConfigs,
  filterBridgeDataByPermissions,
} from "@/lib/widgets/registry";
const at = "2026-11-17T18:05:00.000Z";
const row: HealthCase = {
  id: "case",
  madrasa_id: "tenant",
  student_id: "child",
  class_id: null,
  illness_type: "জ্বর",
  severity: "critical",
  status: "under_treatment",
  symptoms: "private symptoms",
  doctor_or_hospital: "private doctor",
  treatment_notes: "private care",
  boarding_diet_note: null,
  reported_at: at,
  updated_at: at,
  recovered_at: null,
  guardian_notified_at: null,
  guardian_acknowledged_at: null,
  reported_by: "staff",
  timeline: [],
};
const student = {
  id: "child",
  name: "করিম",
  class_id: "jam",
  class_name: "জামাত",
  roll_number: "15",
  student_id_code: "ST-002",
  guardian_name: "",
  photo_url: "",
  parent_phone: "",
};
afterEach(() => vi.unstubAllEnvs());
describe("শিক্ষার্থীর স্বাস্থ্য নথি", () => {
  it("formats all clinical states in Bangla and displays Dhaka local time", () => {
    expect(Object.values(statusLabel)).toEqual([
      "পর্যবেক্ষণে",
      "চিকিৎসাধীন",
      "হাসপাতালে ভর্তি",
      "বাড়িতে বিশ্রাম",
      "সুস্থ",
    ]);
    expect(Object.values(severityLabel)).toEqual([
      "মৃদু",
      "মাঝারি",
      "গুরুতর",
      "অতি জরুরি",
    ]);
    expect(displayTime(at)).toContain("১৮");
    expect(dialable("+৮৮০ ১৭১২-৩৪৫৬৭৮")).toBe("+8801712345678");
    expect(dialable("javascript:alert(1)")).toBe("");
  });
  it("counts unique active, urgent, uncontacted and Dhaka-today recoveries; priority does not revive recovered cases", () => {
    const recovered = {
      ...row,
      status: "recovered" as const,
      recovered_at: at,
    };
    expect(
      healthStats(
        [
          row,
          { ...row, id: "second" },
          {
            ...row,
            status: "hospitalized",
            severity: "mild",
            student_id: "B",
            guardian_acknowledged_at: at,
          },
          recovered,
        ],
        new Date("2026-11-18T08:00:00Z"),
      ),
    ).toEqual({ active: 2, urgent: 2, recovered: 1, pending: 1 });
    expect(urgent(recovered)).toBe(false);
    expect(recentRecovery(recovered, Date.parse(at) + 47 * 3600_000)).toBe(
      true,
    );
    expect(recentRecovery(recovered, Date.parse(at) + 48 * 3600_000)).toBe(
      false,
    );
  });
  it("templates request prompt contact/pickup for urgent cases, reassure mild/moderate and send good news on recovery", () => {
    for (const severity of ["severe", "critical"] as const)
      expect(
        guardianMessage(student.name, "জ্বর", { ...row, severity }),
      ).toContain("নিতে আসার");
    for (const severity of ["mild", "moderate"] as const)
      expect(
        guardianMessage(student.name, "জ্বর", { ...row, severity }),
      ).toContain("খোঁজ রাখছি");
    const m = guardianMessage(student.name, "জ্বর", {
      ...row,
      status: "recovered",
    });
    expect(m).toContain("আলহামদুলিল্লাহ, করিম এখন সুস্থ");
    expect(m).not.toContain("নিতে আসার");
  });
  it("filters on class, state, severity, roll, ID and Bangla name/digits", () => {
    const all: StaffCase[] = [{ ...row, student }];
    for (const search of ["১৫", "st-০০২", "করিম"])
      expect(
        filterCases(all, {
          search,
          classId: "jam",
          status: "urgent",
          severity: "critical",
        }),
      ).toEqual(all);
    expect(searchStudent(student, "অন্য")).toBe(false);
    expect(filterCases(all, { classId: "other" })).toEqual([]);
    expect(filterCases(all, { status: "recovered" })).toEqual([]);
  });
  it("registers an enabled half-size native widget; old configurations gain it and plugin bridge has no clinical data", () => {
    const w = normalizeWidgetConfigs([]).find(
      (w) => w.id === "builtin-sick-students",
    )!;
    expect(w).toMatchObject({
      enabled: true,
      type: "builtin",
      size: "half",
      title: "অসুস্থ শিক্ষার্থী ও স্বাস্থ্য আপডেট",
    });
    expect(
      normalizeWidgetConfigs([{ ...w, enabled: false }]).find(
        (v) => v.id === w.id,
      )?.enabled,
    ).toBe(false);
    expect(
      filterBridgeDataByPermissions({ ...row, studentsCount: 3 }, [
        "students.read",
      ]),
    ).not.toHaveProperty("symptoms");
  });
  it("legacy setting is encrypted/authenticated per tenant, child and record, even for identical plaintext", () => {
    vi.stubEnv("STUDENT_HEALTH_STORAGE_KEY", "only-used-in-test");
    const a = sealCase(row),
      b = sealCase(row);
    for (const needle of [
      "private care",
      "private doctor",
      "private symptoms",
      "জ্বর",
      '"student_id"',
    ])
      expect(JSON.stringify(a)).not.toContain(needle);
    expect(a.iv).not.toBe(b.iv);
    expect(openCase("tenant", "case", a)).toEqual(row);
    for (const [t, k, v] of [
      ["other", "case", a],
      ["tenant", "wrong", a],
      ["tenant", "case", { ...a, child: "another" }],
    ] as const)
      expect(() => openCase(t, k, v)).toThrow();
  });
  it("does not treat ambiguous HTTP-200 provider replies, numeric errors or simulated responses as sent", () => {
    for (const text of [
      "1007",
      "Invalid key",
      '{"success":false}',
      '{"response_code":1004}',
      "{}",
      "simulated",
      "",
    ])
      expect(hasSmsReceipt(text)).toBe(false);
    for (const text of [
      "1001",
      "54321987",
      "Ok: queued",
      '{"response_code":202}',
      '{"success":true}',
    ])
      expect(hasSmsReceipt(text)).toBe(true);
  });
});
