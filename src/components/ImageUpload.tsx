"use client";

import { useState, useRef, useCallback } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  Upload,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { CalendarEventInput } from "@/components/CalendarView";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 10;

interface Props {
  categories: string[];
  onEventsExtracted: (events: CalendarEventInput[]) => void;
}

export default function ImageUpload({ categories, onEventsExtracted }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [extractedCount, setExtractedCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError("");
    setExtractedCount(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("仅支持 JPEG、PNG、WebP、GIF 格式");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`图片大小不能超过 ${MAX_SIZE_MB}MB`);
      return;
    }

    setImageMime(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64 || !imageMime) return;

    setIsAnalyzing(true);
    setError("");
    setExtractedCount(null);

    try {
      const res = await fetch("/api/extractImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          mimeType: imageMime,
          categories,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "图片识别失败");
        return;
      }

      const events: CalendarEventInput[] = (data.events || []).map(
        (e: Record<string, unknown>) => ({
          title: e.title as string,
          start: e.start_time as string,
          end: (e.end_time as string) || undefined,
          location: (e.location as string) || undefined,
          category: (e.category as string) || undefined,
          detail: e.detail as string || undefined,
          raw_message_preview: (e.raw_message_preview as string) || undefined,
        })
      );

      if (events.length === 0) {
        setError("未从图片中识别到通知事件");
        return;
      }

      setExtractedCount(events.length);
      onEventsExtracted(events);
    } catch {
      setError("网络请求失败，请重试");
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageBase64, imageMime, categories, onEventsExtracted]);

  const handleClear = useCallback(() => {
    setPreview(null);
    setImageBase64(null);
    setImageMime(null);
    setError("");
    setExtractedCount(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-4">
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all ${
          preview
            ? "border-indigo-300 bg-indigo-50/30"
            : "border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="p-4">
            <div className="relative inline-block w-full">
              <img
                src={preview}
                alt="预览"
                className="mx-auto max-h-64 rounded-xl object-contain shadow-sm"
              />
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">
              点击图片右上角可重新选择
            </p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center py-12 px-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100">
              <ImagePlus className="h-7 w-7 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              点击上传或拖拽图片到此处
            </p>
            <p className="mt-1 text-xs text-gray-400">
              支持 JPEG / PNG / WebP / GIF，最大 {MAX_SIZE_MB}MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200/60">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {extractedCount !== null && !error && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200/60">
          <CheckCircle className="h-4 w-4 shrink-0" />
          成功识别 {extractedCount} 个事件，已添加到日历
        </div>
      )}

      {preview && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              AI 正在识别图片内容...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              识别图片中的通知
            </>
          )}
        </button>
      )}
    </div>
  );
}
