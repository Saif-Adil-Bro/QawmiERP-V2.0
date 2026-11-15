"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ALL_BASIC_TILES, BasicTileItem } from "./menuCatalog";
import { sanitizeNavGroups } from "./defaultNavData";
import { createClient } from "@/lib/supabase/client";

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

const ModeContext = createContext<ModeContextType | undefined>(undefined);

function persistModeCookie(newMode: AppMode) {
  try {
    document.cookie = `qawmi_app_mode=${newMode}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie errors
  }
}

export function ModeProvider({
  children,
  initialMode = "advanced",
}: {
  children: React.ReactNode;
  initialMode?: AppMode;
}) {
  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [pinnedTileIds, setPinnedTileIds] = useState<string[]>(DEFAULT_PINNED_IDS);
  const [isCustomizingAdvanced, setIsCustomizingAdvanced] = useState<boolean>(false);
  const [customNavGroups, setCustomNavGroups] = useState<any[] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState<boolean>(false);

  // Load saved preferences on mount and sync with Supabase user_metadata
  useEffect(() => {
    setIsMounted(true);
    let activeMode: AppMode = initialMode;

    try {
      const savedMode = localStorage.getItem("qawmi_app_mode") as AppMode;
      if (savedMode === "basic" || savedMode === "advanced") {
        activeMode = savedMode;
        setModeState(savedMode);
        persistModeCookie(savedMode);
      }

      const savedStartOpen = localStorage.getItem("qawmi_start_menu_open");
      if (activeMode === "basic" && savedStartOpen === "true") {
        setIsStartMenuOpen(true);
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

    // Sync from Supabase user_metadata (cross-device persistence)
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        const remoteMode = data?.user?.user_metadata?.app_mode;
        if (remoteMode === "basic" || remoteMode === "advanced") {
          setModeState(remoteMode);
          try {
            localStorage.setItem("qawmi_app_mode", remoteMode);
            persistModeCookie(remoteMode);
          } catch {}
        }
      }).catch(() => {});
    } catch {
      // Ignore auth sync errors
    }
  }, [initialMode]);

  const openStartMenu = () => {
    setIsStartMenuOpen(true);
    try {
      localStorage.setItem("qawmi_start_menu_open", "true");
    } catch {}
  };

  const closeStartMenu = () => {
    setIsStartMenuOpen(false);
    try {
      localStorage.setItem("qawmi_start_menu_open", "false");
    } catch {}
  };

  const toggleStartMenu = () => {
    setIsStartMenuOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("qawmi_start_menu_open", String(next));
      } catch {}
      return next;
    });
  };

  // Close start menu with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStartMenuOpen) {
        closeStartMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStartMenuOpen]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    if (newMode === "basic") {
      openStartMenu();
    } else {
      closeStartMenu();
    }
    try {
      localStorage.setItem("qawmi_app_mode", newMode);
    } catch (e) {
      console.warn("Failed to save mode", e);
    }
    persistModeCookie(newMode);

    // Persist to Supabase user_metadata so it stays saved across devices & sessions
    try {
      const supabase = createClient();
      supabase.auth.updateUser({ data: { app_mode: newMode } }).catch(() => {});
    } catch {
      // Ignore remote sync error
    }
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
  };

  const reorderTiles = (newIds: string[]) => {
    setPinnedTileIds(newIds);
    try {
      localStorage.setItem("qawmi_basic_tiles", JSON.stringify(newIds));
    } catch (e) {
      console.warn("Failed to persist tiles", e);
    }
  };

  const resetTiles = () => {
    setPinnedTileIds(DEFAULT_PINNED_IDS);
    try {
      localStorage.removeItem("qawmi_basic_tiles");
    } catch (e) {
      console.warn("Failed to reset tiles", e);
    }
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
  };

  const resetCustomNavGroups = () => {
    setCustomNavGroups(null);
    try {
      localStorage.removeItem("qawmi_advanced_nav_groups");
    } catch (e) {
      console.warn("Failed to reset custom nav groups", e);
    }
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
