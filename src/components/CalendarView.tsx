"use client";

import { useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  X,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  Filter,
  ChevronUp,
  MapPin,
  Clock,
  FileText,
} from "lucide-react";

export interface CalendarEventInput {
  id?: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  category?: string;
  detail?: string;
  raw_message_preview?: string;
}

export interface CalendarCategory {
  name: string;
  color: string;
}

function getCategoryBgStyle(color: string): string {
  return `${color}20`;
}

function getCategoryTextStyle(color: string): string {
  return color;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai",
    });
  } catch {
    return iso;
  }
}

function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

interface EditFormData {
  title: string;
  start: string;
  end: string;
  location: string;
  category: string;
  detail: string;
}

export default function CalendarView({
  events,
  onEventsChange,
  categories,
  onManageCategories,
}: {
  events: CalendarEventInput[];
  onEventsChange?: (events: CalendarEventInput[]) => void;
  categories: CalendarCategory[];
  onManageCategories?: () => void;
}) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.name))
  );
  const [showFilter, setShowFilter] = useState(false);
  const [modalData, setModalData] = useState<CalendarEventInput | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: "",
    start: "",
    end: "",
    location: "",
    category: "",
    detail: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const colorMap = new Map(categories.map((c) => [c.name, c.color]));
  const defaultColor = "#6b7280";
  const getColor = (name?: string) => colorMap.get(name || "") || defaultColor;

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const filteredEvents = events.filter(
    (e) => selectedCategories.has(e.category || "其他")
  );

  const calendarEvents = filteredEvents.map((e) => ({
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    backgroundColor: getColor(e.category),
    borderColor: getColor(e.category),
    extendedProps: {
      id: e.id,
      location: e.location,
      category: e.category,
      detail: e.detail,
      raw_message_preview: e.raw_message_preview,
    },
  }));

  const openModal = useCallback((ev: CalendarEventInput) => {
    setModalData(ev);
    setIsEditing(false);
    setEditForm({
      title: ev.title,
      start: toDatetimeLocal(ev.start),
      end: ev.end ? toDatetimeLocal(ev.end) : "",
      location: ev.location || "",
      category: ev.category || "其他",
      detail: ev.detail || "",
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalData(null);
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!modalData) return;
    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        start_time: editForm.start
          ? new Date(editForm.start).toISOString()
          : modalData.start,
        end_time: editForm.end
          ? new Date(editForm.end).toISOString()
          : null,
        location: editForm.location || null,
        category: editForm.category,
        detail: editForm.detail || null,
      };

      if (modalData.id) {
        payload.id = modalData.id;
        const res = await fetch("/api/updateEvent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "更新失败");
        }
      }

      const updated: CalendarEventInput = {
        ...modalData,
        title: editForm.title,
        start: editForm.start
          ? new Date(editForm.start).toISOString()
          : modalData.start,
        end: editForm.end
          ? new Date(editForm.end).toISOString()
          : undefined,
        location: editForm.location || undefined,
        category: editForm.category,
        detail: editForm.detail || undefined,
      };

      if (onEventsChange) {
        onEventsChange(
          events.map((e) => (e === modalData ? updated : e))
        );
      }

      setModalData(updated);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [modalData, editForm, events, onEventsChange]);

  const handleDelete = useCallback(async () => {
    if (!modalData) return;
    if (!confirm("确定删除此事件？")) return;

    setIsSaving(true);

    try {
      if (modalData.id) {
        const res = await fetch("/api/deleteEvent", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: modalData.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "删除失败");
        }
      }

      if (onEventsChange) {
        onEventsChange(events.filter((e) => e !== modalData));
      }

      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsSaving(false);
    }
  }, [modalData, events, onEventsChange, closeModal]);

  return (
    <div className="flex gap-5">
      <div className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">分类筛选</h3>
              <button
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() =>
                  setSelectedCategories(
                    selectedCategories.size === categories.length
                      ? new Set()
                      : new Set(categories.map((c) => c.name))
                  )
                }
              >
                {selectedCategories.size === categories.length
                  ? "全不选"
                  : "全选"}
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => (
                <label
                  key={cat.name}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <button
                    className="flex-shrink-0"
                    onClick={() => toggleCategory(cat.name)}
                  >
                    {selectedCategories.has(cat.name) ? (
                      <CheckSquare
                        className="h-4 w-4"
                        style={{ color: cat.color }}
                      />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300" />
                    )}
                  </button>
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    {cat.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
              显示 {filteredEvents.length}/{events.length} 个事件
            </div>
            {onManageCategories && (
              <button
                className="mt-2 w-full text-xs text-blue-600 hover:text-blue-800 py-1"
                onClick={onManageCategories}
              >
                + 管理分类
              </button>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ring-1 ring-blue-200/60">
            <p className="text-xs text-blue-600/80 leading-relaxed">
              💡 点击日历中的事件可查看详情，支持编辑和删除操作
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        <div className="lg:hidden">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="h-4 w-4" />
            分类筛选
            {selectedCategories.size < categories.length && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                {filteredEvents.length}/{events.length}
              </span>
            )}
            <ChevronUp
              className={`h-4 w-4 transition-transform ${showFilter ? "" : "rotate-180"}`}
            />
          </button>

          {showFilter && (
            <div className="mt-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <label
                    key={cat.name}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <button onClick={() => toggleCategory(cat.name)}>
                      {selectedCategories.has(cat.name) ? (
                        <CheckSquare
                          className="h-4 w-4"
                          style={{ color: cat.color }}
                        />
                      ) : (
                        <Square className="h-4 w-4 text-gray-300" />
                      )}
                    </button>
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm text-gray-700">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/60 sm:p-4 lg:p-5 overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: "今天",
              month: "月",
              week: "周",
              day: "日",
            }}
            events={calendarEvents}
            height="auto"
            locale="zh-cn"
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              const props = info.event.extendedProps;
              const original = filteredEvents.find(
                (e) =>
                  e.title === info.event.title &&
                  e.start === info.event.startStr
              );
              if (original) {
                openModal(original);
              } else {
                openModal({
                  id: props.id,
                  title: info.event.title,
                  start: info.event.startStr,
                  end: info.event.endStr || undefined,
                  location: props.location,
                  category: props.category,
                  detail: props.detail,
                  raw_message_preview: props.raw_message_preview,
                });
              }
            }}
            dayMaxEvents={4}
            eventDisplay="block"
          />
        </div>

        <div className="hidden lg:block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              事件列表
              <span className="ml-1.5 text-gray-400 font-normal">
                ({filteredEvents.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredEvents.map((ev, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-white p-3.5 cursor-pointer hover:border-gray-200 hover:shadow-md transition-all group"
                onClick={() => openModal(ev)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {ev.title}
                  </span>
                  {ev.category && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: getCategoryBgStyle(getColor(ev.category)), color: getCategoryTextStyle(getColor(ev.category)) }}
                    >
                      {ev.category}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(ev.start)}
                  </span>
                  {ev.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.location}
                    </span>
                  )}
                </div>
                {ev.detail && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">
                    {ev.detail}
                  </p>
                )}
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="col-span-2 rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-400">
                当前筛选条件下没有事件
              </div>
            )}
          </div>
        </div>

        <div className="lg:hidden space-y-2">
          <h2 className="text-sm font-medium text-gray-500 px-1">
            事件列表 ({filteredEvents.length})
          </h2>
          <div className="max-h-[40vh] space-y-2 overflow-y-auto">
            {filteredEvents.map((ev, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-100 bg-white p-3 cursor-pointer hover:border-gray-200 hover:shadow-sm transition-shadow"
                onClick={() => openModal(ev)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {ev.title}
                  </span>
                  {ev.category && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: getCategoryBgStyle(getColor(ev.category)), color: getCategoryTextStyle(getColor(ev.category)) }}
                    >
                      {ev.category}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span>{formatDateTime(ev.start)}</span>
                  {ev.location && <span>📍 {ev.location}</span>}
                </div>
                {ev.detail && (
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                    {ev.detail}
                  </p>
                )}
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-400">
                当前筛选条件下没有事件
              </div>
            )}
          </div>
        </div>
      </div>

      {modalData && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="w-full sm:max-w-md lg:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              {isEditing ? (
                <input
                  className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-1 flex-1 mr-2 focus:outline-none focus:border-blue-500"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              ) : (
                <h3 className="text-lg font-bold text-gray-900">
                  {modalData.title}
                </h3>
              )}
              <div className="flex items-center gap-1">
                {!isEditing && (
                  <button
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    onClick={() => setIsEditing(true)}
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {!isEditing && (
                  <button
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    onClick={handleDelete}
                    disabled={isSaving}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  onClick={closeModal}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      分类
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        开始时间
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editForm.start}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, start: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        结束时间
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editForm.end}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, end: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      地点
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={editForm.location}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          location: e.target.value,
                        }))
                      }
                      placeholder="可选"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      详情
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      rows={3}
                      value={editForm.detail}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, detail: e.target.value }))
                      }
                      placeholder="可选"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "保存中..." : "保存"}
                    </button>
                    <button
                      className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                      onClick={() => setIsEditing(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {modalData.category && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: getCategoryBgStyle(getColor(modalData.category)), color: getCategoryTextStyle(getColor(modalData.category)) }}
                      >
                        {modalData.category}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3 items-start">
                      <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span className="text-gray-800">
                        {formatDateTime(modalData.start)}
                        {modalData.end &&
                          ` → ${formatDateTime(modalData.end)}`}
                      </span>
                    </div>
                    {modalData.location && (
                      <div className="flex gap-3 items-start">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span className="text-gray-800">
                          {modalData.location}
                        </span>
                      </div>
                    )}
                    {modalData.detail && (
                      <div className="flex gap-3 items-start">
                        <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span className="text-gray-800">
                          {modalData.detail}
                        </span>
                      </div>
                    )}
                    {modalData.raw_message_preview && (
                      <div className="rounded-lg bg-gray-50 p-3 mt-2">
                        <p className="text-xs text-gray-400 mb-1">原文预览</p>
                        <p className="text-xs text-gray-500 italic">
                          {modalData.raw_message_preview}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    className="mt-2 w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    onClick={closeModal}
                  >
                    关闭
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
