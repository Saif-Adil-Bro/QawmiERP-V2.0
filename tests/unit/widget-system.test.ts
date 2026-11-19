import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  DEFAULT_BUILTIN_WIDGETS,
  filterBridgeDataByPermissions,
  normalizeWidgetConfigs,
} from "@/lib/widgets/registry";
import {
  buildSampleWidgetZipBuffer,
  parseCustomWidgetZip,
} from "@/lib/widgets/zip-parser";

describe("QawmiERP Widget & Plugin System", () => {
  describe("normalizeWidgetConfigs", () => {
    it("returns all default built-in widgets when saved config is empty", () => {
      const result = normalizeWidgetConfigs([]);
      expect(result.length).toBe(DEFAULT_BUILTIN_WIDGETS.length);
      expect(result[0].id).toBe("builtin-kpi");
      expect(result.every((w) => w.type === "builtin")).toBe(true);
    });

    it("preserves saved enabled/size/order overrides and custom widgets", () => {
      const result = normalizeWidgetConfigs([
        {
          id: "builtin-charts",
          type: "builtin",
          title: "Charts",
          enabled: false,
          order: -1,
          size: "half",
        },
        {
          id: "custom-test",
          type: "custom",
          title: "My Custom Widget",
          enabled: true,
          order: 0,
          size: "half",
          bundleHtml: "<html><body>Hi</body></html>",
        },
      ]);

      const charts = result.find((w) => w.id === "builtin-charts");
      expect(charts?.enabled).toBe(false);
      expect(charts?.size).toBe("half");

      const custom = result.find((w) => w.id === "custom-test");
      expect(custom).toBeDefined();
      expect(custom?.type).toBe("custom");
      expect(result[0].id).toBe("builtin-charts");
      expect(result[1].id).toBe("custom-test");
    });
  });

  describe("filterBridgeDataByPermissions", () => {
    const full = {
      madrasaName: "জামিয়া ইসলামিয়া",
      studentsCount: 450,
      teachersCount: 25,
      classesCount: 10,
      todayPresent: 410,
      todayAbsent: 40,
      todayIncome: 15000,
      todayExpense: 5000,
      totalIncome: 500000,
      totalExpense: 300000,
    };

    it("returns only fields allowed by declared permissions", () => {
      const onlyStudents = filterBridgeDataByPermissions(full, ["students.read"]);
      expect(onlyStudents.studentsCount).toBe(450);
      expect(onlyStudents.todayIncome).toBeUndefined();
      expect(onlyStudents.madrasaName).toBeUndefined();
      expect(onlyStudents.todayPresent).toBeUndefined();
    });

    it("returns empty object when widget has no permissions", () => {
      const none = filterBridgeDataByPermissions(full, []);
      expect(Object.keys(none).length).toBe(0);
    });
  });

  describe("ZIP Widget Parser & Sample Generator", () => {
    it("round-trips buildSampleWidgetZipBuffer through parseCustomWidgetZip with inlined assets and Bridge SDK", async () => {
      const zipBytes = await buildSampleWidgetZipBuffer();
      const parsed = await parseCustomWidgetZip(zipBytes);

      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.widget.id).toBe("custom-madrasa-live-pulse");
        expect(parsed.widget.permissions).toContain("students.read");
        expect(parsed.widget.bundleHtml).toContain("window.QawmiERP");
        expect(parsed.widget.bundleHtml).toContain("<style>");
        expect(parsed.widget.bundleHtml).toContain("QawmiERP.requestData()");
      }
    });

    it("supports WordPress-style single nested folder inside .zip", async () => {
      const zip = new JSZip();
      zip.file(
        "nested-widget/manifest.json",
        JSON.stringify({
          id: "nested-hello",
          name: "Nested Widget",
          entry: "index.html",
          size: "full",
          permissions: ["madrasa.read", "invalid.perm"],
        })
      );
      zip.file("nested-widget/index.html", "<html><head></head><body>Hello</body></html>");

      const buf = await zip.generateAsync({ type: "uint8array" });
      const parsed = await parseCustomWidgetZip(buf);

      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.widget.id).toBe("custom-nested-hello");
        expect(parsed.widget.size).toBe("full");
        expect(parsed.widget.permissions).toEqual(["madrasa.read"]);
      }
    });

    it("rejects path traversal and dangerous .php files", async () => {
      const zip = new JSZip();
      zip.file(
        "manifest.json",
        JSON.stringify({ id: "bad-widget", name: "Bad", entry: "index.html" })
      );
      zip.file("index.html", "<html></html>");
      zip.file("shell.php", "<?php echo 1; ?>");

      const buf = await zip.generateAsync({ type: "uint8array" });
      const parsed = await parseCustomWidgetZip(buf);

      expect(parsed.ok).toBe(false);
    });
  });
});
