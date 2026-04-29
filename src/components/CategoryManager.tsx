"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import type { Category } from "@/hooks/useCategories";

const COLOR_PALETTE = [
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
];

interface Props {
  categories: Category[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onUpdateColor: (name: string, color: string) => void;
  onClose: () => void;
}

export default function CategoryManager({
  categories,
  onAdd,
  onRemove,
  onUpdateColor,
  onClose,
}: Props) {
  const [newName, setNewName] = useState("");
  const [editingColor, setEditingColor] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name === trimmed)) return;
    onAdd(trimmed);
    setNewName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">管理分类</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="输入新分类名称"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 group hover:bg-gray-50 transition-colors"
            >
              <div className="relative">
                <button
                  className="h-6 w-6 rounded-full ring-2 ring-white shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: cat.color }}
                  onClick={() =>
                    setEditingColor(editingColor === cat.name ? null : cat.name)
                  }
                />
                {editingColor === cat.name && (
                  <div className="absolute top-8 left-0 z-10 rounded-xl bg-white p-3 shadow-xl ring-1 ring-gray-200 grid grid-cols-6 gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        className="h-6 w-6 rounded-full ring-1 ring-gray-200 hover:scale-110 transition-transform flex items-center justify-center"
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          onUpdateColor(cat.name, c);
                          setEditingColor(null);
                        }}
                      >
                        {cat.color === c && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700">
                {cat.name}
              </span>
              {cat.name !== "其他" && (
                <button
                  onClick={() => onRemove(cat.name)}
                  className="rounded-lg p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          删除分类后，已关联的事件将归入&ldquo;其他&rdquo;
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
}
