"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Puzzle, Shield } from "lucide-react";
import { filterBridgeDataByPermissions } from "@/lib/widgets/registry";
import type { ErpWidgetBridgeData, WidgetConfigItem } from "@/lib/widgets/types";

interface CustomWidgetFrameProps {
  widget: WidgetConfigItem;
  bridgeData: ErpWidgetBridgeData;
}

export default function CustomWidgetFrame({ widget, bridgeData }: CustomWidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const permittedPayload = useMemo(
    () => filterBridgeDataByPermissions(bridgeData, widget.permissions || []),
    [bridgeData, widget.permissions]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (event.data?.type === "QAWMI_WIDGET_REQUEST_DATA") {
        iframeRef.current.contentWindow?.postMessage(
          { type: "QAWMI_WIDGET_DATA", payload: permittedPayload },
          "*"
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [permittedPayload]);

  // Also push updated data whenever permittedPayload changes after initial load
  const handleLoad = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "QAWMI_WIDGET_DATA", payload: permittedPayload },
        "*"
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 min-w-0">
          <Puzzle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {widget.title}
          </h3>
          {widget.version && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              v{widget.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
          <Shield className="w-3.5 h-3.5" />
          <span>Sandboxed</span>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        title={widget.title}
        srcDoc={widget.bundleHtml || ""}
        sandbox="allow-scripts"
        onLoad={handleLoad}
        className="w-full min-h-[240px] border-0 bg-white dark:bg-slate-950"
      />
    </div>
  );
}
