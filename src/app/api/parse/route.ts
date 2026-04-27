import { NextRequest, NextResponse } from "next/server";
import { parseWechatLog } from "@/utils/parseChat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "缺少 text 字段或 text 不是字符串" },
        { status: 400 }
      );
    }

    if (body.text.trim().length === 0) {
      return NextResponse.json(
        { error: "text 字段不能为空" },
        { status: 400 }
      );
    }

    const records = parseWechatLog(body.text);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "未能解析出任何聊天记录，请检查文本格式" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: records });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
