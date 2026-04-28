"use client";

import { useState, useCallback } from "react";
import {
  Send,
  X,
  Loader2,
  Calendar,
  ClipboardList,
  Sparkles,
  Filter,
  Zap,
  Brain,
  Target,
  Layers,
} from "lucide-react";
import CalendarView from "@/components/CalendarView";
import type { CalendarEventInput } from "@/components/CalendarView";

type ViewMode = "upload" | "calendar";

const EMOJI_REGEX =
  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+$/u;
const SHORT_TEXT_THRESHOLD = 5;

function preFilterText(text: string): string {
  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length < SHORT_TEXT_THRESHOLD) return false;
    if (EMOJI_REGEX.test(trimmed)) return false;
    return true;
  });
  return filtered.join("\n");
}

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventInput[]>(
    []
  );
  const [extractError, setExtractError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filteredText = rawText ? preFilterText(rawText) : "";
  const filteredCount = rawText
    ? rawText.split("\n").filter((l) => l.trim()).length -
      filteredText.split("\n").filter((l) => l.trim()).length
    : 0;

  const handleExtract = useCallback(async () => {
    if (!rawText.trim()) return;

    const textToSend = preFilterText(rawText);
    if (!textToSend.trim()) {
      setExtractError("过滤后无有效内容，请粘贴包含通知信息的文本");
      return;
    }

    setIsLoading(true);
    setExtractError("");
    setProgress({ current: 0, total: 0 });

    try {
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });

      const contentType = extractRes.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = extractRes.body?.getReader();
        if (!reader) throw new Error("无法读取流");

        const decoder = new TextDecoder();
        let buffer = "";
        let events: CalendarEventInput[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "progress") {
                setProgress({ current: data.current, total: data.total });
              } else if (data.type === "done") {
                events = (data.events || []).map(
                  (e: Record<string, unknown>) => ({
                    title: e.title as string,
                    start: e.start_time as string,
                    end: (e.end_time as string) || undefined,
                    location: (e.location as string) || undefined,
                    category: (e.category as string) || undefined,
                    detail: (e.detail as string) || undefined,
                    raw_message_preview:
                      (e.raw_message_preview as string) || undefined,
                  })
                );
              } else if (data.type === "error") {
                setExtractError(data.error || "提取失败");
                return;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        if (events.length === 0) {
          setExtractError("未识别到任何通知事件");
          return;
        }

        try {
          await fetch("/api/saveEvents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
          });
        } catch {}

        setCalendarEvents((prev) => {
          const existing = new Set(prev.map((e) => `${e.title}::${e.start}`));
          const newEvents = events.filter(
            (e) => !existing.has(`${e.title}::${e.start}`)
          );
          return [...prev, ...newEvents];
        });
        setViewMode("calendar");
      } else {
        const extractData = await extractRes.json();

        if (!extractRes.ok) {
          setExtractError(extractData.error || "提取失败");
          return;
        }

        const events: CalendarEventInput[] = (extractData.events || []).map(
          (e: Record<string, unknown>) => ({
            title: e.title as string,
            start: e.start_time as string,
            end: (e.end_time as string) || undefined,
            location: (e.location as string) || undefined,
            category: (e.category as string) || undefined,
            detail: (e.detail as string) || undefined,
            raw_message_preview: (e.raw_message_preview as string) || undefined,
          })
        );

        if (events.length === 0) {
          setExtractError("未识别到任何通知事件");
          return;
        }

        try {
          await fetch("/api/saveEvents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
          });
        } catch {}

        setCalendarEvents((prev) => {
          const existing = new Set(prev.map((e) => `${e.title}::${e.start}`));
          const newEvents = events.filter(
            (e) => !existing.has(`${e.title}::${e.start}`)
          );
          return [...prev, ...newEvents];
        });
        setViewMode("calendar");
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [rawText]);

  const handleClear = useCallback(() => {
    setRawText("");
    setExtractError("");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="sticky top-0 z-40 border-b border-gray-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 lg:h-10 lg:w-10">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent lg:text-xl">
                通知事件提取
              </h1>
              <p className="hidden text-xs text-gray-400 sm:block">
                AI 智能识别 · 一键日历
              </p>
            </div>
          </div>
          <div className="flex rounded-xl bg-gray-100/80 p-1 ring-1 ring-gray-200/60">
            <button
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all lg:px-4 lg:py-2 ${
                viewMode === "upload"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("upload")}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">文本分析</span>
            </button>
            <button
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all lg:px-4 lg:py-2 ${
                viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">日历视图</span>
              {calendarEvents.length > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                  {calendarEvents.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {viewMode === "calendar" ? (
          calendarEvents.length > 0 ? (
            <CalendarView
              events={calendarEvents}
              onEventsChange={setCalendarEvents}
            />
          ) : (
            <div className="animate-slide-up flex min-h-[60vh] items-center justify-center">
              <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-white/60 p-12 text-center backdrop-blur-sm lg:p-16">
                <div className="animate-float inline-block">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100">
                    <Calendar className="h-8 w-8 text-indigo-400" />
                  </div>
                </div>
                <p className="text-base font-medium text-gray-600">
                  暂无事件
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  粘贴文本，让 AI 帮你提取通知
                </p>
                <button
                  className="mt-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-105"
                  onClick={() => setViewMode("upload")}
                >
                  开始分析
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="animate-slide-up grid gap-6 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl bg-white/80 p-5 shadow-lg shadow-gray-200/50 ring-1 ring-gray-200/60 backdrop-blur-sm lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
                      <ClipboardList className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">
                      粘贴通知文本
                    </h2>
                  </div>
                  {rawText && (
                    <button
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      onClick={handleClear}
                    >
                      <X className="h-3.5 w-3.5" />
                      清除
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    className="w-full rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50/80 to-white p-4 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 resize-none transition-all lg:text-sm"
                    rows={14}
                    placeholder={
                      "粘贴群聊通知、公众号推文、课程通知等文本内容...\n\nAI 会自动识别其中的时间、地点、类别等事件信息。"
                    }
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setExtractError("");
                    }}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full border-4 border-blue-100" />
                          <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700">
                            {progress.total > 0
                              ? `正在分析第 ${progress.current}/${progress.total} 批…`
                              : "AI 分析中…"}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            请稍候，正在提取通知事件
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {rawText && (
                      <>
                        <span className="text-xs text-gray-400">
                          {rawText.length} 字
                        </span>
                        {filteredCount > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 ring-1 ring-amber-200/60">
                            <Filter className="h-3 w-3" />
                            已过滤 {filteredCount} 条无效行
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {filteredText && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Zap className="h-3 w-3" />
                      {filteredText.split("\n").filter((l) => l.trim()).length}{" "}
                      行待分析
                    </span>
                  )}
                </div>
              </div>

              {extractError && (
                <div className="animate-slide-up rounded-xl bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200/60">
                  <span className="font-medium">⚠</span> {extractError}
                </div>
              )}

              <button
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-blue-500/25 overflow-hidden"
                onClick={handleExtract}
                disabled={!rawText.trim() || isLoading}
              >
                {!isLoading && (
                  <div className="absolute inset-0 animate-shimmer" />
                )}
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progress.total > 0
                      ? `正在分析第 ${progress.current}/${progress.total} 批…`
                      : "AI 分析中…"}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    分析通知
                  </>
                )}
              </button>

              {calendarEvents.length > 0 && viewMode === "upload" && (
                <div className="animate-slide-up rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4 ring-1 ring-emerald-200/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
                        <Calendar className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">
                          已有 {calendarEvents.length} 个事件
                        </p>
                        <p className="text-xs text-emerald-600">
                          新分析的事件将追加到日历
                        </p>
                      </div>
                    </div>
                    <button
                      className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
                      onClick={() => setViewMode("calendar")}
                    >
                      查看日历
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:col-span-2 lg:block">
              <div className="sticky top-20 space-y-4">
                <div className="rounded-2xl bg-white/80 p-5 shadow-lg shadow-gray-200/50 ring-1 ring-gray-200/60 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    使用指南
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <ClipboardList className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          粘贴文本
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          从群聊、公众号、课程通知中复制文本内容
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                        <Brain className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          AI 智能提取
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          自动识别时间、地点、类别，过滤无效消息
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                        <Target className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          日历管理
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          事件自动归类，支持编辑、删除、分类筛选
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 p-5 shadow-lg shadow-gray-200/50 ring-1 ring-gray-200/60 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    支持的文本类型
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "群聊通知",
                      "课程安排",
                      "会议纪要",
                      "活动公告",
                      "考试通知",
                      "作业提醒",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-500 ring-1 ring-gray-200/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-5 ring-1 ring-blue-200/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700">
                      智能过滤
                    </span>
                  </div>
                  <p className="text-xs text-blue-600/80 leading-relaxed">
                    自动过滤表情、短消息等无效内容，只将候选通知发送给
                    AI，提升分析速度与准确度。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
