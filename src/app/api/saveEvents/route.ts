import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

interface EventInput {
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
  category?: string;
  detail?: string;
  raw_message_preview?: string;
  user_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json(
        { error: "缺少 events 数组或 events 不是数组" },
        { status: 400 }
      );
    }

    if (body.events.length === 0) {
      return NextResponse.json(
        { error: "events 数组不能为空" },
        { status: 400 }
      );
    }

    const rows: EventInput[] = body.events.map((e: EventInput) => ({
      title: e.title,
      start_time: e.start_time,
      end_time: e.end_time ?? null,
      location: e.location ?? null,
      category: e.category ?? null,
      detail: e.detail ?? null,
      raw_message_preview: e.raw_message_preview ?? null,
      user_id: e.user_id ?? null,
    }));

    const { data, error } = await getSupabaseClient()
      .from("events")
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json(
        { error: "数据库插入失败", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
