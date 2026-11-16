"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ALL_BASIC_TILES, BasicTileItem } from "./menuCatalog";
import { sanitizeNavGroups } from "./defaultNavData";
import { apiUrl } from "@/lib/api-url";

export type AppMode = "basic" | "advanced";

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  // Windows 10 Start Menu Floating Screen state
  isStartMenuOpen: boolean;
  openStartMenu: () => void;
  closeStartMenu: () => void;
  toggleStartMenu: () => void;
  // Basic Mode Tiles state
  pinnedTileIds: string[];
  pinnedTiles: BasicTileItem[];
  addTile: (id: string) => void;
  removeTile: (id: string) => void;
  reorderTiles: (newIds: string[]) => void;
  resetTiles: () => void;
  // Advanced Menu Customization state
  isCustomizingAdvanced: boolean;
  setIsCustomizingAdvanced: (customizing: boolean | ((prev: boolean) => boolean)) => void;
  customNavGroups: any[] | null;
  saveCustomNavGroups: (groups: any[]) => void;
  resetCustomNavGroups: () => void;
}

const DEFAULT_PINNED_IDS = ALL_BASIC_TILES.filter((t) => t.defaultPinned).map((t) => t.id);

const DIRTY_KEY = "qawmi_menu_prefs_dirty";
const UPDATED_AT_KEY = "qawmi_menu_prefs_updated_at";

const ModeContext = createContext<ModeContextType | undefined>(undefined);

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token =
      window.localStorage.getItem("qawmi_access_token") ||
      window.localStorage.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("advanced");
  const [pinnedTileIds, setPinnedTileIds] = useState<string[]>(DEFAULT_PINNED_IDS);
  const [isCustomizingAdvanced, setIsCustomizingAdvanced] = useState<boolean>(false);
  const [customNavGroups, setCustomNavGroups] = useState<any[] | null>(null);
  const isSyncingRef = useRef(false);

  const persistPreferencesToServer = useCallback(
    async (patch: {
      mode?: AppMode;
      pinnedTileIds?: string[] | null;
      customNavGroups?: any[] | null;
      updatedAt?: number;
    }) => {
      const updatedAt = patch.updatedAt ?? Date.now();
      try {
        localStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
      } catch {}

      try {
        const res = await fetch(apiUrl("/api/user/menu-preferences"), {
          method: "POST",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({ ...patch, updatedAt }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        try {
          localStorage.removeItem(DIRTY_KEY);
        } catch {}
      } catch {
        try {
          localStorage.setItem(DIRTY_KEY, "1");
        } catch {}
      }
    },
    []
  );

  const syncPreferencesWithServer = useCallback(async () => {
    if (typeof window === "undefined" || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const isDirty = localStorage.getItem(DIRTY_KEY) === "1";
      if (isDirty) {
        const localMode = localStorage.getItem("qawmi_app_mode") as AppMode | null;
        const localTilesRaw = localStorage.getItem("qawmi_basic_tiles");
        const localNavRaw = localStorage.getItem("qawmi_advanced_nav_groups");
        const localUpdatedAt = Number(localStorage.getItem(UPDATED_AT_KEY) || Date.now());

        await persistPreferencesToServer({
          mode: localMode === "basic" || localMode === "advanced" ? localMode : undefined,
          pinnedTileIds: localTilesRaw ? JSON.parse(localTilesRaw) : null,
          customNavGroups: localNavRaw ? JSON.parse(localNavRaw) : null,
          updatedAt: localUpdatedAt,
        });
        return;
      }

      const res = await fetch(apiUrl("/api/user/menu-preferences"), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json();
      const prefs = json?.preferences;
      if (!prefs || typeof prefs !== "object") return;

      if (prefs.mode === "basic" || prefs.mode === "advanced") {
        setModeState(prefs.mode);
        try {
          localStorage.setItem("qawmi_app_mode", prefs.mode);
        } catch {}
      }

      if (Array.isArray(prefs.pinnedTileIds) && prefs.pinnedTileIds.length > 0) {
        setPinnedTileIds(prefs.pinnedTileIds);
        try {
          localStorage.setItem("qawmi_basic_tiles", JSON.stringify(prefs.pinnedTileIds));
        } catch {}
      } else if (prefs.pinnedTileIds === null) {
        setPinnedTileIds(DEFAULT_PINNED_IDS);
        try {
          localStorage.removeItem("qawmi_basic_tiles");
        } catch {}
      }

      if (Array.isArray(prefs.customNavGroups)) {
        const sanitized = sanitizeNavGroups(prefs.customNavGroups);
        setCustomNavGroups(sanitized);
        try {
          localStorage.setItem("qawmi_advanced_nav_groups", JSON.stringify(sanitized));
        } catch {}
      } else if (prefs.customNavGroups === null) {
        setCustomNavGroups(null);
        try {
          localStorage.removeItem("qawmi_advanced_nav_groups");
        } catch {}
      }

      if (typeof prefs.updatedAt === "number") {
        try {
          localStorage.setItem(UPDATED_AT_KEY, String(prefs.updatedAt));
        } catch {}
      }
    } catch {
      // Offline or unauthenticated; keep localStorage state
    } finally {
      isSyncingRef.current = false;
    }
  }, [persistPreferencesToServer]);

  // Load saved preferences from localStorage first, then sync with server
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("qawmi_app_mode") as AppMode;
      if (savedMode === "basic" || savedMode === "advanced") {
        setModeState(savedMode);
      }

      const savedTiles = localStorage.getItem("qawmi_basic_tiles");
      if (savedTiles) {
        const parsed = JSON.parse(savedTiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPinnedTileIds(parsed);
        }
      }

      const savedNav = localStorage.getItem("qawmi_advanced_nav_groups");
      if (savedNav) {
        const parsedNav = JSON.parse(savedNav);
        if (Array.isArray(parsedNav)) {
          setCustomNavGroups(sanitizeNavGroups(parsedNav));
        }
      }
    } catch (e) {
      console.warn("Failed to read from localStorage", e);
    }

    syncPreferencesWithServer();

    const handleOnline = () => syncPreferencesWithServer();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncPreferencesWithServer();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncPreferencesWithServer]);

  const [isStartMenuOpen, setIsStartMenuOpen] = useState<boolean>(false);

  const openStartMenu = () => setIsStartMenuOpen(true);
  const closeStartMenu = () => setIsStartMenuOpen(false);
  const toggleStartMenu = () => setIsStartMenuOpen((prev) => !prev);

  // Close start menu with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStartMenuOpen) {
        setIsStartMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStartMenuOpen]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    if (newMode === "basic") {
      setIsStartMenuOpen(true);
    }
    try {
      localStorage.setItem("qawmi_app_mode", newMode);
    } catch (e) {
      console.warn("Failed to save mode", e);
    }
    persistPreferencesToServer({ mode: newMode });
  };

  const toggleMode = () => {
    setMode(mode === "basic" ? "advanced" : "basic");
  };

  // Basic Mode tile actions
  const addTile = (id: string) => {
    if (!pinnedTileIds.includes(id)) {
      const next = [...pinnedTileIds, id];
      setPinnedTileIds(next);
      try {
        localStorage.setItem("qawmi_basic_tiles", JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist tiles", e);
      }
      persistPreferencesToServer({ pinnedTileIds: next });
    }
  };

  const removeTile = (id: string) => {
    const next = pinnedTileIds.filter((tId) => tId !== id);
    setPinnedTileIds(next);
    try {
      localStorage.setItem("qawmi_basic_tiles", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist tiles", e);
    }
    persistPreferencesToServer({ pinnedTileIds: next });
  };

  const reorderTiles = (newIds: string[]) => {
    setPinnedTileIds(newIds);
    try {
      localStorage.setItem("qawmi_basic_tiles", JSON.stringify(newIds));
    } catch (e) {
      console.warn("Failed to persist tiles", e);
    }
    persistPreferencesToServer({ pinnedTileIds: newIds });
  };

  const resetTiles = () => {
    setPinnedTileIds(DEFAULT_PINNED_IDS);
    try {
      localStorage.removeItem("qawmi_basic_tiles");
    } catch (e) {
      console.warn("Failed to reset tiles", e);
    }
    persistPreferencesToServer({ pinnedTileIds: null });
  };

  // Advanced Menu Actions
  const saveCustomNavGroups = (groups: any[]) => {
    const sanitized = sanitizeNavGroups(groups);
    setCustomNavGroups(sanitized);
    try {
      localStorage.setItem("qawmi_advanced_nav_groups", JSON.stringify(sanitized));
    } catch (e) {
      console.warn("Failed to save custom nav groups", e);
    }
    persistPreferencesToServer({ customNavGroups: sanitized });
  };

  const resetCustomNavGroups = () => {
    setCustomNavGroups(null);
    try {
      localStorage.removeItem("qawmi_advanced_nav_groups");
    } catch (e) {
      console.warn("Failed to reset custom nav groups", e);
    }
    persistPreferencesToServer({ customNavGroups: null });
  };

  const pinnedTiles = pinnedTileIds
    .map((id) => ALL_BASIC_TILES.find((t) => t.id === id))
    .filter((t): t is BasicTileItem => Boolean(t));

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isStartMenuOpen,
        openStartMenu,
        closeStartMenu,
        toggleStartMenu,
        pinnedTileIds,
        pinnedTiles,
        addTile,
        removeTile,
        reorderTiles,
        resetTiles,
        isCustomizingAdvanced,
        setIsCustomizingAdvanced,
        customNavGroups,
        saveCustomNavGroups,
        resetCustomNavGroups,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within a ModeProvider");
  }
  return context;
}
