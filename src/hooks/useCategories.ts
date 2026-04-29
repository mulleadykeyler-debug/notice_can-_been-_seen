"use client";

import { useState, useCallback, useEffect } from "react";

export interface Category {
  name: string;
  color: string;
}

const STORAGE_KEY = "schedule-app-categories";

const DEFAULT_CATEGORIES: Category[] = [
  { name: "学术", color: "#3b82f6" },
  { name: "行政", color: "#ef4444" },
  { name: "社团活动", color: "#22c55e" },
  { name: "生活", color: "#eab308" },
  { name: "其他", color: "#6b7280" },
];

const PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#e11d48",
  "#84cc16",
  "#a855f7",
  "#0891b2",
  "#d946ef",
];

function pickUnusedColor(existing: Category[]): string {
  const used = new Set(existing.map((c) => c.color));
  for (const c of PALETTE) {
    if (!used.has(c)) return c;
  }
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Category[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  const save = useCallback((next: Category[]) => {
    setCategories(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (categories.some((c) => c.name === trimmed)) return;
      const color = pickUnusedColor(categories);
      save([...categories, { name: trimmed, color }]);
    },
    [categories, save]
  );

  const removeCategory = useCallback(
    (name: string) => {
      if (name === "其他") return;
      save(categories.filter((c) => c.name !== name));
    },
    [categories, save]
  );

  const updateCategory = useCallback(
    (oldName: string, updates: Partial<Category>) => {
      save(
        categories.map((c) =>
          c.name === oldName
            ? { ...c, ...updates, name: updates.name?.trim() || c.name }
            : c
        )
      );
    },
    [categories, save]
  );

  const categoryNames = categories.map((c) => c.name);

  const getColor = useCallback(
    (name?: string): string => {
      return categories.find((c) => c.name === name)?.color || "#6b7280";
    },
    [categories]
  );

  return {
    categories,
    categoryNames,
    loaded,
    addCategory,
    removeCategory,
    updateCategory,
    getColor,
  };
}
