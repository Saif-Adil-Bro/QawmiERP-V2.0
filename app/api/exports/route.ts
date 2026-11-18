import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import { logAuditEvent, type AuditModuleKey } from "@/lib/audit-log";
import { toDhakaDateString } from "@/lib/date-utils";
import {
  buildExportWatermark,
  buildWatermarkedCsv,
  buildWatermarkedWorkbook,
  type ExportFormat,
} from "@/lib/export-watermark";
import {
  canViewUnmaskedField,
  maskBankAccount,
  maskDonorSensitiveFields,
  maskEmailAddress,
  maskNidNumber,
  maskPhoneNumber,
  maskStudentSensitiveFields,
} from "@/lib/data-access-guards";
import { getTenantMaskingPolicy } from "@/lib/step-up-auth";

const PORTAL_ROLES = ["student", "parent", "guardian"];

const DATASET_PERMISSIONS: Record<string, { permissions: string[]; roles: string[]; module: AuditModuleKey }> = {
  students: {
    permissions: ["student.export", "student.view", "student.view_all", "academic.manage"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "office_staff", "teacher", "accountant"],
    module: "students",
  },
  alumni: {
    permissions: ["student.export", "student.view", "academic.manage"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "office_staff"],
    module: "students",
  },
  donors: {
    permissions: ["finance.view", "finance.create", "finance.approve", "fee.view"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"],
    module: "finance",
  },
  life_member_donors: {
    permissions: ["finance.view", "finance.create", "finance.approve", "fee.view"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"],
    module: "finance",
  },
  system_audit_logs: {
    permissions: ["audit.view", "role.view", "security.sessions.manage"],
    roles: ["super_admin", "admin", "muhtamim"],
    module: "security",
  },
  security_audit_logs: {
    permissions: ["audit.view", "role.view", "security.sessions.manage"],
    roles: ["super_admin", "admin", "muhtamim"],
    module: "security",
  },
  activity_logs: {
    permissions: ["audit.view", "communication.send", "notice.create"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "office_staff"],
    module: "notifications",
  },
};

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function maskCellByHeader(header: string, value: unknown): string | number | null | undefined {
  if (value === null || value === undefined || value === "") return value as any;
  const h = header.toLowerCase();
  const str = String(value);

  if (/(phone|mobile|contact|ফোন|মোবাইল|যোগাযোগ)/i.test(h)) {
    return maskPhoneNumber(str);
  }
  if (/(nid|national_id|birth_reg|এনআইডি|জাতীয় পরিচয়)/i.test(h)) {
    return maskNidNumber(str);
  }
  if (/(email|ইমেইল)/i.test(h)) {
    return maskEmailAddress(str);
  }
  if (/(bank|account_no|ব্যাংক|একাউন্ট)/i.test(h)) {
    return maskBankAccount(str);
  }
  return value as any;
}

async function resolveExportActor() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  if (!authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("madrasa_id, full_name, email, role")
    .eq("id", authUser.id)
    .maybeSingle();

  const madrasaId = String((userRow as any)?.madrasa_id || "");
  if (!madrasaId) {
    return { error: NextResponse.json({ error: "No madrasa linked" }, { status: 403 }) };
  }

  const permCtx = await loadServerPermissions(authUser.id, madrasaId);
  if (!permCtx || permCtx.status === "SUSPENDED" || permCtx.status === "DISABLED") {
    return { error: NextResponse.json({ error: "Account disabled" }, { status: 403 }) };
  }

  if (PORTAL_ROLES.includes(permCtx.role) || permCtx.roles.some((r) => PORTAL_ROLES.includes(r))) {
    return { error: NextResponse.json({ error: "Forbidden for portal roles" }, { status: 403 }) };
  }

  const { data: madrasaRow } = await admin
    .from("madrasas")
    .select("name")
    .eq("id", madrasaId)
    .maybeSingle();

  return {
    actor: {
      userId: authUser.id,
      madrasaId,
      madrasaName: (madrasaRow as any)?.name || "QawmiERP",
      actorName: (userRow as any)?.full_name || authUser.email || "User",
      actorEmail: (userRow as any)?.email || authUser.email || "",
      actorRole: permCtx.role,
      permCtx,
    },
  };
}

async function loadDatasetFromDb(
  madrasaId: string,
  dataset: string,
  allowUnmasked: boolean
): Promise<{ headers: string[]; rows: (string | number | null | undefined)[][]; sheetName: string }> {
  const admin = await createAdminClient();

  if (dataset === "students" || dataset === "alumni") {
    let query = admin
      .from("students")
      .select("student_id, first_name, last_name, father_name, parent_phone, email, nid_number, status")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (dataset === "alumni") {
      query = query.in("status", ["alumni", "graduated", "passed_out"]);
    }

    const { data } = await query;
    const rows = (data || []).map((raw: any) => {
      const s = maskStudentSensitiveFields(raw, allowUnmasked);
      return [
        s.student_id || "",
        `${s.first_name || ""} ${s.last_name || ""}`.trim(),
        s.father_name || "",
        s.parent_phone || "",
        s.email || "",
        s.nid_number || "",
        s.status || "active",
      ];
    });
    return {
      sheetName: dataset === "alumni" ? "Alumni" : "Students",
      headers: ["Student ID", "Name", "Father Name", "Parent Phone", "Email", "NID", "Status"],
      rows,
    };
  }

  if (dataset === "donors" || dataset === "life_member_donors") {
    const table = dataset === "life_member_donors" ? "life_member_donors" : "donors";
    const { data } = await admin
      .from(table)
      .select("id, name, phone, email, address, amount, status, created_at")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = (data || []).map((raw: any) => {
      const d = maskDonorSensitiveFields(raw, allowUnmasked);
      return [
        d.name || "",
        d.phone || "",
        d.email || "",
        d.address || "",
        d.amount ?? "",
        d.status || "",
        d.created_at || "",
      ];
    });
    return {
      sheetName: dataset === "life_member_donors" ? "Life Members" : "Donors",
      headers: ["Name", "Phone", "Email", "Address", "Amount", "Status", "Created At"],
      rows,
    };
  }

  if (dataset === "system_audit_logs" || dataset === "security_audit_logs") {
    const { data } = await admin
      .from("system_audit_logs")
      .select("id, created_at, module, action, severity, actor_name, actor_role, summary")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = (data || []).map((l: any) => [
      l.id,
      l.created_at,
      l.module,
      l.action,
      l.severity || "INFO",
      l.actor_name || "",
      l.actor_role || "",
      l.summary || "",
    ]);
    return {
      sheetName: "Audit Logs",
      headers: ["ID", "Time", "Module", "Action", "Severity", "Actor", "Role", "Summary"],
      rows,
    };
  }

  return {
    sheetName: "Export",
    headers: ["Info"],
    rows: [["No data"]],
  };
}

async function handleExport(req: NextRequest, params: {
  dataset: string;
  format: ExportFormat;
  sheetName?: string;
  filename?: string;
  headers?: string[];
  rows?: (string | number | null | undefined)[][];
}) {
  const resolved = await resolveExportActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  const dataset = String(params.dataset || "students").trim();
  const format = (params.format || "csv") as ExportFormat;

  const policy = DATASET_PERMISSIONS[dataset] || {
    permissions: ["student.export", "finance.view", "audit.view"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant", "office_staff"],
    module: "security" as AuditModuleKey,
  };

  const hasPerm =
    actor.permCtx.roles.some((r) => policy.roles.includes(r)) ||
    policy.permissions.some((p) => actor.permCtx.summary.effectivePermissions.includes(p));

  if (!hasPerm) {
    return NextResponse.json({ error: "এই তথ্য এক্সপোর্ট করার অনুমতি আপনার নেই।" }, { status: 403 });
  }

  const maskingPolicy = await getTenantMaskingPolicy(actor.madrasaId);
  const allowUnmasked =
    !maskingPolicy.enforceMasking ||
    canViewUnmaskedField(actor.permCtx.summary, policy.module, "phone");

  let headers = Array.isArray(params.headers) ? params.headers.map(String) : [];
  let rows = Array.isArray(params.rows) ? params.rows : [];
  let sheetName = params.sheetName || dataset;

  if (headers.length === 0) {
    const loaded = await loadDatasetFromDb(actor.madrasaId, dataset, allowUnmasked);
    headers = loaded.headers;
    rows = loaded.rows;
    sheetName = params.sheetName || loaded.sheetName;
  } else if (!allowUnmasked) {
    rows = rows.map((row) =>
      row.map((cell, idx) => maskCellByHeader(headers[idx] || "", cell))
    );
  }

  const ipAddress = getClientIp(req);
  const watermark = buildExportWatermark({
    exportedBy: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress,
    madrasaName: actor.madrasaName,
    dataset,
    rowCount: rows.length,
  });

  // Mandatory audit log for every sensitive export
  await logAuditEvent({
    madrasaId: actor.madrasaId,
    actorId: actor.userId,
    actorName: actor.actorName,
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    module: policy.module,
    action: "SENSITIVE_DATA_EXPORTED",
    entityType: "export",
    entityId: watermark.exportId,
    entityLabel: `${dataset}.${format}`,
    summary: `সংবেদনশীল তথ্য এক্সপোর্ট করা হয়েছে (${dataset}, ফরম্যাট: ${format.toUpperCase()}, সারি: ${rows.length}, Ref: ${watermark.exportId})।`,
    metadata: {
      export_id: watermark.exportId,
      dataset,
      format,
      row_count: rows.length,
      ip_address: ipAddress,
      unmasked: allowUnmasked,
      exported_at_dhaka: watermark.exportedAtDhaka,
    },
    severity: "WARNING",
  });

  if (format === "print_meta") {
    return NextResponse.json({ success: true, watermark });
  }

  const baseName = (params.filename || `${dataset}_${toDhakaDateString()}`).replace(/[^a-zA-Z0-9_-]/g, "_");

  if (format === "xlsx") {
    const buffer = buildWatermarkedWorkbook(sheetName, headers, rows, watermark);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "X-Export-Id": watermark.exportId,
        "X-Watermark-Line": encodeURIComponent(watermark.watermarkLine),
      },
    });
  }

  const csv = buildWatermarkedCsv(headers, rows, watermark);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      "X-Export-Id": watermark.exportId,
      "X-Watermark-Line": encodeURIComponent(watermark.watermarkLine),
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleExport(req, {
    dataset: searchParams.get("dataset") || "students",
    format: (searchParams.get("format") || "csv") as ExportFormat,
    filename: searchParams.get("filename") || undefined,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  return handleExport(req, {
    dataset: String(body.dataset || "students"),
    format: (body.format || "csv") as ExportFormat,
    sheetName: body.sheetName ? String(body.sheetName) : undefined,
    filename: body.filename ? String(body.filename) : undefined,
    headers: Array.isArray(body.headers) ? body.headers : undefined,
    rows: Array.isArray(body.rows) ? body.rows : undefined,
  });
}
