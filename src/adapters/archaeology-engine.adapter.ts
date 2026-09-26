import { ChatMessage, ArchaeologyReport } from '../core/models';
import { analyzeChatStrata } from '../core/archaeology-engine';
import { ArchaeologyPort } from '../ports/archaeology.port';

/** 安全发掘结果：成功携带报告，失败携带错误，调用方无需 try/catch 裸异常 */
export type ExcavationResult =
  | { ok: true; report: ArchaeologyReport }
  | { ok: false; error: Error };

export class ArchaeologyEngineAdapter implements ArchaeologyPort {
  excavateSite(messages: ChatMessage[], siteName?: string): ArchaeologyReport {
    return analyzeChatStrata(messages, siteName);
  }

  /**
   * 安全发掘入口：空消息或引擎异常时返回失败结果而不是抛出异常，
   * 让 UI 可以统一回落到默认空白报告并展示错误提示。
   */
  tryExcavateSite(messages: ChatMessage[], siteName?: string): ExcavationResult {
    if (!messages || messages.length === 0) {
      return { ok: false, error: new Error('聊天记录为空，无法进行地层切片勘探') };
    }
    try {
      return { ok: true, report: analyzeChatStrata(messages, siteName) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
