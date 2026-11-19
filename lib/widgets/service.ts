import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { normalizeWidgetConfigs } from "./registry";
import type { WidgetConfigItem } from "./types";

const WIDGET_NAMESPACE = "widgets";
const WIDGET_KEY = "dashboard_widgets";

export async function getTenantWidgets(madrasaId: string): Promise<WidgetConfigItem[]> {
  if (!madrasaId) return normalizeWidgetConfigs([]);

  const structured = await getStructuredMadrasaSetting<WidgetConfigItem[]>(
    madrasaId,
    WIDGET_NAMESPACE,
    WIDGET_KEY
  );
  if (structured.found && Array.isArray(structured.value)) {
    return normalizeWidgetConfigs(structured.value);
  }

  const meta: any = await getMadrasaMetadata(madrasaId);
  if (Array.isArray(meta?.dashboard_widgets)) {
    return normalizeWidgetConfigs(meta.dashboard_widgets);
  }

  return normalizeWidgetConfigs([]);
}

export async function saveTenantWidgets(
  madrasaId: string,
  widgets: WidgetConfigItem[],
  updatedBy?: string | null
): Promise<WidgetConfigItem[]> {
  const normalized = normalizeWidgetConfigs(widgets);
  const res = await saveStructuredMadrasaSetting(
    madrasaId,
    WIDGET_NAMESPACE,
    WIDGET_KEY,
    normalized,
    updatedBy || null
  );

  if (!res.ok || res.storage === "fallback") {
    await saveMadrasaMetadata(madrasaId, { dashboard_widgets: normalized });
  }

  return normalized;
}
