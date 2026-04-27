export interface ParsedRecord {
  datetime: string;
  sender: string;
  content: string;
}

export function parseWechatLog(text: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  const lines = text.split("\n");
  let currentRecord: Partial<ParsedRecord> | null = null;
  let contentLines: string[] = [];

  const linePattern =
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)(?:\([^)]*\))?\s*[:：]\s*(.*)$/;
  const headerPattern =
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)(?:\([^)]*\))?$/;

  const flushRecord = () => {
    if (currentRecord?.datetime && currentRecord?.sender) {
      const content = contentLines.join("\n").trim();
      if (content) {
        records.push({
          datetime: currentRecord.datetime,
          sender: currentRecord.sender,
          content,
        });
      }
    }
    currentRecord = null;
    contentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lineMatch = trimmed.match(linePattern);
    if (lineMatch) {
      flushRecord();
      currentRecord = {
        datetime: lineMatch[1],
        sender: lineMatch[2],
      };
      if (lineMatch[3]) {
        contentLines = [lineMatch[3]];
      }
      continue;
    }

    const headerMatch = trimmed.match(headerPattern);
    if (headerMatch) {
      flushRecord();
      currentRecord = {
        datetime: headerMatch[1],
        sender: headerMatch[2],
      };
      continue;
    }

    if (currentRecord) {
      contentLines.push(trimmed);
    }
  }

  flushRecord();
  return records;
}
