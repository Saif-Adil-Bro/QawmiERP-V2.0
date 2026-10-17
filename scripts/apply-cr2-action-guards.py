#!/usr/bin/env python3
"""CR-2 guard inserter: every write server-action gets a central authorization guard."""
import glob
import os
import re
import sys

REPO = "/home/user/QawmiERP-V2.0"
DRY_RUN = "--apply" not in sys.argv

MODULE_MAP = {
    "accounting": "finance",
    "fee-management": "finance",
    "zakat": "zakat",
    "fundraising": "fundraising",
    "users": "users",
    "permissions": "roles",
    "students": "students",
    "teachers": "teachers",
    "attendance": "attendance",
    "exams": "exams",
    "exam-routines": "exams",
    "hifz": "hifz",
    "routine": "routine",
    "classes": "classes",
    "class_subjects": "classes",
    "subjects": "subjects",
    "library": "library",
    "inventory": "inventory",
    "communication": "communication",
    "parent-communication": "communication",
    "payment-gateway": "finance",
    "boarding": "boarding",
    "staff": "staff",
    "sessions": "sessions",
    "admissions": "admissions",
    "certificates": "certificates",
    "backup": "backup",
    "kitab": "kitab",
    "leaves": "leaves",
    "holidays": "holidays",
    "syllabus": "syllabus",
    "questions": "questions",
    "biometric": "biometric",
}

# পাবলিক/পোর্টাল-মুখী write action — এগুলো ইচ্ছাকৃতভাবে guard-এর বাইরে
EXCLUDE = {
    ("admissions.ts", "submitAdmissionApplication"),
    ("fundraising.ts", "submitOnlineDonation"),
    ("fundraising.ts", "initiateOnlineDonationGateway"),
    ("leaves.ts", "submitStudentLeaveRequest"),
    ("parent-communication.ts", "createParentFeedback"),
    ("parent-communication.ts", "deleteParentFeedback"),
    ("payment-gateway.ts", "initiateOnlinePayment"),
    ("payment-gateway.ts", "verifyAndCompleteOnlinePayment"),
    # অভ্যন্তরীণ helper — পাবলিক payment-gateway/boarding ফ্লোও এটিকে ডাকে; এর কলাররাই guarded
    ("fee-management.ts", "saveFeeMetadata"),

    # ── পাবলিক/পোর্টাল/শিক্ষক-পোর্টাল থেকে পৌঁছানো যায় এমন action ─────────────────
    # এগুলো guard করা হলে বিনা-লগইন দাতা, অভিভাবক বা শিক্ষকদের স্বাভাবিক কাজ ভেঙে যেত।
    ("students.ts", "getAuthMadrasaId"),          # সব পোর্টাল/লিব ব্যবহার করে
    ("zakat.ts", "getFunds"),                     # পাবলিক /donate পেজ
    ("fundraising.ts", "getOnlineDonations"),     # পোর্টাল donate UI
    ("assignments.ts", "getAssignments"),         # পোর্টাল + শিক্ষক পোর্টাল
    ("assignments.ts", "getStudentAssignments"),  # পোর্টাল হোম
    ("notifications.ts", "markNotificationAsRead"),
    ("notifications.ts", "markAllNotificationsAsRead"),
    ("notifications.ts", "toggleNotificationReadStatus"),
    ("id-card-management.ts", "getStudentDigitalId"),   # পোর্টাল আইডি কার্ড
    ("id-card-management.ts", "verifyStudentIdCard"),   # পাবলিক /verify
    ("admissions.ts", "getAdmissionApplications"),      # notifications.ts ভেতরে ডাকে
    ("admissions.ts", "getAdmissionById"),              # পাবলিক /admission কার্ড
    ("certificates.ts", "verifyCertificateByToken"),    # পাবলিক /verify
    ("sessions.ts", "getAcademicSessions"),             # SessionContext (ক্লায়েন্ট, সর্বত্র)
    ("tenant.ts", "registerMadrasa"),                   # পাবলিক রেজিস্ট্রেশন (self-service signup)
}

WRITE_RE = re.compile(
    r"\.(insert|update|upsert|delete)\(|saveMadrasaMetadata\(|saveFeeMetadata\("
)
GUARD_PRESENT_RE = re.compile(r"requirePermission\(|assertActiveAccount\(|writeGuard\(")


def scan_body(src, body_start):
    """Find the index of the closing brace of a function body (string/comment aware)."""
    i = body_start
    depth = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            i = src.find("\n", i)
            if i == -1:
                return n - 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            end = src.find("*/", i + 2)
            i = n - 1 if end == -1 else end + 1
            continue
        if c in ('"', "'", "`"):
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return n - 1


def find_functions(src):
    out = []
    for m in re.finditer(r"export\s+async\s+function\s+(\w+)\s*\(", src):
        name = m.group(1)
        i = m.end() - 1  # at '('
        depth = 0
        while i < len(src):
            if src[i] == "(":
                depth += 1
            elif src[i] == ")":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            i += 1
        # find body start: skip whitespace, optional return-type annotation, then '{'
        j = i
        while j < len(src) and src[j] in " \t\r\n":
            j += 1

        def scan_type(k):
            angle = 0
            brace = 0
            while k < len(src):
                c = src[k]
                if c == "<":
                    angle += 1
                elif c == ">":
                    angle = max(0, angle - 1)
                elif c == "{":
                    if angle == 0 and brace == 0:
                        return k
                    brace += 1
                elif c == "}":
                    brace -= 1
                k += 1
            return -1

        if src[j] == "{":
            body_start = j
        elif src[j] == ":":
            body_start = scan_type(j + 1)
        else:
            body_start = scan_type(j)
        if body_start == -1:
            continue
        body_end = scan_body(src, body_start)
        out.append((name, body_start, body_end))
    return out


def insert_import(src):
    imp = 'import { writeGuard } from "@/lib/action-authorization";\n'
    if imp in src:
        return src, False
    m = re.search(r'^"use server";\s*\n', src, re.M)
    if m:
        return src[: m.end()] + imp + src[m.end() :], True
    return imp + src, True


def main():
    changes = []
    for path in sorted(glob.glob(os.path.join(REPO, "app/actions/*.ts"))):
        base = os.path.basename(path)
        if base == "auth.ts":
            continue
        module = MODULE_MAP.get(base[:-3], "generic")
        src = open(path, encoding="utf-8").read()
        funcs = find_functions(src)
        inserts = []
        for name, body_start, body_end in funcs:
            body = src[body_start : body_end + 1]
            if (base, name) in EXCLUDE:
                continue
            if not WRITE_RE.search(body):
                continue
            if GUARD_PRESENT_RE.search(body):
                continue
            inserts.append((name, body_start))

        if not inserts:
            continue

        new_src = src
        for name, body_start in sorted(inserts, key=lambda x: -x[1]):
            guard = (
                "\n  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,\n"
                "  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।\n"
                "  {\n"
                '    const __authz = await writeGuard("%s");\n'
                "    if (!__authz.allowed) return __authz.fallback;\n"
                "  }\n"
            ) % module
            new_src = new_src[: body_start + 1] + guard + new_src[body_start + 1 :]

        new_src, imported = insert_import(new_src)
        changes.append((base, module, [n for n, _ in inserts], imported))
        if not DRY_RUN:
            open(path, "w", encoding="utf-8").write(new_src)

    total = sum(len(c[2]) for c in changes)
    print(f"{'DRY RUN' if DRY_RUN else 'APPLIED'} — files: {len(changes)}, guards: {total}")
    for base, module, names, imported in changes:
        print(f"  {base} [{module}] -> {len(names)}: {', '.join(names)}")


if __name__ == "__main__":
    main()
