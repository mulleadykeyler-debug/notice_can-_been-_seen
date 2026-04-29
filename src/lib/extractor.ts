import { createHash } from "crypto";

export interface ExtractedEvent {
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string;
  detail: string;
  is_notification: boolean;
}

export type ProgressCallback = (current: number, total: number) => void;

function buildSystemPrompt(categories: string[]): string {
  const catList = categories.join("、");
  return `你是一个专门从大学生相关文本中提取通知事件的助手。
我会给你一段文本（可能是群聊消息、公众号推文、课程通知、活动公告等）。
请分析文本内容，并以 JSON 对象返回所有识别为通知的事件。
返回格式为 {"events": [...]}

每个事件包含以下字段：

title: 简短通知标题

start_time: ISO 8601 格式的开始时间，结合文本中的时间信息推算（如"明天下午3点"应推算到具体日期时间，默认时区为 Asia/Shanghai）。如果文本中有明确日期则直接使用，如果没有则根据上下文推断，若实在无法确定则留空。

end_time: 结束时间，若通知没有结束时间则留空

location: 地点，没有则留空

category: 类别，仅限以下：${catList}

detail: 补充细节或原始通知摘要

is_notification: true/false，表示是否为有效通知

注意：

仅返回 is_notification 为 true 的条目。

如果文本不是通知（闲聊、表情、没有时间地点类信息），直接返回空数组。

一条文本中包含多个通知的话，拆分为多个事件。

无论如何只返回 JSON，不要带其他文字。

作为示例：
文本：'语'你同行，"寝"焕一新 —— 外国语学院寝室卫生劳育活动通知。活动时间：2026-04-22至 2026-05-14。参与方式：1、报名：寝室的同学们登录【校园活动通】，搜索活动名称完成报名。2、预约：联系本年级助理或导生，预约上门查看时间。3、整理：对照《电子科技大学学生寝室安全卫生检查标准》，完成寝室全面清洁与安全隐患自查。4、提交照片并等待查看。奖励：完成即得：2个劳动学时 + 1盆绿植/寝室
输出：
{"events":[{"title":"寝室卫生劳育活动","start_time":"2026-04-22T00:00:00+08:00","end_time":"2026-05-14T23:59:59+08:00","location":"","category":"生活","detail":"外国语学院寝室卫生劳育活动，需报名、预约、整理、提交照片，完成后得2个劳动学时+1盆绿植","is_notification":true}]}

文本：哈哈哈昨天那节课笑死了
输出：
{"events":[]}`;
}

const cache = new Map<string, ExtractedEvent[]>();

function hashText(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

async function callDeepSeekAPI(
  userContent: string,
  categories: string[],
  retries: number = 2
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: buildSystemPrompt(categories) },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API 请求失败 (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("DeepSeek API 返回内容为空");
      }

      return content;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
    }
  }

  throw new Error("DeepSeek API 调用失败，已重试 2 次");
}

function parseEvents(rawContent: string): ExtractedEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`DeepSeek 返回内容不是有效 JSON: ${rawContent}`);
  }

  let events: ExtractedEvent[];

  if (Array.isArray(parsed)) {
    events = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).events)) {
    events = (parsed as Record<string, unknown>).events as ExtractedEvent[];
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).data)) {
    events = (parsed as Record<string, unknown>).data as ExtractedEvent[];
  } else {
    throw new Error(`DeepSeek 返回 JSON 格式不符合预期: ${rawContent}`);
  }

  return events.filter((e) => e.is_notification === true);
}

export async function extractEventsFromText(
  text: string,
  categories: string[] = ["学术", "行政", "社团活动", "生活", "其他"],
  onProgress?: ProgressCallback
): Promise<ExtractedEvent[]> {
  if (!text.trim()) {
    return [];
  }

  const MAX_CHUNK = 3000;
  const chunks: string[] = [];

  if (text.length <= MAX_CHUNK) {
    chunks.push(text);
  } else {
    for (let i = 0; i < text.length; i += MAX_CHUNK) {
      chunks.push(text.slice(i, i + MAX_CHUNK));
    }
  }

  const allEvents: ExtractedEvent[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);

    const chunk = chunks[i];
    const cacheKey = hashText(chunk);

    const cached = cache.get(cacheKey);
    if (cached) {
      allEvents.push(...cached);
      continue;
    }

    const rawContent = await callDeepSeekAPI(chunk, categories);
    const events = parseEvents(rawContent);

    cache.set(cacheKey, events);
    allEvents.push(...events);
  }

  const seen = new Set<string>();
  return allEvents.filter((e) => {
    const key = `${e.title}::${e.start_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildImageSystemPrompt(categories: string[]): string {
  const catList = categories.join("、");
  return `你是一个专门从图片中提取通知事件的助手。
我会给你一张图片（可能是课程表、活动海报、通知截图、会议纪要等）。
请仔细识别图片中的所有文字和关键信息，并以 JSON 对象返回所有识别为通知的事件。
返回格式为 {"events": [...]}

每个事件包含以下字段：

title: 简短通知标题

start_time: ISO 8601 格式的开始时间，结合图片中的时间信息推算（默认时区为 Asia/Shanghai）。如果图片中有明确日期则直接使用，如果没有则根据上下文推断，若实在无法确定则留空。

end_time: 结束时间，若通知没有结束时间则留空

location: 地点，没有则留空

category: 类别，仅限以下：${catList}

detail: 补充细节或原始通知摘要

is_notification: true/false，表示是否为有效通知

注意：

仅返回 is_notification 为 true 的条目。

如果图片中不包含通知信息（纯风景照、个人照片等），直接返回空数组。

一张图片中包含多个通知的话，拆分为多个事件。

无论如何只返回 JSON，不要带其他文字。`;
}

export async function extractEventsFromImage(
  base64Image: string,
  mimeType: string,
  categories: string[] = ["学术", "行政", "社团活动", "生活", "其他"]
): Promise<ExtractedEvent[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: buildImageSystemPrompt(categories) },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: "请识别这张图片中的所有通知事件信息。",
          },
        ],
      },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API 请求失败 (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("DeepSeek API 返回内容为空");
      }

      return parseEvents(content);
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  throw new Error("DeepSeek 图片识别调用失败，已重试 2 次");
}
