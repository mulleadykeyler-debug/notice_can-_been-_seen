import { NextRequest } from "next/server";
import { extractEventsFromText } from "@/lib/extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.text || typeof body.text !== "string") {
      return Response.json(
        { error: "缺少 text 字段或 text 不是字符串" },
        { status: 400 }
      );
    }

    if (!body.text.trim()) {
      return Response.json(
        { error: "文本内容不能为空" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          const events = await extractEventsFromText(
            body.text,
            (current, total) => {
              send({ type: "progress", current, total });
            }
          );

          send({ type: "done", events });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "服务器内部错误";
          send({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
