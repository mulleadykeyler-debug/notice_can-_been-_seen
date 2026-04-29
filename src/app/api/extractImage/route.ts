import { NextRequest } from "next/server";
import { extractEventsFromImage } from "@/lib/extractor";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.image || typeof body.image !== "string") {
      return Response.json(
        { error: "缺少 image 字段或 image 不是字符串" },
        { status: 400 }
      );
    }

    if (!body.mimeType || typeof body.mimeType !== "string") {
      return Response.json(
        { error: "缺少 mimeType 字段" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(body.mimeType)) {
      return Response.json(
        { error: "不支持的图片格式，仅支持 JPEG、PNG、WebP、GIF" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(body.image, "base64");
    if (buffer.length > MAX_IMAGE_SIZE) {
      return Response.json(
        { error: "图片大小不能超过 10MB" },
        { status: 400 }
      );
    }

    const categories = Array.isArray(body.categories)
      ? body.categories
      : ["学术", "行政", "社团活动", "生活", "其他"];

    const events = await extractEventsFromImage(
      body.image,
      body.mimeType,
      categories
    );

    return Response.json({ events });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
