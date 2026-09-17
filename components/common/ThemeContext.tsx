"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type QawmiTheme = "light" | "dark" | "sepia";

interface ThemeContextType {
  theme: QawmiTheme;
  setTheme: (theme: QawmiTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<QawmiTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("qawmi_theme") as QawmiTheme;
      if (savedTheme && ["light", "dark", "sepia"].includes(savedTheme)) {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        // Check system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        setThemeState(initial);
        applyTheme(initial);
      }
    } catch {
      applyTheme("light");
    }
    setMounted(true);
  }, []);

  const applyTheme = (t: QawmiTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("theme-light", "theme-dark", "theme-sepia", "dark", "sepia-mode");
    root.removeAttribute("data-theme");

    if (body) {
      body.classList.remove("theme-light", "theme-dark", "theme-sepia", "dark", "sepia-mode");
      body.removeAttribute("data-theme");
    }

    if (t === "dark") {
      root.classList.add("theme-dark", "dark");
      root.setAttribute("data-theme", "dark");
      if (body) {
        body.classList.add("theme-dark", "dark");
        body.setAttribute("data-theme", "dark");
      }
    } else if (t === "sepia") {
      root.classList.add("theme-sepia", "sepia-mode");
      root.setAttribute("data-theme", "sepia");
      if (body) {
        body.classList.add("theme-sepia", "sepia-mode");
        body.setAttribute("data-theme", "sepia");
      }
    } else {
      root.classList.add("theme-light");
      root.setAttribute("data-theme", "light");
      if (body) {
        body.classList.add("theme-light");
        body.setAttribute("data-theme", "light");
      }
    }
  };

  const setTheme = (newTheme: QawmiTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem("qawmi_theme", newTheme);
    } catch {
      // Ignore localStorage error
    }
  };

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("sepia");
    else setTheme("light");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
