import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "缺少事件 id" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      "title",
      "start_time",
      "end_time",
      "location",
      "category",
      "detail",
      "raw_message_preview",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseClient()
      .from("events")
      .update(updates)
      .eq("id", body.id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: "更新失败", detail: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "未找到该事件" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
