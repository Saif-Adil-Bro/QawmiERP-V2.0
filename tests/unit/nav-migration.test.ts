import { describe, it, expect } from "vitest";
import { INITIAL_NAV_GROUPS, sanitizeNavGroups } from "@/components/mode/defaultNavData";

describe("Navigation Group Organization & Legacy Migration", () => {
  it("contains the 4 organized settings & portal groups in INITIAL_NAV_GROUPS", () => {
    const ids = INITIAL_NAV_GROUPS.map((g) => g.id);
    expect(ids).toContain("portals");
    expect(ids).toContain("settings_general");
    expect(ids).toContain("security_audit");
    expect(ids).toContain("automation_hub");
    expect(ids).not.toContain("system");
  });

  it("auto-migrates legacy 'system' group into the 4 new groups while preserving hidden states", () => {
    const legacySaved = [
      {
        id: "students",
        title: "শিক্ষার্থী ব্যবস্থাপনা",
        iconName: "Users",
        items: [
          {
            id: "student_list",
            name: "শিক্ষার্থী তালিকা ও প্রোফাইল",
            href: "/dashboard/students",
            iconName: "Users",
          },
        ],
      },
      {
        id: "system",
        title: "সিস্টেম ও পোর্টাল",
        iconName: "Settings",
        items: [
          {
            id: "portal_teacher",
            name: "শিক্ষক পোর্টাল (Teacher)",
            href: "/teacher-portal",
            iconName: "GraduationCap",
            hidden: true,
          },
          {
            id: "system_settings",
            name: "মাদ্রাসা সেটিংস",
            href: "/dashboard/settings",
            iconName: "Settings",
            hidden: false,
          },
        ],
      },
    ];

    const migrated = sanitizeNavGroups(legacySaved);
    const groupIds = migrated.map((g) => g.id);

    expect(groupIds).not.toContain("system");
    expect(groupIds).toContain("portals");
    expect(groupIds).toContain("settings_general");
    expect(groupIds).toContain("security_audit");
    expect(groupIds).toContain("automation_hub");

    const portals = migrated.find((g) => g.id === "portals");
    const teacherPortal = portals?.items.find((i) => i.id === "portal_teacher");
    expect(teacherPortal?.hidden).toBe(true);

    const general = migrated.find((g) => g.id === "settings_general");
    expect(general?.items.some((i) => i.href === "/dashboard/settings/payment-gateway")).toBe(true);
    expect(general?.items.some((i) => i.href === "/dashboard/settings/widgets")).toBe(true);
  });
});
