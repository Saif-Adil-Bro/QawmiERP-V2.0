"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { initWebNotificationBridge } from "@/lib/nativeNotifications";

const HOME_ROUTES = new Set(["/", "/login", "/dashboard", "/portal", "/teacher-portal"]);

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export default function CapacitorProvider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const syncStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        const isDark =
          document.documentElement.classList.contains("dark") ||
          document.documentElement.getAttribute("data-theme") === "dark";
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });
      } catch {
        // Ignore on unsupported platforms
      }
    };

    syncStatusBar();

    // Keep Android status bar style synced when user toggles Dark / Sepia / Light theme
    const themeObserver = new MutationObserver(() => {
      syncStatusBar();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const cleanupNotifications = initWebNotificationBridge();

    let backButtonListener: { remove: () => Promise<void> } | null = null;

    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      const currentPath = normalizePath(window.location.pathname);
      const isHomeRoute = HOME_ROUTES.has(currentPath);

      if (!isHomeRoute && (canGoBack || window.history.length > 1)) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    })
      .then((handle) => {
        backButtonListener = handle;
      })
      .catch(() => {
        // Ignore listener registration errors outside native shell
      });

    return () => {
      themeObserver.disconnect();
      cleanupNotifications();
      backButtonListener?.remove().catch(() => {});
    };
  }, []);

  return null;
}
