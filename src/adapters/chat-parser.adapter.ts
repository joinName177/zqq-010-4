import { ChatMessage, ImportErrorKind } from '../core/models';
import { ChatParserPort } from '../ports/chat-parser.port';

/** 解析失败时抛出的类型化错误，kind 可直接映射到界面错误提示 */
export class ChatParseError extends Error {
  readonly kind: Extract<ImportErrorKind, 'empty-file' | 'no-valid-messages'>;

  constructor(kind: ChatParseError['kind'], message: string) {
    super(message);
    this.name = 'ChatParseError';
    this.kind = kind;
  }
}

export class UniversalChatParserAdapter implements ChatParserPort {
  /**
   * 严格解析入口：空文件与无有效消息时抛出 ChatParseError，
   * 让调用方可以区分失败原因并给出针对性的恢复引导。
   */
  async parseStrict(rawText: string): Promise<ChatMessage[]> {
    if (!rawText || !rawText.trim()) {
      throw new ChatParseError(
        'empty-file',
        '文件内容为空，未检测到任何对话文本。请确认导出的聊天记录文件非空后重新导入。'
      );
    }
    const messages = await this.parse(rawText);
    // 有效消息判定：至少一条消息包含真实文字（任意语言的字母或数字），
    // 防止纯标点 / 纯分隔符 / 二进制乱码文件被当作对话切片
    const hasValidContent = messages.some(m => /[\p{L}\p{N}]/u.test(m.content));
    if (messages.length === 0 || !hasValidContent) {
      throw new ChatParseError(
        'no-valid-messages',
        '未从文件中识别出有效对话记录。请检查文件格式（支持微信 / QQ / 短信导出的文本或 JSON 行格式）后重新导入。'
      );
    }
    return messages;
  }

  async parse(rawText: string): Promise<ChatMessage[]> {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const messages: ChatMessage[] = [];

    // Regex patterns for WeChat, QQ, SMS
    // WeChat: 2023-08-12 21:04:12 张三
    const wechatPattern = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.*?)(?::|：)?$/;
    // QQ: 2023-08-12 21:04:12 张三(123456)
    const qqPattern = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.*?)\(\d+\)$/;
    // SMS / simple: [2023-08-12 21:04] 张三: 内容
    const bracketPattern = /^\[?(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:：]+)[：:](.*)$/;

    let currentSender = '发件人';
    let currentTimestamp = new Date();
    let currentContent: string[] = [];

    const flush = () => {
      if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          messages.push({
            id: `msg-${messages.length + 1}`,
            timestamp: new Date(currentTimestamp),
            sender: currentSender,
            content: text,
            sentimentScore: 0,
            wordCount: text.length
          });
        }
        currentContent = [];
      }
    };

    for (const line of lines) {
      // Check bracket pattern
      const bMatch = line.match(bracketPattern);
      if (bMatch) {
        flush();
        currentTimestamp = new Date(bMatch[1]);
        currentSender = bMatch[2].trim();
        currentContent.push(bMatch[3].trim());
        continue;
      }

      // Check QQ pattern
      const qMatch = line.match(qqPattern);
      if (qMatch) {
        flush();
        currentTimestamp = new Date(qMatch[1]);
        currentSender = qMatch[2].trim();
        continue;
      }

      // Check WeChat header pattern
      const wMatch = line.match(wechatPattern);
      if (wMatch) {
        flush();
        currentTimestamp = new Date(wMatch[1]);
        currentSender = wMatch[2].trim();
        continue;
      }

      // If JSON format
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.content || parsed.message || parsed.text) {
            flush();
            messages.push({
              id: `msg-${messages.length + 1}`,
              timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
              sender: parsed.sender || parsed.user || '未知者',
              content: parsed.content || parsed.message || parsed.text,
              sentimentScore: 0,
              wordCount: (parsed.content || '').length
            });
            continue;
          }
        } catch {
          // not json, continue
        }
      }

      // Otherwise regular dialogue line
      currentContent.push(line);
    }

    flush();

    // If still empty or no timestamps recognized, fallback to sequential mock dates
    if (messages.length === 0 && lines.length > 0) {
      const now = Date.now();
      lines.forEach((line, idx) => {
        const parts = line.split(/[:：]/);
        const sender = parts.length > 1 ? parts[0] : (idx % 2 === 0 ? '挖掘目标A' : '挖掘目标B');
        const content = (parts.length > 1 ? parts.slice(1).join(':') : line).trim();
        // 跳过无实际内容的噪声行（如纯冒号、纯分隔符），保证空垃圾文件不会产出伪消息
        if (!content) return;
        messages.push({
          id: `msg-${messages.length + 1}`,
          timestamp: new Date(now - (lines.length - idx) * 86400000 * 3),
          sender: sender.trim(),
          content,
          sentimentScore: 0,
          wordCount: content.length
        });
      });
    }

    return messages;
  }
}
