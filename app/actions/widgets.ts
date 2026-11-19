"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { requirePermission } from "@/lib/permissions-server";
import { logAuditEvent } from "@/lib/audit-log";
import { getTenantWidgets, saveTenantWidgets } from "@/lib/widgets/service";
import { parseCustomWidgetZip } from "@/lib/widgets/zip-parser";
import type { WidgetConfigItem, WidgetSize } from "@/lib/widgets/types";

const WIDGET_ADMIN_ROLES = ["super_admin", "muhtamim", "admin"];

async function resolveWidgetAdmin(options?: { critical?: boolean; actionScope?: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };
  }

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) {
    return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };
  }

  const guard = await requirePermission({
    userId: user.id,
    madrasaId,
    roles: WIDGET_ADMIN_ROLES,
    riskLevel: options?.critical ? "CRITICAL" : undefined,
    actionScope: options?.actionScope,
    errorMessage: "উইজেট ম্যানেজ করার অনুমতি কেবল সুপার অ্যাডমিন, মুহতামিম অথবা অ্যাডমিনের আছে।",
  });

  if (!guard.allowed) {
    return {
      error: guard.error || "এই কাজটি করার অনুমতি আপনার নেই।",
      stepUpRequired: guard.stepUpRequired,
      errorCode: guard.errorCode,
    };
  }

  return {
    user,
    madrasaId,
    actorName: guard.context?.profile?.fullName || user.email || "প্রশাসন",
    actorEmail: guard.context?.profile?.email || user.email || null,
    actorRole: guard.context?.role || null,
  };
}

export async function getWidgetsForManagerAction(): Promise<{
  widgets: WidgetConfigItem[];
  canManage: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return { widgets: [], canManage: false, error: "অননুমোদিত অ্যাক্সেস।" };
  }
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) {
    return { widgets: [], canManage: false, error: "মাদরাসা আইডি পাওয়া যায়নি।" };
  }

  const guard = await requirePermission({
    userId: user.id,
    madrasaId,
    roles: WIDGET_ADMIN_ROLES,
  });

  const widgets = await getTenantWidgets(madrasaId);
  return { widgets, canManage: Boolean(guard.allowed) };
}

export async function toggleWidgetAction(widgetId: string, enabled: boolean) {
  const ctx = await resolveWidgetAdmin();
  if ("error" in ctx) return ctx;

  const current = await getTenantWidgets(ctx.madrasaId);
  const target = current.find((w) => w.id === widgetId);
  if (!target) {
    return { error: "উইজেটটি খুঁজে পাওয়া যায়নি।" };
  }

  const updated = current.map((w) => (w.id === widgetId ? { ...w, enabled } : w));
  const saved = await saveTenantWidgets(ctx.madrasaId, updated, ctx.user.id);

  await logAuditEvent({
    madrasaId: ctx.madrasaId,
    actorId: ctx.user.id,
    actorName: ctx.actorName,
    actorEmail: ctx.actorEmail,
    actorRole: ctx.actorRole,
    module: "settings",
    action: enabled ? "WIDGET_ENABLED" : "WIDGET_DISABLED",
    entityType: "dashboard_widget",
    entityId: widgetId,
    entityLabel: target.title,
    summary: `ড্যাশবোর্ড উইজেট "${target.title}" ${enabled ? "চালু (Enable)" : "বন্ধ (Disable)"} করা হয়েছে।`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/widgets");
  return { success: true, widgets: saved };
}

export async function updateWidgetLayoutAction(
  widgetId: string,
  updates: { size?: WidgetSize; direction?: "up" | "down" }
) {
  const ctx = await resolveWidgetAdmin();
  if ("error" in ctx) return ctx;

  const current = [...(await getTenantWidgets(ctx.madrasaId))];
  const idx = current.findIndex((w) => w.id === widgetId);
  if (idx === -1) {
    return { error: "উইজেটটি খুঁজে পাওয়া যায়নি।" };
  }

  if (updates.size) {
    current[idx] = { ...current[idx], size: updates.size };
  }

  if (updates.direction === "up" && idx > 0) {
    const tmp = current[idx - 1];
    current[idx - 1] = current[idx];
    current[idx] = tmp;
  } else if (updates.direction === "down" && idx < current.length - 1) {
    const tmp = current[idx + 1];
    current[idx + 1] = current[idx];
    current[idx] = tmp;
  }

  const reordered = current.map((w, i) => ({ ...w, order: i + 1 }));
  const saved = await saveTenantWidgets(ctx.madrasaId, reordered, ctx.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/widgets");
  return { success: true, widgets: saved };
}

export async function installCustomWidgetZipAction(formData: FormData) {
  const ctx = await resolveWidgetAdmin({
    critical: true,
    actionScope: "widget.install",
  });
  if ("error" in ctx) return ctx;

  const file = formData.get("file") as File | null;
  if (!file || typeof file.arrayBuffer !== "function") {
    return { error: "অনুগ্রহ করে একটি .zip ফাইল নির্বাচন করুন।" };
  }

  const buffer = await file.arrayBuffer();
  const parsed = await parseCustomWidgetZip(buffer);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const current = await getTenantWidgets(ctx.madrasaId);
  const existingIdx = current.findIndex((w) => w.id === parsed.widget.id);

  const newWidget: WidgetConfigItem = {
    id: parsed.widget.id,
    type: "custom",
    title: parsed.widget.title,
    description: parsed.widget.description,
    version: parsed.widget.version,
    author: parsed.widget.author,
    enabled: true,
    order: existingIdx >= 0 ? current[existingIdx].order : current.length + 1,
    size: existingIdx >= 0 ? current[existingIdx].size : parsed.widget.size,
    permissions: parsed.widget.permissions,
    bundleHtml: parsed.widget.bundleHtml,
    installedAt: new Date().toISOString(),
  };

  const next =
    existingIdx >= 0
      ? current.map((w, idx) => (idx === existingIdx ? newWidget : w))
      : [...current, newWidget];

  const saved = await saveTenantWidgets(ctx.madrasaId, next, ctx.user.id);

  await logAuditEvent({
    madrasaId: ctx.madrasaId,
    actorId: ctx.user.id,
    actorName: ctx.actorName,
    actorEmail: ctx.actorEmail,
    actorRole: ctx.actorRole,
    module: "settings",
    action: "CUSTOM_WIDGET_INSTALLED",
    entityType: "dashboard_widget",
    entityId: newWidget.id,
    entityLabel: newWidget.title,
    summary: `কাস্টম .zip উইজেট "${newWidget.title}" (v${newWidget.version}) ইনস্টল করা হয়েছে।`,
    severity: "WARNING",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/widgets");
  return {
    success: true,
    widgets: saved,
    installedWidget: {
      id: newWidget.id,
      title: newWidget.title,
      version: newWidget.version,
    },
  };
}

export async function uninstallCustomWidgetAction(widgetId: string) {
  const ctx = await resolveWidgetAdmin({
    critical: true,
    actionScope: "widget.uninstall",
  });
  if ("error" in ctx) return ctx;

  const current = await getTenantWidgets(ctx.madrasaId);
  const target = current.find((w) => w.id === widgetId && w.type === "custom");
  if (!target) {
    return { error: "কাস্টম উইজেটটি পাওয়া যায়নি (ডিফল্ট উইজেট আনইনস্টল করা যাবে না, শুধু Disable করা যাবে)।" };
  }

  const next = current.filter((w) => w.id !== widgetId);
  const saved = await saveTenantWidgets(ctx.madrasaId, next, ctx.user.id);

  await logAuditEvent({
    madrasaId: ctx.madrasaId,
    actorId: ctx.user.id,
    actorName: ctx.actorName,
    actorEmail: ctx.actorEmail,
    actorRole: ctx.actorRole,
    module: "settings",
    action: "CUSTOM_WIDGET_UNINSTALLED",
    entityType: "dashboard_widget",
    entityId: widgetId,
    entityLabel: target.title,
    summary: `কাস্টম উইজেট "${target.title}" আনইনস্টল করা হয়েছে।`,
    severity: "WARNING",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/widgets");
  return { success: true, widgets: saved };
}
