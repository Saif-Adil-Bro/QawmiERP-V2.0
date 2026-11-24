import { describe, it, expect, beforeEach } from "vitest";
import {
  mergeAndDedupeSubjectCatalog,
  normalizeSubjectKey,
  type SubjectCatalogRow,
} from "@/lib/subject-catalog";
import {
  acquireSaveGuard,
  hasActiveSaveGuards,
} from "@/lib/save-guard";
import {
  buildAttendanceSavePayload,
  computeSavedAttendanceSummary,
} from "@/lib/student-attendance-view";

describe("FOLLOWUP3 Regressions — S1, S2, S3", () => {
  describe("S1 + R2: Subject Catalog Non-Destructive Merge, Dedup & Code Uniqueness", () => {
    it("restores all seeded subjects alongside current madrasa's 2 rows without losing any subject or FK IDs", () => {
      const seedTenant = "madrasa-seed-001";
      const currentTenant = "madrasa-live-002";

      const seedCatalog: SubjectCatalogRow[] = [
        { id: "sub-ampara", madrasa_id: seedTenant, name: "আমপারা", code: "AMP" },
        { id: "sub-qaida", madrasa_id: seedTenant, name: "ক্বায়েদা", code: "QAI" },
        { id: "sub-nazera", madrasa_id: seedTenant, name: "কুরআন (নাজেরা)", code: "NAZ" },
        { id: "sub-hifz", madrasa_id: seedTenant, name: "কুরআন (হিফজ)", code: "HIF" },
        { id: "sub-tajweed", madrasa_id: seedTenant, name: "তাজবীদ", code: "TAJ" },
        { id: "sub-fiqh", madrasa_id: seedTenant, name: "ফিকহ", code: "FIQ" },
        { id: "sub-bangla", madrasa_id: seedTenant, name: "বাংলা", code: "BAN" },
        { id: "sub-gonit-assigned", madrasa_id: seedTenant, name: "গণিত", code: "MAT" },
        { id: "sub-gen-math-dup", madrasa_id: seedTenant, name: "সাধারণ গণিত", code: "MTH" },
        { id: "sub-basic-eng", madrasa_id: seedTenant, name: "বেসিক ইংলিশ", code: "ENG" },
        { id: "sub-eng-dup", madrasa_id: seedTenant, name: "English", code: "ENG" },
        { id: "sub-prac-1", madrasa_id: seedTenant, name: "Practical", code: "PRC" },
        { id: "sub-prac-2", madrasa_id: seedTenant, name: "প্র্যাকটিকাল (আমলী)", code: "PRC" },
        { id: "sub-nah-kaf-combined", madrasa_id: seedTenant, name: "নাহবেমীর ও কাফিয়া", code: "NAH" },
        { id: "sub-urdu", madrasa_id: seedTenant, name: "উর্দু ও ফার্সি", code: "URD" },
        { id: "sub-mizan", madrasa_id: seedTenant, name: "মিযানুস সরফ", code: "MIZ" },
        { id: "sub-masayel", madrasa_id: seedTenant, name: "মাসায়েল", code: "MAS" },
        { id: "sub-hadith", madrasa_id: seedTenant, name: "হাদিস", code: "HAD" },
        { id: "sub-jalalain", madrasa_id: seedTenant, name: "তাফসীরে জালালাইন শরীফ", code: "JAL" },
        { id: "sub-bukhari", madrasa_id: seedTenant, name: "সহীহ বুখারী শরীফ", code: "BUK" },
        { id: "sub-arabic-lit", madrasa_id: seedTenant, name: "আরবি সাহিত্য", code: "ARB" },
        { id: "sub-seerah", madrasa_id: seedTenant, name: "সীরাত ও ইতিহাস", code: "SIR" },
        { id: "sub-aqaid", madrasa_id: seedTenant, name: "আকাইদ ও ফিকহ", code: "AQA" },
        { id: "sub-hidaya", madrasa_id: seedTenant, name: "আল-হিদায়াহ", code: "HID" },
        { id: "sub-balagat", madrasa_id: seedTenant, name: "ইলমুল বালাগাত", code: "BAL" },
        { id: "sub-mantiq", madrasa_id: seedTenant, name: "ইলমুল মানতিক", code: "MAN" },
      ];

      // Current tenant only had 2 auto-inserted rows from Round 2
      const currentScoped: SubjectCatalogRow[] = [
        { id: "sub-nah-own", madrasa_id: currentTenant, name: "নাহবেমীর", code: "NAH" },
        { id: "sub-kaf-own", madrasa_id: currentTenant, name: "কাফিয়া", code: "KAF" },
      ];

      // Assigned in Hifz & Noorani 2nd class_subjects
      const assignedIds = [
        "sub-tajweed",
        "sub-hifz",
        "sub-nazera",
        "sub-gonit-assigned",
        "sub-bangla",
        "sub-ampara",
      ];

      const catalog = mergeAndDedupeSubjectCatalog(
        [...currentScoped, ...seedCatalog],
        {
          madrasaId: currentTenant,
          assignedSubjectIds: assignedIds,
        },
      );

      // Must NOT collapse to 2 rows — all 25 unique subjects must be present
      expect(catalog.length).toBe(25);

      // Every assigned class_subject ID must exist verbatim in the catalog
      const catalogIds = new Set(catalog.map((s) => s.id));
      for (const id of assignedIds) {
        expect(catalogIds.has(id)).toBe(true);
      }

      // Practical must appear ONLY ONCE
      const practicalRows = catalog.filter(
        (s) => normalizeSubjectKey(s.name) === "practical",
      );
      expect(practicalRows).toHaveLength(1);

      // Standalone "নাহবেমীর" keeps NAH, combined "নাহবেমীর ও কাফিয়া" gets NAH-KAF (no NAH collision)
      const nahRows = catalog.filter((s) => s.code === "NAH");
      expect(nahRows).toHaveLength(1);
      expect(nahRows[0].name).toBe("নাহবেমীর");

      const combinedRow = catalog.find((s) => s.id === "sub-nah-kaf-combined");
      expect(combinedRow?.code).toBe("NAH-KAF");

      // Idempotency across repeated calls
      const secondRun = mergeAndDedupeSubjectCatalog(
        [...currentScoped, ...seedCatalog],
        {
          madrasaId: currentTenant,
          assignedSubjectIds: assignedIds,
        },
      );
      expect(secondRun).toEqual(catalog);
    });
  });

  describe("S2: Browser beforeunload Save Guard Lifecycle", () => {
    beforeEach(() => {
      // Set up minimal window mock in Node test environment if absent
      if (typeof (globalThis as any).window === "undefined") {
        const listeners = new Map<string, Set<Function>>();
        (globalThis as any).window = {
          onbeforeunload: null,
          addEventListener(type: string, fn: Function) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(fn);
          },
          removeEventListener(type: string, fn: Function) {
            listeners.get(type)?.delete(fn);
          },
          dispatchEvent(evt: any) {
            for (const fn of listeners.get(evt.type) || []) {
              fn(evt);
            }
          },
        };
      }
    });

    it("prevents unload while save guard is active and clears cleanly after completion", () => {
      expect(hasActiveSaveGuards()).toBe(false);

      const release1 = acquireSaveGuard("assign-hifz-nah");
      const release2 = acquireSaveGuard("assign-noorani-kaf");
      expect(hasActiveSaveGuards()).toBe(true);
      expect(typeof window.onbeforeunload).toBe("function");

      let prevented = false;
      const fakeEvent: any = {
        type: "beforeunload",
        returnValue: undefined,
        preventDefault() {
          prevented = true;
        },
      };

      const ret = window.onbeforeunload!(fakeEvent);
      expect(prevented).toBe(true);
      expect(fakeEvent.returnValue).toBe("");
      expect(ret).toBe("");

      // Releasing one in-flight save keeps guard active while second is still saving
      release1();
      expect(hasActiveSaveGuards()).toBe(true);

      // Releasing final save disarms beforeunload
      release2();
      expect(hasActiveSaveGuards()).toBe(false);
      expect(window.onbeforeunload).toBeNull();
    });
  });

  describe("S3: Student Attendance Saved-Record Counters & Unmarked Safety", () => {
    it("counts only saved DB records (total 11, present 2, late 1, unmarked 8) and excludes unmarked rows on save", () => {
      const students = [
        { id: "s1", first_name: "তাহমিদ", savedStatus: "Present", status: "Present" },
        { id: "s2", first_name: "ওমর", savedStatus: "Present", status: "Present" },
        { id: "s3", first_name: "যাচাই", savedStatus: "Late", status: "Late" },
        // 8 unmarked students from other classes (no saved record, no fake Present default)
        { id: "s4", first_name: "আবদুল্লাহ", savedStatus: null, status: null },
        { id: "s5", first_name: "হাসান", savedStatus: null, status: null },
        { id: "s6", first_name: "হোসাইন", savedStatus: null, status: null },
        { id: "s7", first_name: "সাইদ", savedStatus: null, status: null },
        { id: "s8", first_name: "খালিদ", savedStatus: null, status: null },
        { id: "s9", first_name: "বেলাল", savedStatus: null, status: null },
        { id: "s10", first_name: "সাদ", savedStatus: null, status: null },
        { id: "s11", first_name: "মাসউদ", savedStatus: null, status: null },
      ];

      const summary = computeSavedAttendanceSummary(students);
      expect(summary).toEqual({
        total: 11,
        present: 2,
        absent: 0,
        late: 1,
        leave: 0,
        unmarked: 8,
      });

      // Saving without touching the 8 unmarked students only sends the 3 marked students
      const payload = buildAttendanceSavePayload(students);
      expect(payload).toEqual([
        { student_id: "s1", status: "Present" },
        { student_id: "s2", status: "Present" },
        { student_id: "s3", status: "Late" },
      ]);

      // Selecting "Absent" on s4 in the form does not mutate saved summary until saved,
      // and adds only s4 to the save payload (leaving s5..s11 untouched)
      students[3].status = "Absent";
      expect(computeSavedAttendanceSummary(students).unmarked).toBe(8);
      expect(buildAttendanceSavePayload(students)).toHaveLength(4);
    });
  });
});
